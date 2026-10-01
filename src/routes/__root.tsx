import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'

import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import '../styles.css'
import type { ReplaySession } from '../demo/replay-session'
import { ReplayWorkspace } from '../replay/ReplayWorkspace'
import { useEffect } from 'react'

export const Route = createRootRouteWithContext<{ replay: ReplaySession }>()({
  component: RootComponent,
})

function RootComponent() {
  const { replay } = Route.useRouteContext()
  const isReplayRoute = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId === '/' || match.routeId === '/replay'),
  })
  useEffect(() => () => replay.dispose(), [replay])
  return (
    <>
      {isReplayRoute ? <ReplayWorkspace /> : <Outlet />}
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
