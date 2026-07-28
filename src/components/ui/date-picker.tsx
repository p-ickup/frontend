'use client'

import { useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import {
  DayFlag,
  DayPicker,
  SelectionState,
  UI,
  type Matcher,
} from 'react-day-picker'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/utils/tailwind'

const parseDateString = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))

  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined
  }

  return parsed
}

const toDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDisplayDate = (value: string) => {
  const date = parseDateString(value)
  if (!date) return ''

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const getToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const clampDate = (date: Date, min?: Date, max?: Date) => {
  if (min && date < min) return min
  if (max && date > max) return max
  return date
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  defaultMonth?: string
  disabled?: Matcher | Matcher[]
  minDate?: string
  maxDate?: string
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  defaultMonth,
  disabled,
  minDate,
  maxDate,
  placeholder = 'Select date',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseDateString(value), [value])
  const disabledDays = useMemo(() => {
    const matchers = Array.isArray(disabled)
      ? [...disabled]
      : disabled
        ? [disabled]
        : []
    const min = parseDateString(minDate || '')
    const max = parseDateString(maxDate || '')

    if (min) matchers.push({ before: min })
    if (max) matchers.push({ after: max })

    return matchers.length > 0 ? matchers : undefined
  }, [disabled, maxDate, minDate])
  const min = useMemo(() => parseDateString(minDate || ''), [minDate])
  const max = useMemo(() => parseDateString(maxDate || ''), [maxDate])
  const initialMonth = useMemo(
    () =>
      selected ||
      parseDateString(defaultMonth || '') ||
      clampDate(getToday(), min, max),
    [defaultMonth, max, min, selected],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-lg border-2 border-gray-300 bg-white p-3 text-left text-black transition-colors hover:border-gray-400 focus:border-teal-500 focus:outline-none',
            !selected && 'text-gray-500',
          )}
        >
          <span>{selected ? formatDisplayDate(value) : placeholder}</span>
          <Calendar className="h-5 w-5 shrink-0 text-gray-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <DayPicker
          mode="single"
          selected={selected}
          defaultMonth={initialMonth}
          disabled={disabledDays}
          onSelect={(date) => {
            if (!date) return
            onChange(toDateString(date))
            setOpen(false)
          }}
          classNames={{
            [UI.Root]: 'p-0',
            [UI.Months]: 'flex',
            [UI.Month]: 'space-y-4',
            [UI.MonthCaption]:
              'flex h-9 items-center justify-center text-sm font-semibold',
            [UI.CaptionLabel]: 'text-sm font-semibold',
            [UI.Nav]:
              'absolute left-3 right-3 top-3 flex items-center justify-between',
            [UI.PreviousMonthButton]:
              'inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40',
            [UI.NextMonthButton]:
              'inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40',
            [UI.MonthGrid]: 'w-full border-collapse space-y-1',
            [UI.Weekdays]: 'flex',
            [UI.Weekday]:
              'flex h-8 w-9 items-center justify-center text-xs font-medium text-gray-500',
            [UI.Week]: 'mt-1 flex w-full',
            [UI.Day]: 'h-9 w-9 p-0 text-center text-sm',
            [UI.DayButton]:
              'h-9 w-9 rounded-md text-sm transition-colors hover:bg-teal-50 focus:bg-teal-50 focus:outline-none',
            [SelectionState.selected]:
              'bg-teal-600 text-white hover:bg-teal-600 focus:bg-teal-600',
            [DayFlag.today]: 'font-bold text-teal-700',
            [DayFlag.outside]: 'text-gray-400 opacity-60',
            [DayFlag.disabled]: 'pointer-events-none text-gray-300 opacity-50',
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
