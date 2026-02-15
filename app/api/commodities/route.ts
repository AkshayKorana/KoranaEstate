// app/api/commodities/route.ts
/*
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Supported commodities
const COMMODITIES = ['Arabica', 'Robusta', 'Pepper', 'Cardamom']

// Example free sources (placeholders)
const COFFEE_API = 'https://indiancoffee.nic.in/api/latest.json'
const SPICE_API = 'https://agmarknet.gov.in/api/prices.json'

export async function GET(req: NextRequest) {
  try {
    let data: any[] = []

    // 1️⃣ Fetch Coffee prices
    try {
      const res = await fetch(COFFEE_API)
      const coffeeData = await res.json()
      data = data.concat(
        coffeeData.map((c: any) => ({
          type: 'Coffee',
          name: c.variety || 'Unknown',
          price: parseFloat(c.price) || 0,
          location: c.location || '',
          source: 'Gov',
        }))
      )
    } catch (err) {
      console.warn('Coffee API fetch failed:', err)
    }

    // 2️⃣ Fetch Spices
    try {
      const res = await fetch(SPICE_API)
      const spiceData = await res.json()
      data = data.concat(
        spiceData.map((s: any) => ({
          type: 'Spice',
          name: s.commodity || 'Unknown',
          variety: s.variety || '',
          price: parseFloat(s.price) || 0,
          location: s.market || '',
          source: 'Agmarknet',
        }))
      )
    } catch (err) {
      console.warn('Spice API fetch failed:', err)
    }

    // 3️⃣ Store in Prisma
    for (const item of data) {
      await prisma.commodity.create({
        data: {
          type: item.type,
          name: item.name,
          variety: item.variety,
          price: item.price,
          location: item.location,
          source: item.source,
        },
      })
    }

    // 4️⃣ Historical + AI insights
    const result = []
    const insights: Record<string, string> = {}

    for (const commodityName of COMMODITIES) {
      // Last 7 entries
      const history = await prisma.commodity.findMany({
        where: { name: commodityName },
        orderBy: { createdAt: 'desc' },
        take: 7,
      })

      if (!history.length) continue

      const historicalPrices = history
        .map((h) => ({ date: h.createdAt, price: h.price }))
        .reverse()

      // AI prediction
      const pricesArray = historicalPrices.map((h) => h.price)
      const prompt = `
        Last 7 days prices for ${commodityName}: ${pricesArray.join(
        ', '
      )}. Predict next-day trend in 1 short sentence (up, down, or stable).
      `
      try {
        const response = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 40,
        })
        insights[commodityName] =
          response.data.choices[0].message?.content || 'Prediction unavailable'
      } catch (err) {
        insights[commodityName] = 'Prediction unavailable'
      }

      // Prepare final result
      result.push({
        name: commodityName,
        historicalPrices,
        currentPrice: historicalPrices[historicalPrices.length - 1].price,
        source: history[0].source,
      })
    }

    return NextResponse.json({
      data: result,
      insights,
      lastUpdated: new Date(),
    })
  } catch (err) {
    console.error('Commodities API error:', err)
    return NextResponse.json(
      { data: [], insights: {}, lastUpdated: new Date() },
      { status: 500 }
    )
  }
} */
// app/api/commodities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Mock data for development/testing
const MOCK_COMMODITIES = [
  { type: 'Coffee', name: 'Arabica', price: 520, location: 'Chikmagalur', source: 'Mock' },
  { type: 'Coffee', name: 'Robusta', price: 450, location: 'Coorg', source: 'Mock' },
  { type: 'Spice', name: 'Pepper', price: 650, location: 'Kerala', source: 'Mock' },
  { type: 'Spice', name: 'Cardamom', price: 1200, location: 'Kerala', source: 'Mock' },
]

export async function GET(req: NextRequest) {
  try {
    // 1️⃣ Store mock data in DB for history
    for (const item of MOCK_COMMODITIES) {
      await prisma.commodity.create({
        data: {
          type: item.type,
          name: item.name,
          price: item.price,
          location: item.location,
          source: item.source,
        },
      })
    }

    // 2️⃣ Prepare response
    const result = []
    const insights: Record<string, string> = {}

    for (const commodity of MOCK_COMMODITIES) {
      // Get last 7 historical entries
      const history = await prisma.commodity.findMany({
        where: { name: commodity.name },
        orderBy: { createdAt: 'desc' },
        take: 7,
      })

      const historicalPrices = history
        .map((h) => ({ date: h.createdAt, price: h.price }))
        .reverse()

      // AI prediction placeholder
      insights[commodity.name] = 'Prediction unavailable'

      result.push({
        name: commodity.name,
        currentPrice: historicalPrices[historicalPrices.length - 1].price,
        historicalPrices,
        source: commodity.source,
      })
    }

    // 3️⃣ Return JSON schema
    return NextResponse.json({
      data: result,
      insights,
      lastUpdated: new Date(),
    })
  } catch (err) {
    console.error('Commodities API error:', err)
    return NextResponse.json(
      { data: [], insights: {}, lastUpdated: new Date() },
      { status: 500 }
    )
  }
}