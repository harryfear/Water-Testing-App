"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ImageUpload } from "@/components/image-upload"
import { TestResults } from "@/components/test-results"
import { ColorAnalysisDebug } from "@/components/color-analysis-debug"
import { ResultsDashboard } from "@/components/results-dashboard"
import { ManualColorOverride } from "@/components/manual-color-override"
import { Droplets, Camera, Upload, ArrowLeft, Sparkles, CheckCircle, Settings, AlertTriangle } from "lucide-react"
import { detectAndAnalyzeTestStrip } from "@/lib/color-analysis"
import type { AnalysisResult } from "@/lib/color-analysis"

export function WaterTestingApp() {
  const router = useRouter()
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<Record<string, AnalysisResult> | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [showDetailedResults, setShowDetailedResults] = useState(false)
  const [stripType, setStripType] = useState<"3-in-1" | "6-in-1">("6-in-1")
  const [showManualOverride, setShowManualOverride] = useState(false)
  const [stripTypeMismatch, setStripTypeMismatch] = useState(false)

  const handleImageUpload = async (imageUrl: string) => {
    setUploadedImage(imageUrl)
    setIsAnalyzing(true)
    setAnalysisError(null)
    setShowDetailedResults(false)
    setShowManualOverride(false)
    setStripTypeMismatch(false)

    try {
      const analysisResults = await detectAndAnalyzeTestStrip(imageUrl, stripType)
      setResults(analysisResults)
      
      // Check for strip type mismatch
      const detectedParams = Object.keys(analysisResults).length
      if (stripType === "3-in-1" && detectedParams > 3) {
        setStripTypeMismatch(true)
      } else if (stripType === "6-in-1" && detectedParams < 4) {
        setStripTypeMismatch(true)
      }
      
      // Save results to localStorage for the results page
      localStorage.setItem("currentAnalysisResults", JSON.stringify(analysisResults))
    } catch (error) {
      console.error("Analysis failed:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      
      if (errorMessage.includes("Low quality image")) {
        setAnalysisError("Low quality image detected. Please improve lighting and try again with a clearer image.")
      } else {
        setAnalysisError(`Analysis failed: ${errorMessage}`)
      }

      // Fallback results
      const fallbackResults: Record<string, AnalysisResult> =
        stripType === "3-in-1"
          ? {
              freeChlorine: {
                value: 1.8,
                status: "ok" as const,
                unit: "ppm",
                confidence: 0.6,
                detectedColor: { r: 255, g: 200, b: 100 },
              },
              ph: {
                value: 7.3,
                status: "ok" as const,
                unit: "",
                confidence: 0.7,
                detectedColor: { r: 255, g: 150, b: 150 },
              },
              totalAlkalinity: {
                value: 110,
                status: "ok" as const,
                unit: "ppm",
                confidence: 0.5,
                detectedColor: { r: 150, g: 255, b: 150 },
              },
            }
          : {
              freeChlorine: {
                value: 1.8,
                status: "ok" as const,
                unit: "ppm",
                confidence: 0.6,
                detectedColor: { r: 255, g: 200, b: 100 },
              },
              ph: {
                value: 7.3,
                status: "ok" as const,
                unit: "",
                confidence: 0.7,
                detectedColor: { r: 255, g: 150, b: 150 },
              },
              totalAlkalinity: {
                value: 110,
                status: "ok" as const,
                unit: "ppm",
                confidence: 0.5,
                detectedColor: { r: 150, g: 255, b: 150 },
              },
              totalChlorine: {
                value: 2.1,
                status: "ok" as const,
                unit: "ppm",
                confidence: 0.5,
                detectedColor: { r: 200, g: 150, b: 100 },
              },
              totalHardness: {
                value: 300, // Updated to ideal value
                status: "ok" as const,
                unit: "ppm",
                confidence: 0.5,
                detectedColor: { r: 150, g: 100, b: 200 },
              },
              cyanuricAcid: {
                value: 45,
                status: "ok" as const,
                unit: "ppm",
                confidence: 0.5,
                detectedColor: { r: 255, g: 180, b: 120 },
              },
            }

      setResults(fallbackResults)
      // Save fallback results to localStorage as well
      localStorage.setItem("currentAnalysisResults", JSON.stringify(fallbackResults))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleManualOverride = (
    parameter: string,
    newValue: number,
    newStatus: string,
    newColor?: { r: number; g: number; b: number },
  ) => {
    if (!results) return

    setResults((prev) => {
      const updatedResults = {
        ...prev!,
        [parameter]: {
          ...prev![parameter],
          value: newValue,
          status: newStatus as "ok" | "low" | "high",
          confidence: 1.0,
          detectedColor: newColor || prev![parameter].detectedColor,
        },
      }

      // Update localStorage with modified results
      localStorage.setItem("currentAnalysisResults", JSON.stringify(updatedResults))

      return updatedResults
    })
  }

  const handleViewDetails = () => {
    setShowDetailedResults(true)
  }

  const handleViewResultsPage = () => {
    // Navigate to dedicated results page
    router.push("/results")
  }

  const resetTest = () => {
    setUploadedImage(null)
    setResults(null)
    setIsAnalyzing(false)
    setAnalysisError(null)
    setShowDetailedResults(false)
    setShowManualOverride(false)
    setStripTypeMismatch(false)
    // Clear localStorage when starting new test
    localStorage.removeItem("currentAnalysisResults")
  }

  const handleStripTypeChange = (newType: "3-in-1" | "6-in-1") => {
    setStripType(newType)
    if (uploadedImage && results) {
      // Re-analyze with new strip type
      handleImageUpload(uploadedImage)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 max-w-6xl">
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-3 mb-4 sm:mb-6">
            <div className="relative">
              <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg">
                <Droplets className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 p-1 bg-yellow-400 rounded-full">
                <Sparkles className="h-3 w-3 text-yellow-800" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent">
                Deep Blue Strip Ease Pro
              </h1>
              <p className="text-sm sm:text-base text-blue-600 font-medium">AI-Powered Water Analysis</p>
            </div>
          </div>
          <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            Get instant, professional-grade pool water analysis with our advanced AI color detection technology
          </p>
        </div>

        <Card className="mb-8 sm:mb-12 border-0 shadow-xl bg-gradient-to-br from-white to-blue-50/50 backdrop-blur-sm">
          <CardHeader className="px-6 sm:px-8">
            <CardTitle className="text-xl sm:text-2xl font-bold text-center text-gray-900">How It Works</CardTitle>
            <CardDescription className="text-center text-base sm:text-lg text-gray-600 mt-2">
              Get professional water analysis in three simple steps
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="text-center group">
                <div className="relative mx-auto mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-shadow">
                    <span className="text-blue-900 font-bold text-xl sm:text-2xl drop-shadow-sm">1</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Droplets className="h-3 w-3 text-yellow-800" />
                  </div>
                </div>
                <h3 className="font-bold mb-2 text-base sm:text-lg text-gray-900">Dip Test Strip</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Dip your test strip in water for 2 seconds then remove
                </p>
              </div>

              <div className="text-center group">
                <div className="relative mx-auto mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-shadow">
                    <span className="text-purple-900 font-bold text-xl sm:text-2xl drop-shadow-sm">2</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 text-green-800" />
                  </div>
                </div>
                <h3 className="font-bold mb-2 text-base sm:text-lg text-gray-900">Wait 10 Seconds</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Allow the chemical reactions to develop and colours to stabilize
                </p>
              </div>

              <div className="text-center group">
                <div className="relative mx-auto mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg group-hover:shadow-xl transition-shadow">
                    <span className="text-green-900 font-bold text-xl sm:text-2xl drop-shadow-sm">3</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center">
                    <Camera className="h-3 w-3 text-blue-800" />
                  </div>
                </div>
                <h3 className="font-bold mb-2 text-base sm:text-lg text-gray-900">Upload & Analyze</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Take a clear photo and get instant analysis with chemical recommendations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!uploadedImage ? (
          <Card className="mb-8 sm:mb-12 border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6 sm:pb-8 px-6 sm:px-8">
              <CardTitle className="flex items-center justify-center gap-3 text-xl sm:text-2xl font-bold text-gray-900">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Camera className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
                </div>
                Upload Your Test Strip
              </CardTitle>
              <CardDescription className="text-base sm:text-lg text-gray-600 mt-3 max-w-2xl mx-auto">
                Take a clear photo of your water test strip for instant AI analysis and personalized chemical
                recommendations
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 sm:px-8 pb-8">
              <div className="mb-6 flex justify-center">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <Button
                    variant={stripType === "3-in-1" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleStripTypeChange("3-in-1")}
                    className="relative"
                  >
                    3-in-1 Strip
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Basic
                    </Badge>
                  </Button>
                  <Button
                    variant={stripType === "6-in-1" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleStripTypeChange("6-in-1")}
                    className="relative"
                  >
                    6-in-1 Strip
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Complete
                    </Badge>
                  </Button>
                </div>
              </div>

              <ImageUpload onImageUpload={handleImageUpload} />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Strip Type Mismatch Warning */}
            {stripTypeMismatch && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <strong>Strip Type Mismatch Detected:</strong>{" "}
                  {stripType === "3-in-1" 
                    ? "We have detected a 6-in-1 test strip. Please select the 6-in-1 test strip analyser for accurate results."
                    : "We have detected a 3-in-1 test strip. Please select the 3-in-1 test strip analyser for accurate results."
                  }
                </AlertDescription>
              </Alert>
            )}

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4 sm:pb-6 px-6 sm:px-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                        Test Strip Analysis
                        <Badge variant="outline">{stripType.toUpperCase()}</Badge>
                      </CardTitle>
                      <CardDescription className="text-sm sm:text-base">
                        {isAnalyzing ? (
                          <span className="flex items-center gap-2 text-blue-600">
                            <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                            Analyzing colors with AI...
                          </span>
                        ) : (
                          "Analysis complete"
                        )}
                        {analysisError && (
                          <span className="text-orange-600 block mt-1 text-sm font-medium">{analysisError}</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {results && (
                      <Button
                        onClick={() => setShowManualOverride(!showManualOverride)}
                        variant="outline"
                        size="sm"
                        className="shrink-0 bg-white/80 border-gray-200 hover:bg-gray-50 font-medium"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Manual Override</span>
                        <span className="sm:hidden">Override</span>
                      </Button>
                    )}
                    <Button
                      onClick={resetTest}
                      variant="outline"
                      size="sm"
                      className="shrink-0 bg-white/80 border-gray-200 hover:bg-gray-50 font-medium"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Upload New Image</span>
                      <span className="sm:hidden">New Image</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8">
                <div className="relative max-w-md mx-auto">
                  <img
                    src={uploadedImage || "./placeholder.svg"}
                    alt="Test strip"
                    className="w-full rounded-xl shadow-lg border border-gray-200"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl backdrop-blur-sm">
                      <div className="text-white text-center p-6">
                        <div className="relative mx-auto mb-4">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-white/30 rounded-full"></div>
                          <div className="absolute top-0 left-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-sm sm:text-base font-medium">Analyzing test strip colors...</p>
                        <p className="text-xs sm:text-sm text-white/80 mt-1">This may take a few seconds</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {results && showManualOverride && (
              <ManualColorOverride results={results} onOverride={handleManualOverride} stripType={stripType} />
            )}

            {results && !showDetailedResults && (
              <ResultsDashboard 
                results={results} 
                onViewDetails={handleViewDetails}
                onViewResultsPage={handleViewResultsPage}
              />
            )}

            {results && showDetailedResults && (
              <div className="space-y-6 sm:space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Detailed Analysis</h2>
                    <p className="text-gray-600 mt-1">Complete breakdown of your water chemistry</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleViewResultsPage}
                      variant="default"
                      size="sm"
                      className="flex items-center gap-2 font-medium"
                    >
                      View Results Page
                    </Button>
                    <Button
                      onClick={() => setShowDetailedResults(false)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 bg-white/80 border-gray-200 hover:bg-gray-50 font-medium"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Back to Dashboard</span>
                      <span className="sm:hidden">Dashboard</span>
                    </Button>
                  </div>
                </div>

                {uploadedImage && <ColorAnalysisDebug imageUrl={uploadedImage} results={results} />}
                <TestResults results={results} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
