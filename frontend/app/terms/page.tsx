import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata = { title: 'Terms of Service — Hiravi' }

export default function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using Hiravi, you agree to be bound by these Terms of Service. If
                you do not agree to these terms, please do not use the service.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">2. Use of the Service</h2>
              <p className="text-muted-foreground">
                Hiravi provides a platform for uploading, translating, and sharing slide decks. You
                may use the service for lawful purposes only. You are responsible for all content
                you upload and must have the necessary rights to share that content.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">3. Content Ownership</h2>
              <p className="text-muted-foreground">
                You retain ownership of all content you upload to Hiravi. By uploading content,
                you grant Hiravi a non-exclusive, royalty-free license to process, store, and
                display your content for the purpose of providing the service, including generating
                machine translations.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">4. Prohibited Content</h2>
              <p className="text-muted-foreground">
                You must not upload content that is unlawful, harmful, defamatory, infringing on
                intellectual property rights, or otherwise objectionable. We reserve the right to
                remove content that violates these terms.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">5. Translation Accuracy</h2>
              <p className="text-muted-foreground">
                Translations provided by Hiravi are machine-generated and may contain errors. We do
                not guarantee the accuracy, completeness, or suitability of any translation for any
                particular purpose. Users should verify translations before relying on them.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                Hiravi is provided "as is" without warranties of any kind. To the maximum extent
                permitted by law, we are not liable for any indirect, incidental, or consequential
                damages arising from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">7. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these terms from time to time. Continued use of the service after
                changes constitutes acceptance of the revised terms. We will make reasonable efforts
                to notify users of significant changes.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
