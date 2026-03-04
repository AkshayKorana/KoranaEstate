export type HistoryPoint = {
  date: string
  price: number
}

export type ForecastOutput = {
  labels: string[]
  actualSeries: Array<number | null>
  forecastSeries: Array<number | null>
  lowerSeries: Array<number | null>
  upperSeries: Array<number | null>
  trendText: string
  pctMove: number | null
  lowerPct: number | null
  upperPct: number | null
  mape: number | null
  mae: number | null
  rmse: number | null
  modelDiagnostics: {
    linearMae: number | null
    holtMae: number | null
    ensembleWeightLinear: number
    ensembleWeightHolt: number
    regime: 'calm' | 'normal' | 'volatile'
    ridgeMae?: number | null
    ensembleWeightRidge?: number
  }
}

export type OosMetrics = {
  mape: number | null
  mae: number | null
  rmse: number | null
  sampleCount: number
}

type BacktestResult = OosMetrics & {
  residuals: number[]
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}

function fitLinear(values: number[]) {
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    const dx = i - xMean
    num += dx * (values[i] - yMean)
    den += dx * dx
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = yMean - slope * xMean
  return { slope, intercept }
}

export function predictLinear(values: number[], horizonDays: number): number[] {
  const { slope, intercept } = fitLinear(values)
  const n = values.length
  return Array.from({ length: horizonDays }, (_, i) => intercept + slope * (n + i))
}

function holtFit(values: number[], alpha: number, beta: number) {
  let level = values[0]
  let trend = values.length > 1 ? values[1] - values[0] : 0

  for (let t = 1; t < values.length; t += 1) {
    const prevLevel = level
    level = alpha * values[t] + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
  }

  return { level, trend }
}

function predictHolt(values: number[], horizonDays: number, alpha: number, beta: number): number[] {
  const { level, trend } = holtFit(values, alpha, beta)
  return Array.from({ length: horizonDays }, (_, i) => level + trend * (i + 1))
}

function buildLaggedRows(values: number[], lags: number) {
  const X: number[][] = []
  const y: number[] = []
  for (let i = lags; i < values.length; i += 1) {
    const row = []
    for (let l = 1; l <= lags; l += 1) row.push(values[i - l])
    X.push(row)
    y.push(values[i])
  }
  return { X, y }
}

function trainRidgeGD(values: number[], lags = 5, lambda = 0.01, lr = 1e-6, epochs = 3000) {
  const { X, y } = buildLaggedRows(values, lags)
  if (X.length === 0) {
    return { weights: Array.from({ length: lags }, () => 0), bias: values.at(-1) ?? 0, lags }
  }

  const weights = Array.from({ length: lags }, () => 0)
  let bias = y.reduce((a, b) => a + b, 0) / y.length

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW = Array.from({ length: lags }, () => 0)
    let gradB = 0

    for (let i = 0; i < X.length; i += 1) {
      const pred = weights.reduce((acc, w, j) => acc + w * X[i][j], bias)
      const err = pred - y[i]
      gradB += err
      for (let j = 0; j < lags; j += 1) gradW[j] += err * X[i][j]
    }

    const n = X.length
    gradB /= n
    for (let j = 0; j < lags; j += 1) {
      gradW[j] = (gradW[j] / n) + lambda * weights[j]
      weights[j] -= lr * gradW[j]
    }
    bias -= lr * gradB
  }

  return { weights, bias, lags }
}

function predictRidgeRecursive(values: number[], horizonDays: number, lags = 5): number[] {
  const model = trainRidgeGD(values, lags)
  const buffer = [...values]
  const out: number[] = []

  for (let step = 0; step < horizonDays; step += 1) {
    const row: number[] = []
    for (let l = 1; l <= model.lags; l += 1) row.push(buffer[buffer.length - l] ?? buffer[0])
    const pred = model.weights.reduce((acc, w, j) => acc + w * row[j], model.bias)
    out.push(pred)
    buffer.push(pred)
  }

  return out
}

