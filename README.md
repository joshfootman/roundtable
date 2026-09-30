# Roundtable

Choose a local CS2 `.dem` file and select **Import demo** to inspect its recording
metadata and player roster, then play, pause or scrub the first completed competitive round.
Effect manages bounded file reads, typed failures and worker resources. The custom
TypeScript decoder reads entity updates locally. No demo is uploaded.

PixiJS renders recorded player positions on a tactical map. Map images and calibration
are separate from the parser and playback engine. Dust II is verified against the
supplied match. Mirage, Ancient, Anubis, Inferno and Overpass have overview-based map
definitions and still need demo verification. Floor selection remains a later task.

See [the task list](docs/TASKS.md), [replay architecture](src/replay/README.md), and
[fixture verification](fixtures/replay/README.md). With the full reference recording
available locally, `npm run verify:round` compares real world-coordinate samples with
an independent parser oracle.

# Getting Started

To run this application:

```bash
npm install
npm run dev
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Linting and formatting

This project uses [Oxlint](https://oxc.rs/docs/guide/usage/linter) for linting
and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) for formatting.

```bash
npm run lint          # Check JavaScript and TypeScript
npm run lint:fix      # Apply automatic lint fixes
npm run format        # Format project files
npm run format:check  # Check formatting without changing files
npm run check         # Run both checks (suitable for CI)
```

`npm run check` also generates routes and checks TypeScript types.

Configuration lives in `.oxlintrc.json` and `.oxfmtrc.json`. Both tools respect
`.gitignore` and skip the generated `src/routeTree.gen.ts`; the formatter also
skips npm's generated lockfile. Formatting uses single quotes and no semicolons.
Tailwind classes are sorted using `src/styles.css`, including classes in
`className` attributes and calls to `cn`, `clsx`, and `cva`.

## Unsupported imports

The importer recognizes ZIP, RAR, 7z, gzip and bzip2 signatures and asks you to
extract the `.dem` first. It gives separate guidance for empty files, Source 1
including CS:GO, unknown formats, and Source 2 headers that identify another
game. Damaged CS2 metadata remains a parsing error.

Detection uses file contents. Renaming an archive to `.dem` does not make it
supported. Missing optional game identifiers are tolerated for older recordings;
metadata import does not prove that every later gameplay record is supported.

## Tests and CI

Use Node.js 24 (`nvm use`) and install dependencies with `npm ci`.

```bash
npm test                        # Unit tests in src/**/*.test.ts(x)
npm run test:watch              # Watch unit tests
npx playwright install chromium # Install the browser once
npm run test:e2e                # Build the app and run Chromium tests in e2e/
```

Playwright starts its own production preview server on port 4173. Reports are
written to `playwright-report/`; failed tests retain traces and screenshots.

GitHub Actions runs checks and unit tests in one job, and the production build
and browser test in another. It runs on pull requests, pushes to `main` or
`master`, and manual dispatch. Browser reports are retained for seven days.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')

  useEffect(() => {
    getServerTime().then(setTime)
  }, [])

  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
