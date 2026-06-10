'use server'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { auth } from '@clerk/nextjs/server'
import { randomUUID } from 'crypto'
import { withDb } from '@/lib/db'

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })
const sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

export async function getPresignedUploadUrl(filename: string, contentType: string) {
  const deckId = randomUUID()
  const key = `uploads/${deckId}/${filename}`

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  )

  return { url, key, deckId }
}

function toSlug(title: string, deckId: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return `${base}-${deckId.slice(0, 8)}`
}

export async function createDeckRecord(params: {
  deckId: string
  fileKey: string
  title: string
  description: string
  category: string
  originalLanguage: string
  targetLanguages: string[]
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const slug = toSlug(params.title, params.deckId)

  await withDb(async (client) => {
    await client.query(
      `INSERT INTO decks
        (id, slug, title, description, user_id, category,
         original_language, target_languages, file_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [
        params.deckId,
        slug,
        params.title,
        params.description,
        userId,
        params.category,
        params.originalLanguage,
        JSON.stringify(params.targetLanguages),
        params.fileKey,
      ],
    )
  })

  return { slug }
}

export async function enqueueProcessing(params: {
  deckId: string
  fileKey: string
  targetLanguages: string[]
  title: string
  description: string
  category: string
  originalLanguage: string
}) {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        deck_id: params.deckId,
        file_key: params.fileKey,
        target_languages: params.targetLanguages,
        title: params.title,
        description: params.description,
        category: params.category,
        original_language: params.originalLanguage,
      }),
    }),
  )
}
