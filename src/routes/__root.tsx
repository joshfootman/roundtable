import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useEffect } from 'react'

import '../styles.css'
import type { ReplaySession } from '../demo/replay-session'

export const Route = createRootRouteWithContext<{ replay: ReplaySession }>()({
  component: RootComponent,
})

function RootComponent() {
  const { replay } = Route.useRouteContext()
  useEffect(() => () => replay.dispose(), [replay])
  return <Outlet />
}
