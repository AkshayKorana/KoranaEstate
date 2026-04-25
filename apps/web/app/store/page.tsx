'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StoreRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/marketplace?tab=store') }, [router])
  return null
}
