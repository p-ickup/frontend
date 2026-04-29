import type {
  Group,
  OverrideSubsidized,
  OverrideUberType,
  Rider,
} from '../types'

export const UBER_TYPE_OPTIONS = ['X', 'XL', 'XXL', 'Connect'] as const

export const calculateBagUnits = (riders: Rider[]): number => {
  let numLargeBags = 0
  let numNormalBags = 0

  for (const rider of riders) {
    numLargeBags += rider.checked_bags
    numNormalBags += rider.carry_on_bags
  }

  return numLargeBags * 2 + numNormalBags
}

export const getTotalBags = (riders: Rider[]): number => {
  return riders.reduce(
    (sum, rider) => sum + rider.checked_bags + rider.carry_on_bags,
    0,
  )
}

export const getMaxBagUnits = (riderCount: number): number => {
  return riderCount >= 3 ? 10 : 12
}

export const validateBagConstraints = (
  group: Pick<Group, 'riders'>,
  rider: Pick<Rider, 'checked_bags' | 'carry_on_bags'>,
): boolean => {
  const currentBags = getTotalBags(group.riders)
  const riderBags = rider.checked_bags + rider.carry_on_bags
  const totalBags = currentBags + riderBags
  const newRiderCount = group.riders.length + 1

  return totalBags <= getMaxBagUnits(newRiderCount)
}

export const determineUberType = (
  groupSize: number,
  bagUnits: number,
): string => {
  const maxBagUnits = groupSize >= 3 ? 10 : 12
  if (bagUnits > maxBagUnits) return 'XXL*'

  if (groupSize >= 2 && groupSize <= 3) {
    if (bagUnits >= 0 && bagUnits <= 4) return 'X'
    if (bagUnits >= 5 && bagUnits <= 10) return 'XL'
    if (bagUnits >= 11 && bagUnits <= 12) return 'XXL'
  } else if (groupSize === 4) {
    if (bagUnits >= 0 && bagUnits <= 3) return 'X'
    if (bagUnits >= 4 && bagUnits <= 7) return 'XL'
    if (bagUnits >= 8 && bagUnits <= 10) return 'XXL'
  } else if (groupSize === 5) {
    if (bagUnits >= 0 && bagUnits <= 5) return 'XL'
    if (bagUnits >= 6 && bagUnits <= 8) return 'XXL'
  } else if (groupSize === 6) {
    if (bagUnits >= 0 && bagUnits <= 3) return 'XL'
    if (bagUnits >= 4 && bagUnits <= 6) return 'XXL'
  }

  return 'XXL*'
}

export const getCapacityBarColor = (
  totalBagUnits: number,
  uberType?: string | null,
): string => {
  if (uberType?.toLowerCase() === 'connect') return 'bg-green-500'
  if (totalBagUnits === 0) return 'bg-green-500'
  if (totalBagUnits <= 3) return 'bg-gradient-to-r from-green-500 to-yellow-500'
  if (totalBagUnits <= 6) {
    return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  }
  if (totalBagUnits <= 9) return 'bg-gradient-to-r from-orange-500 to-red-500'
  return 'bg-red-700'
}

export const getUberType = (riderCount: number): string => {
  if (riderCount <= 3) return 'X'
  if (riderCount === 4) return 'XL'
  return 'XXL'
}

export const formatUberTypeDisplay = (
  uberType: string | null | undefined,
  fallback: string,
): string => {
  const raw = uberType || fallback
  if (raw?.toLowerCase() === 'connect') return 'Connect Shuttle'
  return `Uber ${raw}`
}

export const isGroupSubsidized = (
  airport: string,
  riderCount: number,
): boolean => {
  if (airport === 'ONT') return riderCount >= 2
  if (airport === 'LAX') return riderCount >= 3
  return riderCount >= 3
}

export const getOverrideSelections = (
  group: Pick<
    Group,
    'is_subsidized' | 'subsidized_override' | 'uber_type' | 'uber_type_override'
  >,
): {
  overrideSubsidized: OverrideSubsidized
  overrideUberType: OverrideUberType
} => {
  return {
    overrideSubsidized: group.subsidized_override
      ? group.is_subsidized
        ? 'yes'
        : 'no'
      : 'auto',
    overrideUberType:
      group.uber_type_override && group.uber_type
        ? (group.uber_type as OverrideUberType)
        : 'auto',
  }
}
