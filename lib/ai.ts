import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function generateCoffeeDescription({
  coffeeType,
  quantity,
  pricePerKg,
  location
}: {
  coffeeType: string
  quantity: number
  pricePerKg: number
  location: string
}) {
  const prompt = `Write a short, catchy product description for a coffee:
Coffee Type: ${coffeeType}, Quantity: ${quantity}kg, Price per Kg: ₹${pricePerKg}, Location: ${location}.
Make it appealing for online buyers.`

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 60
  })

  return response.choices[0].message?.content?.trim() || ""
}