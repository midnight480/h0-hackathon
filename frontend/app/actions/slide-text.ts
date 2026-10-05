'use server'

import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { withDb } from '@/lib/db'
import type { SlideBlock } from '@/lib/data'

const translate = new TranslateClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
})

// 数字・記号・空白のみ（翻訳しても意味がない）。処理 Lambda と同じルール。
const NON_TRANSLATABLE_RE = /^[\d\W_]+$/

// 1テキストを複数言語へ翻訳。個別の失敗は原文フォールバック（Lambda と同じ方針）。
async function translateToTargets(
  text: string,
  targetLanguages: string[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    targetLanguages.map(async (lang): Promise<[string, string]> => {
      const trimmed = text.trim()
      if (!trimmed || NON_TRANSLATABLE_RE.test(trimmed)) return [lang, text]
      try {
        const res = await translate.send(
          new TranslateTextCommand({
            Text: text.slice(0, 10_000),
            SourceLanguageCode: 'auto',
            TargetLanguageCode: lang,
          }),
        )
        return [lang, res.TranslatedText ?? text]
      } catch {
        return [lang, text]
      }
    }),
  )
  return Object.fromEntries(entries)
}

export type UpdateSlideTextResult =
  | { ok: true }
  | { ok: false; code: 'notFound' | 'blockMismatch' | 'invalidInput' }

// 所有者がスライドの抽出テキストを訂正し、target_languages へ再翻訳して保存する。
// blocks 指定時: layout の各ブロックの t.original を更新し、ブロック単位で再翻訳。
// text 指定時  : slide_texts の original を更新し、スライド単位で再翻訳。
export async function updateSlideText(params: {
  deckId: string
  slideId: string
  blocks?: string[]
  text?: string
}): Promise<UpdateSlideTextResult> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const hasBlocks = Array.isArray(params.blocks)
  const hasText = typeof params.text === 'string'
  if (hasBlocks === hasText) return { ok: false, code: 'invalidInput' }

  // 所有権確認 + 翻訳対象言語・公開パス構成要素を取得
  const deck = await withDb(async (client) => {
    const { rows } = await client.query<{
      user_id: string
      username: string | null
      slug: string
      target_languages: string[] | string
    }>(
      `SELECT user_id, username, slug, target_languages FROM decks
       WHERE id = $1 AND deleted_at IS NULL`,
      [params.deckId],
    )
    return rows[0] ?? null
  })
  if (!deck || deck.user_id !== userId) return { ok: false, code: 'notFound' }

  const targetLanguages = (
    Array.isArray(deck.target_languages)
      ? deck.target_languages
      : JSON.parse(deck.target_languages as string)
  ) as string[]

  // スライドを取得し（所有するデッキ配下のみ）、layout を読み出す
  const slide = await withDb(async (client) => {
    const { rows } = await client.query<{ layout: unknown }>(
      `SELECT layout FROM slides WHERE id = $1 AND deck_id = $2`,
      [params.slideId, params.deckId],
    )
    return rows[0] ?? null
  })
  if (!slide) return { ok: false, code: 'notFound' }

  const writeSlideTexts = async (
    original: string,
    translated: Record<string, string>,
  ) =>
    withDb(async (client) => {
      await client.query('BEGIN')
      try {
        await client.query(`DELETE FROM slide_texts WHERE slide_id = $1`, [
          params.slideId,
        ])
        await client.query(
          `INSERT INTO slide_texts (slide_id, language_code, content)
           VALUES ($1, 'original', $2)`,
          [params.slideId, original],
        )
        for (const lang of targetLanguages) {
          await client.query(
            `INSERT INTO slide_texts (slide_id, language_code, content)
             VALUES ($1, $2, $3)`,
            [params.slideId, lang, translated[lang] ?? ''],
          )
        }
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    })

  if (hasBlocks) {
    const raw = slide.layout
    const layout = (typeof raw === 'string' ? JSON.parse(raw) : raw) as
      | SlideBlock[]
      | null
    if (!Array.isArray(layout) || layout.length !== params.blocks!.length) {
      return { ok: false, code: 'blockMismatch' }
    }

    // 翻訳は DSQL トランザクション外で実行し、コミット区間を短く保つ
    const joinedOriginal: string[] = []
    const joinedTranslated: Record<string, string[]> = Object.fromEntries(
      targetLanguages.map((l) => [l, [] as string[]]),
    )
    for (const [i, newOriginal] of params.blocks!.entries()) {
      const translated = await translateToTargets(newOriginal, targetLanguages)
      const t = { ...layout[i].t, original: newOriginal } as Record<
        string,
        string
      >
      for (const lang of targetLanguages) {
        t[lang] = translated[lang]
        joinedTranslated[lang].push(translated[lang])
      }
      layout[i].t = t
      joinedOriginal.push(newOriginal)
    }

    await withDb(async (client) => {
      await client.query('BEGIN')
      try {
        await client.query(
          `UPDATE slides SET layout = $1::jsonb WHERE id = $2`,
          [JSON.stringify(layout), params.slideId],
        )
        await client.query(`DELETE FROM slide_texts WHERE slide_id = $1`, [
          params.slideId,
        ])
        await client.query(
          `INSERT INTO slide_texts (slide_id, language_code, content)
           VALUES ($1, 'original', $2)`,
          [params.slideId, joinedOriginal.join('\n')],
        )
        for (const lang of targetLanguages) {
          await client.query(
            `INSERT INTO slide_texts (slide_id, language_code, content)
             VALUES ($1, $2, $3)`,
            [params.slideId, lang, joinedTranslated[lang].join('\n')],
          )
        }
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      }
    })
  } else {
    const text = params.text!
    const translated = await translateToTargets(text, targetLanguages)
    await writeSlideTexts(text, translated)
  }

  const owner = deck.username ?? deck.user_id
  revalidatePath(`/@${owner}/${deck.slug}`)
  return { ok: true }
}
