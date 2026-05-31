# Hiravi — Global Slide Sharing Platform with Instant Multi-Language Translation

> **Track 3: Million-scale Global App** | AWS Aurora DSQL | Vercel + Next.js

---

## Executive Summary

**Hiravi** (ひらり + visual) transforms how knowledge crosses language barriers. Upload a PDF slide deck, and Hiravi instantly generates a web-native slideshow with machine translations in 75+ languages — without altering a single pixel of the original slides.

The platform addresses a fundamental gap: **millions of high-quality technical presentations exist only in their original language**, invisible to the global audience that could benefit from them. Conference talks, university lectures, corporate training materials — all locked behind language walls.

Hiravi solves this with a unique "translation as a separate layer" approach that preserves author intent while making content globally accessible.

**Name origin**: 「ひらり」(a paper fluttering gracefully) + "visual" + 「開く」(hiraku, to open) — opening knowledge to the world.

---

## The Problem

| Pain Point | Current Reality | Hiravi's Solution |
|---|---|---|
| Language barrier | Japanese/Korean/Chinese slides are invisible to English speakers and vice versa | Automatic 75-language translation with one upload |
| Manual translation cost | Translating a 30-slide deck takes 4-8 hours of human effort | Fully automated in <60 seconds via Amazon Translate |
| Poor sharing UX | PDF links don't render as slideshows; no mobile optimization | Web-native viewer with responsive design |
| Global latency | Existing platforms serve from single regions | Aurora DSQL Multi-Region Active-Active for <50ms reads worldwide |
| Browser translation fails | Slides are images — Chrome Translate cannot process them | OCR text extraction enables translation of image-based content |

---

## Architecture Overview

```
                         ┌─────────────┐
                         │    Users    │
                         │  (Global)   │
                         └──────┬──────┘
                                │ HTTPS
                    ┌───────────▼───────────┐
                    │   Vercel Edge Network  │
                    │   (CDN + SSR + ISR)    │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
     ┌────────────────┐ ┌─────────────┐ ┌──────────────┐
     │  Clerk (Auth)  │ │ Upstash     │ │ Next.js App  │
     │  OAuth + MFA   │ │ Redis       │ │ Server       │
     │  Session Mgmt  │ │ Rate Limit  │ │ Actions      │
     └────────────────┘ │ HyperLogLog │ └──────┬───────┘
                        └─────────────┘        │
                                    ┌──────────┼──────────┐
                                    │          │          │
                                    ▼          ▼          ▼
                          ┌──────────┐ ┌────────────┐ ┌────────┐
                          │ Aurora   │ │ Amazon S3  │ │Amazon  │
                          │ DSQL     │ │ (Storage)  │ │SQS     │
                          │ Region 1 │ │            │ │(Queue) │
                          └────┬─────┘ └─────┬──────┘ └───┬────┘
                               │             │             │
                    ┌──────────▼──────┐      │             ▼
                    │ Aurora DSQL     │      │     ┌──────────────┐
                    │ Region 2        │      │     │ AWS Lambda   │
                    │ (Active-Active) │      │     │ PDF Processor│
                    └─────────────────┘      │     └──────┬───────┘
                                             │            │
                         Multi-Region        │     ┌──────┼──────┐
                         Replication         │     │      │      │
                         (Automatic)         │     ▼      ▼      ▼
                                          ┌──┴──┐ ┌────┐ ┌──────────┐
                                          │ S3  │ │DSQL│ │ Amazon   │
                                          │Save │ │ DB │ │Translate │
                                          └─────┘ └────┘ └──────────┘
```

### Data Flow

1. **Upload**: User → Vercel → S3 (presigned URL direct upload)
2. **Queue**: S3 Event → SQS (decoupled processing)
3. **Process**: SQS → Lambda (PDF→Images + Text Extraction + Translation)
4. **Store**: Lambda → S3 (images) + Aurora DSQL (metadata + translations)
5. **Invalidate**: Lambda → Vercel Webhook (revalidateTag for instant cache purge)
6. **Serve**: User → Vercel CDN → Aurora DSQL (nearest region) + S3 (images)

---

## Why Aurora DSQL — Intentional Database Design

### The Challenge: Global Content Platform at Scale

A slide sharing platform with million-scale users faces a fundamental database challenge:
- **Reads are globally distributed** — viewers access content from every timezone
- **Writes are bursty** — conference speakers upload dozens of decks simultaneously
- **Consistency matters** — a viewer must see the latest published version, not stale data

### Why Aurora DSQL is the Right Choice

