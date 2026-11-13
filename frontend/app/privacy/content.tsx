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
    lastUpdated: 'Last updated: November 2026',
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
          <h2 className="mb-3 font-heading text-xl font-semibold">2. Cookies and Viewing Data</h2>
          <p className="text-muted-foreground">
            To count views and likes, we store an anonymous identifier in a cookie
            (<code>anon_id</code>, valid for one year) on visitors who are not signed in.
            Signed-in users are identified by their account ID instead. When a slide deck is
            viewed, we record the deck, this identifier, the date and time, and the traffic
            source: a category such as X, Facebook, a search engine, or direct access, plus the
            domain name of the referring site and any <code>utm_source</code> value in the
            link. We do not store the full URL of the referring page.
          </p>
          <p className="mt-3 text-muted-foreground">
            We use this data to show each deck&apos;s view count and to give deck owners
            aggregated analytics, such as daily views and traffic sources. Owners cannot see
            who viewed their decks. Views by a deck&apos;s owner and by known bots are not
            recorded. Deleting your browser cookies resets the anonymous identifier.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">3. How We Use Your Information</h2>
          <p className="text-muted-foreground">
            We use collected information to operate and improve Hiravi, process your slide
            decks for translation, communicate with you about your account, and ensure the
            security of our service. We do not sell your personal information to third parties.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">4. Data Storage</h2>
          <p className="text-muted-foreground">
            Uploaded files and processed slide decks are stored on Amazon Web Services (AWS)
            infrastructure in the US East region. We retain your data for as long as your
            account is active or as needed to provide services. You may request deletion of
            your data at any time.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">5. Third-Party Services</h2>
          <p className="text-muted-foreground">
            We use the following third-party services: Clerk for authentication, Amazon Web
            Services for storage and processing, Amazon Translate for language translation,
            Vercel for hosting, and Sentry for error monitoring (including recordings of the
            screen around an error when one occurs).
            Each provider has their own privacy policy governing their use of data.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">6. Your Rights</h2>
          <p className="text-muted-foreground">
            You have the right to access, correct, or delete your personal data. You may also
            request that we restrict processing or export your data. To exercise these rights,
            please contact us.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">7. Contact</h2>
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
    lastUpdated: '最終更新: 2026年11月',
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
          <h2 className="mb-3 font-heading text-xl font-semibold">2. Cookie と閲覧データ</h2>
          <p className="text-muted-foreground">
            閲覧数といいねを数えるため、ログインしていない閲覧者には匿名の識別子を Cookie
            （<code>anon_id</code>、有効期間1年）に保存します。ログイン中の方は、匿名の識別子の代わりに
            アカウント ID で識別します。スライドデッキが閲覧されると、そのデッキ、上記の識別子、
            閲覧日時、流入元を記録します。流入元とは、X・Facebook・検索エンジン・ダイレクトといった
            分類、参照元サイトのドメイン名、リンクに含まれる <code>utm_source</code> の値です。
            参照元ページのフル URL は保存しません。
          </p>
          <p className="mt-3 text-muted-foreground">
            これらのデータは、各デッキの閲覧数の表示と、デッキ所有者への集計済みのアクセス分析
            （日別の閲覧数や流入元など）の提供に利用します。誰が閲覧したかを所有者が知ることは
            できません。所有者自身の閲覧と、Bot と判定したアクセスは記録しません。ブラウザの Cookie を
            削除すると、匿名の識別子はリセットされます。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">3. 情報の利用方法</h2>
          <p className="text-muted-foreground">
            収集した情報は、Hiravi の運営および改善、スライドデッキの翻訳処理、
            アカウントに関するご連絡、ならびにサービスのセキュリティ確保のために利用します。
            お客様の個人情報を第三者に販売することはありません。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">4. データの保管</h2>
          <p className="text-muted-foreground">
            アップロードされたファイルおよび処理済みのスライドデッキは、米国東部リージョンの
            Amazon Web Services（AWS）インフラ上に保管されます。データはアカウントが
            有効である間、またはサービス提供に必要な期間にわたり保持します。
            お客様はいつでもデータの削除を請求できます。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">5. 第三者サービス</h2>
          <p className="text-muted-foreground">
            当サービスは次の第三者サービスを利用します: 認証に Clerk、保管・処理に Amazon Web
            Services、言語翻訳に Amazon Translate、ホスティングに Vercel、エラー監視に Sentry
            （エラー発生時の画面操作の記録を含む）。各提供者は、データの取り扱いに関する
            独自のプライバシーポリシーを有しています。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">6. お客様の権利</h2>
          <p className="text-muted-foreground">
            お客様は、ご自身の個人データへのアクセス、訂正、または削除を求める権利を有します。
            また、処理の制限やデータのエクスポートを請求することもできます。これらの権利を
            行使するには、当方までご連絡ください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">7. お問い合わせ</h2>
          <p className="text-muted-foreground">
            プライバシーに関するご質問やご請求は、当方の GitHub リポジトリ、または
            アカウント設定に記載の連絡先までお寄せください。
          </p>
        </section>
      </>
    ),
  },
}
