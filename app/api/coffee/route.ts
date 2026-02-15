import { prisma } from "@/lib/prisma"
import { generateCoffeeDescription } from "@/lib/ai"
import { randomUUID } from "crypto"

export async function GET() {
  try {
    const coffees = await prisma.coffee.findMany()
    return new Response(JSON.stringify(coffees))
  } catch (error) {
    console.error("GET /api/coffee error:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const { coffeeType, quantity, pricePerKg, location } = data

    let description: string | null = null

    // Try generating AI description only if key exists
    if (process.env.OPENAI_API_KEY) {
      try {
        description = await generateCoffeeDescription({
          coffeeType,
          quantity,
          pricePerKg,
          location
        })
        console.log("AI description generated:", description)
      } catch (aiError) {
        console.error("AI generation failed, skipping description:", aiError)
        description = null // fallback to null
      }
    }

    const newCoffee = await prisma.coffee.create({
      data: { id: randomUUID(), coffeeType, quantity, pricePerKg, location, description }
    })

    return new Response(JSON.stringify(newCoffee), { status: 201 })
  } catch (error) {
    console.error("POST /api/coffee error:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}