function evaluateOneStep(values: number[], predictor: (train: number[]) => number): BacktestResult {
  const absErr: number[] = []
  const ape: number[] = []
  const sqErr: number[] = []
  const residuals: number[] = []

  for (let i = 8; i < values.length; i += 1) {
    const train = values.slice(0, i)
    const pred = predictor(train)
    const actual = values[i]
    const err = actual - pred
    absErr.push(Math.abs(err))
    sqErr.push(err * err)
    residuals.push(err)
    if (actual > 0) ape.push(Math.abs(err / actual))
  }

  if (absErr.length === 0) {
    return { mape: null, mae: null, rmse: null, sampleCount: 0, residuals: [] }
  }

  const mae = absErr.reduce((a, b) => a + b, 0) / absErr.length
  const mape = ape.length ? (ape.reduce((a, b) => a + b, 0) / ape.length) * 100 : null
  const rmse = Math.sqrt(sqErr.reduce((a, b) => a + b, 0) / sqErr.length)

  return {
    mape: mape == null ? null : Number(mape.toFixed(3)),
    mae: Number(mae.toFixed(3)),
    rmse: Number(rmse.toFixed(3)),
    sampleCount: absErr.length,
    residuals,
  }
}

function pickBestHoltParams(values: number[]) {
  const candidates = [0.2, 0.35, 0.5, 0.65, 0.8]
  let best = { alpha: 0.5, beta: 0.3, mae: Number.POSITIVE_INFINITY }

  for (const alpha of candidates) {
    for (const beta of candidates) {
      const metrics = evaluateOneStep(values, (train) => predictHolt(train, 1, alpha, beta)[0])
      const mae = metrics.mae ?? Number.POSITIVE_INFINITY
      if (mae < best.mae) best = { alpha, beta, mae }
    }
  }

  return best
}

function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  return sorted[base]
}

function toDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function baseSeriesSkeleton(history: HistoryPoint[], horizonDays: number) {
  const values = history.map(p => p.price)
  const last4 = values.slice(-4).map(round2)
  const actualSeries: Array<number | null> = [...last4, ...Array.from({ length: horizonDays }, () => null)]

  const lastDate = new Date(history[history.length - 1].date)
  const labels = Array.from({ length: 4 + horizonDays }, (_, i) => {
    const d = new Date(lastDate)
    d.setDate(lastDate.getDate() - 3 + i)
    return toDateLabel(d.toISOString())
  })

  return { labels, actualSeries, values, last4 }
}

function fallbackForecast(labels: string[], horizonDays: number, message: string): ForecastOutput {
  return {
    labels,
    actualSeries: Array.from({ length: 4 + horizonDays }, () => null),
    forecastSeries: Array.from({ length: 4 + horizonDays }, () => null),
    lowerSeries: Array.from({ length: 4 + horizonDays }, () => null),
    upperSeries: Array.from({ length: 4 + horizonDays }, () => null),
    trendText: message,
    pctMove: null,
    lowerPct: null,
    upperPct: null,
    mape: null,
    mae: null,
    rmse: null,
    modelDiagnostics: {
      linearMae: null,
      holtMae: null,
      ensembleWeightLinear: 0.5,
      ensembleWeightHolt: 0.5,
      regime: 'normal',
      ridgeMae: null,
      ensembleWeightRidge: 0,
    },
  }
}

