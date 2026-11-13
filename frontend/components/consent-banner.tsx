'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import {
  CONSENT_OPEN_EVENT,
  type ConsentValue,
  openConsentSettings,
  writeConsent,
} from '@/lib/consent'
import { useT } from '@/lib/i18n/locale-provider'

// 同意済みの場合のみ Sentry Session Replay（エラー時の画面記録）を有効化する
function enableReplay() {
  const client = Sentry.getClient()
  if (!client || client.getIntegrationByName('Replay')) return
  Sentry.addIntegration(Sentry.replayIntegration())
}

export function ConsentBanner({ initialConsent }: { initialConsent: ConsentValue | null }) {
  const t = useT()
  const [open, setOpen] = useState(initialConsent === null)

  useEffect(() => {
    if (initialConsent === 'granted') enableReplay()
    const onOpen = () => setOpen(true)
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen)
  }, [initialConsent])

  if (!open) return null

  const choose = (value: ConsentValue) => {
    writeConsent(value)
    if (value === 'granted') {
      enableReplay()
    } else {
      // 既に有効化済みの Replay は停止する（再読み込み後は有効化されない）
      Sentry.getReplay()?.stop()
    }
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('consent.title')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{t('consent.title')}</span>{' '}
          {t('consent.body')}{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            {t('consent.policy')}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose('denied')}>
            {t('consent.deny')}
          </Button>
          <Button size="sm" onClick={() => choose('granted')}>
            {t('consent.accept')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// フッター等から同意の選択をやり直すためのボタン
export function ConsentSettingsButton() {
  const t = useT()
  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {t('consent.settings')}
    </button>
  )
}
