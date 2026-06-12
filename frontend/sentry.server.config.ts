// サーバー(Node.js ランタイム)用 Sentry 初期化
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://3a99952906add43561ff1eec6f26a8bf@o4510010536886272.ingest.us.sentry.io/4511549399957504',

  // パフォーマンストレースのサンプリング率（本番では下げてよい）
  tracesSampleRate: 1,

  // 開発時のデバッグログ
  debug: false,
})
