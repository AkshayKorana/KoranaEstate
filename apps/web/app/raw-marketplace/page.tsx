'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RawMarketplaceRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/marketplace?tab=raw') }, [router])
  return null
}
