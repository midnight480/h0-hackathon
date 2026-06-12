import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Shield, Lock, Server, Eye } from 'lucide-react'

export const metadata = { title: 'Security — Hiravi' }

const PRACTICES = [
  {
    icon: Lock,
    title: 'Authentication',
    body: 'User authentication is handled by Clerk, a dedicated identity platform. Passwords are never stored by Hiravi. We support sign-in via Google and other OAuth providers.',
  },
  {
    icon: Server,
    title: 'Data Storage',
    body: 'All files are stored in Amazon S3 with server-side encryption (SSE-S3). Database records are stored in Amazon Aurora DSQL with encryption at rest and in transit.',
  },
  {
    icon: Shield,
    title: 'Transport Security',
    body: 'All connections to Hiravi use TLS 1.2 or higher. API endpoints and file uploads are served exclusively over HTTPS.',
  },
  {
    icon: Eye,
    title: 'Access Control',
    body: 'Decks are private by default. Public visibility is opt-in per deck. Only authenticated owners can delete or modify their content. Server-side ownership checks are enforced on all mutations.',
  },
]

export default function SecurityPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Security
          </h1>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            We take the security of your data seriously. Here is an overview of the practices and
            infrastructure that protect your content on Hiravi.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {PRACTICES.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <p.icon className="mb-3 size-6 text-accent" />
                <h2 className="mb-2 font-heading text-base font-semibold text-foreground">
                  {p.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
            <h2 className="mb-2 font-heading text-base font-semibold text-foreground">
              Reporting a Vulnerability
            </h2>
            <p>
              If you discover a security vulnerability in Hiravi, please report it responsibly via
              our GitHub repository. We will acknowledge your report within 72 hours and work to
              address confirmed issues promptly. We appreciate the efforts of security researchers
              who help keep our users safe.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
