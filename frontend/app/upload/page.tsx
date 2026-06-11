'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  FileText,
  Globe,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CATEGORIES, LANGUAGES, type LanguageCode } from '@/lib/data'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '@/lib/upload-limits'
import { cn } from '@/lib/utils'
import { getPresignedUploadUrl, createDeckRecord, enqueueProcessing } from '@/app/actions/upload'

export default function UploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('tech')
  const [original, setOriginal] = useState<LanguageCode>('en')
  const [targets, setTargets] = useState<LanguageCode[]>(['ja', 'zh'])
  const [submitting, setSubmitting] = useState(false)

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error(`File is too large. Maximum size is ${MAX_UPLOAD_LABEL}.`)
      return
    }
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ''))
  }

  const toggleTarget = (code: LanguageCode) => {
    setTargets((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return toast.error('Add a PDF to upload')
    if (file.size > MAX_UPLOAD_BYTES) {
      return toast.error(`File is too large. Maximum size is ${MAX_UPLOAD_LABEL}.`)
    }
    if (!title.trim()) return toast.error('Give your deck a title')
    setSubmitting(true)

    try {
      // 1. presigned POST を取得
      const { url, fields, key, deckId } = await getPresignedUploadUrl(file.name, file.type)

      // 2. S3 に直接アップロード（multipart/form-data POST）
      //    fields は presigned POST の署名・ポリシーを含む。file は必ず最後に append する。
      const formData = new FormData()
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string))
      formData.append('file', file)

      const uploadRes = await fetch(url, { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error(`S3 upload failed: ${uploadRes.status}`)

      // 3. DSQL にデッキレコードを登録
      await createDeckRecord({
        deckId,
        fileKey: key,
        title: title.trim(),
        description: description.trim(),
        category,
        originalLanguage: original,
        targetLanguages: targets,
      })

      // 4. SQS に処理ジョブを登録
      await enqueueProcessing({
        deckId,
        fileKey: key,
        targetLanguages: targets,
        title: title.trim(),
        description: description.trim(),
        category,
        originalLanguage: original,
      })

      toast.success('Deck uploaded — translation in progress')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Upload a deck
            </h1>
            <p className="mt-1 text-muted-foreground">
              Drop in a PDF and choose which languages to translate it into.
            </p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-8">
            {/* Dropzone */}
            {!file ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  handleFiles(e.dataTransfer.files)
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors',
                  dragging
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-card hover:border-accent/60',
                )}
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <UploadCloud className="size-7" />
                </span>
                <span className="font-heading text-lg font-semibold text-foreground">
                  Drag & drop your PDF here
                </span>
                <span className="text-sm text-muted-foreground">
                  or click to browse — up to {MAX_UPLOAD_LABEL}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </button>
            ) : (
              <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <FileText className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB · PDF
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  aria-label="Remove file"
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}

            {/* Metadata */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Designing for Aurora DSQL at Global Scale"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this talk about?"
                  rows={3}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Original language</Label>
                  <Select
                    value={original}
                    onValueChange={(v) => setOriginal(v as LanguageCode)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.native}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Target languages */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-2">
                  <Globe className="size-4 text-accent" />
                  Translate into
                </Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.filter((l) => l.code !== original).map((l) => {
                    const active = targets.includes(l.code)
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => toggleTarget(l.code)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                          active
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {active && <Check className="size-3.5" />}
                        {l.native}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {targets.length} target {targets.length === 1 ? 'language' : 'languages'} selected
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
              <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? 'Uploading…' : 'Upload & translate'}
              </Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
