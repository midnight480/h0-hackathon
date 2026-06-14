# Hiravi 🌐

[日本語版 (README_ja.md)](./README_ja.md)

**Global Slide Sharing Platform with Instant Multi-Language Translation**

> H0 Hackathon 2026 — Track 3: Million-scale Global App

## What is Hiravi?

Upload a PDF slide deck → Get a web-native slideshow with automatic translations in 75+ languages. The original slide images are never modified — translations render as an optional overlay on top of the source slide, stored as a separate reference layer alongside the extracted text.

Decks live at clean, shareable URLs like `/@username/abcdefghij` (Google-Meet-style slug), and the app UI itself is localized (English / Japanese).

**Name**: ひらり (paper fluttering) + visual + 開く (*hiraku*, to open)

## Architecture

```mermaid
flowchart TD
    subgraph client["Browser"]
        U["User"]
    end

    subgraph vercel["Vercel — Next.js 16 App Router"]
        UP["Upload page<br/>/upload"]
        SA["Server Actions<br/>(upload.ts / deck.ts / locale.ts)"]
        VIEW["Deck pages (ISR)<br/>/@[user]/[slug]<br/>+ profile /@[user]"]
    end

    subgraph aws["AWS — ap-northeast-1 (Tokyo)"]
        S3["S3<br/>uploads/ + slides/public/"]
        SQS["SQS<br/>processing queue + DLQ"]
        LAMBDA["Lambda (Python 3.12)<br/>hiravi-slide-processor<br/>+ Ghostscript layer"]
        TRANSLATE["Amazon Translate<br/>75+ languages"]
        DSQL[("Aurora DSQL<br/>decks / slides / slide_texts / deck_likes")]
    end

    CLERK["Clerk<br/>auth"]

    %% --- Upload flow ---
    U -->|"1. sign in"| CLERK
    U -->|"2. open"| UP
    UP -->|"3. request presigned POST"| SA
    SA -->|"4. presigned URL"| S3
    U -->|"5. PUT PDF directly"| S3
    SA -->|"6. INSERT deck (status=pending)"| DSQL
    SA -->|"7. enqueue job"| SQS

    %% --- Processing pipeline ---
    SQS -->|"8. trigger"| LAMBDA
    LAMBDA -->|"9. download PDF"| S3
    LAMBDA -->|"10. PyMuPDF → WebP"| S3
    LAMBDA -->|"11. extract + translate text"| TRANSLATE
    LAMBDA -->|"12. UPDATE status=ready + INSERT slides/texts"| DSQL
    LAMBDA -->|"13. revalidate webhook"| VIEW

    %% --- View flow ---
    U -->|"A. open deck"| VIEW
    VIEW -->|"B. read deck/slides/texts"| DSQL
    U -->|"C. load WebP images"| S3
```

**Processing pipeline (sequence)**

```mermaid
sequenceDiagram
    participant V as Vercel (Server Action)
    participant Q as SQS
    participant L as Lambda
    participant S as S3
    participant T as Amazon Translate
    participant D as Aurora DSQL

    V->>Q: enqueue {deck_id, file_key, target_languages}
    Q->>L: deliver message (batchSize=1)
    L->>S: download PDF
    L->>L: PyMuPDF → render pages to WebP
    L->>S: upload slides/public/{deck}/v1/page-N.webp
    L->>L: extract text layer (PyMuPDF)
    L->>T: translate_text (parallel, up to 50 threads)
    L->>D: UPDATE deck status=ready, INSERT slides + slide_texts
    L->>V: POST revalidate webhook (X-Webhook-Secret)
    Note over L,D: 40001 serialization errors retried<br/>with exponential backoff
```

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui | Server Actions for all AWS calls |
| i18n (UI) | Cookie-based locale (English / Japanese) | Dictionaries in `lib/i18n/`, switched via `setLocale` Server Action |
| Hosting | Vercel (ISR + Web Analytics + Speed Insights) | Slide pages cached, revalidated by webhook |
| Database | **Aurora DSQL** (multi-region serverless PostgreSQL) | Accessed via `pg` + `@aws-sdk/dsql-signer` (IAM auth token) |
| Auth | Clerk (`@clerk/nextjs`) | OAuth, sessions; anonymous likes via signed cookie |
| Storage | Amazon S3 (versioned, encrypted, CORS-scoped) | Direct browser upload via presigned POST; public slides under `slides/public/*` |
| Queue | Amazon SQS + Dead Letter Queue | Decouples upload from heavy processing |
| Compute | AWS Lambda (Python 3.12, 2 GB, 15 min) | PyMuPDF for render/extract, Ghostscript layer |
| Translation | Amazon Translate (75+ languages) | `SourceLanguageCode=auto`, parallelized per slide×language |
| Observability | AWS X-Ray, Sentry | Active tracing on Lambda |
| IaC | AWS CDK (TypeScript, 6 stacks) | See [`src/README.md`](./src/README.md) |

> **Upload limits** are enforced server-side by the S3 presigned POST `content-length-range` condition (tamper-proof), not a separate rate limiter.

## Repository Structure

