import { expect, test } from 'vitest'
import { getRouter } from './router'

test('registers the home route', () => {
  const router = getRouter()

  expect(router.routesByPath['/']).toBeDefined()
  expect(router.routesByPath['/'].fullPath).toBe('/')
})
