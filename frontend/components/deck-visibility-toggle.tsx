'use client'

import { useTransition } from 'react'
import { Globe, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { toggleVisibility } from '@/app/actions/deck'

export function DeckVisibilityToggle({
  deckId,
  isPublic,
}: {
  deckId: string
  isPublic: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(checked: boolean) {
    startTransition(async () => {
      try {
        await toggleVisibility(deckId, checked)
        toast.success(checked ? 'Set to public' : 'Set to private')
      } catch {
        toast.error('Failed to update visibility')
      }
    })
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {isPublic ? (
        <Globe className="size-3.5 text-muted-foreground" />
      ) : (
        <Lock className="size-3.5 text-muted-foreground" />
      )}
      <Switch
        checked={isPublic}
        onCheckedChange={handleChange}
        disabled={isPending}
        size="sm"
        aria-label={isPublic ? 'Set to private' : 'Set to public'}
      />
    </div>
  )
}