export function computeHybridForecast(history: HistoryPoint[], horizonDays: number): ForecastOutput {
  const filtered = history
    .filter(p => Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-180)

  if (filtered.length < 8) {
    const labels = Array.from({ length: 4 + horizonDays }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - 3 + i)
      return toDateLabel(d.toISOString())
    })
    return fallbackForecast(labels, horizonDays, `Not enough historical points for a validated ${horizonDays}-day forecast.`)
  }

  const { labels, actualSeries, values, last4 } = baseSeriesSkeleton(filtered, horizonDays)

  const linearEval = evaluateOneStep(values, (train) => predictLinear(train, 1)[0])
  const bestHolt = pickBestHoltParams(values)
  const holtEval = evaluateOneStep(values, (train) => predictHolt(train, 1, bestHolt.alpha, bestHolt.beta)[0])
  const ridgeEval = evaluateOneStep(values, (train) => predictRidgeRecursive(train, 1, 5)[0])

  const invLinear = 1 / Math.max(linearEval.mae ?? 1, 0.001)
  const invHolt = 1 / Math.max(holtEval.mae ?? 1, 0.001)
  const invRidge = 1 / Math.max(ridgeEval.mae ?? 1, 0.001)
  const denom = invLinear + invHolt + invRidge
  const wLinear = invLinear / denom
  const wHolt = invHolt / denom
  const wRidge = invRidge / denom

  const linearN = predictLinear(values, horizonDays)
  const holtN = predictHolt(values, horizonDays, bestHolt.alpha, bestHolt.beta)
  const ridgeN = predictRidgeRecursive(values, horizonDays, 5)

  const ensembleN = linearN.map((v, i) => (v * wLinear) + (holtN[i] * wHolt) + (ridgeN[i] * wRidge))
  const forecastSeries: Array<number | null> = [null, null, null, last4[last4.length - 1], ...ensembleN.map(round2)]

  const deltas = values.slice(1).map((v, i) => (v - values[i]) / values[i]).filter(Number.isFinite)
  const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0
  const variance = deltas.length ? deltas.reduce((acc, d) => acc + (d - meanDelta) ** 2, 0) / deltas.length : 0
  const std = Math.sqrt(variance)
  const regime: 'calm' | 'normal' | 'volatile' = std < 0.01 ? 'calm' : std < 0.025 ? 'normal' : 'volatile'

  const residualPool = [...linearEval.residuals, ...holtEval.residuals, ...ridgeEval.residuals]
  const lowerRes = percentile(residualPool, 0.1)
  const upperRes = percentile(residualPool, 0.9)

  const lowerSeries: Array<number | null> = [null, null, null, null]
  const upperSeries: Array<number | null> = [null, null, null, null]
  for (let i = 0; i < horizonDays; i += 1) {
    const stepScale = Math.sqrt((i + 1) / horizonDays)
    const pred = ensembleN[i]
    lowerSeries.push(round2(pred + lowerRes * stepScale))
    upperSeries.push(round2(pred + upperRes * stepScale))
  }

  const current = values[values.length - 1]
  const target = ensembleN[horizonDays - 1]
  const pctMove = ((target - current) / current) * 100

  const lowerPct = ((lowerSeries[lowerSeries.length - 1] ?? target) - current) / current * 100
  const upperPct = ((upperSeries[upperSeries.length - 1] ?? target) - current) / current * 100

  const mape = ((linearEval.mape ?? 0) * wLinear) + ((holtEval.mape ?? 0) * wHolt) + ((ridgeEval.mape ?? 0) * wRidge)
  const mae = ((linearEval.mae ?? 0) * wLinear) + ((holtEval.mae ?? 0) * wHolt) + ((ridgeEval.mae ?? 0) * wRidge)
  const rmse = ((linearEval.rmse ?? 0) * wLinear) + ((holtEval.rmse ?? 0) * wHolt) + ((ridgeEval.rmse ?? 0) * wRidge)

  const trendDirection = pctMove >= 0 ? 'up' : 'down'
  const trendText = `Advanced ensemble (${regime}) expects ${trendDirection} move ${Math.abs(pctMove).toFixed(1)}% in next ${horizonDays} days. Likely band ${lowerPct.toFixed(1)}% to ${upperPct.toFixed(1)}%. Backtest MAPE ${mape.toFixed(1)}%.`

  return {
    labels,
    actualSeries,
    forecastSeries,
    lowerSeries,
    upperSeries,
    trendText,
    pctMove: Number(pctMove.toFixed(3)),
    lowerPct: Number(lowerPct.toFixed(3)),
    upperPct: Number(upperPct.toFixed(3)),
    mape: Number(mape.toFixed(3)),
    mae: Number(mae.toFixed(3)),
    rmse: Number(rmse.toFixed(3)),
    modelDiagnostics: {
      linearMae: linearEval.mae,
      holtMae: holtEval.mae,
      ensembleWeightLinear: Number(wLinear.toFixed(4)),
      ensembleWeightHolt: Number(wHolt.toFixed(4)),
      regime,
      ridgeMae: ridgeEval.mae,
      ensembleWeightRidge: Number(wRidge.toFixed(4)),
    },
  }
}

