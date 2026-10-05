import { createFileRoute } from '@tanstack/react-router'
import { DemoWorkspace } from '../components/DemoWorkspace'

export const Route = createFileRoute('/')({
  component: DemoWorkspace,
})
