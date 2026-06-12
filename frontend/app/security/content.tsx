import type { Locale } from '@/lib/i18n/config'

interface SecurityContent {
  title: string
  intro: string
  // practices の順序は page.tsx の ICONS（Lock, Server, Shield, Eye）と一致させること。
  practices: { title: string; body: string }[]
  reportingTitle: string
  reportingBody: string
}

// 法務ページの本文はロケール別に「本文分割」方式で管理する（短文辞書には載せない）。
export const securityContent: Record<Locale, SecurityContent> = {
  en: {
    title: 'Security',
    intro:
      'We take the security of your data seriously. Here is an overview of the practices and infrastructure that protect your content on Hiravi.',
    practices: [
      {
        title: 'Authentication',
        body: 'User authentication is handled by Clerk, a dedicated identity platform. Passwords are never stored by Hiravi. We support sign-in via Google and other OAuth providers.',
      },
      {
        title: 'Data Storage',
        body: 'All files are stored in Amazon S3 with server-side encryption (SSE-S3). Database records are stored in Amazon Aurora DSQL with encryption at rest and in transit.',
      },
      {
        title: 'Transport Security',
        body: 'All connections to Hiravi use TLS 1.2 or higher. API endpoints and file uploads are served exclusively over HTTPS.',
      },
      {
        title: 'Access Control',
        body: 'Decks are private by default. Public visibility is opt-in per deck. Only authenticated owners can delete or modify their content. Server-side ownership checks are enforced on all mutations.',
      },
    ],
    reportingTitle: 'Reporting a Vulnerability',
    reportingBody:
      'If you discover a security vulnerability in Hiravi, please report it responsibly via our GitHub repository. We will acknowledge your report within 72 hours and work to address confirmed issues promptly. We appreciate the efforts of security researchers who help keep our users safe.',
  },
  ja: {
    // 要法務確認: 暫定訳。正式文言に差し替え予定
    title: 'セキュリティ',
    intro:
      '当方はお客様のデータのセキュリティを重視しています。ここでは、Hiravi 上のお客様のコンテンツを保護する取り組みとインフラの概要をご説明します。',
    practices: [
      {
        title: '認証',
        body: 'ユーザー認証は、専用の ID プラットフォームである Clerk が処理します。パスワードが Hiravi に保存されることはありません。Google やその他の OAuth プロバイダーによるログインに対応しています。',
      },
      {
        title: 'データの保管',
        body: 'すべてのファイルは、サーバーサイド暗号化（SSE-S3）を施した Amazon S3 に保管されます。データベースのレコードは、保管時および転送時に暗号化された Amazon Aurora DSQL に保存されます。',
      },
      {
        title: '通信のセキュリティ',
        body: 'Hiravi へのすべての接続は TLS 1.2 以上を使用します。API エンドポイントおよびファイルのアップロードは、HTTPS 経由でのみ提供されます。',
      },
      {
        title: 'アクセス制御',
        body: 'デッキはデフォルトで非公開です。公開はデッキごとのオプトイン方式です。認証された所有者のみがコンテンツを削除・変更できます。すべての更新操作に対してサーバーサイドの所有権チェックが適用されます。',
      },
    ],
    reportingTitle: '脆弱性の報告',
    reportingBody:
      'Hiravi にセキュリティ上の脆弱性を発見された場合は、当方の GitHub リポジトリを通じて責任ある形でご報告ください。報告は 72 時間以内に確認し、確認された問題には速やかに対処するよう努めます。ユーザーの安全を守ってくださるセキュリティ研究者の皆さまの取り組みに感謝します。',
  },
}
