import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test/')({ component: TestIndex })

const experiments = [{ to: '/test/cards', search: { page: 1 }, title: 'Player cards' }] as const

function TestIndex() {
  return (
    <main className="gui-roundtable min-h-dvh bg-(--neutral-1) p-(--space-xl)">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-(--space-m)">
        {experiments.map((experiment) => (
          <li key={experiment.to}>
            <Link
              to={experiment.to}
              search={experiment.search}
              className="block rounded-(--radius-m) bg-(--neutral-2) p-(--space-l) type-m weight-medium transition-colors motion-small hover:bg-(--neutral-3) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-1)"
            >
              {experiment.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
