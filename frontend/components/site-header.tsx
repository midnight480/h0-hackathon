'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Upload } from 'lucide-react'
import { useAuth, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/browse', label: 'Browse' },
  { href: '/dashboard', label: 'Dashboard' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const { isLoaded, isSignedIn } = useAuth()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Hiravi home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground',
                  pathname.startsWith(item.href)
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isLoaded && isSignedIn && (
            <>
              <Button
                render={<Link href="/upload" />}
                nativeButton={false}
                variant="default"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Upload className="size-4" />
                Upload
              </Button>
              <UserButton />
            </>
          )}
          {isLoaded && !isSignedIn && (
            <>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="default" size="sm">Sign up</Button>
              </SignUpButton>
            </>
          )}

          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mt-8 flex flex-col gap-1 px-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/upload"
                  className="mt-2 flex items-center gap-2 rounded-md bg-primary px-3 py-2.5 text-base font-medium text-primary-foreground"
                >
                  <Upload className="size-4" />
                  Upload a deck
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
