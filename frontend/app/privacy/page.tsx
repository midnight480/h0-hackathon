import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata = { title: 'Privacy Policy — Hiravi' }

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">1. Information We Collect</h2>
              <p className="text-muted-foreground">
                We collect information you provide when you create an account, upload slide decks,
                or interact with our service. This includes your name, email address, and the
                content of uploaded files. We also automatically collect usage data such as pages
                visited and features used.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">2. How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use collected information to operate and improve Hiravi, process your slide
                decks for translation, communicate with you about your account, and ensure the
                security of our service. We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">3. Data Storage</h2>
              <p className="text-muted-foreground">
                Uploaded files and processed slide decks are stored on Amazon Web Services (AWS)
                infrastructure in the US East region. We retain your data for as long as your
                account is active or as needed to provide services. You may request deletion of
                your data at any time.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">4. Third-Party Services</h2>
              <p className="text-muted-foreground">
                We use the following third-party services: Clerk for authentication, Amazon Web
                Services for storage and processing, and Amazon Translate for language translation.
                Each provider has their own privacy policy governing their use of data.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">5. Your Rights</h2>
              <p className="text-muted-foreground">
                You have the right to access, correct, or delete your personal data. You may also
                request that we restrict processing or export your data. To exercise these rights,
                please contact us.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-heading text-xl font-semibold">6. Contact</h2>
              <p className="text-muted-foreground">
                For privacy-related questions or requests, please reach out via our GitHub
                repository or the contact information provided in your account settings.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
