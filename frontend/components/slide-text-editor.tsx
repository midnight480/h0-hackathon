'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/i18n/locale-provider'
import { updateSlideText } from '@/app/actions/slide-text'

export interface EditableSlide {
  slideId: string
  pageNumber: number
  imageUrl: string
  // layout が空のスライド向けの編集対象（slide_texts の original）
  originalText: string
  // layout ブロックの t.original 配列（空ならスライド単位編集）
  blockTexts: string[]
}

function SlideEditorCard({
  deckId,
  slide,
}: {
  deckId: string
  slide: EditableSlide
}) {
  const t = useT()
  const isBlocks = slide.blockTexts.length > 0
  const [values, setValues] = useState<string[]>(
    isBlocks ? [...slide.blockTexts] : [slide.originalText],
  )
  const [saved, setSaved] = useState<string[]>(
    isBlocks ? [...slide.blockTexts] : [slide.originalText],
  )
  const [saving, setSaving] = useState(false)

  const dirty = values.some((v, i) => v !== saved[i])

  const save = async () => {
    setSaving(true)
    try {
      const res = isBlocks
        ? await updateSlideText({
            deckId,
            slideId: slide.slideId,
            blocks: values,
          })
        : await updateSlideText({
            deckId,
            slideId: slide.slideId,
            text: values[0] ?? '',
          })
      if (res.ok) {
        toast.success(t('editor.saved'))
        setSaved([...values])
      } else {
        toast.error(t('editor.saveFailed'))
      }
    } catch {
      toast.error(t('editor.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
      <div className="w-full shrink-0 sm:w-48">
        <img
          src={slide.imageUrl}
          alt={t('editor.slideAlt', { n: slide.pageNumber })}
          className="aspect-[16/10] w-full rounded-md border border-border object-cover"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t('editor.slideLabel', { n: slide.pageNumber })}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {isBlocks ? (
          values.map((v, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label
                htmlFor={`s${slide.slideId}-b${i}`}
                className="text-xs font-medium text-muted-foreground"
              >
                {t('editor.blockLabel', { n: i + 1 })}
              </label>
              <Textarea
                id={`s${slide.slideId}-b${i}`}
                value={v}
                onChange={(e) =>
                  setValues((prev) => {
                    const next = [...prev]
                    next[i] = e.target.value
                    return next
                  })
                }
                rows={Math.min(6, Math.max(2, v.split('\n').length))}
              />
            </div>
          ))
        ) : (
          <Textarea
            value={values[0] ?? ''}
            onChange={(e) => setValues([e.target.value])}
            rows={4}
            aria-label={t('editor.slideTextLabel')}
            placeholder={t('editor.emptySlide')}
          />
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? t('editor.saving') : t('editor.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SlideTextEditor({
  deckId,
  deckTitle,
  backHref,
  slides,
}: {
  deckId: string
  deckTitle: string
  backHref: string
  slides: EditableSlide[]
}) {
  const t = useT()

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('editor.backToDeck')}
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground">
        {t('editor.title')}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('editor.subtitle', { title: deckTitle })}
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {slides.map((slide) => (
          <SlideEditorCard key={slide.slideId} deckId={deckId} slide={slide} />
        ))}
        {slides.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('editor.noSlides')}</p>
        )}
      </div>
    </div>
  )
}
