'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Product, CreateProductInput, CreateOrderInput } from '@/types/marketplace'
import Navbar from '@/app/components/Navbar'
import { useLanguage } from '@/app/language-context'

const CATEGORIES = ['Coffee Powder', 'Roasted Beans', 'Pepper Powder', 'Cardamom Powder', 'Ground Spices', 'Gift Packs']

export default function StorePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useLanguage()
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

  function categoryLabel(category: string) {
    const map: Record<string, string> = {
      'Coffee Powder': t('Coffee Powder', 'ಕಾಫಿ ಪುಡಿ'),
      'Roasted Beans': t('Roasted Beans', 'ಹುರಿದ ಬೀಜಗಳು'),
      'Pepper Powder': t('Pepper Powder', 'ಮೆಣಸು ಪುಡಿ'),
      'Cardamom Powder': t('Cardamom Powder', 'ಏಲಕ್ಕಿ ಪುಡಿ'),
      'Ground Spices': t('Ground Spices', 'ಪುಡಿ ಮಸಾಲೆಗಳು'),
      'Gift Packs': t('Gift Packs', 'ಗಿಫ್ಟ್ ಪ್ಯಾಕ್‌ಗಳು'),
    }
    return map[category] || category
  }

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
        alert(error.error || t('Failed to create product', 'ಉತ್ಪನ್ನ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch (error) {
      console.error('Error creating product:', error)
      alert(t('Failed to create product', 'ಉತ್ಪನ್ನ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ'))
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
        alert(t('Order placed successfully!', 'ಆರ್ಡರ್ ಯಶಸ್ವಿಯಾಗಿ ಮಾಡಲಾಗಿದೆ!'))
        fetchProducts() // Refresh to show updated stock
      } else {
        const error = await res.json()
        alert(error.error || t('Failed to place order', 'ಆರ್ಡರ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch (error) {
      console.error('Error placing order:', error)
      alert(t('Failed to place order', 'ಆರ್ಡರ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  return (
    <div className="min-h-screen content-under-navbar pb-12">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        {/* Header */}
        <div className="mb-8 slide-in-up">
          <div className="flex items-center space-x-4 mb-3">
            <div className="p-4 rounded-2xl gradient-brand-spectrum float-animation">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <h1 className="font-luxe text-5xl font-bold text-brand-spectrum">
                {t('Korana Store', 'ಕೊರಾನಾ ಸ್ಟೋರ್')}
              </h1>
              <p className="mt-2 text-[#c8bca9] text-lg">{t('Premium roasted coffee, ground spices, and gift packs ☕', 'ಪ್ರೀಮಿಯಂ ರೋಸ್ಟ್ ಕಾಫಿ, ಪುಡಿ ಮಸಾಲೆಗಳು ಮತ್ತು ಗಿಫ್ಟ್ ಪ್ಯಾಕ್‌ಗಳು ☕')}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Category Sidebar */}
          <aside className="w-72 flex-shrink-0 fade-in">
            <div className="glass rounded-2xl shadow-lg p-6 sticky top-36 border border-emerald-200/30">
              <div className="flex items-center space-x-2 mb-6">
                <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <h2 className="font-luxe font-bold text-2xl text-brand-spectrum">{t('Categories', 'ವರ್ಗಗಳು')}</h2>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all font-semibold ${
                    selectedCategory === '' 
                      ? 'gradient-brand-spectrum text-white shadow-lg scale-105' 
                      : 'bg-[#171411]/75 text-[#d8c8b3] hover:bg-emerald-900/35 hover:text-[#e9dcc9]'
                  }`}
                >
                  📦 {t('All Products', 'ಎಲ್ಲಾ ಉತ್ಪನ್ನಗಳು')}
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all font-semibold ${
                      selectedCategory === cat 
                        ? 'gradient-brand-spectrum text-white shadow-lg scale-105' 
                        : 'bg-[#171411]/75 text-[#d8c8b3] hover:bg-emerald-900/35 hover:text-[#e9dcc9]'
                    }`}
                  >
                    {categoryLabel(cat)}
                  </button>
                ))}
              </div>

              {/* Stats Card */}
              <div className="mt-6 pt-6 border-t border-emerald-200/25">
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-700">{products.length}</p>
                  <p className="text-sm text-[#c8bca9] mt-1">{t('Available Products', 'ಲಭ್ಯ ಉತ್ಪನ್ನಗಳು')}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 slide-in-up">
              <p className="text-[#c8bca9] font-medium">
                {loading
                  ? t('Loading...', 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...')
                  : `${products.length} ${products.length === 1 ? t('product', 'ಉತ್ಪನ್ನ') : t('products', 'ಉತ್ಪನ್ನಗಳು')} ${t('available', 'ಲಭ್ಯ')}`}
              </p>
              <button
                onClick={() => {
                  if (status !== 'authenticated') {
                    router.push('/auth')
                  } else {
                    setShowCreateModal(true)
                  }
                }}
                className="lux-btn-primary px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{t('Add Product', 'ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl">
                <div className="flex justify-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-amber-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-amber-800 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-[#c8bca9] font-medium">{t('Loading store...', 'ಸ್ಟೋರ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl fade-in">
                <div className="w-24 h-24 mx-auto mb-6 p-6 rounded-full gradient-coffee-cream float-animation">
                  <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-[#efe4d4] mb-2">{t('No Products Yet', 'ಇನ್ನೂ ಉತ್ಪನ್ನಗಳಿಲ್ಲ')}</h3>
                <p className="text-[#bbae9a] mb-6">{t('List your first product and start selling!', 'ನಿಮ್ಮ ಮೊದಲ ಉತ್ಪನ್ನವನ್ನು ಲಿಸ್ಟ್ ಮಾಡಿ ಮತ್ತು ಮಾರಾಟ ಪ್ರಾರಂಭಿಸಿ!')}</p>
                <button
                  onClick={() => status === 'authenticated' ? setShowCreateModal(true) : router.push('/auth')}
                  className="lux-btn-primary px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all inline-flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{t('Add First Product', 'ಮೊದಲ ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product, idx) => (
                  <div 
                    key={product.id} 
                    className="glass rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-emerald-200/30 card-hover fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    {/* Product Image */}
                    <div className="h-56 bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-50 flex items-center justify-center relative overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <span className="text-6xl float-animation">☕</span>
                          <p className="text-sm text-gray-500 mt-2 font-medium">{categoryLabel(product.category)}</p>
                        </div>
                      )}
                      {product.stock === 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold text-xl">{t('OUT OF STOCK', 'ಸ್ಟಾಕ್ ಇಲ್ಲ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-lg text-[#efe4d4] line-clamp-2">{product.name}</h3>
                        <span className="gradient-brand-spectrum text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md whitespace-nowrap ml-2">
                          {categoryLabel(product.category)}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-3xl font-bold text-brand-spectrum">
                          ₹{product.price.toFixed(2)}
                        </p>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50">
                          <span className="text-sm font-medium text-gray-600">📦 {t('Stock', 'ಸ್ಟಾಕ್')}</span>
                          <span className={`text-sm font-bold ${product.stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {product.stock > 0 ? `${product.stock} ${t('units', 'ಯೂನಿಟ್‌ಗಳು')}` : t('Out', 'ಖಾಲಿ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <div className="w-7 h-7 rounded-full gradient-coffee-cream flex items-center justify-center text-white font-bold text-xs">
                            {product.seller?.name?.[0]?.toUpperCase() || 'S'}
                          </div>
                          <span className="font-medium">{product.seller?.name || t('Store', 'ಸ್ಟೋರ್')}</span>
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                      )}

                      <button
                        onClick={() => {
                          if (product.stock === 0) {
                            alert(t('This product is out of stock', 'ಈ ಉತ್ಪನ್ನ ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಇಲ್ಲ'))
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
                            ? 'gradient-brand-spectrum text-white hover:shadow-lg hover:scale-105'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <span>{product.stock > 0 ? t('Buy Now', 'ಈಗ ಖರೀದಿ') : t('Out of Stock', 'ಸ್ಟಾಕ್ ಇಲ್ಲ')}</span>
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
              <div className="p-3 rounded-xl gradient-brand-spectrum">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-brand-spectrum">
                {t('Add New Product', 'ಹೊಸ ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}
              </h2>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Product Name', 'ಉತ್ಪನ್ನದ ಹೆಸರು')} *</label>
                <input
                  required
                  type="text"
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  placeholder={t('e.g., Premium Arabica Powder 250g', 'ಉದಾ., ಪ್ರೀಮಿಯಂ ಅರಬಿಕಾ ಪುಡಿ 250g')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Category', 'ವರ್ಗ')} *</label>
                <select
                  required
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{categoryLabel(c)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Price (₹)', 'ಬೆಲೆ (₹)')} *</label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Stock (units)', 'ಸ್ಟಾಕ್ (ಯೂನಿಟ್‌ಗಳು)')} *</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Description (optional)', 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)')}</label>
                <textarea
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  rows={3}
                  placeholder={t('Product details...', 'ಉತ್ಪನ್ನದ ವಿವರಗಳು...')}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Image URL (optional)', 'ಚಿತ್ರ URL (ಐಚ್ಛಿಕ)')}</label>
                <input
                  type="url"
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  placeholder={t('https://example.com/image.jpg', 'https://example.com/image.jpg')}
                  value={formData.imageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">{t('Enter a direct link to your product image', 'ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಚಿತ್ರಕ್ಕೆ ನೇರ ಲಿಂಕ್ ನಮೂದಿಸಿ')}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-coffee-cream text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  {t('Add Product', 'ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}
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
                  {t('Place Order', 'ಆರ್ಡರ್ ಮಾಡಿ')}
                </h2>
                <p className="text-gray-600 text-sm">{selectedProduct.name}</p>
              </div>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
                <p className="text-sm font-medium text-gray-600 mb-1">{t('Unit Price', 'ಯೂನಿಟ್ ಬೆಲೆ')}</p>
                <p className="text-2xl font-bold text-amber-700">₹{selectedProduct.price.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('Quantity', 'ಪ್ರಮಾಣ')} *</label>
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
                <p className="text-xs text-gray-500 mt-1">{t('Available', 'ಲಭ್ಯ')}: {selectedProduct.stock} {t('units', 'ಯೂನಿಟ್‌ಗಳು')}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">📍 {t('Shipping Address', 'ಶಿಪ್ಪಿಂಗ್ ವಿಳಾಸ')}</label>
                <textarea
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  rows={3}
                  placeholder={t('Enter your complete delivery address...', 'ನಿಮ್ಮ ಸಂಪೂರ್ಣ ವಿತರಣಾ ವಿಳಾಸ ನಮೂದಿಸಿ...')}
                  value={orderData.shippingAddress || ''}
                  onChange={(e) => setOrderData({ ...orderData, shippingAddress: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">📞 {t('Phone Number', 'ಫೋನ್ ಸಂಖ್ಯೆ')}</label>
                <input
                  type="tel"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  placeholder={t('+91 XXXXX XXXXX', '+91 XXXXX XXXXX')}
                  value={orderData.phone || ''}
                  onChange={(e) => setOrderData({ ...orderData, phone: e.target.value })}
                />
              </div>

              <div className="p-6 rounded-xl gradient-emerald-coffee">
                <div className="space-y-2 text-white/90 text-sm mb-3">
                  <div className="flex justify-between">
                    <span>{t('Price per unit:', 'ಪ್ರತಿ ಯೂನಿಟ್ ಬೆಲೆ:')}</span>
                    <span>₹{selectedProduct.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('Quantity:', 'ಪ್ರಮಾಣ:')}</span>
                    <span>{orderData.quantity}</span>
                  </div>
                </div>
                <div className="pt-3 border-t-2 border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-sm">{t('Total Amount', 'ಒಟ್ಟು ಮೊತ್ತ')}</span>
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
