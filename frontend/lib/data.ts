export type Category = 'tech' | 'business' | 'design' | 'education' | 'other'

export type ProcessingStatus = 'ready' | 'processing' | 'pending' | 'failed'

export type LanguageCode =
  | 'af' | 'sq' | 'am' | 'ar' | 'hy' | 'az'
  | 'bn' | 'bs' | 'bg' | 'ca'
  | 'zh' | 'zh-TW'
  | 'hr' | 'cs' | 'da' | 'fa-AF' | 'nl'
  | 'en' | 'et' | 'fa' | 'tl' | 'fi'
  | 'fr' | 'fr-CA' | 'ka' | 'de' | 'el' | 'gu'
  | 'ht' | 'ha' | 'he' | 'hi' | 'hu'
  | 'is' | 'id' | 'ga' | 'it'
  | 'ja' | 'kn' | 'kk' | 'ko'
  | 'lv' | 'lt' | 'mk' | 'ms' | 'ml' | 'mt' | 'mr' | 'mn'
  | 'no' | 'ps' | 'pl'
  | 'pt' | 'pt-PT' | 'pa'
  | 'ro' | 'ru' | 'sr' | 'si' | 'sk' | 'sl' | 'so'
  | 'es' | 'es-MX' | 'sw' | 'sv'
  | 'ta' | 'te' | 'th' | 'tr'
  | 'uk' | 'ur' | 'uz' | 'vi' | 'cy'

export interface Language {
  code: LanguageCode
  label: string
  native: string
}

