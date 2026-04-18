import type { HookContext } from '@feathersjs/feathers'

export function setTimestamps(context: HookContext): void {
  const data = context.data as Record<string, unknown> | undefined
  if (!data) return

  const now = new Date().toISOString()

  if (context.method === 'create') {
    data['createdAt'] ??= now
    data['updatedAt'] ??= now
  } else if (context.method === 'patch' || context.method === 'update') {
    data['updatedAt'] = now
  }
}
