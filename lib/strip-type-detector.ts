type StripInference = "3-in-1" | "6-in-1" | null

export interface StripTypeDetection {
  padCount: number
  inferredType: StripInference
  confidence: number
}

interface RGB {
  r: number
  g: number
  b: number
}

type SegmentSource = "cluster" | "score" | "peak"

interface SegmentStats {
  averageStrength: number
  minStrength: number
  spanMean: number
  spanStdDev: number
  gapRatio: number
  strengths: number[]
}

interface SegmentCandidate {
  source: SegmentSource
  segments: SampleSegment[]
  stats: SegmentStats | null
}

interface ConfidenceContext {
  fallbackUsed: boolean
  stats: SegmentStats | null
  source: SegmentSource
}

interface PeakRange {
  start: number
  end: number
  peakIndex: number
}

export async function detectStripType(imageUrl: string): Promise<StripTypeDetection> {
  try {
    const image = await loadImage(imageUrl)
    const { canvas, ctx } = prepareCanvas(image)

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const isVertical = canvas.height >= canvas.width
    const samples = sampleAlongStripAxis(imageData, isVertical)
    const saturationSeries = samples.map((sample) => sample.saturation)
    const smoothedSaturation = smoothSeries(saturationSeries, 5)
    const baselineWindow = toOdd(Math.max(9, Math.floor(samples.length / 6)))
    const baselineSaturation = smoothSeries(smoothedSaturation, baselineWindow)
    const minSmoothed = Math.min(...smoothedSaturation)
    const normalizedSaturation = smoothedSaturation.map((value) => value - minSmoothed)
    const prominenceSeries = smoothedSaturation.map((value, idx) => {
      const baseline = baselineSaturation[idx] ?? value
      const diff = value - baseline
      const normalized = normalizedSaturation[idx] ?? 0
      const blended = Math.max(diff, normalized * 0.6)
      return blended > 0 ? blended : 0
    })

    const rawClusterSegments = clusterSamples(samples)
    const refinedClusterSegments = refineSegmentsByProminence(rawClusterSegments, prominenceSeries, samples)
    const filteredRawSegments = filterPadSegments(rawClusterSegments)
    const filteredRefinedSegments = filterPadSegments(refinedClusterSegments)
    let candidateSegments =
      filteredRefinedSegments.length >= filteredRawSegments.length ? filteredRefinedSegments : filteredRawSegments
    candidateSegments = normalizeSegmentCount(candidateSegments, samples, prominenceSeries, 2, 6)
    let clusteredSegments = filterPadSegments(candidateSegments)
    if (clusteredSegments.length === 0) {
      clusteredSegments = filteredRawSegments
    }
    const clusterCandidate: SegmentCandidate = {
      source: "cluster",
      segments: clusteredSegments,
      stats: computeSegmentStats(clusteredSegments, smoothedSaturation, baselineSaturation, prominenceSeries),
    }

    const scoreSegments = filterPadSegments(buildSegmentsFromScores(samples))
    const scoreCandidate: SegmentCandidate = {
      source: "score",
      segments: scoreSegments,
      stats: computeSegmentStats(scoreSegments, smoothedSaturation, baselineSaturation, prominenceSeries),
    }

    const peakCandidate = buildPeakCandidate(samples, smoothedSaturation, baselineSaturation, prominenceSeries)
    const allCandidates: SegmentCandidate[] = [clusterCandidate, scoreCandidate, peakCandidate]

    if (process.env.NODE_ENV !== "production") {
      allCandidates.forEach((candidate) => {
        const statsSummary = candidate.stats
          ? `avgStrength=${candidate.stats.averageStrength.toFixed(2)} gapRatio=${candidate.stats.gapRatio.toFixed(2)}`
          : "no-stats"
        console.debug(
          "[strip-type-detector] candidate source=%s pads=%s %s",
          candidate.source,
          candidate.segments.length,
          statsSummary,
        )
      })
    }

    const candidates: SegmentCandidate[] = allCandidates.filter(
      (candidate) => candidate.segments.length > 0,
    )

    const selectedCandidate = selectBestCandidate(candidates) ?? clusterCandidate
    const effectiveSegments = selectedCandidate.segments
    const selectedSource = selectedCandidate.source

    const padCount = effectiveSegments.length
    const inferredType = inferStripType(padCount)
    const confidence = calculateConfidence(effectiveSegments, samples, padCount, inferredType, {
      fallbackUsed: selectedSource !== "cluster",
      stats: selectedCandidate.stats,
      source: selectedSource,
    })

    if (process.env.NODE_ENV !== "production") {
      console.debug(
        "[strip-type-detector] detection padCount=%s inferredType=%s confidence=%s source=%s",
        padCount,
        inferredType,
        confidence.toFixed(2),
        selectedSource,
      )
    }

    return {
      padCount,
      inferredType,
      confidence,
    }
  } catch (error) {
    console.warn("[strip-type-detector] Failed to analyse strip type", error)
    return {
      padCount: 0,
      inferredType: null,
      confidence: 0,
    }
  }
}

