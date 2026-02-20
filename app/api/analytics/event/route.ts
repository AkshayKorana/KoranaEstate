import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type AnalyticsPayload = {
  eventName?: string
  page?: string
  commodity?: string
  horizonDays?: number
  lang?: string
  meta?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyticsPayload

    if (!body.eventName || typeof body.eventName !== 'string') {
      return NextResponse.json({ error: 'eventName is required' }, { status: 400 })
    }

    await prisma.analyticsEvent.create({
      data: {
        eventName: body.eventName,
        page: body.page,
        commodity: body.commodity,
        horizonDays: Number.isFinite(body.horizonDays) ? body.horizonDays : null,
        lang: body.lang,
        metaJson: body.meta ? JSON.stringify(body.meta) : null,
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/analytics/event failed:', error)
    return NextResponse.json({ error: 'Failed to store analytics event.' }, { status: 500 })
  }
}
