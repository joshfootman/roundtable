import { examples, type ExampleId } from '#/demo/examples'
import type { ImportState } from '#/demo/session'

const matchDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function ExampleDemos({
  state,
  activeExample,
  onSelect,
}: {
  state: ImportState
  activeExample: ExampleId | undefined
  onSelect: (id: ExampleId) => void
}) {
  const loading =
    state.status === 'reading' || (state.status === 'ready' && state.parsing.status === 'active')

  return (
    <div className="demo-content min-h-0 flex-1 overflow-y-auto px-2 pb-2 replay-desktop:px-4 replay-desktop:pb-4">
      <section
        aria-labelledby="example-demos-heading"
        className="rounded-2xl bg-neutral-900/50 px-4 pt-2 pb-4 sm:px-6 sm:pt-4 sm:pb-6"
      >
        <div className="pt-2 pb-5">
          <h1 id="example-demos-heading" className="text-2xl font-medium text-balance">
            Example demos
          </h1>
          <p className="mt-1 text-sm text-pretty text-mauve-200/65">
            Pick a match to replay, or choose your own demo.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Object.values(examples).map((example) => {
            const busy = loading && activeExample === example.id
            return (
              <button
                key={example.id}
                type="button"
                aria-label={`Play ${example.teams[0].name} vs ${example.teams[1].name}, ${example.mapName}, ${example.event}, map ${example.mapNumber}`}
                aria-busy={busy}
                onClick={() => onSelect(example.id)}
                className="min-w-0 cursor-pointer overflow-hidden rounded-2xl bg-neutral-700/30 text-left outline-offset-2 transition-colors duration-150 ease-out hover:bg-neutral-700/60 focus-visible:outline-2 focus-visible:outline-mauve-200 active:bg-neutral-700 motion-reduce:transition-none"
              >
                <div className="relative">
                  <img
                    src={example.mapImage}
                    width={768}
                    height={432}
                    loading="lazy"
                    alt={`${example.mapName} map`}
                    className="aspect-video w-full object-cover outline-1 -outline-offset-1 outline-white/10"
                  />
                  <span className="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-neutral-900/85 px-2.5 py-1 text-sm font-medium">
                      {example.mapName}
                    </span>
                    {busy && (
                      <output className="rounded-lg bg-neutral-900/85 px-2.5 py-1 text-sm">
                        Loading…
                      </output>
                    )}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex flex-col gap-2.5">
                    {example.teams.map((team, index) => (
                      <div key={team.name} className="flex min-w-0 items-center gap-3">
                        <img
                          src={team.logo}
                          width={28}
                          height={28}
                          loading="lazy"
                          alt={`${team.name} logo`}
                          className="size-7 shrink-0 object-contain"
                        />
                        <span className="min-w-0 flex-1 truncate text-base font-medium">
                          {team.name}
                        </span>
                        <span className="text-lg tabular-nums">{example.score[index]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col gap-1 text-xs leading-5 text-mauve-200/65">
                    <span className="truncate">{example.event}</span>
                    <span className="flex flex-wrap items-center gap-x-2">
                      <time dateTime={example.date}>
                        {matchDate.format(new Date(example.date))}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span>Map {example.mapNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>{example.roundCount} rounds</span>
                    </span>
                  </div>
                  <span className="mt-4 block text-sm font-medium">
                    {busy ? 'Loading demo…' : 'Play demo'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
