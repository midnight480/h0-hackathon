'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  FileText,
  Globe,
  Link2,
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
import { useT } from '@/lib/i18n/locale-provider'
import { cn } from '@/lib/utils'
import { getPresignedUploadUrl, createDeckRecord, enqueueProcessing } from '@/app/actions/upload'
import { importFromGoogleSlides } from '@/app/actions/import'

export default function UploadPage() {
  const router = useRouter()
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('tech')
  const [original, setOriginal] = useState<LanguageCode>('en')
  const [targets, setTargets] = useState<LanguageCode[]>(['ja', 'zh'])
  const [gsUrl, setGsUrl] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      toast.error(t('upload.toastNotPdf'))
      return
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error(t('upload.toastTooLarge', { limit: MAX_UPLOAD_LABEL }))
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
    const useGslides = gsUrl.trim().length > 0
    if (!useGslides) {
      if (!file) return toast.error(t('upload.toastAddPdf'))
      if (file.size > MAX_UPLOAD_BYTES) {
        return toast.error(t('upload.toastTooLarge', { limit: MAX_UPLOAD_LABEL }))
      }
    }
    if (useGslides && !consent) {
      return toast.error(t('upload.toastNeedConsent'))
    }
    setSubmitting(true)

    try {
      let deckId: string
      let fileKey: string
      let deckTitle = title.trim()

      if (useGslides) {
        // Google Slides: Drive API で PDF をサーバー側取得 → S3 保存済み
        const res = await importFromGoogleSlides(gsUrl.trim())
        if (!res.ok) {
          toast.error(
            t(`upload.importError.${res.code}`, { limit: MAX_UPLOAD_LABEL }),
          )
          return
        }
        deckId = res.deckId
        fileKey = res.fileKey
        if (!deckTitle) deckTitle = res.suggestedTitle
      } else {
        // 1. presigned POST を取得
        const presigned = await getPresignedUploadUrl(file!.name, file!.type)
        deckId = presigned.deckId
        fileKey = presigned.key

        // 2. S3 に直接アップロード（multipart/form-data POST）
        //    fields は presigned POST の署名・ポリシーを含む。file は必ず最後に append する。
        const formData = new FormData()
        Object.entries(presigned.fields).forEach(([k, v]) => formData.append(k, v as string))
        formData.append('file', file!)

        const uploadRes = await fetch(presigned.url, { method: 'POST', body: formData })
        if (!uploadRes.ok) throw new Error(`S3 upload failed: ${uploadRes.status}`)
      }

      if (!deckTitle) return toast.error(t('upload.toastNeedTitle'))

      // 3. DSQL にデッキレコードを登録
      await createDeckRecord({
        deckId,
        fileKey,
        title: deckTitle,
        description: description.trim(),
        category,
        originalLanguage: original,
        targetLanguages: targets,
      })

      // 4. SQS に処理ジョブを登録
      await enqueueProcessing({
        deckId,
        fileKey,
        targetLanguages: targets,
        title: deckTitle,
        description: description.trim(),
        category,
        originalLanguage: original,
      })

      toast.success(t('upload.toastSuccess'))
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error(t('upload.toastFailed'))
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
              {t('upload.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t('upload.subtitle')}
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
                  {t('upload.dropTitle')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('upload.dropHint', { limit: MAX_UPLOAD_LABEL })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('upload.dropNote')}
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
                  aria-label={t('upload.removeFile')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}

            {/* Google Slides import */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {t('upload.importDivider')}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="gslides-url"
                className="flex items-center gap-2"
              >
                <Link2 className="size-4 text-accent" />
                {t('upload.gslidesLabel')}
              </Label>
              <Input
                id="gslides-url"
                type="url"
                value={gsUrl}
                onChange={(e) => setGsUrl(e.target.value)}
                placeholder="https://docs.google.com/presentation/d/…"
              />
              <p className="text-xs text-muted-foreground">
                {t('upload.gslidesHint')}
              </p>
              {gsUrl.trim() && (
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 accent-accent"
                  />
                  {t('upload.consentLabel')}
                </label>
              )}
            </div>

            {/* Metadata */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">{t('upload.fieldTitle')}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('upload.titlePlaceholder')}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">{t('upload.fieldDescription')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('upload.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t('upload.fieldCategory')}</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v ?? 'tech')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {t(`categories.${c.value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{t('upload.fieldOriginal')}</Label>
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
                  {t('upload.translateInto')}
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
                  {t(
                    targets.length === 1
                      ? 'upload.targetsSelected'
                      : 'upload.targetsSelectedPlural',
                    { count: targets.length },
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
              <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
                {t('upload.cancel')}
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? t('upload.submitting') : t('upload.submit')}
              </Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