async function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image for strip detection"))
    img.src = imageUrl
  })
}

function prepareCanvas(image: HTMLImageElement) {
  const maxSize = 480
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Unable to create 2D context for strip detection")
  }
  return { canvas, ctx }
}

interface AxisSample {
  index: number
  color: RGB
  lightness: number
  saturation: number
}

function sampleAlongStripAxis(imageData: ImageData, isVertical: boolean): AxisSample[] {
  const samples: AxisSample[] = []

  const sampleCount = 96
  const paddingRatio = 0.08

  for (let i = 0; i < sampleCount; i++) {
    const progress = paddingRatio + (i / sampleCount) * (1 - paddingRatio * 2)
    const color = isVertical
      ? averageColorRegion(imageData, 0.25, progress, 0.5, 0.06)
      : averageColorRegion(imageData, progress, 0.25, 0.06, 0.5)

    const { lightness, saturation } = getLightnessAndSaturation(color)

    samples.push({
      index: i,
      color,
      lightness,
      saturation,
    })
  } // end for i

  return samples
}

function averageColorRegion(
  imageData: ImageData,
  centerXRatio: number,
  centerYRatio: number,
  widthRatio: number,
  heightRatio: number,
): RGB {
  const { width, height, data } = imageData

  const centerX = Math.round(width * centerXRatio)
  const centerY = Math.round(height * centerYRatio)
  const regionWidth = Math.max(2, Math.round(width * widthRatio))
  const regionHeight = Math.max(2, Math.round(height * heightRatio))

  const startX = Math.max(0, centerX - Math.floor(regionWidth / 2))
  const startY = Math.max(0, centerY - Math.floor(regionHeight / 2))
  const endX = Math.min(width, startX + regionWidth)
  const endY = Math.min(height, startY + regionHeight)

  let totalR = 0
  let totalG = 0
  let totalB = 0
  let count = 0

  const step = Math.max(1, Math.floor(Math.min(regionWidth, regionHeight) / 6))

  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]

      if (a >= 220) {
        totalR += r
        totalG += g
        totalB += b
        count++
      }
    } // end for x
  } // end for y

  if (count === 0) {
    return { r: 255, g: 255, b: 255 }
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  }
}

interface SampleSegment {
  start: number
  end: number
  meanColor: RGB
  lightness: number
  saturation: number
  peakStrength?: number
}

function clusterSamples(samples: AxisSample[]): SampleSegment[] {
  if (samples.length === 0) return []

  const segments: SampleSegment[] = []
  let currentSegment: {
    start: number
    end: number
    totalR: number
    totalG: number
    totalB: number
    totalLightness: number
    totalSaturation: number
    count: number
  } | null = null

  const colorThreshold = 12

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]

    if (!currentSegment) {
      currentSegment = createSegmentAccumulator(sample, i)
      continue
    }

    const prevColor = {
      r: currentSegment.totalR / currentSegment.count,
      g: currentSegment.totalG / currentSegment.count,
      b: currentSegment.totalB / currentSegment.count,
    }

    if (colorDistance(prevColor, sample.color) > colorThreshold) {
      segments.push(finalizeSegment(currentSegment))
      currentSegment = createSegmentAccumulator(sample, i)
    } else {
      currentSegment.end = i
      currentSegment.totalR += sample.color.r
      currentSegment.totalG += sample.color.g
      currentSegment.totalB += sample.color.b
      currentSegment.totalLightness += sample.lightness
      currentSegment.totalSaturation += sample.saturation
      currentSegment.count++
    }
  } // end for i

  if (currentSegment) {
    segments.push(finalizeSegment(currentSegment))
  }

  return segments
}

