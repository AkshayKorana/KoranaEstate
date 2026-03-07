import { Suspense } from 'react'
import HomeStayDetailClient from './HomeStayDetailClient'

export default async function HomeStayDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomeStayDetailClient id={id} />
    </Suspense>
  )
}
