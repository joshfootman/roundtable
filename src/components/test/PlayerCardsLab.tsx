import { useEffect } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { cardVariants, type CardVariant } from './card-variants'
import { samplePlayers } from './sample-players'

const route = getRouteApi('/test/cards')

export function PlayerCardsLab() {
  const { page } = route.useSearch()
  const navigate = route.useNavigate()
  const variant = cardVariants[page - 1]!
  const go = (next: number) =>
    navigate({ search: { page: Math.min(cardVariants.length, Math.max(1, next)) }, replace: true })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return
      if (event.key === 'ArrowRight') go(page + 1)
      else if (event.key === 'ArrowLeft') go(page - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <main className="gui-roundtable min-h-dvh bg-(--neutral-1) px-(--space-l) pt-(--space-l) pb-[calc(var(--space-xxl)*3)]">
      <header className="mb-(--space-l) flex items-baseline gap-(--space-m)">
        <Link
          to="/test"
          className="type-s text-(--text-muted) hover:text-(--text-strong) focus-visible:outline-2 focus-visible:outline-(--color-1)"
        >
          Tests
        </Link>
        <h1 className="type-m weight-medium">{variant.label}</h1>
      </header>
      <Players variant={variant} />
      <nav
        aria-label="Card designs"
        className="fixed inset-x-0 bottom-(--space-xl) flex justify-center"
      >
        <ol className="flex items-center gap-(--space-xs) rounded-(--radius-full) bg-(--neutral-3) px-(--space-m) py-(--space-s)">
          {cardVariants.map((candidate, index) => (
            <li key={candidate.id} className="flex">
              <button
                type="button"
                aria-label={candidate.label}
                aria-current={index + 1 === page ? 'page' : undefined}
                title={candidate.label}
                onClick={() => go(index + 1)}
                className="size-(--space-xs) cursor-pointer rounded-(--radius-full) bg-(--neutral-6) transition-[background-color,scale] motion-small hover:bg-(--neutral-8) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-1) aria-[current=page]:scale-200 aria-[current=page]:bg-(--neutral-10)"
              />
            </li>
          ))}
        </ol>
      </nav>
    </main>
  )
}

function Players({ variant }: { variant: CardVariant }) {
  const { Card } = variant
  const teams = [
    { team: 3, label: 'Counter-Terrorist players' },
    { team: 2, label: 'Terrorist players' },
  ] as const
  if (variant.layout === 'strip')
    return (
      <div className="grid gap-(--space-l) xl:grid-cols-2">
        {teams.map(({ team, label }) => (
          <ul
            key={team}
            aria-label={label}
            className="grid grid-cols-2 gap-(--space-xs) sm:grid-cols-5"
          >
            {samplePlayers
              .filter((player) => player.team === team)
              .map((player) => (
                <Card key={player.steamId} player={player} />
              ))}
          </ul>
        ))}
      </div>
    )
  return (
    <div className="grid gap-(--space-l) md:grid-cols-2 md:justify-between">
      {teams.map(({ team, label }) => (
        <ul
          key={team}
          aria-label={label}
          className={`flex w-full flex-col gap-(--space-xxs) md:max-w-[min(100%,360px)] ${team === 2 ? 'md:justify-self-end' : ''}`}
        >
          {samplePlayers
            .filter((player) => player.team === team)
            .map((player) => (
              <Card key={player.steamId} player={player} />
            ))}
        </ul>
      ))}
    </div>
  )
}
