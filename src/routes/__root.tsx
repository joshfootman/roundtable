import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import '../styles.css'
import type { ReplaySession } from '../demo/replay-session'
import { useEffect } from 'react'

export const Route = createRootRouteWithContext<{ replay: ReplaySession }>()({
  component: RootComponent,
})

function RootComponent() {
  const { replay } = Route.useRouteContext()
  useEffect(() => () => replay.dispose(), [replay])
  return (
    <>
      <Outlet />
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
