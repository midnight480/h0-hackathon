// クライアント(ブラウザ)用 Sentry 初期化
// Turbopack 対応のため sentry.client.config.ts ではなく instrumentation-client.ts を使用
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://3a99952906add43561ff1eec6f26a8bf@o4510010536886272.ingest.us.sentry.io/4511549399957504',

  // パフォーマンストレース
  tracesSampleRate: 1,

  // Session Replay: エラー発生時のみ録画（通常セッションは録画しない）
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  integrations: [Sentry.replayIntegration()],

  debug: false,
})

// ナビゲーション計測（App Router の遷移をトレースに反映）
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
