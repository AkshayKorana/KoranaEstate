import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${secret}`
}

async function runStep(origin: string, path: string) {
  const res = await fetch(`${origin}${path}`, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Step ${path} failed (${res.status}): ${text.slice(0, 300)}`)
  }
  return { path, status: res.status }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const origin = req.nextUrl.origin
    const steps = []

    // 1) Ingest latest web benchmark feed.
    steps.push(await runStep(origin, '/api/market'))

    // 2) Refresh multi-source normalized price intelligence.
    steps.push(await runStep(origin, '/api/price-intel'))

    // 3) Recompute forecasts (3/7/14 days) + persist metrics.
    steps.push(await runStep(origin, '/api/forecast?commodities=Arabica,Robusta,Pepper,Cardamom'))

    // 4) Recompute leaderboard (linear-v1 vs hybrid-v2) with OOS tracking.
    steps.push(await runStep(origin, '/api/model-leaderboard?commodities=Arabica,Robusta,Pepper,Cardamom'))

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      steps,
    })
  } catch (error) {
    console.error('Pipeline job failed:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Pipeline failed',
        ranAt: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