| Requirement | Aurora DSQL Capability |
|---|---|
| Global low-latency reads | Multi-Region Active-Active with automatic replication |
| Strong consistency | Serializable isolation across regions |
| No operational overhead | Serverless — no capacity planning, no connection pooling |
| PostgreSQL compatibility | Full SQL expressiveness for complex queries |
| Optimistic Concurrency Control | INSERT-heavy workload avoids lock contention |

### Design Decisions Aligned with DSQL Constraints

| DSQL Constraint | Our Design Response |
|---|---|
| No foreign keys | Application-layer referential integrity via Drizzle ORM |
| OCC (Optimistic Concurrency Control) | Event-sourcing pattern — INSERT-only for state changes |
| No sequences/auto-increment | UUID primary keys (gen_random_uuid()) — eliminates hotspots |
| Async index creation | `CREATE INDEX ASYNC` for non-blocking DDL |
| 10-second transaction limit | Atomic single-row operations; batch processing in Lambda |

### OCC Retry Strategy

```typescript
async function withOCCRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (isOCCConflict(error) && attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 50 + Math.random() * 100);
        continue;
      }
      throw error;
    }
  }
  throw new Error("OCC retry exhausted");
}
```

---

## Database Schema (Aurora DSQL)

```sql
-- Users: Clerk webhook syncs profile changes
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,  -- Immutable, used in URLs: /@{username}/...
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slide Decks: Core content entity
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  original_language TEXT NOT NULL DEFAULT 'ja',
  target_languages TEXT[] NOT NULL DEFAULT '{en}',
  category TEXT,  -- 'tech' | 'business' | 'design' | 'education' | 'other'
  file_key TEXT NOT NULL,
  slide_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  processing_status TEXT NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

-- Slide Pages: Individual pages with extracted text
CREATE TABLE slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  page_number INTEGER NOT NULL,
  image_key TEXT NOT NULL,
  original_text TEXT,
  UNIQUE (deck_id, version, page_number)
);

-- Event Sourcing: Deck lifecycle (INSERT-only, no OCC conflicts)
CREATE TABLE deck_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL,
  event_type TEXT NOT NULL,  -- 'draft'|'published'|'unpublished'|'revised'|'deleted'
  version INTEGER,
  actor_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Sourcing: Translation lifecycle (INSERT-only)
CREATE TABLE translation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID NOT NULL,
  target_language TEXT NOT NULL DEFAULT 'en',
  event_type TEXT NOT NULL,  -- 'auto_translated'|'edited'|'approved'|'hidden'|'visible'
  translated_text TEXT,
  actor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Views: INSERT-only analytics (no UPDATE contention)
CREATE TABLE deck_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL,
  viewer_id UUID,  -- NULL = anonymous
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Likes: INSERT-only "clap" pattern (multiple likes per user allowed)
CREATE TABLE deck_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL,
  user_id UUID,  -- NULL = anonymous
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Async indexes (DSQL-specific non-blocking DDL)
CREATE INDEX ASYNC idx_decks_user_slug ON decks (user_id, slug);
CREATE INDEX ASYNC idx_decks_category ON decks (category, published_at DESC);
CREATE INDEX ASYNC idx_decks_status ON decks (processing_status);
CREATE INDEX ASYNC idx_slides_deck ON slides (deck_id, version, page_number);
CREATE INDEX ASYNC idx_translations ON translation_events (slide_id, target_language, created_at DESC);
CREATE INDEX ASYNC idx_views_deck ON deck_views (deck_id, viewed_at DESC);
CREATE INDEX ASYNC idx_likes_deck ON deck_likes (deck_id);
CREATE INDEX ASYNC idx_events_deck ON deck_events (deck_id, created_at DESC);
```

### Schema Design Rationale

- **Event Sourcing for state changes**: All status transitions are INSERT operations. This eliminates OCC conflicts on hot rows, provides complete audit trails, and enables time-travel queries.
- **INSERT-only analytics**: Views and likes never UPDATE existing rows. Aggregation uses `COUNT(*)` with indexed scans. At scale, Upstash Redis HyperLogLog (`PFADD`/`PFCOUNT`) provides O(1) approximate counts with 0.81% error rate.
- **UUID primary keys**: Uniform distribution across DSQL's distributed storage — no hotspot on sequential IDs.
- **No foreign keys**: DSQL constraint. Referential integrity enforced in application layer via Drizzle ORM's `relations()` API.
- **JSONB metadata**: Extensible event payloads without schema migrations.

---

## Core Features

### 1. PDF Upload & Processing Pipeline

