"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, XCircle, Calculator, TrendingUp } from "lucide-react"
import { ChemicalRecommendations } from "./chemical-recommendations"
import type { AnalysisResult } from "@/lib/color-analysis"

interface TestResultsProps {
  results: Record<string, AnalysisResult>
}

const parameterInfo = {
  freeChlorine: {
    name: "Free Chlorine",
    description: "Available chlorine for sanitization",
    ideal: "1.0 - 3.0 ppm",
  },
  ph: {
    name: "pH Level",
    description: "Acidity/alkalinity balance",
    ideal: "7.2 - 7.6",
  },
  totalAlkalinity: {
    name: "Total Alkalinity",
    description: "pH buffer capacity",
    ideal: "80 - 120 ppm",
  },
  totalChlorine: {
    name: "Total Chlorine",
    description: "Combined available and used chlorine",
    ideal: "1.0 - 3.0 ppm",
  },
  totalHardness: {
    name: "Total Hardness",
    description: "Calcium and magnesium content",
    ideal: "150 - 300 ppm",
  },
  cyanuricAcid: {
    name: "Cyanuric Acid",
    description: "Chlorine stabilizer",
    ideal: "30 - 50 ppm",
  },
}

function getStatusIcon(status: string) {
  switch (status) {
    case "ok":
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case "high":
      return <AlertTriangle className="h-5 w-5 text-orange-500" />
    case "low":
      return <XCircle className="h-5 w-5 text-red-500" />
    default:
      return <CheckCircle className="h-5 w-5 text-gray-400" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "ok":
      return "bg-green-100 text-green-800"
    case "high":
      return "bg-orange-100 text-orange-800"
    case "low":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100)
  const color = confidence > 0.8 ? "text-green-600" : confidence > 0.6 ? "text-yellow-600" : "text-red-600"

  return (
    <div className={`flex items-center gap-1 text-xs ${color}`}>
      <TrendingUp className="h-3 w-3" />
      {percentage}% confidence
    </div>
  )
}

function ColorIndicator({ detectedColor }: { detectedColor: { r: number; g: number; b: number } }) {
  const r = Math.round(detectedColor.r)
  const g = Math.round(detectedColor.g)
  const b = Math.round(detectedColor.b)
  const rgbString = `rgb(${r}, ${g}, ${b})`

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm"
          style={{ backgroundColor: rgbString }}
          title={`RGB(${r}, ${g}, ${b})`}
        />
        <div className="text-xs text-gray-500 mt-1 bg-white/80 px-1 rounded">Detected</div>
      </div>
      <div className="text-xs text-gray-500">
        RGB({r}, {g}, {b})
      </div>
    </div>
  )
}

export function TestResults({ results }: TestResultsProps) {
  const hasIssues = Object.values(results).some((result) => result.status !== "ok")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Detailed Water Test Results
          </CardTitle>
          <CardDescription>
            {hasIssues
              ? "Some parameters need attention - see recommendations below"
              : "All parameters are within ideal ranges"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {Object.entries(results).map(([key, result]) => {
              const info = parameterInfo[key as keyof typeof parameterInfo]

              if (!info) {
                console.warn(`Unknown parameter: ${key}`)
                return null
              }

              return (
                <div key={key} className="flex items-center justify-between p-4 border rounded-lg bg-white/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(result.status)}
                      <h3 className="font-semibold text-lg">{info.name}</h3>
                      <Badge className={getStatusColor(result.status)}>{result.status.toUpperCase()}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{info.description}</p>
                    <p className="text-xs text-gray-500 mb-2">Ideal range: {info.ideal}</p>
                    <ConfidenceIndicator confidence={result.confidence} />
                    {result.detectedColor && (
                      <div className="mt-3">
                        <ColorIndicator detectedColor={result.detectedColor} />
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {!isFinite(result.value) ? (
                        <span className="text-red-600">Low quality image, please improve lighting</span>
                      ) : (
                        <>
                          {result.value}
                          <span className="text-lg text-gray-600 ml-1">{result.unit}</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">Current Value</div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <ChemicalRecommendations results={results} />
    </div>
  )
}
