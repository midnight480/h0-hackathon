import { clerkClient } from '@clerk/nextjs/server'

export interface UserInfo {
  name: string
  avatarUrl: string
}

export async function getClerkUsers(userIds: string[]): Promise<Map<string, UserInfo>> {
  const unique = [...new Set(userIds)]
  const clerk = await clerkClient()
  const results = await Promise.all(
    unique.map((id) => clerk.users.getUser(id).catch(() => null)),
  )
  const map = new Map<string, UserInfo>()
  unique.forEach((id, i) => {
    const u = results[i]
    map.set(id, {
      name: u
        ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || id
        : id,
      avatarUrl: u?.imageUrl ?? '',
    })
  })
  return map
}
