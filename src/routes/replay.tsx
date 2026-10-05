import { createFileRoute } from '@tanstack/react-router'
import { DemoWorkspace } from '../components/DemoWorkspace'
import { defaultExampleId, parseExampleId } from '../demo/examples'
import type { ExampleId } from '../demo/examples'

export const Route = createFileRoute('/replay')({
  component: DemoWorkspace,
  validateSearch: (
    search: Record<string, unknown>,
  ): { source: 'local' | 'example'; round?: number; example?: ExampleId } => {
    const source = search.source === 'example' ? 'example' : 'local'
    const example = search.example === undefined ? defaultExampleId : parseExampleId(search.example)
    if (source === 'example' && example === undefined) throw new Error('Unknown example recording.')
    return {
      source,
      ...(source === 'example' ? { example } : {}),
      ...(Number.isSafeInteger(Number(search.round)) && Number(search.round) > 0
        ? { round: Number(search.round) }
        : {}),
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, preload }) => {
    if (!preload) context.replay.restore(deps.source, deps.round, deps.example)
  },
})
