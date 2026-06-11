import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="size-7 text-accent"
      >
        {/* a sheet of paper fluttering — ひらり */}
        <path
          d="M7 5.5C7 5.5 13 3 20 5.5C24.5 7.1 26 11 26 16C26 22 22 27 15 28C15 28 19 22 17 16C15.5 11.5 11 9 7 9V5.5Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M6 9.5C10 9.5 14.5 12 16 16.5C18 22.5 13.5 28.5 13.5 28.5C7.5 27.5 4 23 4 17.5C4 14 4.8 11.2 6 9.5Z"
          fill="currentColor"
          opacity="0.45"
        />
      </svg>
      <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
        Hiravi
      </span>
    </span>
  )
}