```
User uploads PDF → S3 (presigned URL, direct upload)
                 → S3 Event Notification → SQS
                 → Lambda consumes message
                 → PDF → WebP images (pdf2image + Ghostscript)
                 → Text extraction (PyMuPDF text layer)
                 → Amazon Translate (75 languages)
                 → Results → S3 + Aurora DSQL
                 → Vercel revalidateTag webhook
                 → User sees "Ready!" (no page reload needed)
```

**Processing time**: ~30-60 seconds for a 30-page deck with 2 target languages.

### 2. Web-Native Slide Viewer

- Keyboard navigation (←/→/Space)
- Touch swipe on mobile
- Fullscreen mode
- Responsive layout (adapts to any screen size)
- `/@{username}/{slug}` URL structure

### 3. Translation Display Modes

| Mode | Description | Best For |
|---|---|---|
| Side Panel | Translation text beside the slide | Desktop, detailed reading |
| Subtitle | Overlay at bottom of slide | Presentation-style viewing |
| Note View | Below slide like speaker notes | Study/reference |

All modes display a "Machine Translated" label. Authors can edit, approve, or hide translations.

### 4. Social Sharing & OGP

- Dynamic `og:image` from first slide (permanent S3 URL, no expiration)
- `og:image` URL includes version: `slides/public/{deck_id}/v{version}/page-1.webp`
- Version change on update forces SNS re-crawl (cache busting)
- Twitter Card: `summary_large_image`
- Share buttons: X (Twitter), Facebook, Copy Link

### 5. Like System (Clap Pattern)

- Multiple likes per user (like dev.to/note.com claps)
- INSERT-only — zero OCC conflicts
- Anonymous likes supported (user_id = NULL)
- Real-time count via `COUNT(*)` (small scale) or HyperLogLog (at scale)

### 6. Search & Discovery

- MVP: `title ILIKE '%keyword%'` + `tags @> ARRAY['tag']`
- Category tabs: tech / business / design / education / other
- Sort: newest / most liked
- Future: Amazon OpenSearch for full-text search at scale

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js (App Router) via v0 | SSR/ISR for SEO + OGP, Server Components for performance |
| Styling | Tailwind CSS + shadcn/ui | Consistent design system, dark/light mode |
| Hosting | Vercel | Edge CDN, automatic HTTPS, zero-config deploys |
| Auth | Clerk | SOC 2 Type II, 10K MAU free, OAuth (Google/GitHub) |
| Database | Aurora DSQL | Multi-Region Active-Active, serverless, PostgreSQL compatible |
| ORM | Drizzle ORM | Type-safe SQL, lightweight, no foreign key requirement |
| Storage | Amazon S3 | PDF originals + WebP slide images, versioned |
| Queue | Amazon SQS + DLQ | Decoupled processing, 3x retry, dead letter queue |
| Compute | AWS Lambda (Python) | PDF processing with Ghostscript + PyMuPDF |
| Translation | Amazon Translate | 75 languages, $15/million chars, auto language detection |
| Rate Limiting | Upstash Redis | IP + user-level rate limiting, HyperLogLog analytics |
| IaC | AWS CDK (TypeScript) | Type-safe infrastructure, 6 modular stacks |

---

## Security Design

### Defense in Depth

```
Layer 1: Vercel Edge    → DDoS mitigation, WAF, Bot protection, TLS 1.3
Layer 2: Clerk Auth     → OAuth, MFA, session management, brute-force protection
Layer 3: Application    → Input validation (zod), CSRF (Server Actions built-in)
Layer 4: Data Access    → Presigned URLs, IAM least-privilege, parameterized queries
Layer 5: Storage        → SSE-S3 encryption, bucket policy (public only for slides/public/*)
Layer 6: Network        → Aurora DSQL default encryption, SSL-only connections
```

### Key Security Decisions

| Threat | Mitigation |
|---|---|
| File upload abuse | 20MB limit, .pdf only, magic byte validation, sandboxed Lambda processing |
| S3 unauthorized access | Presigned URLs (15min) for uploads, public-read only for `slides/public/*` |
| API abuse | Upstash Redis rate limiting (IP + user), Vercel WAF custom rules |
| Webhook spoofing | `X-Webhook-Secret` header validation on Vercel revalidation endpoint |
| SQL injection | Drizzle ORM parameterized queries exclusively |
| XSS | React auto-escaping + CSP headers |
| Secret leakage | No `NEXT_PUBLIC_` prefix for secrets, `server-only` package enforcement |

### Security Headers

```javascript
// next.config.js
headers: [
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy: default-src \'self\'; ...'
]
```

---

## Scalability Strategy (Million-Scale)

