export interface PoolSpecs {
  volume: number // in gallons
  type: "residential" | "commercial" | "spa"
}

export interface ChemicalRecommendation {
  chemical: string
  amount: number
  unit: string
  reason: string
  priority: "high" | "medium" | "low"
  instructions: string
}

export interface CalculationResult {
  recommendations: ChemicalRecommendation[]
  totalCost?: number
  timeToRetest: string
  warnings: string[]
}

// Chemical adjustment formulas based on pool chemistry standards
const CHEMICAL_FORMULAS = {
  // pH adjustment - 10g per 1000L to change pH by 0.2
  phIncrease: {
    // pH plus: 10g per 1000L to increase pH by 0.2
    sodiumCarbonate: (currentPh: number, targetPh: number, volume: number) => {
      const phDifference = targetPh - currentPh
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (phDifference / 0.2) * 10 // 10g per 0.2 pH increase per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },

  phDecrease: {
    // pH minus: 10g per 1000L to decrease pH by 0.2
    sodiumBisulfate: (currentPh: number, targetPh: number, volume: number) => {
      const phDifference = currentPh - targetPh
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (phDifference / 0.2) * 10 // 10g per 0.2 pH decrease per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },

  // Chlorine adjustment
  chlorineIncrease: {
    // Chlorine granules: 6g per 1000L to increase 3ppm
    granularChlorine: (currentCl: number, targetCl: number, volume: number) => {
      const clDifference = targetCl - currentCl
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (clDifference / 3) * 6 // 6g per 3ppm increase per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },

  chlorineDecrease: {
    // Chlorine reducer: 16g per 1000L to decrease 10ppm
    chlorineReducer: (currentCl: number, targetCl: number, volume: number) => {
      const clDifference = currentCl - targetCl
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (clDifference / 10) * 16 // 16g per 10ppm decrease per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },

  // Total Alkalinity adjustment
  alkalinityIncrease: {
    // TA increaser: 18g per 1000L to increase 10ppm
    sodiumBicarbonate: (currentAlk: number, targetAlk: number, volume: number) => {
      const alkDifference = targetAlk - currentAlk
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (alkDifference / 10) * 18 // 18g per 10ppm increase per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },

  alkalinityDecrease: {
    // TA reducer: 10g per 1000L to decrease 10ppm
    taReducer: (currentAlk: number, targetAlk: number, volume: number) => {
      const alkDifference = currentAlk - targetAlk
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (alkDifference / 10) * 10 // 10g per 10ppm decrease per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },

  // Calcium Hardness adjustment
  hardnessIncrease: {
    // Calcium hardness: 15g per 1000L to increase 10ppm
    calciumChloride: (currentHardness: number, targetHardness: number, volume: number) => {
      const hardnessDifference = targetHardness - currentHardness
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (hardnessDifference / 10) * 15 // 15g per 10ppm increase per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },

  // Cyanuric Acid adjustment
  cyanuricAcidIncrease: {
    // Cyanuric acid: 10g per 1000L to increase 10ppm
    cyanuricAcid: (currentCya: number, targetCya: number, volume: number) => {
      const cyaDifference = targetCya - currentCya
      const volumeInLiters = volume * 3.78541 // Convert gallons to liters
      const baseAmount = (cyaDifference / 10) * 10 // 10g per 10ppm increase per 1000L
      return (baseAmount * volumeInLiters) / 1000
    },
  },
}

// Target ranges for optimal pool chemistry
const TARGET_RANGES = {
  freeChlorine: { min: 1.0, max: 3.0, ideal: 2.0 },
  ph: { min: 7.2, max: 7.6, ideal: 7.4 },
  totalAlkalinity: { min: 80, max: 120, ideal: 100 },
  totalChlorine: { min: 1.0, max: 3.0, ideal: 2.0 },
  totalHardness: { min: 200, max: 400, ideal: 300 }, // Updated range: 200-400 ppm
  cyanuricAcid: { min: 30, max: 50, ideal: 40 },
}

function convertToGrams(pounds: number): number {
  return Math.round(pounds * 453.592) // 1 lb = 453.592 grams
}

function convertToMilliliters(fluidOunces: number): number {
  return Math.round(fluidOunces * 29.5735) // 1 fl oz = 29.5735 ml
}

function getAppropriateUnit(grams: number): { amount: number; unit: string } {
  if (grams >= 1000) {
    return { amount: Math.round((grams / 1000) * 100) / 100, unit: "kg" }
  }
  return { amount: Math.round(grams), unit: "g" }
}

export function calculateChemicalAdjustments(
  testResults: Record<string, { value: number; status: string; unit: string }>,
  poolSpecs: PoolSpecs,
): CalculationResult {
  const recommendations: ChemicalRecommendation[] = []
  const warnings: string[] = []

  if (!poolSpecs.volume || poolSpecs.volume <= 0) {
    warnings.push("Invalid pool volume. Please check your pool dimensions.")
    return { recommendations: [], timeToRetest: "N/A", warnings }
  }

  // pH Adjustment
  const ph = testResults.ph?.value || 7.4
  const phTarget = TARGET_RANGES.ph

  if (ph < phTarget.min) {
    const amountGrams = CHEMICAL_FORMULAS.phIncrease.sodiumCarbonate(ph, phTarget.ideal, poolSpecs.volume)
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "pH Plus (Sodium Carbonate)",
      amount,
      unit,
      reason: `Raise pH from ${ph.toFixed(1)} to ${phTarget.ideal}`,
      priority: "high",
      instructions: "Dissolve in bucket of water, add to deep end with pump running. Wait 4 hours before retesting.",
    })
  } else if (ph > phTarget.max) {
    const amountGrams = CHEMICAL_FORMULAS.phDecrease.sodiumBisulfate(ph, phTarget.ideal, poolSpecs.volume)
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "pH Minus (Sodium Bisulfate)",
      amount,
      unit,
      reason: `Lower pH from ${ph.toFixed(1)} to ${phTarget.ideal}`,
      priority: "high",
      instructions: "Dissolve in bucket of water, add to deep end with pump running. Wait 4 hours before retesting.",
    })
  }

  // Free Chlorine Adjustment
  const freeChlorine = testResults.freeChlorine?.value || 0
  const chlorineTarget = TARGET_RANGES.freeChlorine

  if (freeChlorine < chlorineTarget.min) {
    const amountGrams = CHEMICAL_FORMULAS.chlorineIncrease.granularChlorine(
      freeChlorine,
      chlorineTarget.ideal,
      poolSpecs.volume,
    )
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "Chlorine Granules (Calcium Hypochlorite)",
      amount,
      unit,
      reason: `Raise free chlorine from ${freeChlorine.toFixed(1)} to ${chlorineTarget.ideal} ppm`,
      priority: "high",
      instructions: "Dissolve in bucket of water, add to deep end with pump running. Wait 4 hours before swimming.",
    })
  } else if (freeChlorine > chlorineTarget.max) {
    const amountGrams = CHEMICAL_FORMULAS.chlorineDecrease.chlorineReducer(
      freeChlorine,
      chlorineTarget.ideal,
      poolSpecs.volume,
    )
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "Chlorine Reducer (Sodium Thiosulfate)",
      amount,
      unit,
      reason: `Lower free chlorine from ${freeChlorine.toFixed(1)} to ${chlorineTarget.ideal} ppm`,
      priority: "high",
      instructions: "Dissolve in bucket of water, add to deep end with pump running. Wait 4 hours before retesting.",
    })
  }

  // Total Alkalinity Adjustment
  const totalAlkalinity = testResults.totalAlkalinity?.value || 100
  const alkalinityTarget = TARGET_RANGES.totalAlkalinity

  if (totalAlkalinity < alkalinityTarget.min) {
    const amountGrams = CHEMICAL_FORMULAS.alkalinityIncrease.sodiumBicarbonate(
      totalAlkalinity,
      alkalinityTarget.ideal,
      poolSpecs.volume,
    )
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "TA Increaser (Sodium Bicarbonate)",
      amount,
      unit,
      reason: `Raise total alkalinity from ${totalAlkalinity.toFixed(0)} to ${alkalinityTarget.ideal} ppm`,
      priority: "medium",
      instructions: "Dissolve in bucket of water, add slowly to deep end. Wait 6 hours before retesting pH.",
    })
  } else if (totalAlkalinity > alkalinityTarget.max) {
    const amountGrams = CHEMICAL_FORMULAS.alkalinityDecrease.taReducer(
      totalAlkalinity,
      alkalinityTarget.ideal,
      poolSpecs.volume,
    )
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "TA Reducer (Sodium Bisulfate)",
      amount,
      unit,
      reason: `Lower total alkalinity from ${totalAlkalinity.toFixed(0)} to ${alkalinityTarget.ideal} ppm`,
      priority: "medium",
      instructions: "Dissolve in bucket of water, add to deep end with pump running. Wait 6 hours before retesting.",
    })
  }

  // Calcium Hardness Adjustment
  const totalHardness = testResults.totalHardness?.value || 200
  const hardnessTarget = TARGET_RANGES.totalHardness

  if (totalHardness < hardnessTarget.min) {
    const amountGrams = CHEMICAL_FORMULAS.hardnessIncrease.calciumChloride(
      totalHardness,
      hardnessTarget.ideal,
      poolSpecs.volume,
    )
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "Calcium Hardness Increaser (Calcium Chloride)",
      amount,
      unit,
      reason: `Raise calcium hardness from ${totalHardness.toFixed(0)} to ${hardnessTarget.ideal} ppm`,
      priority: "low",
      instructions:
        "Dissolve in bucket of water, add slowly to deep end with pump running. Wait 4 hours before retesting.",
    })
  } else if (totalHardness > hardnessTarget.max) {
    const excessHardness = totalHardness - hardnessTarget.ideal
    const dilutionPercentage = Math.min((excessHardness / totalHardness) * 100, 50) // Cap at 50%

    recommendations.push({
      chemical: "Fresh Water Dilution",
      amount: Math.round(dilutionPercentage),
      unit: "% of pool volume",
      reason: `Lower calcium hardness from ${totalHardness.toFixed(0)} to ${hardnessTarget.ideal} ppm`,
      priority: "low",
      instructions: `Drain ${Math.round(dilutionPercentage)}% of pool water and refill with fresh water to reduce calcium hardness.`,
    })
  }

  // Cyanuric Acid Adjustment
  const cyanuricAcid = testResults.cyanuricAcid?.value || 0
  const cyaTarget = TARGET_RANGES.cyanuricAcid

  if (cyanuricAcid < cyaTarget.min) {
    const amountGrams = CHEMICAL_FORMULAS.cyanuricAcidIncrease.cyanuricAcid(
      cyanuricAcid,
      cyaTarget.ideal,
      poolSpecs.volume,
    )
    const { amount, unit } = getAppropriateUnit(amountGrams)

    recommendations.push({
      chemical: "Chlorine Conditioner (Cyanuric Acid)",
      amount,
      unit,
      reason: `Raise cyanuric acid from ${cyanuricAcid.toFixed(0)} to ${cyaTarget.ideal} ppm`,
      priority: "low",
      instructions: "Add to skimmer basket with pump running. May take 24-48 hours to fully dissolve and register.",
    })
  } else if (cyanuricAcid > cyaTarget.max) {
    const excessCya = cyanuricAcid - cyaTarget.ideal
    const dilutionPercentage = Math.min((excessCya / cyanuricAcid) * 100, 50) // Cap at 50%

    recommendations.push({
      chemical: "Fresh Water Dilution",
      amount: Math.round(dilutionPercentage),
      unit: "% of pool volume",
      reason: `Lower cyanuric acid from ${cyanuricAcid.toFixed(0)} to ${cyaTarget.ideal} ppm`,
      priority: "low",
      instructions: `Drain ${Math.round(dilutionPercentage)}% of pool water and refill with fresh water to reduce cyanuric acid levels.`,
    })
  }

  // Updated chlorine status check - if chlorine is 4 or higher, it should be "high"
  if (freeChlorine >= 4.0) {
    warnings.push("High chlorine levels detected. Free chlorine above 4.0 ppm is considered high and may cause skin/eye irritation.")
  } else if (freeChlorine > 5.0) {
    warnings.push("Very high chlorine levels may interfere with other test readings. Consider reducing chlorine first.")
  }

  if (ph < 6.8 || ph > 8.2) {
    warnings.push("Extreme pH levels detected. Adjust pH before adding other chemicals.")
  }

  // Sort recommendations by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  // Determine retest time based on pool type
  let timeToRetest = "For hot tubs retest in 30 mins, for swimming pools retest in 6-24 hours"

  return {
    recommendations,
    timeToRetest,
    warnings,
  }
}