```text
.
├── README.md                 # This file (English)
├── README_ja.md              # Japanese version
├── Makefile                  # install / synth / deploy / frontend-dev / sync-env
├── frontend/                 # Next.js 16 app (deployed to Vercel)
│   ├── app/                  # App Router: pages, Server Actions, route handlers
│   │   ├── actions/          # upload.ts, deck.ts, locale.ts (Server Actions)
│   │   ├── [user]/           # public profile (/@user) + deck viewer ([slug])
│   │   ├── browse/           # public deck gallery
│   │   ├── dashboard/        # signed-in user's decks
│   │   ├── upload/           # upload page
│   │   ├── s/[code]/         # short-id redirect
│   │   ├── sign-in/ sign-up/ # Clerk auth pages
│   │   └── privacy/ terms/ security/  # legal & policy pages
│   ├── components/           # UI (deck-viewer, deck-card, browse, shadcn/ui)
│   └── lib/                  # db.ts (DSQL), data.ts, upload-limits.ts,
│       │                     # username.ts, public-id.ts, clerk-users.ts
│       └── i18n/             # locale config, dictionaries (en/ja), provider
├── src/                      # AWS CDK infrastructure (TypeScript)
│   ├── bin/                  # CDK app entry point
│   ├── lib/                  # 6 stack definitions
│   ├── lambda/processing/    # handler.py (PDF processor)
│   ├── layers/ghostscript/   # Lambda layer
│   ├── schema/schema.sql     # Aurora DSQL schema
│   └── scripts/              # one-off DB migration helpers
└── docs/                     # Knowledge base & references — see docs/README.md
```

## Data Model (Aurora DSQL)

| Table | Purpose |
|---|---|
| `decks` | Deck metadata, status (`pending`→`ready`/`failed`), counters, soft-delete (`deleted_at`). Public identity columns: `slug` (Google-Meet-style `^[a-z]{10}$`, UNIQUE), `legacy_slug` (old title-derived slug, kept for 301 redirects), `username` (denormalized Clerk username for `/@user/slug` resolution without a Clerk API call) |
| `slides` | One row per page, ordered by `page_number`, points to S3 `image_key` |
| `slide_texts` | Per-slide text keyed by `language_code` (`original` + each target language) |
| `deck_likes` | Composite PK `(deck_id, liker_id)` — Clerk user id or `anon:<uuid>` cookie id |

> DSQL does not support `TEXT[]`; array-like fields (`tags`, `target_languages`) use `JSONB`. Indexes are created with `CREATE INDEX ASYNC`.

## Key Design Decisions

1. **Decoupled async processing** — `S3 → SQS → Lambda` keeps the upload request fast; heavy PDF→image→translate work runs out-of-band (`batchSize=1`, `maxConcurrency=10`).
2. **Direct-to-S3 upload** — Browsers `PUT` straight to S3 via a presigned POST, so large PDFs never pass through Vercel functions. The `content-length-range` condition enforces the size cap server-side.
3. **Translation as a separate layer** — Original slide images are never altered; translations live in `slide_texts` and render as an optional reference layer.
4. **IAM auth token for DSQL** — No static DB password; `@aws-sdk/dsql-signer` mints a short-lived token per connection.
5. **OCC handled, not avoided** — Aurora DSQL is optimistic-concurrency; the Lambda retries `40001` serialization failures with exponential backoff rather than relying on locks.
6. **Least-privilege credentials** — The Vercel IAM user is scoped to S3 put/get/delete, SQS send, and DSQL connect only; its access key is stored in Secrets Manager (never in CloudFormation outputs).
7. **Clean, stable public URLs** — Decks are served at `/@username/slug` with a random Google-Meet-style 10-letter `slug`. The Clerk `username` is denormalized into `decks` so view/list pages resolve owners straight from DSQL (no Clerk API call); old `user_id`- and title-based URLs `301`-redirect via `legacy_slug`.
8. **Localized UI without a router rewrite** — The interface ships English/Japanese dictionaries selected by a `locale` cookie; `setLocale` writes the cookie server-side and `router.refresh()` re-renders SSR in the new locale, so no per-locale route segment is needed.

## Getting Started

```bash
# 1. Deploy AWS infrastructure (CDK)
make install        # cd src && npm install
make synth          # generate CloudFormation
make deploy         # cdk deploy --all

# 2. Frontend (Vercel)
make frontend-install   # cd frontend && pnpm install
make frontend-dev       # local dev server
make frontend-deploy    # sync env + vercel --prod
```

Apply the database schema with the helpers in `src/scripts/` (see [`src/README.md`](./src/README.md)).

## Documentation

| Doc | Contents |
|---|---|
| [`README_ja.md`](./README_ja.md) | Japanese version of this README |
| [`src/README.md`](./src/README.md) | CDK stacks, deployment, security notes |
| [`docs/README.md`](./docs/README.md) | Knowledge base index (per-technology references) |
| [`docs/REFERENCE.md`](./docs/REFERENCE.md) | Hackathon rules & judging criteria |
| [`PROMPT.md`](./PROMPT.md) | Full original project specification |

## License

MIT

---

Built for [H0: Hack the Zero Stack](https://h01.devpost.com/) with Vercel v0 and AWS Databases.

**#H0Hackathon**
