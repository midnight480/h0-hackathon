'use client'

import { useEffect } from 'react'

const VIEWER_KEY = 'hiravi_vid'
const viewedKey = (deckId: string) => `hiravi_viewed:${deckId}`

// デッキのユニーク視聴を記録する非表示コンポーネント。
// クライアントのマウント時に1回だけ POST /api/decks/:id/view を送るため、
// prefetch や OGP クローラー（JS 非実行）では計測されない。
// localStorage の送信済みフラグは送信削減用で、最終的な重複排除は
// サーバー側の deck_views 複合主キーが担う。
export function ViewTracker({ deckId }: { deckId: string }) {
  useEffect(() => {
    try {
      if (localStorage.getItem(viewedKey(deckId))) return
      let vid = localStorage.getItem(VIEWER_KEY)
      if (!vid) {
        vid = crypto.randomUUID()
        localStorage.setItem(VIEWER_KEY, vid)
      }
      // 結果に関わらず再送しない（失敗しても閲覧を阻害しない）
      localStorage.setItem(viewedKey(deckId), '1')
      fetch(`/api/decks/${deckId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerId: vid }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // localStorage / crypto が使えない環境では計測しない
    }
  }, [deckId])
  return null
}
