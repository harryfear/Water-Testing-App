"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ResultsDashboard } from "@/components/results-dashboard"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home, AlertTriangle } from "lucide-react"
import type { AnalysisResult } from "@/lib/color-analysis"
import { useAlertDialog } from "@/hooks/use-alert-dialog"

interface SharedResultsData {
  timestamp: string
  healthScore: number
  results: Record<string, AnalysisResult>
  issueCount: number
  totalParams: number
}

export function ResultsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [results, setResults] = useState<Record<string, AnalysisResult> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { showAlert, AlertDialogComponent } = useAlertDialog()

  useEffect(() => {
    const shareId = searchParams.get("share")
    
    if (shareId) {
      // Load shared results
      const stored = localStorage.getItem(`results_${shareId}`)
      if (stored) {
        try {
          const data: SharedResultsData = JSON.parse(stored)
          setResults(data.results)
        } catch (err) {
          setError("Failed to load shared results. The link may have expired.")
          console.error("Error loading shared results:", err)
        }
      } else {
        setError("Shared results not found or expired. Please request a new share link.")
      }
    } else {
      // Load current analysis results
      const currentResults = localStorage.getItem("currentAnalysisResults")
      if (currentResults) {
        try {
          const data = JSON.parse(currentResults)
          setResults(data)
        } catch (err) {
          setError("Failed to load current results. Please perform a new analysis.")
          console.error("Error loading results:", err)
        }
      } else {
        setError("No results found. Please upload and analyze a test strip first.")
      }
    }
    
    setLoading(false)
  }, [searchParams])

  const handleBackToHome = () => {
    router.push("/")
  }

  const handleViewDetails = () => {
    // For shared results, we can't show detailed view in main app
    if (searchParams.get("share")) {
      showAlert({
        title: "Feature Not Available",
        description: "Detailed view is not available for shared results.",
      })
    } else {
      // For current results, navigate back to main app
      router.push("/")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="bg-white rounded-lg shadow-lg p-6 border border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Results Not Available</h2>
            <p className="text-gray-600 mb-6">
              {error || "Unable to load water test results."}
            </p>
            <div className="space-y-3">
              <Button onClick={handleBackToHome} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              {!searchParams.get("share") && (
                <Button 
                  onClick={() => router.push("/")} 
                  variant="outline" 
                  className="w-full"
                >
                  Perform New Analysis
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={handleBackToHome}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Water Test Results
            </h1>
            <p className="text-gray-600 mt-2">
              {searchParams.get("share") ? "Shared Results" : "Your Analysis Results"}
            </p>
          </div>
          
          <div className="w-20"></div> {/* Spacer for balance */}
        </div>

        {/* Results Dashboard */}
        <div className="max-w-6xl mx-auto">
          <ResultsDashboard 
            results={results} 
            onViewDetails={handleViewDetails}
            isShared={!!searchParams.get("share")}
          />
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Generated by Deep Blue Pool Supplies Water Testing App</p>
          {searchParams.get("share") && (
            <p className="mt-2">
              Results shared on {new Date().toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      {AlertDialogComponent}
    </div>
  )
}
