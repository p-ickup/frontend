'use client'

import type {
  ResultsResponseDto,
  UnmatchedOptionsResponseDto,
} from '@/contracts/readModels'
import { createContext, useContext } from 'react'

const ResultsInitialDataContext = createContext<ResultsResponseDto | null>(null)
const UnmatchedInitialDataContext =
  createContext<UnmatchedOptionsResponseDto | null>(null)

export function ResultsInitialDataProvider({
  data,
  children,
}: {
  data: ResultsResponseDto
  children: React.ReactNode
}) {
  return (
    <ResultsInitialDataContext.Provider value={data}>
      {children}
    </ResultsInitialDataContext.Provider>
  )
}

export function UnmatchedInitialDataProvider({
  data,
  children,
}: {
  data: UnmatchedOptionsResponseDto
  children: React.ReactNode
}) {
  return (
    <UnmatchedInitialDataContext.Provider value={data}>
      {children}
    </UnmatchedInitialDataContext.Provider>
  )
}

export const useResultsInitialData = () => useContext(ResultsInitialDataContext)

export const useUnmatchedInitialData = () =>
  useContext(UnmatchedInitialDataContext)
