'use client'

import * as Sentry from '@sentry/nextjs'
import { useState } from 'react'

class SentryExampleFrontendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SentryExampleFrontendError'
  }
}

export default function SentryExamplePage() {
  const [sent, setSent] = useState(false)

  const throwError = async () => {
    // トレースに紐づけてフロントエンドのエラーを送信
    await Sentry.startSpan({ name: 'Example Frontend Span', op: 'test' }, async () => {
      setSent(true)
      throw new SentryExampleFrontendError(
        'This error is raised on the frontend of the example page.',
      )
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-heading text-2xl font-bold">Sentry test page</h1>
      <p className="text-sm text-muted-foreground">
        Click the button to throw a test error. If Sentry is configured
        correctly, the issue will appear in your Sentry dashboard.
      </p>
      <button
        type="button"
        onClick={throwError}
        className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground"
      >
        Throw a test error
      </button>
      {sent && (
        <p className="text-xs text-muted-foreground">
          Error thrown — check your Sentry Issues.
        </p>
      )}
    </main>
  )
}