function createSegmentAccumulator(sample: AxisSample, index: number) {
  return {
    start: index,
    end: index,
    totalR: sample.color.r,
    totalG: sample.color.g,
    totalB: sample.color.b,
    totalLightness: sample.lightness,
    totalSaturation: sample.saturation,
    count: 1,
  }
}

function finalizeSegment(segment: {
  start: number
  end: number
  totalR: number
  totalG: number
  totalB: number
  totalLightness: number
  totalSaturation: number
  count: number
}): SampleSegment {
  return {
    start: segment.start,
    end: segment.end,
    meanColor: {
      r: Math.round(segment.totalR / segment.count),
      g: Math.round(segment.totalG / segment.count),
      b: Math.round(segment.totalB / segment.count),
    },
    lightness: segment.totalLightness / segment.count,
    saturation: segment.totalSaturation / segment.count,
  }
}

function filterPadSegments(segments: SampleSegment[]): SampleSegment[] {
  const minSpan = 3
  const filtered: SampleSegment[] = []

  for (const segment of segments) {
    const span = segment.end - segment.start + 1
    if (span < minSpan) {
      continue
    }

    if (segment.lightness > 92 && segment.saturation < 6) {
      continue
    }

    filtered.push(segment)
  } // end for segment

  return filtered
}

function toOdd(value: number): number {
  const normalized = Math.max(1, Math.floor(value))
  return normalized % 2 === 0 ? normalized + 1 : normalized
}

function smoothSeries(values: number[], windowSize: number): number[] {
  if (values.length === 0) return []
  const normalizedWindow = Math.max(1, Math.floor(windowSize))
  const radius = Math.max(0, Math.floor(normalizedWindow / 2))

  return values.map((_, index) => {
    let total = 0
    let count = 0
    for (let offset = -radius; offset <= radius; offset++) {
      const sampleIndex = index + offset
      if (sampleIndex >= 0 && sampleIndex < values.length) {
        total += values[sampleIndex]
        count++
      }
    }
    return count > 0 ? total / count : values[index]
  })
}

function computeSegmentStats(
  segments: SampleSegment[],
  _smoothed: number[],
  _baseline: number[],
  prominence: number[],
): SegmentStats | null {
  if (segments.length === 0) return null

  const spans = segments.map((segment) => Math.max(1, segment.end - segment.start + 1))
  const coverage = spans.reduce((sum, span) => sum + span, 0)
  const totalRange = Math.max(1, segments[segments.length - 1].end - segments[0].start + 1)
  const gapRatio = Math.min(1, Math.max(0, (totalRange - coverage) / totalRange))

  const strengths: number[] = segments.map((segment) => {
    if (segment.peakStrength && segment.peakStrength > 0) {
      return segment.peakStrength
    }
    let strength = 0
    for (let i = segment.start; i <= segment.end; i++) {
      strength = Math.max(strength, prominence[i] ?? 0)
    }
    return strength
  })

  const sumStrength = strengths.reduce((sum, value) => sum + value, 0)
  const averageStrength = strengths.length ? sumStrength / strengths.length : 0
  const minStrength = strengths.length ? Math.min(...strengths) : 0

  const spanMean = spans.reduce((sum, span) => sum + span, 0) / spans.length
  const spanVariance = spans.reduce((sum, span) => sum + (span - spanMean) ** 2, 0) / spans.length
  const spanStdDev = Math.sqrt(spanVariance)

  return {
    averageStrength,
    minStrength,
    spanMean,
    spanStdDev,
    gapRatio,
    strengths,
  }
}

