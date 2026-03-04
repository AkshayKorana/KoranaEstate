'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

type Commodity = {
  historicalPrices: { date: string; price: number }[]
  name: string
}

export default function CommodityChart({ commodity }: { commodity: Commodity }) {
  const labels = commodity.historicalPrices.map((h) =>
    new Date(h.date).toLocaleDateString()
  )

  const data = {
    labels,
    datasets: [
      {
        label: `${commodity.name} Price`,
        data: commodity.historicalPrices.map((h) => h.price),
        borderColor: 'rgb(34,197,94)',
        backgroundColor: 'rgba(34,197,94,0.3)',
      },
    ],
  }

  return <Line data={data} />
}