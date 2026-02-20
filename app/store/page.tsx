'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Product, CreateProductInput, CreateOrderInput } from '@/types/marketplace'
import Navbar from '@/app/components/Navbar'

const CATEGORIES = ['Coffee Powder', 'Roasted Beans', 'Pepper Powder', 'Cardamom Powder', 'Ground Spices', 'Gift Packs']

export default function StorePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  // Form states
  const [formData, setFormData] = useState<CreateProductInput>({
    name: '',
    category: CATEGORIES[0],
    price: 0,
    stock: 0
  })
  const [orderData, setOrderData] = useState<CreateOrderInput>({ productId: '', quantity: 1 })

  useEffect(() => {
    fetchProducts()
  }, [selectedCategory])

  async function fetchProducts() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)
      
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowCreateModal(false)
        setFormData({ name: '', category: CATEGORIES[0], price: 0, stock: 0 })
        fetchProducts()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      alert('Failed to create product')
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    if (!selectedProduct) return

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (res.ok) {
        setShowOrderModal(false)
        setOrderData({ productId: '', quantity: 1 })
        alert('Order placed successfully!')
        fetchProducts() // Refresh to show updated stock
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to place order')
      }
    } catch (error) {
      console.error('Error placing order:', error)
      alert('Failed to place order')
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 slide-in-up">
          <div className="flex items-center space-x-4 mb-3">
            <div className="p-4 rounded-2xl gradient-coffee-cream float-animation">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-700 via-amber-600 to-emerald-600 bg-clip-text text-transparent">
                Korana Store
              </h1>
              <p className="mt-2 text-gray-600 text-lg">Premium roasted coffee, ground spices, and gift packs ☕</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Category Sidebar */}
          <aside className="w-72 flex-shrink-0 fade-in">
            <div className="glass rounded-2xl shadow-xl p-6 sticky top-24 border-2 border-amber-100">
              <div className="flex items-center space-x-2 mb-6">
                <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <h2 className="font-bold text-xl bg-gradient-to-r from-amber-700 to-amber-900 bg-clip-text text-transparent">Categories</h2>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all font-semibold ${
                    selectedCategory === '' 
                      ? 'gradient-coffee-cream text-white shadow-lg scale-105' 
                      : 'bg-white/50 text-gray-700 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  📦 All Products
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all font-semibold ${
                      selectedCategory === cat 
                        ? 'gradient-coffee-cream text-white shadow-lg scale-105' 
                        : 'bg-white/50 text-gray-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Stats Card */}
              <div className="mt-6 pt-6 border-t-2 border-amber-100">
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-700">{products.length}</p>
                  <p className="text-sm text-gray-600 mt-1">Available Products</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 slide-in-up">
              <p className="text-gray-600 font-medium">
                {loading ? 'Loading...' : `${products.length} ${products.length === 1 ? 'product' : 'products'} available`}
              </p>
              <button
                onClick={() => {
                  if (status !== 'authenticated') {
                    router.push('/auth')
                  } else {
                    setShowCreateModal(true)
                  }
                }}
                className="gradient-coffee-cream text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Product</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl">
                <div className="flex justify-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-amber-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-amber-800 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-gray-600 font-medium">Loading store...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl fade-in">
                <div className="w-24 h-24 mx-auto mb-6 p-6 rounded-full gradient-coffee-cream float-animation">
                  <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-700 mb-2">No Products Yet</h3>
                <p className="text-gray-500 mb-6">List your first product and start selling!</p>
                <button
                  onClick={() => status === 'authenticated' ? setShowCreateModal(true) : router.push('/auth')}
                  className="gradient-coffee-cream text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all inline-flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add First Product</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product, idx) => (
                  <div 
                    key={product.id} 
                    className="glass rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border-2 border-amber-100 card-hover fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    {/* Product Image */}
                    <div className="h-56 bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-50 flex items-center justify-center relative overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <span className="text-6xl float-animation">☕</span>
                          <p className="text-sm text-gray-500 mt-2 font-medium">{product.category}</p>
                        </div>
                      )}
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-xl">OUT OF STOCK</span>
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-lg text-gray-800 line-clamp-2">{product.name}</h3>
                        <span className="gradient-emerald text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md whitespace-nowrap ml-2">
                          {product.category}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-3xl font-bold bg-gradient-to-r from-amber-700 to-amber-900 bg-clip-text text-transparent">
                          ₹{product.price.toFixed(2)}
                        </p>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50">
                          <span className="text-sm font-medium text-gray-600">📦 Stock</span>
                          <span className={`text-sm font-bold ${product.stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {product.stock > 0 ? `${product.stock} units` : 'Out'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <div className="w-7 h-7 rounded-full gradient-coffee-cream flex items-center justify-center text-white font-bold text-xs">
                            {product.seller?.name?.[0]?.toUpperCase() || 'S'}
                          </div>
                          <span className="font-medium">{product.seller?.name || 'Store'}</span>
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                      )}

                      <button
                        onClick={() => {
                          if (product.stock === 0) {
                            alert('This product is out of stock')
                            return
                          }
                          if (status !== 'authenticated') {
                            router.push('/auth')
                            return
                          }
                          setSelectedProduct(product)
                          setOrderData({ productId: product.id, quantity: 1 })
                          setShowOrderModal(true)
                        }}
                        disabled={product.stock === 0}
                        className={`w-full py-3 rounded-xl font-semibold shadow-md transition-all flex items-center justify-center space-x-2 ${
                          product.stock > 0
                            ? 'gradient-emerald text-white hover:shadow-lg hover:scale-105'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <span>{product.stock > 0 ? 'Buy Now' : 'Out of Stock'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="glass rounded-3xl max-w-lg w-full p-8 shadow-2xl border-2 border-amber-100 slide-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-xl gradient-coffee-cream">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-700 to-amber-900 bg-clip-text text-transparent">
                Add New Product
              </h2>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Product Name *</label>
                <input
                  required
                  type="text"
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  placeholder="e.g., Premium Arabica Powder 250g"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                <select
                  required
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price (₹) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stock (units) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                    value={formData.stock || ''}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  rows={3}
                  placeholder="Product details..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL (optional)</label>
                <input
                  type="url"
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  placeholder="https://example.com/image.jpg"
                  value={formData.imageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Enter a direct link to your product image</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-coffee-cream text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place Order Modal */}
      {showOrderModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="glass rounded-3xl max-w-lg w-full p-8 shadow-2xl border-2 border-emerald-100 slide-in-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 rounded-xl gradient-emerald">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                  Place Order
                </h2>
                <p className="text-gray-600 text-sm">{selectedProduct.name}</p>
              </div>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
                <p className="text-sm font-medium text-gray-600 mb-1">Unit Price</p>
                <p className="text-2xl font-bold text-amber-700">₹{selectedProduct.price.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                <input
                  required
                  type="number"
                  min="1"
                  max={selectedProduct.stock}
                  step="1"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-lg font-semibold"
                  value={orderData.quantity}
                  onChange={(e) => setOrderData({ ...orderData, quantity: parseInt(e.target.value) })}
                />
                <p className="text-xs text-gray-500 mt-1">Available: {selectedProduct.stock} units</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">📍 Shipping Address</label>
                <textarea
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  rows={3}
                  placeholder="Enter your complete delivery address..."
                  value={orderData.shippingAddress || ''}
                  onChange={(e) => setOrderData({ ...orderData, shippingAddress: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">📞 Phone Number</label>
                <input
                  type="tel"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  placeholder="+91 XXXXX XXXXX"
                  value={orderData.phone || ''}
                  onChange={(e) => setOrderData({ ...orderData, phone: e.target.value })}
                />
              </div>

              <div className="p-6 rounded-xl gradient-emerald-coffee">
                <div className="space-y-2 text-white/90 text-sm mb-3">
                  <div className="flex justify-between">
                    <span>Price per unit:</span>
                    <span>₹{selectedProduct.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{orderData.quantity}</span>
                  </div>
                </div>
                <div className="pt-3 border-t-2 border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-sm">Total Amount</span>
                    <span className="text-3xl font-bold text-white">₹{(selectedProduct.price * orderData.quantity).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  Confirm Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