function buildPeakCandidate(
  samples: AxisSample[],
  smoothedSaturation: number[],
  baselineSaturation: number[],
  prominenceSeries: number[],
): SegmentCandidate {
  const sampleCount = samples.length
  if (sampleCount === 0) {
    return { source: "peak", segments: [], stats: null }
  }

  const maxProminence = Math.max(...prominenceSeries)
  if (!isFinite(maxProminence) || maxProminence <= 0) {
    return { source: "peak", segments: [], stats: null }
  }

  const minProminence = Math.max(2, maxProminence * 0.24)
  const minDistance = Math.max(4, Math.round(sampleCount / 18))
  let peakIndices = selectPeakIndices(prominenceSeries, minProminence, minDistance)

  if (peakIndices.length < 4 && maxProminence > 0) {
    const relaxedThreshold = Math.max(1.4, maxProminence * 0.18)
    const relaxedDistance = Math.max(3, Math.round(minDistance * 0.75))
    const relaxedPeaks = selectPeakIndices(prominenceSeries, relaxedThreshold, relaxedDistance)
    if (relaxedPeaks.length > peakIndices.length) {
      peakIndices = relaxedPeaks
    }
  }

  if (peakIndices.length === 0 && maxProminence > 0) {
    peakIndices = selectTopProminenceIndices(prominenceSeries, Math.min(6, Math.max(3, Math.round(sampleCount / 24))), minDistance)
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "[strip-type-detector] peak-analysis maxProminence=%s minProminence=%s peaksFound=%s",
      maxProminence.toFixed(2),
      minProminence.toFixed(2),
      peakIndices.length,
    )
  }

  if (peakIndices.length === 0) {
    return { source: "peak", segments: [], stats: null }
  }

  const prioritized = [...peakIndices].sort((a, b) => prominenceSeries[b] - prominenceSeries[a])
  const maxPeaks = Math.min(6, prioritized.length)
  const chosenPeaks = prioritized.slice(0, maxPeaks).sort((a, b) => a - b)

  const ranges = buildRangesFromPeaks(chosenPeaks, prominenceSeries, sampleCount, minDistance)
  const segments = ranges.map((range) =>
    createSegmentFromRange(samples, range.start, range.end, prominenceSeries[range.peakIndex] || 0),
  )
  const filteredSegments = filterPadSegments(segments)
  const usableSegments =
    filteredSegments.length >= Math.max(2, Math.floor(segments.length * 0.6)) ? filteredSegments : segments
  const stats = computeSegmentStats(usableSegments, smoothedSaturation, baselineSaturation, prominenceSeries)

  return {
    source: "peak",
    segments: usableSegments,
    stats,
  }
}

function selectPeakIndices(prominence: number[], minProminence: number, minDistance: number): number[] {
  const candidates: Array<{ index: number; value: number }> = []

  for (let i = 1; i < prominence.length - 1; i++) {
    const value = prominence[i]
    if (value < minProminence) continue
    if (value >= prominence[i - 1] && value >= prominence[i + 1]) {
      candidates.push({ index: i, value })
    }
  }

  candidates.sort((a, b) => b.value - a.value)

  const peaks: number[] = []
  for (const candidate of candidates) {
    if (peaks.some((existing) => Math.abs(existing - candidate.index) < minDistance)) {
      continue
    }
    peaks.push(candidate.index)
    if (peaks.length >= 8) {
      break
    }
  }

  return peaks.sort((a, b) => a - b)
}

function selectTopProminenceIndices(prominence: number[], targetCount: number, minDistance: number): number[] {
  const candidates = prominence
    .map((value, index) => ({ value, index }))
    .filter((entry) => isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => b.value - a.value)

  const peaks: number[] = []
  for (const candidate of candidates) {
    if (peaks.some((existing) => Math.abs(existing - candidate.index) < minDistance)) {
      continue
    }
    peaks.push(candidate.index)
    if (peaks.length >= targetCount) break
  }

  return peaks.sort((a, b) => a - b)
}

function buildRangesFromPeaks(
  peaks: number[],
  prominenceSeries: number[],
  sampleCount: number,
  minDistance: number,
): PeakRange[] {
  const minSpan = 3
  const defaultHalfWidth = Math.max(3, Math.round(minDistance / 2) + 1)
  const boundaries: number[] = []

  for (let i = 0; i < peaks.length - 1; i++) {
    boundaries.push(Math.floor((peaks[i] + peaks[i + 1]) / 2))
  }

  const ranges: PeakRange[] = peaks.map((peakIndex, idx) => {
    const startBoundary = idx === 0 ? Math.max(0, peakIndex - defaultHalfWidth) : boundaries[idx - 1] + 1
    const endBoundary =
      idx === peaks.length - 1 ? Math.min(sampleCount - 1, peakIndex + defaultHalfWidth) : boundaries[idx]

    let start = Math.max(0, Math.min(startBoundary, peakIndex))
    let end = Math.min(sampleCount - 1, Math.max(endBoundary, peakIndex))

    if (end - start + 1 < minSpan) {
      const deficit = minSpan - (end - start + 1)
      const extendLeft = Math.min(deficit, start)
      start -= extendLeft
      end = Math.min(sampleCount - 1, end + (deficit - extendLeft))
    }

    const peakProminence = prominenceSeries[peakIndex] || 0
    const softDrop = Math.max(1, peakProminence * 0.18)

    while (start > 0 && prominenceSeries[start] > softDrop && start > (idx === 0 ? 0 : boundaries[idx - 1])) {
      start--
    }
    while (
      end < sampleCount - 1 &&
      prominenceSeries[end] > softDrop &&
      end < (idx === peaks.length - 1 ? sampleCount - 1 : boundaries[idx])
    ) {
      end++
    }

    return {
      start: Math.max(0, start),
      end: Math.min(sampleCount - 1, end),
      peakIndex,
    }
  })

  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1]
    const current = ranges[i]
    if (current.start <= prev.end) {
      current.start = Math.min(sampleCount - 1, prev.end + 1)
    }
    if (current.start > current.end) {
      current.start = Math.max(prev.end + 1, current.end - (minSpan - 1))
    }
  }

  for (let i = ranges.length - 2; i >= 0; i--) {
    const current = ranges[i]
    const next = ranges[i + 1]
    if (current.end >= next.start) {
      current.end = Math.max(current.start + minSpan - 1, next.start - 1)
    }
  }

  return ranges.filter((range) => range.start <= range.end)
}

