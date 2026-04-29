// Learn more: https://github.com/testing-library/jest-dom
import { QueryCache } from '@tanstack/react-query'
import '@testing-library/jest-dom'

const queryCache = new QueryCache()
let server: {
  listen: () => void
  resetHandlers: () => void
  close: () => void
} | null = null

try {
  server = require('@/mocks/server').server
} catch {
  server = null
}

// Establish API mocking before all tests.
beforeAll(() => server?.listen())
// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => {
  server?.resetHandlers()
  queryCache.clear()
})
// Clean up after the tests are finished.
afterAll(() => server?.close())
