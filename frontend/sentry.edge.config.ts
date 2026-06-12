// Edge ランタイム(middleware など)用 Sentry 初期化
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ??
    'https://3a99952906add43561ff1eec6f26a8bf@o4510010536886272.ingest.us.sentry.io/4511549399957504',

  tracesSampleRate: 1,

  debug: false,
})
