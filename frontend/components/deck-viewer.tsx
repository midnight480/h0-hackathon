'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Languages,
  Maximize2,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeckCard } from '@/components/deck-card'
import {
  type Deck,
  type LanguageCode,
  type SlideBlock,
  LANGUAGES,
  formatCount,
  languageLabel,
} from '@/lib/data'
import { useT } from '@/lib/i18n/locale-provider'
import { cn } from '@/lib/utils'
import { likeDeck } from '@/app/actions/deck'

type ViewMode = 'overlay' | 'text' | 'image'

// 背景色の輝度から、読みやすい文字色（黒/白）を選ぶ。
function readableTextColor(bg: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(bg.trim())
  if (!m) return '#111111'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#111111' : '#ffffff'
}

// オーバーレイ 1 ブロック。元画像上の bbox 位置に絶対配置し、訳文を重ねる。
// フォントはコンテナクエリ高さ単位 (cqh) で解像度非依存にスケールし、
// ブロックに収まらない場合は二分探索でフォントを縮める簡易オートフィットを行う。
function OverlayBlock({
  block,
  lang,
  originalLanguage,
  revision,
}: {
  block: SlideBlock
  lang: LanguageCode
  originalLanguage: LanguageCode
  // 画像ロード完了などで増える再フィット用シグナル
  revision: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const text =
    block.t[lang] ?? block.t[originalLanguage] ?? block.t.original ?? ''
  // ページ高に対する正規化フォントサイズ → cqh 基準値（百分率）
  const baseFs = (block.fs || 0.03) * 100
  const textColor = readableTextColor(block.bg)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const MIN_MULT = 0.4 // 潰れすぎ防止のためのフォント下限係数
    const apply = (mult: number) => {
      el.style.fontSize = `${baseFs * mult}cqh`
    }
    const fits = () =>
      el.scrollHeight <= el.clientHeight + 1 &&
      el.scrollWidth <= el.clientWidth + 1

    // フォントは cqh 単位なのでコンテナのリサイズには CSS 側で自動追従する。
    // ブロック寸法（%）とフォント（cqh）が同じコンテナ基準でスケールするため、
    // 収まるか否かはスケール不変 → 一度フィット係数を決めれば全サイズで有効。
    // よってウィンドウリサイズ用の継続的な ResizeObserver は不要（自己監視による
    // ResizeObserver ループ警告も回避）。text/baseFs 変化と画像ロード完了
    // (revision) の時のみ、有効な高さで 1 回フィットすれば足りる。
    apply(1)
    if (fits()) return
    let lo = MIN_MULT
    let hi = 1
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      apply(mid)
      if (fits()) lo = mid
      else hi = mid
    }
    apply(lo)
  }, [text, baseFs, revision])

  if (!text) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: `${block.x0 * 100}%`,
        top: `${block.y0 * 100}%`,
        width: `${(block.x1 - block.x0) * 100}%`,
        height: `${(block.y1 - block.y0) * 100}%`,
        background: block.bg,
        color: textColor,
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '0.5cqh 0.4cqh',
        borderRadius: '0.4cqh',
      }}
    >
      <div
        ref={ref}
        style={{
          fontSize: `${baseFs}cqh`,
          lineHeight: 1.15,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  )
}

