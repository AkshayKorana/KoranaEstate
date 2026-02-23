import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STRICT_REAL_DATA = process.env.STRICT_REAL_DATA === 'true' || process.env.NODE_ENV === 'production'

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // 1) Database reachability check
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch (error) {
    checks.database = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }

  // 2) Core auth environment readiness
  checks.nextAuthSecret = {
    ok: Boolean(process.env.NEXTAUTH_SECRET),
    detail: process.env.NEXTAUTH_SECRET ? undefined : 'NEXTAUTH_SECRET is missing',
  }

  checks.nextAuthUrl = {
    ok: Boolean(process.env.NEXTAUTH_URL),
    detail: process.env.NEXTAUTH_URL ? undefined : 'NEXTAUTH_URL is missing',
  }

  // 3) Runtime mode flags
  checks.strictRealData = {
    ok: true,
    detail: STRICT_REAL_DATA ? 'strict mode enabled' : 'strict mode disabled',
  }

  const allOk = Object.values(checks).every((check) => check.ok)

  return NextResponse.json(
    {
      ok: allOk,
      strictMode: STRICT_REAL_DATA,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