// Pool volume calculator with multiple units
export function calculatePoolVolume(
  shape: "rectangular" | "circular" | "oval" | "kidney",
  dimensions: {
    length?: number
    width?: number
    diameter?: number
    shallowDepth: number
    deepDepth: number
  },
  unit: "gallons" | "litres" | "cubic-meters" = "gallons",
): number {
  const avgDepth = (dimensions.shallowDepth + dimensions.deepDepth) / 2

  let volumeCubicMeters = 0

  switch (shape) {
    case "rectangular":
      if (!dimensions.length || !dimensions.width) return 0
      // Dimensions are already in meters
      volumeCubicMeters = dimensions.length * dimensions.width * avgDepth
      break

    case "circular":
      if (!dimensions.diameter) return 0
      const radius = dimensions.diameter / 2
      // Dimensions are already in meters
      volumeCubicMeters = Math.PI * radius * radius * avgDepth
      break

    case "oval":
      if (!dimensions.length || !dimensions.width) return 0
      // Dimensions are already in meters
      volumeCubicMeters = Math.PI * (dimensions.length / 2) * (dimensions.width / 2) * avgDepth
      break

    case "kidney":
      if (!dimensions.length || !dimensions.width) return 0
      // Approximate kidney shape as 0.85 of an oval
      // Dimensions are already in meters
      volumeCubicMeters = Math.PI * (dimensions.length / 2) * (dimensions.width / 2) * avgDepth * 0.85
      break

    default:
      return 0
  }

  // Convert to desired unit
  switch (unit) {
    case "gallons":
      return volumeCubicMeters * 222 // 1 cubic meter = 222 imperial gallons
    case "litres":
      return volumeCubicMeters * 1000 // 1 cubic meter = 1000 litres
    case "cubic-meters":
      return volumeCubicMeters
    default:
      return volumeCubicMeters * 222 // Default to gallons
  }
}

// Convert between volume units
export function convertVolume(volume: number, fromUnit: string, toUnit: string): number {
  // First convert to cubic meters
  let cubicMeters = 0
  switch (fromUnit) {
    case "gallons":
      cubicMeters = volume / 222
      break
    case "litres":
      cubicMeters = volume / 1000
      break
    case "cubic-meters":
      cubicMeters = volume
      break
    default:
      cubicMeters = volume / 222
  }

  // Then convert to target unit
  switch (toUnit) {
    case "gallons":
      return cubicMeters * 222
    case "litres":
      return cubicMeters * 1000
    case "cubic-meters":
      return cubicMeters
    default:
      return cubicMeters * 222
  }
}