export function computeLinearForecast(history: HistoryPoint[], horizonDays: number): ForecastOutput {
  const filtered = history
    .filter(p => Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-180)

  if (filtered.length < 8) {
    const labels = Array.from({ length: 4 + horizonDays }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - 3 + i)
      return toDateLabel(d.toISOString())
    })
    return fallbackForecast(labels, horizonDays, `Not enough historical points for a validated ${horizonDays}-day forecast.`)
  }

  const { labels, actualSeries, values, last4 } = baseSeriesSkeleton(filtered, horizonDays)
  const evalMetrics = evaluateOneStep(values, (train) => predictLinear(train, 1)[0])
  const forecastN = predictLinear(values, horizonDays)

  const forecastSeries: Array<number | null> = [null, null, null, last4[last4.length - 1], ...forecastN.map(round2)]
  const lowerSeries: Array<number | null> = [null, null, null, null, ...forecastN.map(v => round2(v * 0.985))]
  const upperSeries: Array<number | null> = [null, null, null, null, ...forecastN.map(v => round2(v * 1.015))]

  const current = values[values.length - 1]
  const target = forecastN[horizonDays - 1]
  const pctMove = ((target - current) / current) * 100

  return {
    labels,
    actualSeries,
    forecastSeries,
    lowerSeries,
    upperSeries,
    trendText: `Linear baseline expects ${pctMove >= 0 ? 'up' : 'down'} ${Math.abs(pctMove).toFixed(1)}% over next ${horizonDays} days.${evalMetrics.mape != null ? ` Backtest MAPE ${evalMetrics.mape.toFixed(1)}%.` : ''}`,
    pctMove: Number(pctMove.toFixed(3)),
    lowerPct: Number((pctMove - 1.5).toFixed(3)),
    upperPct: Number((pctMove + 1.5).toFixed(3)),
    mape: evalMetrics.mape,
    mae: evalMetrics.mae,
    rmse: evalMetrics.rmse,
    modelDiagnostics: {
      linearMae: evalMetrics.mae,
      holtMae: null,
      ensembleWeightLinear: 1,
      ensembleWeightHolt: 0,
      regime: 'normal',
      ridgeMae: null,
      ensembleWeightRidge: 0,
    },
  }
}

export function evaluateRollingOos(history: HistoryPoint[], model: 'linear-v1' | 'hybrid-v2' | 'hybrid-v3', horizonDays: number, minTrain = 24): OosMetrics {
  const values = history
    .filter(p => Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(p => p.price)

  const absErr: number[] = []
  const ape: number[] = []
  const sqErr: number[] = []

  for (let split = minTrain; split + horizonDays <= values.length; split += 1) {
    const trainValues = values.slice(0, split)
    const actual = values[split + horizonDays - 1]

    const trainHistory: HistoryPoint[] = trainValues.map((price, idx) => ({
      date: new Date(Date.UTC(2024, 0, idx + 1)).toISOString(),
      price,
    }))

    const forecast = model === 'linear-v1'
      ? computeLinearForecast(trainHistory, horizonDays)
      : model === 'hybrid-v2'
        ? computeHybridForecast(trainHistory, horizonDays) // backward compatible alias
        : computeHybridForecast(trainHistory, horizonDays)

    const pred = forecast.forecastSeries[forecast.forecastSeries.length - 1]
    if (pred == null) continue

    const err = actual - pred
    absErr.push(Math.abs(err))
    sqErr.push(err * err)
    if (actual > 0) ape.push(Math.abs(err / actual))
  }

  if (!absErr.length) return { mape: null, mae: null, rmse: null, sampleCount: 0 }

  const mae = absErr.reduce((a, b) => a + b, 0) / absErr.length
  const rmse = Math.sqrt(sqErr.reduce((a, b) => a + b, 0) / sqErr.length)
  const mape = ape.length ? (ape.reduce((a, b) => a + b, 0) / ape.length) * 100 : null

  return {
    mape: mape == null ? null : Number(mape.toFixed(3)),
    mae: Number(mae.toFixed(3)),
    rmse: Number(rmse.toFixed(3)),
    sampleCount: absErr.length,
  }
}
