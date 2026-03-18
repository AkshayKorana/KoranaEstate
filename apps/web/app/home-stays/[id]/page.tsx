import { Suspense } from 'react'
import HomeStayDetailClient from './HomeStayDetailClient'

const HOME_STAYS_ENABLED = false

export default async function HomeStayDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!HOME_STAYS_ENABLED) {
    return null
  }

  const { id } = await params

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomeStayDetailClient id={id} />
    </Suspense>
  )
}
