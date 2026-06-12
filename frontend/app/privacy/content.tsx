import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'

interface LegalContent {
  title: string
  lastUpdated: string
  body: ReactNode
}

// 法務ページの本文はロケール別に「本文分割」方式で管理する（短文辞書には載せない）。
export const privacyContent: Record<Locale, LegalContent> = {
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: June 2026',
    body: (
      <>
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
      </>
    ),
  },
  ja: {
    title: 'プライバシーポリシー',
    lastUpdated: '最終更新: 2026年6月',
    body: (
      <>
        {/* 要法務確認: 暫定訳。正式文言に差し替え予定 */}
        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">1. 収集する情報</h2>
          <p className="text-muted-foreground">
            アカウントの作成、スライドデッキのアップロード、または当サービスのご利用時に
            お客様が提供する情報を収集します。これには氏名、メールアドレス、
            アップロードされたファイルの内容が含まれます。また、閲覧したページや利用した
            機能などの利用データも自動的に収集します。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">2. 情報の利用方法</h2>
          <p className="text-muted-foreground">
            収集した情報は、Hiravi の運営および改善、スライドデッキの翻訳処理、
            アカウントに関するご連絡、ならびにサービスのセキュリティ確保のために利用します。
            お客様の個人情報を第三者に販売することはありません。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">3. データの保管</h2>
          <p className="text-muted-foreground">
            アップロードされたファイルおよび処理済みのスライドデッキは、米国東部リージョンの
            Amazon Web Services（AWS）インフラ上に保管されます。データはアカウントが
            有効である間、またはサービス提供に必要な期間にわたり保持します。
            お客様はいつでもデータの削除を請求できます。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">4. 第三者サービス</h2>
          <p className="text-muted-foreground">
            当サービスは次の第三者サービスを利用します: 認証に Clerk、保管・処理に Amazon Web
            Services、言語翻訳に Amazon Translate。各提供者は、データの取り扱いに関する
            独自のプライバシーポリシーを有しています。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">5. お客様の権利</h2>
          <p className="text-muted-foreground">
            お客様は、ご自身の個人データへのアクセス、訂正、または削除を求める権利を有します。
            また、処理の制限やデータのエクスポートを請求することもできます。これらの権利を
            行使するには、当方までご連絡ください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">6. お問い合わせ</h2>
          <p className="text-muted-foreground">
            プライバシーに関するご質問やご請求は、当方の GitHub リポジトリ、または
            アカウント設定に記載の連絡先までお寄せください。
          </p>
        </section>
      </>
    ),
  },
}
