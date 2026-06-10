import Link from 'next/link'
import { Logo } from '@/components/logo'

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
              Opening knowledge to the world. Upload a deck once, share it in
              every language — without altering a single pixel of your slides.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol
              title="Product"
              links={[
                { href: '/browse', label: 'Browse' },
                { href: '/upload', label: 'Upload' },
                { href: '/dashboard', label: 'Dashboard' },
              ]}
            />
            <FooterCol
              title="Company"
              links={[
                { href: '/', label: 'About' },
                { href: '/', label: 'Blog' },
                { href: '/', label: 'Careers' },
              ]}
            />
            <FooterCol
              title="Legal"
              links={[
                { href: '/', label: 'Privacy' },
                { href: '/', label: 'Terms' },
                { href: '/', label: 'Security' },
              ]}
            />
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border/70 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Hiravi. ひらり、ひらく。</p>
          <p>Translations are machine-generated and may contain errors.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((link, i) => (
          <li key={i}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
