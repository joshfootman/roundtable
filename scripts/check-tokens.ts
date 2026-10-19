// Tailwind's default palette and radius scale are removed in src/styles.css, so their
// classes silently generate nothing. This catches them before they ship.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const palette =
  'slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const banned = [
  new RegExp(`\\b[a-z-]+-(?:${palette})-\\d{2,3}\\b`, 'g'),
  /\b[a-z-]+-(?:white|black)(?:\/\d+)?\b/g,
  /\brounded(?:-[trblse]{1,2})?-(?:xs|sm|md|lg|xl|[234]xl)\b/g,
  new RegExp(`--color-(?:${palette})-\\d`, 'g'),
]

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : files(path)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.gen.ts') ? [path] : []
  })
}

const problems = files('src').flatMap((path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((line, index) =>
      banned.flatMap((pattern) =>
        [...line.matchAll(pattern)].map((match) => `${path}:${index + 1}  ${match[0]}`),
      ),
    ),
)

if (problems.length) {
  console.error(`Use a token from src/styles.css instead:\n${problems.join('\n')}`)
  process.exit(1)
}
