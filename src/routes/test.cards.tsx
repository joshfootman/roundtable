import { createFileRoute } from '@tanstack/react-router'
import { PlayerCardsLab } from '../components/test/PlayerCardsLab'
import { cardVariants } from '../components/test/card-variants'

export const Route = createFileRoute('/test/cards')({
  component: PlayerCardsLab,
  validateSearch: (search: Record<string, unknown>): { page: number } => {
    const page = Number(search.page)
    return {
      page: Number.isSafeInteger(page) && page >= 1 && page <= cardVariants.length ? page : 1,
    }
  },
})
