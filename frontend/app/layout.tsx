import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/ui/themes'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { LocaleProvider } from '@/lib/i18n/locale-provider'
import { getServerI18n } from '@/lib/i18n'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://hiravi.midnight480.com'),
  title: 'Hiravi — Share slides across every language',
  description:
    'Upload a PDF deck and Hiravi instantly turns it into a web-native slideshow with machine translations in 75+ languages. Opening knowledge to the world.',
  applicationName: 'Hiravi',
  generator: 'v0.app',
  openGraph: {
    type: 'website',
    siteName: 'Hiravi',
    title: 'Hiravi — Share slides across every language',
    description:
      'Upload a PDF deck once and read any deck in your language with instant AI translation in 75+ languages.',
    url: 'https://hiravi.midnight480.com',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hiravi — Share slides across every language',
    description:
      'Upload a PDF deck once and read any deck in your language with instant AI translation in 75+ languages.',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Cookie から UI ロケールを解決し、対応する辞書のみをクライアントへ渡す。
  const { locale, dictionary } = await getServerI18n()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        <ClerkProvider appearance={{ theme: shadcn }}>
          <LocaleProvider locale={locale} dictionary={dictionary}>
            <ThemeProvider>
              <div className="flex min-h-screen flex-col">{children}</div>
              <Toaster position="bottom-right" />
            </ThemeProvider>
          </LocaleProvider>
          <Analytics />
          <SpeedInsights />
        </ClerkProvider>
      </body>
    </html>
  )
}
