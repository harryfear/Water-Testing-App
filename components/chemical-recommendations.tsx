"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Calculator, AlertTriangle, Clock, ShoppingCart } from "lucide-react"
import { PoolVolumeCalculator, type PoolCalculatorState, type VolumeUnit } from "./pool-volume-calculator"
import { calculateChemicalAdjustments, type PoolSpecs } from "@/lib/chemical-calculator"
import type { AnalysisResult } from "@/lib/color-analysis"

interface ChemicalRecommendationsProps {
  results: Record<string, AnalysisResult>
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800"
    case "medium":
      return "bg-orange-100 text-orange-800"
    case "low":
      return "bg-blue-100 text-blue-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case "high":
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case "medium":
      return <Clock className="h-4 w-4 text-orange-500" />
    case "low":
      return <Calculator className="h-4 w-4 text-blue-500" />
    default:
      return <Calculator className="h-4 w-4 text-gray-500" />
  }
}

function formatVolumeUnit(unit: VolumeUnit): string {
  switch (unit) {
    case "gallons":
      return "imperial gallons"
    case "litres":
      return "litres"
    case "cubic-meters":
      return "cubic meters"
  }
}

export function ChemicalRecommendations({ results }: ChemicalRecommendationsProps) {
  const [poolVolume, setPoolVolume] = useState<number>(0)
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>("gallons")
  const [calculatorState, setCalculatorState] = useState<PoolCalculatorState | undefined>(undefined)
  const [showCalculator, setShowCalculator] = useState(false)
  const [calculations, setCalculations] = useState<ReturnType<typeof calculateChemicalAdjustments> | null>(null)

  const handleVolumeCalculated = (volume: number, unit: VolumeUnit, state: PoolCalculatorState) => {
    setPoolVolume(volume)
    setVolumeUnit(unit)
    setCalculatorState(state)
    if (volume > 0) {
      const poolSpecs: PoolSpecs = {
        volume,
        type: "residential",
      }
      const calc = calculateChemicalAdjustments(results, poolSpecs)
      setCalculations(calc)
      setShowCalculator(false)
    }
  }

  const handleCalculateChemicals = () => {
    if (poolVolume > 0) {
      const poolSpecs: PoolSpecs = {
        volume: poolVolume,
        type: "residential",
      }
      const calc = calculateChemicalAdjustments(results, poolSpecs)
      setCalculations(calc)
    } else {
      setShowCalculator(true)
    }
  }

  return (
    <div className="space-y-6">
      {showCalculator && (
        <PoolVolumeCalculator
          onVolumeCalculated={handleVolumeCalculated}
          initialVolume={poolVolume > 0 ? poolVolume : undefined}
          initialUnit={volumeUnit}
          initialState={calculatorState}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Chemical Recommendations
          </CardTitle>
          <CardDescription>Get precise chemical dosing based on your test results and pool volume</CardDescription>
        </CardHeader>
        <CardContent>
          {poolVolume === 0 ? (
            <div className="text-center py-8">
              <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Calculate Pool Volume First</h3>
              <p className="text-gray-600 mb-4">
                To get accurate chemical recommendations, we need to know your pool volume.
              </p>
              <Button onClick={() => setShowCalculator(true)}>Calculate Pool Volume</Button>
            </div>
          ) : calculations ? (
            <div className="space-y-6">
              {/* Pool Info */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-semibold">Pool Volume</div>
                  <div className="text-sm text-gray-600">{Math.round(poolVolume).toLocaleString()} {formatVolumeUnit(volumeUnit)}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCalculator(true)}>
                  Change Volume
                </Button>
              </div>

              {/* Warnings */}
              {calculations.warnings.length > 0 && (
                <div className="space-y-2">
                  {calculations.warnings.map((warning, index) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {calculations.recommendations.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Chemical Shopping List
                  </h4>

                  {calculations.recommendations.map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getPriorityIcon(rec.priority)}
                          <div>
                            <h5 className="font-semibold">{rec.chemical}</h5>
                            <p className="text-sm text-gray-600">{rec.reason}</p>
                          </div>
                        </div>
                        <Badge className={getPriorityColor(rec.priority)}>{rec.priority.toUpperCase()}</Badge>
                      </div>

                      <div className="bg-gray-50 rounded p-3 mb-3">
                        <div className="text-lg font-bold text-center">
                          {rec.amount} {rec.unit}
                        </div>
                      </div>

                      <div className="text-sm text-gray-700">
                        <strong>Instructions:</strong> {rec.instructions}
                      </div>
                    </div>
                  ))}

                  <Separator />

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Retest in {calculations.timeToRetest}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-green-600 mb-2">
                    <Calculator className="h-12 w-12 mx-auto mb-2" />
                  </div>
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Perfect Water Balance!</h3>
                  <p className="text-green-600">
                    All your water parameters are within ideal ranges. No chemical adjustments needed.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <Button onClick={handleCalculateChemicals} size="lg">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Chemical Amounts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
