"use client"

import { useEffect, useState } from "react"

type Coffee = {
  id: string
  coffeeType: string
  quantity: number
  pricePerKg: number
  location: string
}

export default function Home() {
  const [coffees, setCoffees] = useState<Coffee[]>([])
  const [form, setForm] = useState({
    coffeeType: "",
    quantity: "",
    pricePerKg: "",
    location: ""
  })

  const fetchCoffees = async () => {
    const res = await fetch("/api/coffee")
    const data = await res.json()
    setCoffees(data)
  }

  useEffect(() => {
    fetchCoffees()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await fetch("/api/coffee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coffeeType: form.coffeeType,
        quantity: Number(form.quantity),
        pricePerKg: Number(form.pricePerKg),
        location: form.location
      })
    })

    setForm({
      coffeeType: "",
      quantity: "",
      pricePerKg: "",
      location: ""
    })

    fetchCoffees()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Navbar */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center px-8">
        <h1 className="text-2xl font-bold">☕ BrewMarket</h1>
        <button className="bg-black text-white px-5 py-2 rounded-full hover:bg-gray-800 transition">
          Sell Coffee
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-8">

        {/* Add Listing Section */}
        <div className="bg-white rounded-3xl shadow-md p-8 mb-12">
          <h2 className="text-2xl font-semibold mb-6">Add New Listing</h2>

          <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4">
            <input
              className="border p-3 rounded-xl"
              placeholder="Coffee Type"
              value={form.coffeeType}
              onChange={(e) =>
                setForm({ ...form, coffeeType: e.target.value })
              }
              required
            />

            <input
              className="border p-3 rounded-xl"
              type="number"
              placeholder="Quantity (kg)"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: e.target.value })
              }
              required
            />

            <input
              className="border p-3 rounded-xl"
              type="number"
              placeholder="Price / kg"
              value={form.pricePerKg}
              onChange={(e) =>
                setForm({ ...form, pricePerKg: e.target.value })
              }
              required
            />

            <input
              className="border p-3 rounded-xl"
              placeholder="Location"
              value={form.location}
              onChange={(e) =>
                setForm({ ...form, location: e.target.value })
              }
              required
            />

            <button
              type="submit"
              className="md:col-span-4 bg-black text-white py-3 rounded-xl hover:bg-gray-900 transition"
            >
              Publish Listing
            </button>
          </form>
        </div>

        {/* Product Grid */}
        <h2 className="text-3xl font-bold mb-8">Available Coffee</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {coffees.map((coffee) => (
            <div
              key={coffee.id}
              className="bg-white rounded-3xl shadow hover:shadow-xl transition duration-300 overflow-hidden"
            >
              <div className="h-40 bg-gradient-to-br from-yellow-200 to-orange-300 flex items-center justify-center text-4xl">
                ☕
              </div>

              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">
                  {coffee.coffeeType}
                </h3>

                <p className="text-gray-500 mb-2">
                  {coffee.quantity} kg available
                </p>

                <p className="text-gray-700 mb-4">
                  📍 {coffee.location}
                </p>

                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-black">
                    ₹{coffee.pricePerKg}
                  </span>

                  <button className="bg-yellow-400 px-4 py-2 rounded-full font-medium hover:bg-yellow-500 transition">
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}