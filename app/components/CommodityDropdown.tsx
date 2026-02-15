'use client'

type Commodity = {
  name: string
  historicalPrices: { date: string; price: number }[]
  currentPrice: number
  source: string
}

export default function CommodityDropdown({
  commodities,
  selected,
  onChange,
}: {
  commodities: Commodity[]
  selected: Commodity | null
  onChange: (c: Commodity) => void
}) {
  return (
    <select
      value={selected?.name || ''}
      onChange={(e) =>
        onChange(commodities.find((c) => c.name === e.target.value)!)
      }
      className="border p-2 rounded"
    >
      {commodities.map((c) => (
        <option key={c.name} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  )
}