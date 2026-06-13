import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Shield, Lock, Server, Eye } from 'lucide-react'
import { getLocaleFromCookie } from '@/lib/i18n'
import { securityContent } from './content'

export const metadata = { title: 'Security — Hiravi' }

// アイコンは本文（content.tsx の practices）と同じ順序で対応させる。
const ICONS = [Lock, Server, Shield, Eye]

export default async function SecurityPage() {
  const locale = await getLocaleFromCookie()
  const content = securityContent[locale]

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {content.title}
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            {content.intro}
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {content.practices.map((p, i) => {
              const Icon = ICONS[i] ?? Shield
              return (
                <div
                  key={p.title}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <Icon className="mb-3 size-6 text-accent" />
                  <h2 className="mb-2 font-heading text-base font-semibold text-foreground">
                    {p.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-12 rounded-xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
            <h2 className="mb-2 font-heading text-base font-semibold text-foreground">
              {content.reportingTitle}
            </h2>
            <p>{content.reportingBody}</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
