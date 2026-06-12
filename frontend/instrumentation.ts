// サーバー/Edge ランタイムの起動時に Sentry を読み込む
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Server Component / Route Handler / Server Action のエラーを Sentry に送る
export const onRequestError = Sentry.captureRequestError