export const LANGUAGES: Language[] = [
  { code: 'af',    label: 'Afrikaans',               native: 'Afrikaans' },
  { code: 'sq',    label: 'Albanian',                native: 'Shqip' },
  { code: 'am',    label: 'Amharic',                 native: 'አማርኛ' },
  { code: 'ar',    label: 'Arabic',                  native: 'العربية' },
  { code: 'hy',    label: 'Armenian',                native: 'Հայերեն' },
  { code: 'az',    label: 'Azerbaijani',             native: 'Azərbaycanca' },
  { code: 'bn',    label: 'Bengali',                 native: 'বাংলা' },
  { code: 'bs',    label: 'Bosnian',                 native: 'Bosanski' },
  { code: 'bg',    label: 'Bulgarian',               native: 'Български' },
  { code: 'ca',    label: 'Catalan',                 native: 'Català' },
  { code: 'zh',    label: 'Chinese (Simplified)',    native: '中文（简体）' },
  { code: 'zh-TW', label: 'Chinese (Traditional)',  native: '中文（繁體）' },
  { code: 'hr',    label: 'Croatian',                native: 'Hrvatski' },
  { code: 'cs',    label: 'Czech',                   native: 'Čeština' },
  { code: 'da',    label: 'Danish',                  native: 'Dansk' },
  { code: 'fa-AF', label: 'Dari',                    native: 'دری' },
  { code: 'nl',    label: 'Dutch',                   native: 'Nederlands' },
  { code: 'en',    label: 'English',                 native: 'English' },
  { code: 'et',    label: 'Estonian',                native: 'Eesti' },
  { code: 'fa',    label: 'Farsi (Persian)',         native: 'فارسی' },
  { code: 'tl',    label: 'Filipino (Tagalog)',      native: 'Filipino' },
  { code: 'fi',    label: 'Finnish',                 native: 'Suomi' },
  { code: 'fr',    label: 'French',                  native: 'Français' },
  { code: 'fr-CA', label: 'French (Canada)',         native: 'Français (Canada)' },
  { code: 'ka',    label: 'Georgian',                native: 'ქართული' },
  { code: 'de',    label: 'German',                  native: 'Deutsch' },
  { code: 'el',    label: 'Greek',                   native: 'Ελληνικά' },
  { code: 'gu',    label: 'Gujarati',                native: 'ગુજરાતી' },
  { code: 'ht',    label: 'Haitian Creole',          native: 'Kreyòl ayisyen' },
  { code: 'ha',    label: 'Hausa',                   native: 'Hausa' },
  { code: 'he',    label: 'Hebrew',                  native: 'עברית' },
  { code: 'hi',    label: 'Hindi',                   native: 'हिन्दी' },
  { code: 'hu',    label: 'Hungarian',               native: 'Magyar' },
  { code: 'is',    label: 'Icelandic',               native: 'Íslenska' },
  { code: 'id',    label: 'Indonesian',              native: 'Bahasa Indonesia' },
  { code: 'ga',    label: 'Irish',                   native: 'Gaeilge' },
  { code: 'it',    label: 'Italian',                 native: 'Italiano' },
  { code: 'ja',    label: 'Japanese',                native: '日本語' },
  { code: 'kn',    label: 'Kannada',                 native: 'ಕನ್ನಡ' },
  { code: 'kk',    label: 'Kazakh',                  native: 'Қазақша' },
  { code: 'ko',    label: 'Korean',                  native: '한국어' },
  { code: 'lv',    label: 'Latvian',                 native: 'Latviešu' },
  { code: 'lt',    label: 'Lithuanian',              native: 'Lietuvių' },
  { code: 'mk',    label: 'Macedonian',              native: 'Македонски' },
  { code: 'ms',    label: 'Malay',                   native: 'Bahasa Melayu' },
  { code: 'ml',    label: 'Malayalam',               native: 'മലയാളം' },
  { code: 'mt',    label: 'Maltese',                 native: 'Malti' },
  { code: 'mr',    label: 'Marathi',                 native: 'मराठी' },
  { code: 'mn',    label: 'Mongolian',               native: 'Монгол' },
  { code: 'no',    label: 'Norwegian (Bokmål)',      native: 'Norsk (Bokmål)' },
  { code: 'ps',    label: 'Pashto',                  native: 'پښتو' },
  { code: 'pl',    label: 'Polish',                  native: 'Polski' },
  { code: 'pt',    label: 'Portuguese (Brazil)',     native: 'Português (Brasil)' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)',   native: 'Português (Portugal)' },
  { code: 'pa',    label: 'Punjabi',                 native: 'ਪੰਜਾਬੀ' },
  { code: 'ro',    label: 'Romanian',                native: 'Română' },
  { code: 'ru',    label: 'Russian',                 native: 'Русский' },
  { code: 'sr',    label: 'Serbian',                 native: 'Српски' },
  { code: 'si',    label: 'Sinhala',                 native: 'සිංහල' },
  { code: 'sk',    label: 'Slovak',                  native: 'Slovenčina' },
  { code: 'sl',    label: 'Slovenian',               native: 'Slovenščina' },
  { code: 'so',    label: 'Somali',                  native: 'Soomaali' },
  { code: 'es',    label: 'Spanish',                 native: 'Español' },
  { code: 'es-MX', label: 'Spanish (Mexico)',        native: 'Español (México)' },
  { code: 'sw',    label: 'Swahili',                 native: 'Kiswahili' },
  { code: 'sv',    label: 'Swedish',                 native: 'Svenska' },
  { code: 'ta',    label: 'Tamil',                   native: 'தமிழ்' },
  { code: 'te',    label: 'Telugu',                  native: 'తెలుగు' },
  { code: 'th',    label: 'Thai',                    native: 'ไทย' },
  { code: 'tr',    label: 'Turkish',                 native: 'Türkçe' },
  { code: 'uk',    label: 'Ukrainian',               native: 'Українська' },
  { code: 'ur',    label: 'Urdu',                    native: 'اردو' },
  { code: 'uz',    label: 'Uzbek',                   native: 'Oʻzbekcha' },
  { code: 'vi',    label: 'Vietnamese',              native: 'Tiếng Việt' },
  { code: 'cy',    label: 'Welsh',                   native: 'Cymraeg' },
]

export interface Author {
  username: string
  name: string
  avatarUrl: string
}

export interface Slide {
  pageNumber: number
  imageUrl: string
  text: Partial<Record<LanguageCode, string>>
}

export interface Deck {
  id: string
  slug: string
  shortId?: string
  title: string
  description: string
  author: Author
  category: Category
  tags: string[]
  originalLanguage: LanguageCode
  targetLanguages: LanguageCode[]
  slideCount: number
  views: number
  likes: number
  status: ProcessingStatus
  publishedAt: string
  cover: string
  slides: Slide[]
}

export const CATEGORIES: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tech', label: 'Technology' },
  { value: 'business', label: 'Business' },
  { value: 'design', label: 'Design' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
]

export function languageLabel(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${n}`
}
