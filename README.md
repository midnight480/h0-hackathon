# Hiravi 🌐

[日本語版 (README_ja.md)](./README_ja.md)

**Global Slide Sharing Platform with Instant Multi-Language Translation**

> H0 Hackathon 2026 — Track 3: Million-scale Global App

## What is Hiravi?

Upload a PDF slide deck → Get a web-native slideshow with automatic translations in 75+ languages. Original slides are never modified — translations appear as a separate reference layer.

**Name**: ひらり (paper fluttering) + visual + 開く (to open)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) via v0, Tailwind CSS, shadcn/ui |
| Hosting | Vercel (Edge CDN + ISR) |
| Database | **Aurora DSQL** (Multi-Region Active-Active) |
| Auth | Clerk (OAuth, MFA, session management) |
| Storage | Amazon S3 (versioned, encrypted) |
| Queue | Amazon SQS + Dead Letter Queue |
| Compute | AWS Lambda (Python 3.12 + Ghostscript) |
| Translation | Amazon Translate (75 languages) |
| Rate Limiting | Upstash Redis (HyperLogLog) |
| IaC | AWS CDK (TypeScript, 6 stacks) |

## Repository Structure

```
├── PROMPT.md              # Full project specification
├── DRAWIO_PROMPT.md       # Architecture diagram (draw.io XML)
├── src/                   # AWS CDK infrastructure code
│   ├── bin/               # CDK app entry point
│   ├── lib/               # Stack definitions (6 stacks)
│   ├── lambda/            # Lambda function code (Python)
│   └── layers/            # Lambda layers (Ghostscript)
├── *_KNOWLEDGE.md         # Technology reference docs
└── REFERENCE.md           # Hackathon rules & judging criteria
```

## Key Design Decisions

1. **Event Sourcing** — All state changes are INSERT-only, avoiding OCC conflicts in Aurora DSQL
2. **Translation as a Separate Layer** — Original slides are sacred; translations are reference material
3. **Decoupled Processing** — S3 → SQS → Lambda pipeline for async PDF processing
4. **Multi-Region Active-Active** — Aurora DSQL replicates between Tokyo and Virginia automatically

## Getting Started

```bash
# Deploy AWS infrastructure
cd src && npm install && npx cdk deploy --all

# Frontend (after v0 scaffold)
# See PROMPT.md for v0 initial prompt
```

## License

MIT

---

Built for [H0: Hack the Zero Stack](https://h01.devpost.com/) with Vercel v0 and AWS Databases.

**#H0Hackathon**
