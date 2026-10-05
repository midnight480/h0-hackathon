// Google Slides 共有URL からプレゼンID を抽出する。
// 対応形式:
//   https://docs.google.com/presentation/d/<ID>/edit[#slide=...]
//   https://docs.google.com/presentation/d/<ID>/edit?usp=sharing
//   https://docs.google.com/presentation/d/<ID>/view | /pub | /present など
//   https://docs.google.com/presentation/d/<ID> (パス末尾)
const PRESENTATION_PATH_RE = /^\/presentation\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/

export function parseGoogleSlidesPresentationId(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.hostname.toLowerCase() !== 'docs.google.com') return null
  const m = url.pathname.match(PRESENTATION_PATH_RE)
  return m ? m[1] : null
}
