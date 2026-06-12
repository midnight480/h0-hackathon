import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { getLocaleFromCookie } from '@/lib/i18n'
import { privacyContent } from './content'

export const metadata = { title: 'Privacy Policy — Hiravi' }

export default async function PrivacyPage() {
  const locale = await getLocaleFromCookie()
  const content = privacyContent[locale]

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {content.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{content.lastUpdated}</p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
            {content.body}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