### Read Path (Optimized for Global Viewers)

```
User Request → Vercel CDN (edge cache, ISR)
            → If cache miss: Aurora DSQL (nearest region, <50ms)
            → Slide images served from S3 via Vercel Image Optimization
```

- **ISR (Incremental Static Regeneration)**: Published decks are statically generated and cached at edge. Revalidated on-demand via webhook when content changes.
- **Aurora DSQL Multi-Region**: Readers in Asia hit ap-northeast-1, readers in US hit us-east-1. Automatic replication ensures consistency.
- **Vercel Image Optimization**: S3 WebP images are automatically resized per device. Zero implementation cost.

### Write Path (Optimized for OCC Avoidance)

```
Upload → S3 direct (presigned URL, bypasses server)
      → SQS (fire-and-forget from client perspective)
      → Lambda (isolated processing, no DB contention during heavy compute)
      → INSERT-only DB writes (events, views, likes — never UPDATE hot rows)
```

### Scaling Bottlenecks & Mitigations

| Bottleneck | At Scale | Mitigation |
|---|---|---|
| View counting | Millions of INSERTs/day | Upstash HyperLogLog (O(1), 0.81% error) |
| Search | `ILIKE` full scan | Migrate to Amazon OpenSearch |
| Translation cost | $15/M chars × languages | Cache aggressively, translate once per version |
| Lambda concurrency | Burst uploads | SQS smooths spikes, `maxConcurrency: 10` |

---

## Translation Approach — Design Philosophy

### Why "Translation as a Separate Layer"?

Existing platforms don't offer multi-language slides because:
1. **Text expansion** (Japanese→English: 1.5-2x) breaks layouts
2. **Font/size differences** across languages cause rendering issues
3. **Image re-rendering** is computationally expensive
4. **Mistranslation risk** — errors published under author's name

**Hiravi's approach**: The original slide image is sacred. Translation is presented as a reference layer alongside the visual, clearly labeled as machine-generated.

```
┌─────────────────────────────────────────────────┐
│  Original Slide Image (untouched, author's work) │
├─────────────────────────────────────────────────┤
│  [Machine Translated] Translation text here...   │
│  Author can: Edit | Approve | Hide              │
└─────────────────────────────────────────────────┘
```

### Why This Can't Be Done with Browser Translation

- Slides are rendered as **images** (WebP) — browser translation tools cannot process them
- Hiravi extracts text from the PDF text layer (or OCR fallback), translates it, and caches the result
- Viewers get instant access to translations without any client-side processing

---

## Differentiation (Judging Criteria Alignment)

### Technical Implementation ⭐

- **Aurora DSQL Multi-Region Active-Active** with intentional schema design for OCC avoidance
- **Event sourcing pattern** eliminates UPDATE contention on hot rows
- **6 modular CDK stacks** with proper cross-stack references and least-privilege IAM
- **OCC retry with exponential backoff** + jitter
- **Async processing pipeline**: S3 → SQS → Lambda → DSQL (fully decoupled)
- **Vercel revalidateTag webhook** for instant cache invalidation without polling
- `/api/health` endpoint exposing connection region + latency (demo-ready)

### Design ⭐

- **v0-scaffolded UI** with shadcn/ui components and Tailwind CSS
- **Three translation display modes** (side panel / subtitle / note view)
- **Dark/light mode** with system preference detection
- **Mobile-first responsive** slide viewer with touch gestures
- **Progressive disclosure**: Processing status shown inline, errors in notification toast

### Impact & Real-world Applicability ⭐

- **Solves a real problem**: 100K+ conference talks/year in Japan alone lack English translations
- **Production-ready architecture**: Not a demo — designed for actual deployment
- **Cost-efficient**: ~$40/month for 300 decks/month (85% is translation cost, scales linearly)
- **Extensible**: OpenSearch for search, CloudFront for CDN, additional languages trivially added

### Originality ⭐

- **"Translation as a separate layer"** — no existing platform does this
- **Preserves author intent** while enabling global access
- **Author control over translations** — edit, approve, or hide machine output
- **OGP cache busting via versioned image URLs** — forces SNS re-crawl on updates
- **INSERT-only analytics** designed specifically for DSQL's OCC model

---

## User Flows

### Upload Flow

```
1. Sign in (Clerk OAuth: Google/GitHub)
2. Drag & drop PDF (max 20MB, validated: extension + magic bytes)
3. Fill metadata: title, slug (auto-generated), description, category, tags
4. Select languages:
   - Source language (Japanese/English/Chinese/other)
   - Target languages (English required; Chinese/Spanish/French/etc. optional)
5. Upload → S3 presigned URL → processing_status = 'pending'
6. Background: SQS → Lambda → Images + Text + Translation → DSQL
7. Dashboard polls every 3s → status becomes 'ready' → "Published!" toast
8. On failure: notification toast with "Retry" button → re-queues to SQS
```

