'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { setLocale } from '@/app/actions/locale'
import type { Locale } from '@/lib/i18n/config'
import { useLocale } from '@/lib/i18n/locale-provider'
import { cn } from '@/lib/utils'

// ヘッダーの JP/EN 2値トグル。クリックで Server Action により Cookie を更新し、
// router.refresh() で SSR を再取得して即時切り替える。
export function LocaleToggle() {
  const { locale, t } = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const switchTo = (next: Locale) => {
    if (next === locale || isPending) return
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  const options: { value: Locale; label: string }[] = [
    { value: 'ja', label: t('locale.ja') },
    { value: 'en', label: t('locale.en') },
  ]

  return (
    <div
      role="group"
      aria-label={t('locale.toggleLabel')}
      className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs font-medium"
    >
      {options.map((option) => {
        const active = option.value === locale
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => switchTo(option.value)}
            disabled={isPending}
            aria-pressed={active}
            className={cn(
              'rounded-full px-2.5 py-1 transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
