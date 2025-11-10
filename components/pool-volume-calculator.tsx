"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calculator, Ruler } from "lucide-react"
import { calculatePoolVolume } from "@/lib/chemical-calculator"
import { useAlertDialog } from "@/hooks/use-alert-dialog"

export type PoolShape = "rectangular" | "circular" | "oval" | "kidney"
export type VolumeUnit = "gallons" | "litres" | "cubic-meters"
export type LengthUnit = "feet" | "meters"

export interface PoolDimensions {
  length: string
  width: string
  diameter: string
  shallowDepth: string
  deepDepth: string
}

export interface PoolCalculatorState {
  shape: PoolShape
  lengthUnit: LengthUnit
  dimensions: PoolDimensions
}

interface PoolVolumeCalculatorProps {
  onVolumeCalculated: (volume: number, unit: VolumeUnit, state: PoolCalculatorState) => void
  initialVolume?: number
  initialUnit?: VolumeUnit
  initialState?: PoolCalculatorState
}

export function PoolVolumeCalculator({ onVolumeCalculated, initialVolume, initialUnit, initialState }: PoolVolumeCalculatorProps) {
  const [shape, setShape] = useState<PoolShape>(initialState?.shape || "rectangular")
  const [unit, setUnit] = useState<VolumeUnit>(initialUnit || "gallons")
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>(initialState?.lengthUnit || "meters")
  const [dimensions, setDimensions] = useState<PoolDimensions>(initialState?.dimensions || {
    length: "",
    width: "",
    diameter: "",
    shallowDepth: "",
    deepDepth: "",
  })
  const [calculatedVolume, setCalculatedVolume] = useState<number | null>(initialVolume || null)
  const { showAlert, AlertDialogComponent } = useAlertDialog()

  // Convert length unit to meters
  const convertToMeters = (value: number, unit: LengthUnit): number => {
    if (unit === "feet") {
      return value / 3.2808 // Convert feet to meters
    }
    return value // Already in meters
  }

  // Stable handlers for dimension inputs to prevent remounting
  const handleLengthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensions(prev => ({ ...prev, length: e.target.value }))
  }, [])

  const handleWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensions(prev => ({ ...prev, width: e.target.value }))
  }, [])

  const handleDiameterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensions(prev => ({ ...prev, diameter: e.target.value }))
  }, [])

  const handleShallowDepthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensions(prev => ({ ...prev, shallowDepth: e.target.value }))
  }, [])

  const handleDeepDepthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensions(prev => ({ ...prev, deepDepth: e.target.value }))
  }, [])

  const handleCalculate = () => {
    const shallowDepth = parseFloat(dimensions.shallowDepth)
    const deepDepth = parseFloat(dimensions.deepDepth)

    if (isNaN(shallowDepth) || isNaN(deepDepth)) {
      showAlert({
        title: "Missing Depth Values",
        description: "Please enter both depth values",
      })
      return
    }

    // Convert depths to meters
    const shallowDepthM = convertToMeters(shallowDepth, lengthUnit)
    const deepDepthM = convertToMeters(deepDepth, lengthUnit)

    let volume = 0

    switch (shape) {
      case "rectangular":
        const length = parseFloat(dimensions.length)
        const width = parseFloat(dimensions.width)
        if (isNaN(length) || isNaN(width)) {
          showAlert({
            title: "Missing Dimensions",
            description: "Please enter length and width for rectangular pool",
          })
          return
        }
        // Convert to meters
        const lengthM = convertToMeters(length, lengthUnit)
        const widthM = convertToMeters(width, lengthUnit)
        volume = calculatePoolVolume(shape, { length: lengthM, width: widthM, shallowDepth: shallowDepthM, deepDepth: deepDepthM }, unit)
        break

      case "circular":
        const diameter = parseFloat(dimensions.diameter)
        if (isNaN(diameter)) {
          showAlert({
            title: "Missing Dimension",
            description: "Please enter diameter for circular pool",
          })
          return
        }
        // Convert to meters
        const diameterM = convertToMeters(diameter, lengthUnit)
        volume = calculatePoolVolume(shape, { diameter: diameterM, shallowDepth: shallowDepthM, deepDepth: deepDepthM }, unit)
        break

      case "oval":
        const ovalLength = parseFloat(dimensions.length)
        const ovalWidth = parseFloat(dimensions.width)
        if (isNaN(ovalLength) || isNaN(ovalWidth)) {
          showAlert({
            title: "Missing Dimensions",
            description: "Please enter length and width for oval pool",
          })
          return
        }
        // Convert to meters
        const ovalLengthM = convertToMeters(ovalLength, lengthUnit)
        const ovalWidthM = convertToMeters(ovalWidth, lengthUnit)
        volume = calculatePoolVolume(shape, { length: ovalLengthM, width: ovalWidthM, shallowDepth: shallowDepthM, deepDepth: deepDepthM }, unit)
        break

      case "kidney":
        const kidneyLength = parseFloat(dimensions.length)
        const kidneyWidth = parseFloat(dimensions.width)
        if (isNaN(kidneyLength) || isNaN(kidneyWidth)) {
          showAlert({
            title: "Missing Dimensions",
            description: "Please enter length and width for kidney-shaped pool",
          })
          return
        }
        // Convert to meters
        const kidneyLengthM = convertToMeters(kidneyLength, lengthUnit)
        const kidneyWidthM = convertToMeters(kidneyWidth, lengthUnit)
        volume = calculatePoolVolume(shape, { length: kidneyLengthM, width: kidneyWidthM, shallowDepth: shallowDepthM, deepDepth: deepDepthM }, unit)
        break
    }

    if (volume > 0) {
      setCalculatedVolume(volume)
      const currentState: PoolCalculatorState = {
        shape,
        lengthUnit,
        dimensions
      }
      onVolumeCalculated(volume, unit, currentState) // Pass volume, unit, and current state
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Calculate hot tub or swimming pool volume
        </CardTitle>
        <CardDescription>
          Enter your pool dimensions to calculate volume for accurate chemical dosing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Shape Selection */}
        <div className="space-y-3">
          <Label>Pool Shape</Label>
          <Select value={shape} onValueChange={(value: PoolShape) => setShape(value)} modal={false}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rectangular">Rectangular</SelectItem>
              <SelectItem value="circular">Circular</SelectItem>
              <SelectItem value="oval">Oval</SelectItem>
              <SelectItem value="kidney">Kidney-shaped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Length Unit Selection */}
        <div className="space-y-3">
          <Label>Input Dimensions Unit</Label>
          <Select value={lengthUnit} onValueChange={(value: LengthUnit) => setLengthUnit(value)} modal={false}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meters">Meters (m)</SelectItem>
              <SelectItem value="feet">Feet (ft)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Volume Unit Selection */}
        <div className="space-y-3">
          <Label>Output Volume Unit</Label>
          <Select value={unit} onValueChange={(value: VolumeUnit) => setUnit(value)} modal={false}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gallons">Imperial Gallons</SelectItem>
              <SelectItem value="litres">Litres</SelectItem>
              <SelectItem value="cubic-meters">Cubic Meters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dimensions Input */}
        <div className="space-y-4">
          <Label>Pool Dimensions</Label>
          
          {(shape === "rectangular" || shape === "oval" || shape === "kidney") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length">Length ({lengthUnit === "meters" ? "m" : "ft"})</Label>
                <Input
                  id="length"
                  type="number"
                  placeholder="0"
                  value={dimensions.length}
                  onChange={handleLengthChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Width ({lengthUnit === "meters" ? "m" : "ft"})</Label>
                <Input
                  id="width"
                  type="number"
                  placeholder="0"
                  value={dimensions.width}
                  onChange={handleWidthChange}
                />
              </div>
            </div>
          )}

          {shape === "circular" && (
            <div className="space-y-2">
              <Label htmlFor="diameter">Diameter ({lengthUnit === "meters" ? "m" : "ft"})</Label>
              <Input
                id="diameter"
                type="number"
                placeholder="0"
                value={dimensions.diameter}
                onChange={handleDiameterChange}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shallowDepth">Shallow End Depth ({lengthUnit === "meters" ? "m" : "ft"})</Label>
              <Input
                id="shallowDepth"
                type="number"
                placeholder="0"
                value={dimensions.shallowDepth}
                onChange={handleShallowDepthChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deepDepth">Deep End Depth ({lengthUnit === "meters" ? "m" : "ft"})</Label>
              <Input
                id="deepDepth"
                type="number"
                placeholder="0"
                value={dimensions.deepDepth}
                onChange={handleDeepDepthChange}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleCalculate} className="w-full">
          <Calculator className="h-4 w-4 mr-2" />
          Calculate hot tub or swimming pool volume
        </Button>
      </CardContent>
      {AlertDialogComponent}
    </Card>
  )
}