### Viewing Flow

```
1. Access /@{username}/{slug}
2. Slide viewer renders (SSR with ISR caching)
3. Select translation language from dropdown
4. Choose display mode (side panel / subtitle / note)
5. Navigate slides (keyboard/touch/click)
6. Like (clap) button — multiple presses allowed
7. Share via X/Facebook/Copy Link
```

---

## Infrastructure as Code (AWS CDK)

### Stack Architecture

```
HiraviDsqlStack          → Aurora DSQL cluster
HiraviStorageStack       → S3 bucket (versioned, encrypted, CORS)
HiraviQueueStack         → SQS queue + Dead Letter Queue (3x retry)
HiraviLambdaStack        → Lambda + Ghostscript layer + event source mapping
HiraviTranslateStack     → IAM policies for Translate + Comprehend
HiraviVercelAccessStack  → IAM user for Vercel Server Actions
```

### Key Infrastructure Decisions

- **S3 versioning enabled**: Supports slide deck updates with rollback capability
- **SQS visibility timeout = 16min**: Exceeds Lambda max execution (15min) to prevent duplicate processing
- **DLQ with 14-day retention**: Failed jobs preserved for debugging
- **Lambda 2048MB / 15min timeout**: PDF processing with Ghostscript is memory and time intensive
- **X-Ray tracing active**: End-to-end observability for the processing pipeline
- **`BlockPublicAccess.BLOCK_ALL`** with selective bucket policy for `slides/public/*` only

---

## Cost Estimate (30 users, 300 decks/month)

| Service | Usage | Monthly Cost |
|---|---|---|
| Amazon S3 | 1.5GB storage + requests | ~$0.33 |
| AWS Lambda | 300 invocations × 60s × 2048MB | ~$0 (free tier) |
| Amazon SQS | 300 messages | ~$0 (free tier) |
| Amazon Translate | 2.4M characters | ~$36 |
| Aurora DSQL | Reads + writes + 1GB storage | ~$3-5 |
| Vercel | Hobby plan | $0 |
| Clerk | 30 MAU (free tier: 10,000) | $0 |
| Upstash Redis | Free tier (10K commands/day) | $0 |
| **Total** | | **~$40/month** |

> 85% of cost is Amazon Translate. Reducing target languages from 2→1 halves translation cost. AWS $100 credit covers ~2.5 months.

---

## Development Timeline

| Week | Deliverables |
|---|---|
| Week 1 (5/30-6/5) | v0 scaffold, Aurora DSQL setup, Drizzle schema, basic CRUD |
| Week 2 (6/6-6/12) | File upload + S3, SQS pipeline, Lambda processing |
| Week 3 (6/13-6/19) | Translation UI, slide viewer, OGP, share buttons |
| Week 4 (6/20-6/26) | Multi-region config, polish, testing, performance tuning |
| Final (6/27-6/29) | Demo video, bonus content (blog × 3), submission |

---

## Bonus Content Plan (+0.6 points)

1. **Blog (builder.aws.com)**: "Building a Global Slide Platform with Aurora DSQL Multi-Region Active-Active"
2. **Technical Article (dev.to)**: "Event Sourcing with Aurora DSQL: Designing for Optimistic Concurrency"
3. **YouTube Video**: 3-minute architecture walkthrough + live demo

All tagged with **#H0Hackathon**.

---

## Submission Checklist

- [ ] Text description (Database: Aurora DSQL)
- [ ] Demo video (3-5 min, YouTube)
- [ ] Vercel project link + Team ID
- [ ] Architecture diagram (draw.io export)
- [ ] Storage Configuration screenshot
- [ ] Bonus content × 3 published
- [ ] Test credentials provided for judges

---

## v0 Initial Prompt

```
Build a slide sharing platform called "Hiravi" with Next.js App Router.

Pages needed:
1. Landing: Hero + featured slides grid + search + category tabs
2. Upload (auth): Drag-drop PDF, metadata form, language selection
3. Viewer (/@username/slug): Slideshow with translation panel, like, share
4. Dashboard (auth): User's decks grid with status badges
5. Browse: All public decks with filters and sorting

Tech: shadcn/ui, Tailwind, Clerk auth, dark/light mode, mobile responsive.
URL structure: /@{username}/{slug}
```
