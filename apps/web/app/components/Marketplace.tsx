'use client'

import { useState } from 'react'

type Item = {
  id: string
  name: string
  type: string
  price: number
  quantity: number
  location?: string
}

export default function Marketplace() {
  const [items] = useState<Item[]>([
    { id: '1', name: 'Arabica Coffee', type: 'Coffee', price: 520, quantity: 50, location: 'Coorg' },
    { id: '2', name: 'Robusta Coffee', type: 'Coffee', price: 450, quantity: 30, location: 'Chikmagalur' },
    { id: '3', name: 'Pepper', type: 'Spice', price: 650, quantity: 20, location: 'Kerala' },
  ])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <div key={item.id} className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition">
          <h3 className="font-bold text-lg">{item.name}</h3>
          <p>Type: {item.type}</p>
          <p>Price: ₹{item.price.toLocaleString()}</p>
          <p>Quantity: {item.quantity}</p>
          <p>Location: {item.location || 'India'}</p>
          <div className="mt-2 flex space-x-2">
            <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Buy</button>
            <button className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600">Sell</button>
          </div>
        </div>
      ))}
    </div>
  )
}
