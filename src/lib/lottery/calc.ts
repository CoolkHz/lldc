export type PoolBreakdown = {
  grossPoints: number
  linuxdoFeePoints: number
  netPoints: number
  operatorFeePoints: number
  p1Points: number
  p2Points: number
  p3Points: number
}

export type Tier = 0 | 1 | 2 | 3

export function calculatePool(params: { paidPoints: number; carryOverPoints: number; linuxdoFeeRate: number }): PoolBreakdown {
  const grossPoints = params.paidPoints + params.carryOverPoints
  const linuxdoFeePoints = Math.round(grossPoints * params.linuxdoFeeRate)
  const netPoints = grossPoints - linuxdoFeePoints

  const operatorFeePoints = Math.floor(netPoints * 0.05)
  let p1Points = Math.floor(netPoints * 0.8)
  const p2Points = Math.floor(netPoints * 0.1)
  const p3Points = Math.floor(netPoints * 0.05)

  const remainder = netPoints - (operatorFeePoints + p1Points + p2Points + p3Points)
  p1Points += remainder

  return {
    grossPoints,
    linuxdoFeePoints,
    netPoints,
    operatorFeePoints,
    p1Points,
    p2Points,
    p3Points,
  }
}

export function getPrizeTier(ticketNumber: string, winning: string): Tier {
  if (ticketNumber === winning) return 1
  if (ticketNumber.slice(1) === winning.slice(1)) return 2
  if (ticketNumber.slice(2) === winning.slice(2)) return 3
  return 0
}

type TierPools = {
  p1: number
  p2: number
  p3: number
}

export type TierPayout = {
  perPoints: number
  rolloverPoints: number
  winners: number
}

export type DrawPayoutResult = {
  p1: TierPayout
  p2: TierPayout
  p3: TierPayout
  nextCarryOverPoints: number
}

function splitPool(pool: number, winners: number): TierPayout {
  if (winners <= 0) return { winners: 0, perPoints: 0, rolloverPoints: pool }
  const perPoints = Math.floor(pool / winners)
  const rolloverPoints = pool - perPoints * winners
  return { winners, perPoints, rolloverPoints }
}

export function calculateTierPayouts(params: { pools: TierPools; winnerCounts: { p1: number; p2: number; p3: number } }): DrawPayoutResult {
  const p1 = splitPool(params.pools.p1, params.winnerCounts.p1)
  const p2 = splitPool(params.pools.p2, params.winnerCounts.p2)
  const p3 = splitPool(params.pools.p3, params.winnerCounts.p3)
  return {
    p1,
    p2,
    p3,
    nextCarryOverPoints: p1.rolloverPoints + p2.rolloverPoints + p3.rolloverPoints,
  }
}