export function DeckViewer({
  deck,
  related,
  initialLiked = false,
}: {
  deck: Deck
  related: Deck[]
  initialLiked?: boolean
}) {
  const t = useT()
  const available: LanguageCode[] = [...new Set([deck.originalLanguage, ...deck.targetLanguages])]
  const [lang, setLang] = useState<LanguageCode>(deck.originalLanguage)
  const [index, setIndex] = useState(0)
  const [liked, setLiked] = useState(initialLiked)
  const [optimisticLikes, setOptimisticLikes] = useState(deck.likes)
  const [isPending, startTransition] = useTransition()

  // オーバーレイ用ブロックを持つデッキか（旧デッキは layout が空なので無効化）
  const hasLayout = useMemo(
    () => deck.slides.some((s) => (s.layout?.length ?? 0) > 0),
    [deck.slides],
  )
  // 表示モード：layout があれば既定で「重ねて表示」、無ければ従来のテキストパネル
  const [viewMode, setViewMode] = useState<ViewMode>(hasLayout ? 'overlay' : 'text')
  // 画像ロード完了でインクリメントし、オーバーレイの再フィットを促すシグナル。
  // 画像の自然高さが確定して初めて cqh が正しく解決されるため、ロード後に 1 回再計算する。
  const [imgRev, setImgRev] = useState(0)

  const slide = deck.slides[index]
  const total = deck.slides.length

  const go = (dir: number) =>
    setIndex((i) => Math.min(Math.max(i + dir, 0), total - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  const slideText = slide?.text?.[lang] ?? slide?.text?.[deck.originalLanguage] ?? slide?.text?.en

  const share = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = deck.shortId ? `${origin}/s/${deck.shortId}` : window.location.href
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('viewer.linkCopied'))
    } catch {
      toast.error(t('viewer.linkFailed'))
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Title row */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{t(`categories.${deck.category}`)}</Badge>
            <Badge variant="outline" className="gap-1">
              <Languages className="size-3" />
              {t('viewer.languagesCount', { count: available.length })}
            </Badge>
          </div>
          <h1 className="text-balance font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {deck.title}
          </h1>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Viewer column */}
        <div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {(() => {
              const navButtons = (
                <>
                  <button
                    onClick={() => go(-1)}
                    disabled={index === 0}
                    aria-label={t('viewer.prevSlide')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    onClick={() => go(1)}
                    disabled={index === total - 1}
                    aria-label={t('viewer.nextSlide')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )
              const img = (
                <img
                  src={slide?.imageUrl || '/placeholder.svg'}
                  alt={`Slide ${index + 1} of ${total}`}
                  onLoad={() => setImgRev((r) => r + 1)}
                  className={
                    viewMode === 'overlay'
                      ? 'block h-auto w-full'
                      : 'size-full object-contain'
                  }
                />
              )
              if (viewMode === 'overlay') {
                // 元画像の実描画領域にぴったり重ねる（レターボックス無しの自然アスペクト）。
                // オーバーレイ層は absolute inset-0 で画像と同寸になり、container-type:size で
                // cqh/cqw が画像高さ・幅基準で解決される。
                return (
                  <div className="relative bg-muted">
                    {img}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{ containerType: 'size' }}
                    >
                      {(slide?.layout ?? []).map((b, i) => (
                        <OverlayBlock
                          key={i}
                          block={b}
                          lang={lang}
                          originalLanguage={deck.originalLanguage}
                          revision={imgRev}
                        />
                      ))}
                    </div>
                    {navButtons}
                  </div>
                )
              }
              return (
                <div className="relative aspect-[16/10] bg-muted">
                  {img}
                  {navButtons}
                </div>
              )
            })()}

            {/* Controls bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="size-9" onClick={() => go(-1)} disabled={index === 0} aria-label={t('viewer.prevSlide')}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-16 text-center text-sm font-medium tabular-nums text-foreground">
                  {index + 1} / {total}
                </span>
                <Button variant="outline" size="icon" className="size-9" onClick={() => go(1)} disabled={index === total - 1} aria-label={t('viewer.nextSlide')}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Select value={lang} onValueChange={(v) => setLang(v as LanguageCode)}>
                  <SelectTrigger className="h-9 w-[150px]" aria-label={t('viewer.readingLanguage')}>
                    <Languages className="size-4 text-accent" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((code) => (
                      <SelectItem key={code} value={code}>
                        {LANGUAGES.find((l) => l.code === code)?.native ?? code}
                        {code === deck.originalLanguage ? t('viewer.original') : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div
                  className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
                  role="group"
                  aria-label={t('viewer.viewMode')}
                >
                  {(['overlay', 'text', 'image'] as ViewMode[]).map((m) => (
                    <Button
                      key={m}
                      variant={viewMode === m ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-2.5"
                      onClick={() => setViewMode(m)}
                      disabled={m === 'overlay' && !hasLayout}
                      aria-pressed={viewMode === m}
                    >
                      {m === 'overlay'
                        ? t('viewer.overlayMode')
                        : m === 'text'
                          ? t('viewer.textMode')
                          : t('viewer.imageMode')}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Translated text panel */}
          {viewMode === 'text' && (
            <div className="mt-4 rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Languages className="size-3.5 text-accent" />
                {languageLabel(lang)}
                {lang !== deck.originalLanguage && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {t('viewer.aiTranslated')}
                  </Badge>
                )}
              </div>
              <p className="text-pretty text-lg leading-relaxed text-foreground">
                {slideText || t('viewer.noText')}
              </p>
            </div>
          )}

          {/* Thumbnails */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t('viewer.allSlides')}
            </h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {deck.slides.map((s, i) => (
                <button
                  key={s.pageNumber}
                  onClick={() => setIndex(i)}
                  aria-label={`${t('viewer.allSlides')} ${i + 1}`}
                  className={cn(
                    'relative aspect-[16/10] overflow-hidden rounded-md border-2 bg-muted transition',
                    i === index ? 'border-accent' : 'border-transparent hover:border-border',
                  )}
                >
                  <img src={s.imageUrl || '/placeholder.svg'} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                if (liked || isPending) return
                setLiked(true)
                setOptimisticLikes((n) => n + 1)
                startTransition(async () => {
                  try {
                    const res = await likeDeck(deck.id)
                    if (res.alreadyLiked) {
                      // サーバー側で既にいいね済み判定 → カウントを戻す
                      setOptimisticLikes((n) => n - 1)
                    }
                  } catch {
                    setLiked(false)
                    setOptimisticLikes((n) => n - 1)
                    toast.error(t('viewer.failedToLike'))
                  }
                })
              }}
              variant={liked ? 'default' : 'outline'}
              disabled={isPending || liked}
              className="flex-1 gap-2"
            >
              <Heart className={cn('size-4', liked && 'fill-current')} />
              {formatCount(optimisticLikes)}
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={share}>
              <Share2 className="size-4" />
              {t('viewer.share')}
            </Button>
          </div>

          {/* Author */}
          <div className="rounded-xl border border-border bg-card p-5">
            <Link href={`/@${deck.author.username}`} className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarImage src={deck.author.avatarUrl || '/placeholder.svg'} alt="" />
                <AvatarFallback>{deck.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading font-semibold text-foreground">
                  {deck.author.name}
                </p>
              </div>
            </Link>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
              {deck.description}
            </p>
            <dl className="mt-4 flex items-center gap-5 border-t border-border pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Heart className="size-4" />
                {formatCount(optimisticLikes)}
              </div>
              <div className="flex items-center gap-1.5">
                <Maximize2 className="size-4" />
                {t('viewer.slidesCount', { count: deck.slideCount })}
              </div>
            </dl>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('viewer.tags')}</h2>
            <div className="flex flex-wrap gap-2">
              {deck.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/browse?q=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-border px-3 py-1 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  {tag}
                </Link>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{t('viewer.published')}</p>
              <p className="text-sm text-foreground">
                {new Date(deck.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-heading text-2xl font-bold tracking-tight text-foreground">
            {t('viewer.moreLikeThis')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((d) => (
              <DeckCard key={d.id} deck={d} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
