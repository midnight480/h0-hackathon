import { ImageResponse } from 'next/og'

export const alt = 'Hiravi — Share slides across every language'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// 紙(paper) + 朱色(vermillion) のブランドパレット
const PAPER = '#F4F3EE'
const INK = '#1C1B19'
const VERMILLION = '#E14A2B'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* ブランド行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <path
              d="M7 5.5C7 5.5 13 3 20 5.5C24.5 7.1 26 11 26 16C26 22 22 27 15 28C15 28 19 22 17 16C15.5 11.5 11 9 7 9V5.5Z"
              fill={VERMILLION}
            />
            <path
              d="M6 9.5C10 9.5 14.5 12 16 16.5C18 22.5 13.5 28.5 13.5 28.5C7.5 27.5 4 23 4 17.5C4 14 4.8 11.2 6 9.5Z"
              fill={VERMILLION}
              opacity="0.45"
            />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, color: INK }}>Hiravi</span>
        </div>

        {/* メインコピー */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: INK,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            Share slides across every language
          </span>
          <span style={{ fontSize: 34, color: '#5B584F', lineHeight: 1.3 }}>
            Upload a PDF once — read any deck in your language with instant AI
            translation in 75+ languages.
          </span>
        </div>

        {/* フッター */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', width: 48, height: 8, background: VERMILLION, borderRadius: 4 }} />
          <span style={{ fontSize: 28, color: '#5B584F' }}>hiravi.midnight480.com</span>
        </div>
      </div>
    ),
    size,
  )
}
