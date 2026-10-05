import { createFileRoute } from '@tanstack/react-router'
import { DemoWorkspace } from '../components/DemoWorkspace'

export const Route = createFileRoute('/replay')({
  component: DemoWorkspace,
  validateSearch: (
    search: Record<string, unknown>,
  ): { source: 'local' | 'example'; round?: number } => ({
    source: search.source === 'example' ? 'example' : 'local',
    ...(Number.isSafeInteger(Number(search.round)) && Number(search.round) > 0
      ? { round: Number(search.round) }
      : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, preload }) => {
    if (!preload) context.replay.restore(deps.source, deps.round)
  },
})
