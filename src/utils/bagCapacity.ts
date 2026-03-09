/**
 * Bag capacity logic aligned with admin GroupsManagement.
 * Bag units = (large bags * 2) + normal bags.
 * Max units: 12 for < 3 people, 10 for >= 3 people.
 */

export function calculateBagUnits(
  checkedBags: number,
  carryOnBags: number,
): number {
  return checkedBags * 2 + carryOnBags
}

export function getMaxBagUnits(riderCount: number): number {
  return riderCount >= 3 ? 10 : 12
}

/**
 * Returns Uber type string; 'XXL*' means invalid (over capacity).
 */
export function determineUberType(groupSize: number, bagUnits: number): string {
  const maxBagUnits = getMaxBagUnits(groupSize)
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

export function canAccommodateRider(
  currentRiderCount: number,
  currentBagUnits: number,
  riderCheckedBags: number,
  riderCarryOnBags: number,
): boolean {
  const userBagUnits = calculateBagUnits(riderCheckedBags, riderCarryOnBags)
  const newRiderCount = currentRiderCount + 1
  if (newRiderCount > 6) return false
  const totalBagUnits = currentBagUnits + userBagUnits
  const maxUnits = getMaxBagUnits(newRiderCount)
  if (totalBagUnits > maxUnits) return false
  const uberType = determineUberType(newRiderCount, totalBagUnits)
  return uberType !== 'XXL*'
}