function createSegmentFromRange(
  samples: AxisSample[],
  start: number,
  end: number,
  peakStrength: number,
): SampleSegment {
  const clampedStart = Math.max(0, Math.min(start, samples.length - 1))
  const clampedEnd = Math.max(clampedStart, Math.min(end, samples.length - 1))

  let totalR = 0
  let totalG = 0
  let totalB = 0
  let totalLightness = 0
  let totalSaturation = 0
  let count = 0

  for (let i = clampedStart; i <= clampedEnd; i++) {
    const sample = samples[i]
    totalR += sample.color.r
    totalG += sample.color.g
    totalB += sample.color.b
    totalLightness += sample.lightness
    totalSaturation += sample.saturation
    count++
  }

  if (count === 0) {
    return {
      start: clampedStart,
      end: clampedEnd,
      meanColor: { r: 255, g: 255, b: 255 },
      lightness: 100,
      saturation: 0,
      peakStrength: 0,
    }
  }

  return {
    start: clampedStart,
    end: clampedEnd,
    meanColor: {
      r: Math.round(totalR / count),
      g: Math.round(totalG / count),
      b: Math.round(totalB / count),
    },
    lightness: totalLightness / count,
    saturation: totalSaturation / count,
    peakStrength,
  }
}

function refineSegmentsByProminence(
  segments: SampleSegment[],
  prominence: number[],
  samples: AxisSample[],
): SampleSegment[] {
  if (segments.length === 0) return []

  const refinedRanges: PeakRange[] = []
  const minSpan = 3
  const targetSpan = Math.max(minSpan + 1, Math.round(prominence.length / 6))
  const maxSpan = Math.max(targetSpan + 4, minSpan + 2)

  const processRange = (start: number, end: number) => {
    start = Math.max(0, Math.min(start, prominence.length - 1))
    end = Math.max(start, Math.min(end, prominence.length - 1))
    const span = end - start + 1

    if (span <= minSpan) {
      const peakIndex = findPeakIndexInRange(start, end, prominence)
      refinedRanges.push({ start, end, peakIndex })
      return
    }

    const splitIndex = findSplitIndexInRange(start, end, prominence, minSpan)
    if (splitIndex !== null && span > maxSpan) {
      processRange(start, splitIndex)
      processRange(splitIndex + 1, end)
      return
    }

    const peakIndex = findPeakIndexInRange(start, end, prominence)
    refinedRanges.push({ start, end, peakIndex })
  }

  for (const segment of segments) {
    processRange(segment.start, segment.end)
  }

  return refinedRanges
    .filter((range) => range.start <= range.end)
    .map((range) => {
      const strength = getMaxInRange(prominence, range.start, range.end)
      return createSegmentFromRange(samples, range.start, range.end, strength)
    })
}

function findSplitIndexInRange(
  start: number,
  end: number,
  prominence: number[],
  minSpan: number,
): number | null {
  const span = end - start + 1
  if (span < minSpan * 2 + 2) return null

  let minValue = Number.POSITIVE_INFINITY
  let minIndex = -1
  for (let i = start + minSpan; i <= end - minSpan; i++) {
    const value = prominence[i] ?? 0
    if (value < minValue) {
      minValue = value
      minIndex = i
    }
  }

  if (minIndex === -1) return null

  const leftMax = getMaxInRange(prominence, start, minIndex - 1)
  const rightMax = getMaxInRange(prominence, minIndex + 1, end)
  const peakReference = Math.min(leftMax, rightMax)

  if (peakReference <= 0) return null
  if (minValue > peakReference * 0.55) return null

  return minIndex
}

