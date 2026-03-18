import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  void request
  return NextResponse.json({ listings: [] })
}

export async function POST(request: NextRequest) {
  void request
  return NextResponse.json(
    { error: 'Estate listings are temporarily unavailable in the web app.' },
    { status: 501 },
  )
}
