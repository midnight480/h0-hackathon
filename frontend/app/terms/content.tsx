import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n/config'

interface LegalContent {
  title: string
  lastUpdated: string
  body: ReactNode
}

// 法務ページの本文はロケール別に「本文分割」方式で管理する（短文辞書には載せない）。
export const termsContent: Record<Locale, LegalContent> = {
  en: {
    title: 'Terms of Service',
    lastUpdated: 'Last updated: June 2026',
    body: (
      <>
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
            Hiravi is provided &quot;as is&quot; without warranties of any kind. To the maximum extent
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
      </>
    ),
  },
  ja: {
    title: '利用規約',
    lastUpdated: '最終更新: 2026年6月',
    body: (
      <>
        {/* 要法務確認: 暫定訳。正式文言に差し替え予定 */}
        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">1. 規約への同意</h2>
          <p className="text-muted-foreground">
            Hiravi にアクセスまたはこれを利用することにより、お客様は本利用規約に拘束される
            ことに同意するものとします。本規約に同意されない場合は、当サービスをご利用に
            ならないでください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">2. サービスの利用</h2>
          <p className="text-muted-foreground">
            Hiravi は、スライドデッキのアップロード、翻訳、共有のためのプラットフォームを
            提供します。当サービスは適法な目的にのみご利用いただけます。お客様は
            アップロードするすべてのコンテンツについて責任を負い、当該コンテンツを共有する
            ために必要な権利を有している必要があります。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">3. コンテンツの所有権</h2>
          <p className="text-muted-foreground">
            お客様は、Hiravi にアップロードしたすべてのコンテンツの所有権を保持します。
            コンテンツをアップロードすることにより、お客様は、機械翻訳の生成を含むサービス
            提供の目的で当該コンテンツを処理・保管・表示するための非独占的かつ無償の
            ライセンスを Hiravi に付与するものとします。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">4. 禁止コンテンツ</h2>
          <p className="text-muted-foreground">
            お客様は、違法、有害、名誉毀損的、知的財産権を侵害する、またはその他不適切な
            コンテンツをアップロードしてはなりません。当方は、本規約に違反するコンテンツを
            削除する権利を留保します。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">5. 翻訳の正確性</h2>
          <p className="text-muted-foreground">
            Hiravi が提供する翻訳は機械生成によるものであり、誤りを含む場合があります。
            当方は、いかなる翻訳についても、特定の目的への正確性・完全性・適合性を保証
            しません。利用者は、翻訳に依拠する前にその内容を確認してください。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">6. 責任の制限</h2>
          <p className="text-muted-foreground">
            Hiravi はいかなる種類の保証もなく「現状有姿」で提供されます。法律で認められる
            最大限の範囲において、当方は、お客様による当サービスの利用に起因する間接的・
            付随的・結果的損害について一切責任を負いません。
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-heading text-xl font-semibold">7. 規約の変更</h2>
          <p className="text-muted-foreground">
            当方は本規約を随時更新することがあります。変更後も当サービスの利用を継続した
            場合、改定後の規約に同意したものとみなされます。重要な変更については、利用者へ
            通知するよう合理的な努力を行います。
          </p>
        </section>
      </>
    ),
  },
}