function findPeakIndexInRange(start: number, end: number, prominence: number[]): number {
  let bestIndex = start
  let bestValue = Number.NEGATIVE_INFINITY
  for (let i = start; i <= end; i++) {
    const value = prominence[i] ?? 0
    if (value > bestValue) {
      bestValue = value
      bestIndex = i
    }
  }
  return bestIndex
}

function getMaxInRange(prominence: number[], start: number, end: number): number {
  let maxValue = 0
  for (let i = start; i <= end; i++) {
    const value = prominence[i] ?? 0
    if (value > maxValue) {
      maxValue = value
    }
  }
  return maxValue
}

function normalizeSegmentCount(
  segments: SampleSegment[],
  samples: AxisSample[],
  prominence: number[],
  minCount: number,
  maxCount: number,
): SampleSegment[] {
  if (segments.length === 0) return segments

  let normalized = [...segments].sort((a, b) => a.start - b.start)

  while (normalized.length > maxCount) {
    let mergeIndex = 0
    let bestSpan = Number.POSITIVE_INFINITY

    for (let i = 0; i < normalized.length - 1; i++) {
      const left = normalized[i]
      const right = normalized[i + 1]
      const combinedSpan = left.end - left.start + 1 + (right.end - right.start + 1)
      if (combinedSpan < bestSpan) {
        bestSpan = combinedSpan
        mergeIndex = i
      }
    }

    const mergedStart = normalized[mergeIndex].start
    const mergedEnd = normalized[mergeIndex + 1].end
    const mergedStrength = getMaxInRange(prominence, mergedStart, mergedEnd)

    normalized.splice(
      mergeIndex,
      2,
      createSegmentFromRange(samples, mergedStart, mergedEnd, mergedStrength),
    )
  }

  if (normalized.length < minCount) {
    return segments
  }

  return normalized
}

function selectBestCandidate(candidates: SegmentCandidate[]): SegmentCandidate | null {
  if (!candidates.length) return null

  let bestCandidate: SegmentCandidate | null = null
  let bestScore = -Infinity

  for (const candidate of candidates) {
    const score = evaluateSegmentCandidate(candidate)
    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  return bestCandidate
}

function evaluateSegmentCandidate(candidate: SegmentCandidate): number {
  const padCount = candidate.segments.length
  if (padCount === 0) return -Infinity

  const stats = candidate.stats
  const closenessToSix = 1 - Math.min(1, Math.abs(padCount - 6) / 3)
  const closenessToThree = 1 - Math.min(1, Math.abs(padCount - 3) / 2)
  const padPreference =
    closenessToSix > closenessToThree + 0.15 ? closenessToSix * 1.2 : Math.max(closenessToSix * 1.05, closenessToThree)

  const strengthScore = stats ? Math.min(1, stats.averageStrength / 12) : 0.25
  const gapScore = stats ? Math.max(0, 1 - Math.min(1, stats.gapRatio * 2)) : 0.25
  const spanScore = stats
    ? Math.max(0, 1 - Math.min(1, stats.spanStdDev / Math.max(1, stats.spanMean)))
    : 0.25
  const sourceBoost = candidate.source === "peak" ? 0.05 : 0
  const highPadBonus = padCount >= 5 ? 0.12 : 0
  const lowPadPenalty = padCount <= 3 ? 0.08 : 0

  return (
    padPreference * 0.6 +
    strengthScore * 0.25 +
    gapScore * 0.1 +
    spanScore * 0.05 +
    sourceBoost +
    highPadBonus -
    lowPadPenalty
  )
}

function getPadScore(sample: AxisSample): number {
  const saturation = sample.saturation
  const brightnessPenalty = sample.lightness > 90 ? (sample.lightness - 90) * 1.5 : 0
  const adjustedScore = saturation - brightnessPenalty
  return Math.max(0, adjustedScore)
}

function buildSegmentsFromScores(samples: AxisSample[]): SampleSegment[] {
  if (samples.length === 0) return []

  const scores = samples.map(getPadScore)
  const maxScore = Math.max(...scores)
  if (maxScore <= 0) return []

  const minScore = Math.min(...scores)
  const dynamicThreshold = minScore + (maxScore - minScore) * 0.35
  const scoreThreshold = Math.max(6, dynamicThreshold)

  const segments: SampleSegment[] = []
  let inSegment = false
  let startIndex = 0
  let totalR = 0
  let totalG = 0
  let totalB = 0
  let totalSaturation = 0
  let totalLightness = 0
  let segmentCount = 0

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const isPad = scores[i] >= scoreThreshold

    if (isPad) {
      if (!inSegment) {
        inSegment = true
        startIndex = i
        totalR = 0
        totalG = 0
        totalB = 0
        totalSaturation = 0
        totalLightness = 0
        segmentCount = 0
      }

      totalR += sample.color.r
      totalG += sample.color.g
      totalB += sample.color.b
      totalSaturation += sample.saturation
      totalLightness += sample.lightness
      segmentCount++
    } else if (inSegment && segmentCount > 0) {
      segments.push({
        start: startIndex,
        end: i - 1,
        meanColor: {
          r: Math.round(totalR / segmentCount),
          g: Math.round(totalG / segmentCount),
          b: Math.round(totalB / segmentCount),
        },
        lightness: totalLightness / segmentCount,
        saturation: totalSaturation / segmentCount,
      })
      inSegment = false
    }
  } // end for i

  if (inSegment && segmentCount > 0) {
    segments.push({
      start: startIndex,
      end: samples.length - 1,
      meanColor: {
        r: Math.round(totalR / segmentCount),
        g: Math.round(totalG / segmentCount),
        b: Math.round(totalB / segmentCount),
      },
      lightness: totalLightness / segmentCount,
      saturation: totalSaturation / segmentCount,
    })
  }

  return segments
}

