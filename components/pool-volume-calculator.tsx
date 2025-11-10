"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calculator, Ruler, Droplets } from "lucide-react"
import { calculatePoolVolume, convertVolume } from "@/lib/chemical-calculator"
import { useAlertDialog } from "@/hooks/use-alert-dialog"

interface PoolVolumeCalculatorProps {
  onVolumeCalculated: (volume: number) => void
  initialVolume?: number
}

type PoolShape = "rectangular" | "circular" | "oval" | "kidney"
type VolumeUnit = "gallons" | "litres" | "cubic-meters"

export function PoolVolumeCalculator({ onVolumeCalculated, initialVolume }: PoolVolumeCalculatorProps) {
  const [shape, setShape] = useState<PoolShape>("rectangular")
  const [unit, setUnit] = useState<VolumeUnit>("gallons")
  const [dimensions, setDimensions] = useState({
    length: "",
    width: "",
    diameter: "",
    shallowDepth: "",
    deepDepth: "",
  })
  const [calculatedVolume, setCalculatedVolume] = useState<number | null>(initialVolume || null)
  const { showAlert, AlertDialogComponent } = useAlertDialog()

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
        volume = calculatePoolVolume(shape, { length, width, shallowDepth, deepDepth }, unit)
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
        volume = calculatePoolVolume(shape, { diameter, shallowDepth, deepDepth }, unit)
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
        volume = calculatePoolVolume(shape, { length: ovalLength, width: ovalWidth, shallowDepth, deepDepth }, unit)
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
        volume = calculatePoolVolume(shape, { length: kidneyLength, width: kidneyWidth, shallowDepth, deepDepth }, unit)
        break
    }

    if (volume > 0) {
      setCalculatedVolume(volume)
      onVolumeCalculated(convertVolume(volume, unit, "gallons")) // Always store in gallons internally
    }
  }

  const getVolumeInAllUnits = () => {
    if (!calculatedVolume) return null

    const gallons = convertVolume(calculatedVolume, unit, "gallons")
    const litres = convertVolume(calculatedVolume, unit, "litres")
    const cubicMeters = convertVolume(calculatedVolume, unit, "cubic-meters")

    return { gallons, litres, cubicMeters }
  }

  const allVolumes = getVolumeInAllUnits()

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
          <Select value={shape} onValueChange={(value: PoolShape) => setShape(value)}>
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

        {/* Unit Selection */}
        <div className="space-y-3">
          <Label>Measurement Units</Label>
          <Select value={unit} onValueChange={(value: VolumeUnit) => setUnit(value)}>
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
                <Label htmlFor="length">Length</Label>
                <Input
                  id="length"
                  type="number"
                  placeholder="0"
                  value={dimensions.length}
                  onChange={(e) => setDimensions({ ...dimensions, length: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Width</Label>
                <Input
                  id="width"
                  type="number"
                  placeholder="0"
                  value={dimensions.width}
                  onChange={(e) => setDimensions({ ...dimensions, width: e.target.value })}
                />
              </div>
            </div>
          )}

          {shape === "circular" && (
            <div className="space-y-2">
              <Label htmlFor="diameter">Diameter</Label>
              <Input
                id="diameter"
                type="number"
                placeholder="0"
                value={dimensions.diameter}
                onChange={(e) => setDimensions({ ...dimensions, diameter: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shallowDepth">Shallow End Depth</Label>
              <Input
                id="shallowDepth"
                type="number"
                placeholder="0"
                value={dimensions.shallowDepth}
                onChange={(e) => setDimensions({ ...dimensions, shallowDepth: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deepDepth">Deep End Depth</Label>
              <Input
                id="deepDepth"
                type="number"
                placeholder="0"
                value={dimensions.deepDepth}
                onChange={(e) => setDimensions({ ...dimensions, deepDepth: e.target.value })}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleCalculate} className="w-full">
          <Calculator className="h-4 w-4 mr-2" />
          Calculate hot tub or swimming pool volume
        </Button>

        {/* Results */}
        {allVolumes && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Calculated Volume
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="text-center p-3 bg-white rounded border">
                <div className="text-2xl font-bold text-blue-600">{Math.round(allVolumes.cubicMeters * 100) / 100}</div>
                <div className="text-sm text-gray-600">Cubic Meters</div>
              </div>
              <div className="text-center p-3 bg-white rounded border">
                <div className="text-2xl font-bold text-blue-600">{Math.round(allVolumes.litres)}</div>
                <div className="text-sm text-gray-600">Litres</div>
              </div>
              <div className="text-center p-3 bg-white rounded border">
                <div className="text-2xl font-bold text-blue-600">{Math.round(allVolumes.gallons)}</div>
                <div className="text-sm text-gray-600">Imperial Gallons</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center">
              Conversion: 1 cubic meter = 1000 litres = 222 imperial gallons
            </div>
          </div>
        )}
      </CardContent>
      {AlertDialogComponent}
    </Card>
  )
}
