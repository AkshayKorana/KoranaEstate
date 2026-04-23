'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Product, CreateProductInput, CreateOrderInput, OrderCustomerDetails } from '@/types/marketplace'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'
import { sendMarketplaceMessage } from '@/app/lib/send-marketplace-message'
import { extractErrorMessage } from '@/app/lib/api-errors'

const CATEGORIES = ['Coffee Powder', 'Roasted Beans', 'Pepper Powder', 'Cardamom Powder', 'Ground Spices', 'Gift Packs']
const STORE_ORDER_REQUIRED_FIELDS: Array<keyof OrderCustomerDetails> = ['fullName', 'mobileNumber', 'addressLine1', 'area', 'city', 'state', 'pincode']

function createEmptyCustomerDetails(fullName = ''): OrderCustomerDetails {
  return {
    fullName,
    mobileNumber: '',
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    orderNote: '',
  }
}

function extractOrderResponse(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  return (payload as { order?: { id?: string } }).order ?? null
}

export default function StorePage() {
  const router = useRouter()
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated: () => router.replace('/auth'),
  })
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
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
  const [orderData, setOrderData] = useState<CreateOrderInput>({
    productId: '',
    quantity: 1,
    customer: createEmptyCustomerDetails(),
  })
  const [orderErrors, setOrderErrors] = useState<Partial<Record<keyof OrderCustomerDetails | 'quantity' | 'form', string>>>({})
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const isSellerOrAdmin = session?.user?.role === 'SELLER' || session?.user?.role === 'ADMIN'

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
    if (status !== 'authenticated') return
    fetchProducts()
  }, [status, selectedCategory])

  if (status === 'loading') {
    return null
  }

  async function fetchProducts() {
    try {
      setLoading(true)
      setLoadError(null)
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)
      
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) {
        const message = (await extractErrorMessage(res)) || t('Failed to load products', 'ಉತ್ಪನ್ನಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ')
        console.error('Failed to fetch products:', message)
        setLoadError(message)
        return
      }
      const data = await res.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Failed to fetch products:', error)
      setLoadError(t('Failed to load products', 'ಉತ್ಪನ್ನಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
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
    if (!isSellerOrAdmin) {
      setCreateError(t('A seller account is required to add store products.', 'ಸ್ಟೋರ್ ಉತ್ಪನ್ನಗಳನ್ನು ಸೇರಿಸಲು ಮಾರಾಟಗಾರ ಖಾತೆ ಅಗತ್ಯವಿದೆ.'))
      return
    }

    try {
      setCreateError(null)
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowCreateModal(false)
        setCreateError(null)
        setFormData({ name: '', category: CATEGORIES[0], price: 0, stock: 0, description: '', imageUrl: '' })
        fetchProducts()
      } else {
        const message =
          res.status === 403
            ? t('Only seller accounts can add store products.', 'ಮಾರಾಟಗಾರ ಖಾತೆಗಳಷ್ಟೇ ಸ್ಟೋರ್ ಉತ್ಪನ್ನಗಳನ್ನು ಸೇರಿಸಬಹುದು.')
            : (await extractErrorMessage(res)) || t('Failed to create product', 'ಉತ್ಪನ್ನ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ')
        setCreateError(message)
      }
    } catch (error) {
      console.error('Error creating product:', error)
      setCreateError(t('Failed to create product', 'ಉತ್ಪನ್ನ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    if (!selectedProduct) {
      setOrderErrors({
        form: t('Please reopen the order modal and try again.', 'ದಯವಿಟ್ಟು ಆರ್ಡರ್ ಮೋಡಲ್ ಅನ್ನು ಮತ್ತೆ ತೆರೆಯಿರಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'),
      })
      return
    }

    const nextErrors: Partial<Record<keyof OrderCustomerDetails | 'quantity' | 'form', string>> = {}
    if (orderData.quantity < 1) {
      nextErrors.quantity = t('Quantity must be at least 1', 'ಪ್ರಮಾಣ ಕನಿಷ್ಠ 1 ಇರಬೇಕು')
    } else if (orderData.quantity > selectedProduct.stock) {
      nextErrors.quantity = `${t('Only', 'ಕೇವಲ')} ${selectedProduct.stock} ${t('units available', 'ಯೂನಿಟ್‌ಗಳು ಲಭ್ಯ')}`
    }

    for (const field of STORE_ORDER_REQUIRED_FIELDS) {
      if (!orderData.customer[field]?.trim()) {
        nextErrors[field] = t('This field is required', 'ಈ ಕ್ಷೇತ್ರ ಕಡ್ಡಾಯವಾಗಿದೆ')
      }
    }

    if (orderData.customer.mobileNumber && !/^[6-9]\d{9}$/.test(orderData.customer.mobileNumber.trim())) {
      nextErrors.mobileNumber = t('Enter a valid 10-digit mobile number', 'ಮಾನ್ಯ 10 ಅಂಕೆಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ')
    }

    if (orderData.customer.pincode && !/^\d{6}$/.test(orderData.customer.pincode.trim())) {
      nextErrors.pincode = t('Enter a valid 6-digit pincode', 'ಮಾನ್ಯ 6 ಅಂಕೆಯ ಪಿನ್‌ಕೋಡ್ ನಮೂದಿಸಿ')
    }

    if (Object.keys(nextErrors).length > 0) {
      nextErrors.form = t('Please correct the highlighted fields before placing your order.', 'ನಿಮ್ಮ ಆರ್ಡರ್ ಮಾಡುವ ಮೊದಲು ಗುರುತಿಸಿದ ಕ್ಷೇತ್ರಗಳನ್ನು ಸರಿಪಡಿಸಿ.')
    }

    setOrderErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      setSubmittingOrder(true)
      setOrderErrors({})
      
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: orderData.quantity,
          customer: orderData.customer,
        })
      })

      const payload = await res.json().catch(() => null)

      if (res.ok) {
        const order = extractOrderResponse(payload)
        if (!order?.id) {
          setOrderErrors((current) => ({
            ...current,
            form: t('Order was created but confirmation could not be loaded.', 'ಆರ್ಡರ್ ರಚಿಸಲಾಗಿದೆ ಆದರೆ ದೃಢೀಕರಣವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.'),
          }))
          return
        }
        setShowOrderModal(false)
        setOrderData({
          productId: '',
          quantity: 1,
          customer: createEmptyCustomerDetails(session?.user?.name || ''),
        })
        setOrderErrors({})
        fetchProducts()
        router.push(`/orders/${order.id}`)
      } else {
        const errorMessage =
          (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string' ? payload.error : null) ||
          (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string' ? payload.message : null) ||
          t('Failed to place COD order', 'COD ಆರ್ಡರ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ')
        setOrderErrors((current) => ({
          ...current,
          form: errorMessage,
        }))
      }
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('[STORE PAGE] 💥 CRASH:', error)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      setOrderErrors((current) => ({
        ...current,
        form: t('Failed to place COD order', 'COD ಆರ್ಡರ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'),
      }))
    } finally {
      setSubmittingOrder(false)
    }
  }

  async function handleOpenSellerChat(product: Product, withIntro: boolean) {
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    if (!product.seller?.id) {
      alert(t('Seller details unavailable', 'ಮಾರಾಟಗಾರ ವಿವರಗಳು ಲಭ್ಯವಿಲ್ಲ'))
      return
    }

    try {
      await sendMarketplaceMessage({
        recipientId: product.seller.id,
        listingId: product.id,
        listingName: `${product.name} (${product.category})`,
        kind: 'store',
        action: withIntro ? 'contact' : 'message',
        router,
      })
    } catch (error) {
      console.error('Failed to open seller chat:', error)
      alert(t('Failed to connect with seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  return (
    <div className="min-h-screen pb-12">
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
              <p className={`mt-2 text-lg ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Premium roasted coffee, ground spices, and gift packs ☕', 'ಪ್ರೀಮಿಯಂ ರೋಸ್ಟ್ ಕಾಫಿ, ಪುಡಿ ಮಸಾಲೆಗಳು ಮತ್ತು ಗಿಫ್ಟ್ ಪ್ಯಾಕ್‌ಗಳು ☕')}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Category Sidebar */}
          <aside className="w-72 flex-shrink-0 fade-in">
            <div className={`glass rounded-2xl shadow-lg p-6 sticky top-36 border ${isDark ? 'border-emerald-200/30' : 'border-black/10'}`}>
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
                      : isDark
                        ? 'bg-[#171411]/75 text-[#d8c8b3] hover:bg-emerald-900/35 hover:text-[#e9dcc9]'
                        : 'bg-white text-[#2f2f2f] border border-black/10 hover:bg-[#f3ede4] hover:text-[#1f4d3a]'
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
                        : isDark
                          ? 'bg-[#171411]/75 text-[#d8c8b3] hover:bg-emerald-900/35 hover:text-[#e9dcc9]'
                          : 'bg-white text-[#2f2f2f] border border-black/10 hover:bg-[#f3ede4] hover:text-[#1f4d3a]'
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
                  <p className={`text-sm mt-1 ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Available Products', 'ಲಭ್ಯ ಉತ್ಪನ್ನಗಳು')}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 slide-in-up">
              <p className={`font-medium ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>
                {loading
                  ? t('Loading...', 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...')
                  : `${products.length} ${products.length === 1 ? t('product', 'ಉತ್ಪನ್ನ') : t('products', 'ಉತ್ಪನ್ನಗಳು')} ${t('available', 'ಲಭ್ಯ')}`}
              </p>
              <button
                onClick={() => {
                  if (status !== 'authenticated') {
                    router.push('/auth')
                  } else {
                    setCreateError(
                      isSellerOrAdmin
                        ? null
                        : t('A seller account is required to add store products.', 'ಸ್ಟೋರ್ ಉತ್ಪನ್ನಗಳನ್ನು ಸೇರಿಸಲು ಮಾರಾಟಗಾರ ಖಾತೆ ಅಗತ್ಯವಿದೆ.'),
                    )
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
                <p className={`font-medium ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Loading store...', 'ಸ್ಟೋರ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
              </div>
            ) : loadError ? (
              <div className="text-center py-12 glass rounded-2xl shadow-xl fade-in">
                <p className="text-lg font-semibold text-red-600">{loadError}</p>
                <button
                  onClick={() => fetchProducts()}
                  className="mt-4 surface-app-button-secondary rounded-xl px-5 py-3 font-semibold"
                >
                  {t('Retry', 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ')}
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl fade-in">
                <div className="w-24 h-24 mx-auto mb-6 p-6 rounded-full gradient-coffee-cream float-animation">
                  <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-2 text-card-strong">{t('No Products Yet', 'ಇನ್ನೂ ಉತ್ಪನ್ನಗಳಿಲ್ಲ')}</h3>
                <p className={`mb-6 ${isDark ? 'text-[#bbae9a]' : 'text-[#4a4a4a]'}`}>{t('List your first product and start selling!', 'ನಿಮ್ಮ ಮೊದಲ ಉತ್ಪನ್ನವನ್ನು ಲಿಸ್ಟ್ ಮಾಡಿ ಮತ್ತು ಮಾರಾಟ ಪ್ರಾರಂಭಿಸಿ!')}</p>
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
                    className="surface-card rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden card-hover fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    {/* Product Image */}
                    <div className="h-56 bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-50 flex items-center justify-center relative overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <span className="text-6xl float-animation">☕</span>
                          <p className="text-sm text-muted-safe mt-2 font-medium">{categoryLabel(product.category)}</p>
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
                        <h3 className="font-bold text-lg text-card-strong line-clamp-2">{product.name}</h3>
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
                          <span className="text-sm font-medium text-[#444444]">📦 {t('Stock', 'ಸ್ಟಾಕ್')}</span>
                          <span className={`text-sm font-bold ${product.stock > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {product.stock > 0 ? `${product.stock} ${t('units', 'ಯೂನಿಟ್‌ಗಳು')}` : t('Out', 'ಖಾಲಿ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-safe">
                          <div className="w-7 h-7 rounded-full gradient-coffee-cream flex items-center justify-center text-white font-bold text-xs">
                            {product.seller?.name?.[0]?.toUpperCase() || 'S'}
                          </div>
                          <span className="font-medium">{product.seller?.name || t('Store', 'ಸ್ಟೋರ್')}</span>
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-sm text-muted-safe mb-4 line-clamp-2">{product.description}</p>
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
                          setOrderData({
                            productId: product.id,
                            quantity: 1,
                            customer: createEmptyCustomerDetails(session?.user?.name || ''),
                          })
                          setOrderErrors({})
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

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenSellerChat(product, false)}
                          className="w-full lux-btn-secondary py-2.5 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all"
                        >
                          {t('Message', 'ಸಂದೇಶ')}
                        </button>
                        <button
                          onClick={() => handleOpenSellerChat(product, true)}
                          className="w-full lux-btn-secondary py-2.5 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all"
                        >
                          {t('Contact Seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ')}
                        </button>
                      </div>
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
          <div className="surface-card rounded-3xl max-w-lg w-full p-8 shadow-2xl slide-in-up max-h-[90vh] overflow-y-auto">
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
              {createError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {createError}
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Product Name', 'ಉತ್ಪನ್ನದ ಹೆಸರು')} *</label>
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
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Category', 'ವರ್ಗ')} *</label>
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
                  <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Price (₹)', 'ಬೆಲೆ (₹)')} *</label>
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
                  <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Stock (units)', 'ಸ್ಟಾಕ್ (ಯೂನಿಟ್‌ಗಳು)')} *</label>
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
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Description (optional)', 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)')}</label>
                <textarea
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  rows={3}
                  placeholder={t('Product details...', 'ಉತ್ಪನ್ನದ ವಿವರಗಳು...')}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Image URL (optional)', 'ಚಿತ್ರ URL (ಐಚ್ಛಿಕ)')}</label>
                <input
                  type="url"
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  placeholder={t('https://example.com/image.jpg', 'https://example.com/image.jpg')}
                  value={formData.imageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                />
                <p className="text-xs text-muted-safe mt-1">{t('Enter a direct link to your product image', 'ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಚಿತ್ರಕ್ಕೆ ನೇರ ಲಿಂಕ್ ನಮೂದಿಸಿ')}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all"
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  disabled={!isSellerOrAdmin}
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
          <div className="surface-card rounded-3xl max-w-4xl w-full p-8 shadow-2xl slide-in-up max-h-[92vh] overflow-y-auto">
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
                <p className="text-muted-safe text-sm">{selectedProduct.name}</p>
              </div>
            </div>

            <form noValidate onSubmit={handlePlaceOrder} className="space-y-6">
              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex flex-col gap-5 md:flex-row md:items-start">
                  <div className="h-28 w-28 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-50 flex items-center justify-center">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-5xl">☕</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-app-strong">{selectedProduct.name}</h3>
                      <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {categoryLabel(selectedProduct.category)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-app-muted">
                      {selectedProduct.seller?.name ? `${t('Sold by', 'ಮಾರಾಟಗಾರ')}: ${selectedProduct.seller.name}` : t('Sold by Korana Store sellers', 'ಕೊರಾನಾ ಸ್ಟೋರ್ ಮಾರಾಟಗಾರರಿಂದ')}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="surface-app-panel-soft rounded-xl p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Unit price', 'ಯೂನಿಟ್ ಬೆಲೆ')}</p>
                        <p className="mt-2 text-2xl font-bold text-app-strong">₹{selectedProduct.price.toFixed(2)}</p>
                      </div>
                      <div className="surface-app-panel-soft rounded-xl p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Available stock', 'ಲಭ್ಯ ಸ್ಟಾಕ್')}</p>
                        <p className="mt-2 text-2xl font-bold text-app-strong">{selectedProduct.stock}</p>
                      </div>
                      <div className="surface-app-panel-soft rounded-xl p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Total', 'ಒಟ್ಟು')}</p>
                        <p className="mt-2 text-2xl font-bold text-app-strong">₹{(selectedProduct.price * orderData.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-bold text-app-strong">{t('Quantity & payment', 'ಪ್ರಮಾಣ ಮತ್ತು ಪಾವತಿ')}</h3>
                    <p className="mt-1 text-sm text-app-muted">{t('Review your quantity and COD total before placing the order.', 'ಆರ್ಡರ್ ಮಾಡುವ ಮೊದಲು ಪ್ರಮಾಣ ಮತ್ತು COD ಒಟ್ಟು ಮೊತ್ತ ಪರಿಶೀಲಿಸಿ.')}</p>
                  </div>
                  <div className="surface-app-chip rounded-full px-4 py-2 text-sm font-semibold">CASH ON DELIVERY</div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Quantity', 'ಪ್ರಮಾಣ')} *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max={selectedProduct.stock}
                      step="1"
                      className="surface-app-input w-full rounded-xl px-4 py-3 text-lg font-semibold transition-all"
                      value={orderData.quantity}
                      onChange={(e) => {
                        const nextQuantity = parseInt(e.target.value || '1', 10)
                        setOrderData({ ...orderData, quantity: Number.isFinite(nextQuantity) ? nextQuantity : 1 })
                        setOrderErrors((current) => ({ ...current, quantity: undefined, form: undefined }))
                      }}
                    />
                    <p className="mt-2 text-xs text-app-soft">{t('Available stock', 'ಲಭ್ಯ ಸ್ಟಾಕ್')}: {selectedProduct.stock}</p>
                    {orderErrors.quantity ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.quantity}</p> : null}
                  </div>
                  <div className="surface-app-panel-soft rounded-xl p-4">
                    <p className="text-sm font-semibold text-app-strong">CASH ON DELIVERY</p>
                    <p className="mt-1 text-sm text-app-muted">{t('Pay in cash when your order is delivered.', 'ನಿಮ್ಮ ಆರ್ಡರ್ ವಿತರಿಸಿದಾಗ ನಗದು ಪಾವತಿಸಿ.')}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-app-muted">
                        <span>{t('Unit price', 'ಯೂನಿಟ್ ಬೆಲೆ')}</span>
                        <span className="font-semibold text-app-body">₹{selectedProduct.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-app-muted">
                        <span>{t('Quantity', 'ಪ್ರಮಾಣ')}</span>
                        <span className="font-semibold text-app-body">{orderData.quantity}</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-200/80 pt-3 text-app-body dark:border-white/10">
                        <span className="font-semibold">{t('Total payable', 'ಪಾವತಿಸಬೇಕಾದ ಒಟ್ಟು')}</span>
                        <span className="text-xl font-bold">₹{(selectedProduct.price * orderData.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="surface-app-panel rounded-2xl p-5">
                <h3 className="text-lg font-bold text-app-strong">{t('Delivery details', 'ವಿತರಣಾ ವಿವರಗಳು')}</h3>
                <p className="mt-1 text-sm text-app-muted">{t('These details are required to confirm and deliver your COD order.', 'ನಿಮ್ಮ COD ಆರ್ಡರ್ ದೃಢೀಕರಿಸಲು ಮತ್ತು ವಿತರಿಸಲು ಈ ವಿವರಗಳು ಅಗತ್ಯವಿದೆ.')}</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Full name', 'ಪೂರ್ಣ ಹೆಸರು')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={orderData.customer.fullName}
                      onChange={(e) => {
                        setOrderData({ ...orderData, customer: { ...orderData.customer, fullName: e.target.value } })
                        setOrderErrors((current) => ({ ...current, fullName: undefined, form: undefined }))
                      }}
                    />
                    {orderErrors.fullName ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.fullName}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      inputMode="numeric"
                      maxLength={10}
                      value={orderData.customer.mobileNumber}
                      onChange={(e) => {
                        setOrderData({ ...orderData, customer: { ...orderData.customer, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) } })
                        setOrderErrors((current) => ({ ...current, mobileNumber: undefined, form: undefined }))
                      }}
                    />
                    {orderErrors.mobileNumber ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.mobileNumber}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Address line 1', 'ವಿಳಾಸ ಸಾಲು 1')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={orderData.customer.addressLine1}
                      onChange={(e) => {
                        setOrderData({ ...orderData, customer: { ...orderData.customer, addressLine1: e.target.value } })
                        setOrderErrors((current) => ({ ...current, addressLine1: undefined, form: undefined }))
                      }}
                    />
                    {orderErrors.addressLine1 ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.addressLine1}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Address line 2', 'ವಿಳಾಸ ಸಾಲು 2')}</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={orderData.customer.addressLine2 || ''}
                      onChange={(e) => setOrderData({ ...orderData, customer: { ...orderData.customer, addressLine2: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Area / locality', 'ಪ್ರದೇಶ / ಲೋಕಾಲಿಟಿ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={orderData.customer.area}
                      onChange={(e) => {
                        setOrderData({ ...orderData, customer: { ...orderData.customer, area: e.target.value } })
                        setOrderErrors((current) => ({ ...current, area: undefined, form: undefined }))
                      }}
                    />
                    {orderErrors.area ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.area}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Landmark', 'ಲ್ಯಾಂಡ್‌ಮಾರ್ಕ್')}</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={orderData.customer.landmark || ''}
                      onChange={(e) => setOrderData({ ...orderData, customer: { ...orderData.customer, landmark: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('City / town', 'ನಗರ / ಪಟ್ಟಣ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={orderData.customer.city}
                      onChange={(e) => {
                        setOrderData({ ...orderData, customer: { ...orderData.customer, city: e.target.value } })
                        setOrderErrors((current) => ({ ...current, city: undefined, form: undefined }))
                      }}
                    />
                    {orderErrors.city ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.city}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('State', 'ರಾಜ್ಯ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={orderData.customer.state}
                      onChange={(e) => {
                        setOrderData({ ...orderData, customer: { ...orderData.customer, state: e.target.value } })
                        setOrderErrors((current) => ({ ...current, state: undefined, form: undefined }))
                      }}
                    />
                    {orderErrors.state ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.state}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Pincode', 'ಪಿನ್‌ಕೋಡ್')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      inputMode="numeric"
                      maxLength={6}
                      value={orderData.customer.pincode}
                      onChange={(e) => {
                        setOrderData({ ...orderData, customer: { ...orderData.customer, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) } })
                        setOrderErrors((current) => ({ ...current, pincode: undefined, form: undefined }))
                      }}
                    />
                    {orderErrors.pincode ? <p className="mt-2 text-sm font-medium text-red-600">{orderErrors.pincode}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Order note', 'ಆರ್ಡರ್ ಟಿಪ್ಪಣಿ')}</label>
                    <textarea
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      rows={3}
                      value={orderData.customer.orderNote || ''}
                      onChange={(e) => setOrderData({ ...orderData, customer: { ...orderData.customer, orderNote: e.target.value } })}
                    />
                  </div>
                </div>
              </section>

              {orderErrors.form ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {orderErrors.form}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !submittingOrder && setShowOrderModal(false)}
                  className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all"
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submittingOrder ? t('Placing order...', 'ಆರ್ಡರ್ ಮಾಡಲಾಗುತ್ತಿದೆ...') : t('Place COD Order', 'COD ಆರ್ಡರ್ ಮಾಡಿ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
