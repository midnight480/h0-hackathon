import { withSentryConfig } from '@sentry/nextjs/config'

/** @type {import('next').NextConfig} */
const securityHeaders = [
  // クリックジャッキング防止（iframe 埋め込み禁止）
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // MIME スニッフィング防止
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // リファラ漏洩の抑制
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // HTTPS 強制（Vercel は常時 HTTPS）
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // 不要なブラウザ機能を無効化
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
]

const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'midnight480',
  project: 'h0-hackathon',

  // ビルドログでの Sentry CLI 出力を抑制（CI では false 推奨）
  silent: !process.env.CI,

  // ソースマップのアップロードには SENTRY_AUTH_TOKEN が必要（Vercel 環境変数に設定）。
  // 未設定でもビルドは通る（アップロードがスキップされるだけ）。
  widenClientFileUpload: true,

  // Sentry のトンネリングで広告ブロッカーによるイベント欠落を回避
  tunnelRoute: '/monitoring',
})