function inferStripType(padCount: number): StripInference {
  if (padCount <= 0) return null
  if (padCount >= 6) return "6-in-1"
  if (padCount <= 2) return "3-in-1"

  const distanceToSix = Math.abs(padCount - 6)
  const distanceToThree = Math.abs(padCount - 3)

  if (distanceToSix < distanceToThree) return "6-in-1"
  if (distanceToThree < distanceToSix) return "3-in-1"

  return padCount >= 4 ? "6-in-1" : "3-in-1"
}

function calculateConfidence(
  segments: SampleSegment[],
  _samples: AxisSample[],
  padCount: number,
  inferredType: StripInference,
  context: ConfidenceContext,
): number {
  if (!inferredType || padCount === 0) return 0
  const countExpectation = inferredType === "6-in-1" ? 6 : 3
  const countScore = Math.max(
    0,
    1 - Math.min(countExpectation, Math.abs(countExpectation - padCount)) / countExpectation,
  )

  const stats = context.stats
  const averageStrength = stats ? stats.averageStrength : 0
  const minStrength = stats ? stats.minStrength : 0
  const strengthScore = stats ? Math.min(1, averageStrength / 12) : 0.3
  const strengthUniformity =
    stats && stats.averageStrength > 0 ? Math.min(1, minStrength / stats.averageStrength) : 0.3
  const stabilityScore = strengthScore * 0.7 + strengthUniformity * 0.3

  const consistencyScore = stats
    ? Math.max(0, 1 - Math.min(1, stats.spanStdDev / Math.max(1, stats.spanMean)))
    : 0.4
  const gapScore = stats ? Math.max(0, 1 - Math.min(0.9, stats.gapRatio * 1.6)) : 0.4

  const peakBonus = context.source === "peak" ? 0.07 : 0
  const fallbackPenalty = context.fallbackUsed ? 0.12 : 0
  const coverageBonus = segments.length > 1 ? Math.min(0.05, (segments.length - 1) * 0.01) : 0

  const confidence =
    0.28 + countScore * 0.35 + stabilityScore * 0.25 + consistencyScore * 0.15 + gapScore * 0.15 + peakBonus + coverageBonus - fallbackPenalty

  return Math.min(1, Math.max(0, confidence))
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

function getLightnessAndSaturation(color: RGB) {
  const max = Math.max(color.r, color.g, color.b)
  const min = Math.min(color.r, color.g, color.b)
  const lightness = ((max + min) / 2 / 255) * 100
  const saturation = max === 0 ? 0 : ((max - min) / max) * 100
  return { lightness, saturation }
}

