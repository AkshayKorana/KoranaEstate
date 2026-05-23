'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  Product,
  CreateProductInput,
  CreateOrderInput,
  OrderCustomerDetails,
  RawListing,
  RawListingFilters,
  CreateRawListingInput,
  CreateRawMarketplaceOrderInput,
} from '@/types/marketplace'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'
import { sendMarketplaceMessage } from '@/app/lib/send-marketplace-message'
import { extractErrorMessage, extractMessage } from '@/app/lib/api-errors'

// ── Shared constants ──────────────────────────────────────────────────────────
const STORE_CATEGORIES = ['Coffee Powder', 'Roasted Beans', 'Pepper Powder', 'Cardamom Powder', 'Ground Spices', 'Gift Packs']
const RAW_COMMODITIES = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper']
const STORE_ORDER_REQUIRED_FIELDS: Array<keyof OrderCustomerDetails> = ['fullName', 'mobileNumber', 'addressLine1', 'area', 'city', 'state', 'pincode']
const RAW_ORDER_REQUIRED_FIELDS: Array<keyof OrderCustomerDetails> = ['fullName', 'mobileNumber', 'addressLine1', 'city', 'state', 'pincode']

function createEmptyCustomerDetails(fullName = ''): OrderCustomerDetails {
  return { fullName, mobileNumber: '', addressLine1: '', addressLine2: '', area: '', city: '', state: '', pincode: '', landmark: '', orderNote: '' }
}

function extractOrderResponse(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  return (payload as { order?: { id?: string } }).order ?? null
}

// ── Store Tab ─────────────────────────────────────────────────────────────────
function StoreTab() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [formData, setFormData] = useState<CreateProductInput>({ name: '', category: STORE_CATEGORIES[0], price: 0, stock: 0, coffeeVariant: '', coffeeVariantPct: null, chicoryPct: null })
  const [orderData, setOrderData] = useState<CreateOrderInput>({ productId: '', quantity: 1, customer: createEmptyCustomerDetails() })
  const [orderErrors, setOrderErrors] = useState<Partial<Record<keyof OrderCustomerDetails | 'quantity' | 'form', string>>>({})
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editFormData, setEditFormData] = useState<CreateProductInput>({ name: '', category: STORE_CATEGORIES[0], price: 0, stock: 0, coffeeVariant: '', coffeeVariantPct: null, chicoryPct: null })
  const [editError, setEditError] = useState<string | null>(null)
  const isAdmin = session?.user?.role === 'ADMIN'

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedCategory])

  async function fetchProducts() {
    try {
      setLoading(true)
      setLoadError(null)
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) {
        setLoadError((await extractErrorMessage(res)) || t('Failed to load products', 'ಉತ್ಪನ್ನಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
        return
      }
      const data = await res.json()
      setProducts(data.products || [])
    } catch {
      setLoadError(t('Failed to load products', 'ಉತ್ಪನ್ನಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) { setCreateError(t('Only the store owner can add products.', 'ಸ್ಟೋರ್ ಮಾಲಿಕರು ಮಾತ್ರ ಉತ್ಪನ್ನಗಳನ್ನು ಸೇರಿಸಬಹುದು.')); return }
    try {
      setCreateError(null)
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) {
        setShowCreateModal(false)
        setFormData({ name: '', category: STORE_CATEGORIES[0], price: 0, stock: 0, description: '', imageUrl: '', coffeeVariant: '', coffeeVariantPct: null, chicoryPct: null })
        fetchProducts()
      } else {
        setCreateError(res.status === 403
          ? t('Only seller accounts can add store products.', 'ಮಾರಾಟಗಾರ ಖಾತೆಗಳಷ್ಟೇ ಸ್ಟೋರ್ ಉತ್ಪನ್ನಗಳನ್ನು ಸೇರಿಸಬಹುದು.')
          : (await extractErrorMessage(res)) || t('Failed to create product', 'ಉತ್ಪನ್ನ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch { setCreateError(t('Failed to create product', 'ಉತ್ಪನ್ನ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ')) }
  }

  async function handleEditProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin || !editingProduct) return
    try {
      setEditError(null)
      const body = {
        title: editFormData.name,
        category: editFormData.category,
        price: editFormData.price,
        stock: editFormData.stock,
        description: editFormData.description || null,
        imageUrl: editFormData.imageUrl || null,
        coffeeVariant: editFormData.coffeeVariant || null,
        coffeeVariantPct: editFormData.coffeeVariantPct ?? null,
        chicoryPct: editFormData.chicoryPct ?? null,
      }
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowEditModal(false)
        setEditingProduct(null)
        fetchProducts()
      } else {
        setEditError((await extractErrorMessage(res)) || t('Failed to update product', 'ಉತ್ಪನ್ನ ಅಪ್ಡೇಟ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch {
      setEditError(t('Failed to update product', 'ಉತ್ಪನ್ನ ಅಪ್ಡೇಟ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  async function handleDeleteProduct(productId: string, productName: string) {
    if (!isAdmin) return
    if (!confirm(t(`Delete "${productName}"? This cannot be undone.`, `"${productName}" ಅಳಿಸಬೇಕೇ? ಇದನ್ನು ರದ್ದು ಮಾಡಲಾಗುವುದಿಲ್ಲ.`))) return
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId))
      } else {
        alert((await extractErrorMessage(res)) || t('Failed to delete product', 'ಉತ್ಪನ್ನ ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch {
      alert(t('Failed to delete product', 'ಉತ್ಪನ್ನ ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct) { setOrderErrors({ form: t('Please reopen the order modal and try again.', 'ದಯವಿಟ್ಟು ಆರ್ಡರ್ ಮೋಡಲ್ ಅನ್ನು ಮತ್ತೆ ತೆರೆಯಿರಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.') }); return }
    const nextErrors: Partial<Record<keyof OrderCustomerDetails | 'quantity' | 'form', string>> = {}
    if (orderData.quantity < 1) nextErrors.quantity = t('Quantity must be at least 1', 'ಪ್ರಮಾಣ ಕನಿಷ್ಠ 1 ಇರಬೇಕು')
    else if (orderData.quantity > selectedProduct.stock) nextErrors.quantity = `${t('Only', 'ಕೇವಲ')} ${selectedProduct.stock} ${t('units available', 'ಯೂನಿಟ್‌ಗಳು ಲಭ್ಯ')}`
    for (const field of STORE_ORDER_REQUIRED_FIELDS) { if (!orderData.customer[field]?.trim()) nextErrors[field] = t('This field is required', 'ಈ ಕ್ಷೇತ್ರ ಕಡ್ಡಾಯವಾಗಿದೆ') }
    if (orderData.customer.mobileNumber && !/^[6-9]\d{9}$/.test(orderData.customer.mobileNumber.trim())) nextErrors.mobileNumber = t('Enter a valid 10-digit mobile number', 'ಮಾನ್ಯ 10 ಅಂಕೆಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ')
    if (orderData.customer.pincode && !/^\d{6}$/.test(orderData.customer.pincode.trim())) nextErrors.pincode = t('Enter a valid 6-digit pincode', 'ಮಾನ್ಯ 6 ಅಂಕೆಯ ಪಿನ್‌ಕೋಡ್ ನಮೂದಿಸಿ')
    if (Object.keys(nextErrors).length > 0) nextErrors.form = t('Please correct the highlighted fields before placing your order.', 'ನಿಮ್ಮ ಆರ್ಡರ್ ಮಾಡುವ ಮೊದಲು ಗುರುತಿಸಿದ ಕ್ಷೇತ್ರಗಳನ್ನು ಸರಿಪಡಿಸಿ.')
    setOrderErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    try {
      setSubmittingOrder(true)
      setOrderErrors({})
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: selectedProduct.id, quantity: orderData.quantity, customer: orderData.customer }) })
      const payload = await res.json().catch(() => null)
      if (res.ok) {
        const order = extractOrderResponse(payload)
        if (!order?.id) { setOrderErrors((c) => ({ ...c, form: t('Order was created but confirmation could not be loaded.', 'ಆರ್ಡರ್ ರಚಿಸಲಾಗಿದೆ ಆದರೆ ದೃಢೀಕರಣವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.') })); return }
        setShowOrderModal(false)
        setOrderData({ productId: '', quantity: 1, customer: createEmptyCustomerDetails(session?.user?.name || '') })
        setOrderErrors({})
        fetchProducts()
        router.push(`/orders/${order.id}`)
      } else {
        const msg = extractMessage(payload) || t('Failed to place COD order', 'COD ಆರ್ಡರ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ')
        setOrderErrors((c) => ({ ...c, form: msg }))
      }
    } catch { setOrderErrors((c) => ({ ...c, form: t('Failed to place COD order', 'COD ಆರ್ಡರ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ') }))
    } finally { setSubmittingOrder(false) }
  }

  async function handleOpenSellerChat(product: Product, withIntro: boolean) {
    if (!product.seller?.id) { alert(t('Seller details unavailable', 'ಮಾರಾಟಗಾರ ವಿವರಗಳು ಲಭ್ಯವಿಲ್ಲ')); return }
    try {
      await sendMarketplaceMessage({
        recipientId: product.seller.id,
        listingId: product.id,
        listingName: product.name,
        kind: 'store',
        action: withIntro ? 'contact' : 'message',
        router,
        details: {
          price: product.price,
          stock: product.stock,
          category: product.category,
        },
      })
    } catch { alert(t('Failed to connect with seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಲು ವಿಫಲವಾಗಿದೆ')) }
  }

  return (
    <div className="space-y-4">
      {/* Mobile category scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden scrollbar-hide -mx-4 px-4">
        <button onClick={() => setSelectedCategory('')} className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-all ${selectedCategory === '' ? 'gradient-brand-spectrum text-white shadow-md' : isDark ? 'bg-white/10 text-[#d8c8b3]' : 'bg-white border border-black/10 text-[#2f2f2f]'}`}>
          {t('All', 'ಎಲ್ಲ')}
        </button>
        {STORE_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-all ${selectedCategory === cat ? 'gradient-brand-spectrum text-white shadow-md' : isDark ? 'bg-white/10 text-[#d8c8b3]' : 'bg-white border border-black/10 text-[#2f2f2f]'}`}>
            {categoryLabel(cat)}
          </button>
        ))}
      </div>

      <div className="flex gap-6 lg:gap-8">
        {/* Category Sidebar — desktop only */}
        <aside className="hidden lg:block w-64 flex-shrink-0 fade-in">
          <div className={`glass rounded-2xl shadow-lg p-6 sticky top-36 border ${isDark ? 'border-emerald-200/30' : 'border-black/10'}`}>
            <div className="flex items-center space-x-2 mb-6">
              <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h2 className="font-semibold text-lg text-brand-spectrum">{t('Categories', 'ವರ್ಗಗಳು')}</h2>
            </div>
            <div className="space-y-1.5">
              <button onClick={() => setSelectedCategory('')} className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${selectedCategory === '' ? 'gradient-brand-spectrum text-white shadow-md' : isDark ? 'bg-[#171411]/75 text-[#d8c8b3] hover:bg-emerald-900/35' : 'bg-white text-[#2f2f2f] border border-black/10 hover:bg-[#f3ede4]'}`}>
                {t('All Products', 'ಎಲ್ಲಾ ಉತ್ಪನ್ನಗಳು')}
              </button>
              {STORE_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-medium text-sm ${selectedCategory === cat ? 'gradient-brand-spectrum text-white shadow-md' : isDark ? 'bg-[#171411]/75 text-[#d8c8b3] hover:bg-emerald-900/35' : 'bg-white text-[#2f2f2f] border border-black/10 hover:bg-[#f3ede4]'}`}>
                  {categoryLabel(cat)}
                </button>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-emerald-200/25 text-center">
              <p className="text-2xl font-bold text-amber-700">{products.length}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Available Products', 'ಲಭ್ಯ ಉತ್ಪನ್ನಗಳು')}</p>
            </div>
          </div>
        </aside>

        {/* Products grid */}
        <main className="flex-1 min-w-0">
          <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 slide-in-up">
            <p className={`text-sm font-medium ${isDark ? 'text-[#c8bca9]' : 'text-[#6b6b6b]'}`}>
              {loading ? t('Loading...', 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...') : `${products.length} ${products.length === 1 ? t('product', 'ಉತ್ಪನ್ನ') : t('products', 'ಉತ್ಪನ್ನಗಳು')} ${t('available', 'ಲಭ್ಯ')}`}
            </p>
            {isAdmin && (
              <button onClick={() => { setCreateError(null); setShowCreateModal(true) }} className="lux-btn-primary px-6 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('Add Product', 'ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16 glass rounded-2xl shadow-xl">
              <div className="flex justify-center space-x-2 mb-4">
                {[0, 150, 300].map(d => <div key={d} className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
              <p className={`font-medium text-sm ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Loading store...', 'ಸ್ಟೋರ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
            </div>
          ) : loadError ? (
            <div className="text-center py-12 glass rounded-2xl shadow-xl fade-in">
              <p className="text-base font-semibold text-red-600">{loadError}</p>
              <button onClick={fetchProducts} className="mt-4 surface-app-button-secondary rounded-xl px-5 py-2.5 font-semibold text-sm">{t('Retry', 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ')}</button>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 glass rounded-2xl shadow-xl fade-in">
              <div className="w-16 h-16 mx-auto mb-4 p-4 rounded-full gradient-coffee-cream flex items-center justify-center">
                <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-card-strong">{t('No Products Yet', 'ಇನ್ನೂ ಉತ್ಪನ್ನಗಳಿಲ್ಲ')}</h3>
              <p className={`mb-4 text-sm ${isDark ? 'text-[#bbae9a]' : 'text-[#4a4a4a]'}`}>{t('Products will appear here soon.', 'ಉತ್ಪನ್ನಗಳು ಶೀಘ್ರದಲ್ಲಿ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.')}</p>
              {isAdmin && <button onClick={() => setShowCreateModal(true)} className="lux-btn-primary px-6 py-2.5 rounded-xl font-semibold shadow-lg hover:scale-105 transition-all text-sm">{t('Add First Product', 'ಮೊದಲ ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product, idx) => (
                <div key={product.id} className="surface-card rounded-2xl shadow-md hover:shadow-2xl transition-all overflow-hidden card-hover fade-in flex flex-col" style={{ animationDelay: `${idx * 100}ms` }}>
                  {/* Product image */}
                  <div className="h-28 sm:h-32 bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-50 flex items-center justify-center relative overflow-hidden flex-shrink-0">
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" /> : (
                      <div className="text-center">
                        <span className="text-4xl">☕</span>
                      </div>
                    )}
                    {product.stock === 0 && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><span className="text-white font-bold text-sm">{t('OUT OF STOCK', 'ಸ್ಟಾಕ್ ಇಲ್ಲ')}</span></div>}
                    <span className="absolute top-2 right-2 gradient-brand-spectrum text-white text-[10px] px-2 py-0.5 rounded-full font-semibold shadow">{categoryLabel(product.category)}</span>
                  </div>

                  <div className="p-3 sm:p-4 flex flex-col flex-1">
                    {/* Name — prominent */}
                    <h3 className="font-extrabold text-sm sm:text-base text-card-strong leading-tight mb-1 line-clamp-2">{product.name}</h3>

                    {/* Price — very prominent */}
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">₹{product.price.toFixed(0)}</span>
                      <span className="text-xs text-muted-safe">{t('/ unit', '/ ಯೂನಿಟ್')}</span>
                    </div>

                    {/* Coffee Composition — always shown, prominent */}
                    <div className={`rounded-xl p-2.5 mb-3 ${isDark ? 'bg-amber-900/30 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">☕ {t('Coffee Composition', 'ಕಾಫಿ ಸಂಯೋಜನೆ')}</p>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div>
                          <p className="text-[8px] text-muted-safe uppercase tracking-wide leading-tight mb-0.5">{t('Variant', 'ವೈವಿಧ್ಯ')}</p>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-200 leading-tight line-clamp-2">{product.coffeeVariant || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-muted-safe uppercase tracking-wide leading-tight mb-0.5">{t('Coffee', 'ಕಾಫಿ')}</p>
                          <p className="text-base font-extrabold text-amber-700 dark:text-amber-200">{product.coffeeVariantPct != null ? `${product.coffeeVariantPct}%` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-muted-safe uppercase tracking-wide leading-tight mb-0.5">{t('Chicory', 'ಚಿಕೊರಿ')}</p>
                          <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">{product.chicoryPct != null ? `${product.chicoryPct}%` : '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Stock + seller — compact row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full gradient-coffee-cream flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0">{product.seller?.name?.[0]?.toUpperCase() || 'S'}</div>
                        <span className="text-xs text-muted-safe truncate max-w-[70px]">{product.seller?.name || t('Store', 'ಸ್ಟೋರ್')}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.stock > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'}`}>
                        {product.stock > 0 ? `${product.stock} ${t('in stock', 'ಸ್ಟಾಕ್')}` : t('Out', 'ಖಾಲಿ')}
                      </span>
                    </div>

                    {product.description && <p className="text-xs text-muted-safe mb-2 line-clamp-2">{product.description}</p>}

                    {/* Actions */}
                    <div className="mt-auto space-y-2">
                      <button
                        onClick={() => {
                          if (product.stock === 0) { alert(t('This product is out of stock', 'ಈ ಉತ್ಪನ್ನ ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಇಲ್ಲ')); return }
                          setSelectedProduct(product)
                          setOrderData({ productId: product.id, quantity: 1, customer: createEmptyCustomerDetails(session?.user?.name || '') })
                          setOrderErrors({})
                          setShowOrderModal(true)
                        }}
                        disabled={product.stock === 0}
                        className={`w-full py-2.5 rounded-xl font-semibold shadow transition-all flex items-center justify-center gap-2 text-sm ${product.stock > 0 ? 'gradient-brand-spectrum text-white hover:shadow-lg hover:scale-105' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        {product.stock > 0 ? t('Buy Now', 'ಈಗ ಖರೀದಿ') : t('Out of Stock', 'ಸ್ಟಾಕ್ ಇಲ್ಲ')}
                      </button>
                      <button onClick={() => handleOpenSellerChat(product, true)} className="w-full lux-btn-secondary py-2 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all text-sm flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {t('Contact Seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ')}
                      </button>
                      {isAdmin && (
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setEditingProduct(product); setEditFormData({ name: product.name, category: product.category, price: product.price, stock: product.stock, description: product.description ?? '', imageUrl: product.imageUrl ?? '', coffeeVariant: product.coffeeVariant ?? '', coffeeVariantPct: product.coffeeVariantPct, chicoryPct: product.chicoryPct }); setEditError(null); setShowEditModal(true) }} className="py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30 dark:hover:bg-amber-900/40 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            {t('Edit', 'ತಿದ್ದು')}
                          </button>
                          <button onClick={() => handleDeleteProduct(product.id, product.name)} className="py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/30 dark:hover:bg-red-900/40 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            {t('Delete', 'ಅಳಿಸಿ')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl slide-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl gradient-brand-spectrum"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div>
              <h2 className="text-2xl font-bold text-brand-spectrum">{t('Add New Product', 'ಹೊಸ ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}</h2>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              {createError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{createError}</div>}
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Product Name', 'ಉತ್ಪನ್ನದ ಹೆಸರು')} *</label><input required type="text" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" placeholder={t('e.g., Premium Arabica Powder 250g', 'ಉದಾ., ಪ್ರೀಮಿಯಂ ಅರಬಿಕಾ ಪುಡಿ 250g')} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Category', 'ವರ್ಗ')} *</label><select required className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>{STORE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Price (₹)', 'ಬೆಲೆ (₹)')} *</label><input required type="number" min="1" step="0.01" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} /></div>
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Stock (units)', 'ಸ್ಟಾಕ್ (ಯೂನಿಟ್‌ಗಳು)')} *</label><input required type="number" min="0" step="1" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={formData.stock || ''} onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })} /></div>
              </div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Description (optional)', 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)')}</label><textarea className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" rows={3} placeholder={t('Product details...', 'ಉತ್ಪನ್ನದ ವಿವರಗಳು...')} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Image URL (optional)', 'ಚಿತ್ರ URL (ಐಚ್ಛಿಕ)')}</label><input type="url" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" placeholder="https://example.com/image.jpg" value={formData.imageUrl || ''} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} /></div>
              {/* Coffee composition — required */}
              <div className={`rounded-xl p-4 space-y-3 ${isDark ? 'bg-amber-900/20 border border-amber-600/40' : 'bg-amber-50 border-2 border-amber-300'}`}>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">☕ {t('Coffee Composition', 'ಕಾಫಿ ಸಂಯೋಜನೆ')} <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-[#111111] dark:text-[#ffffff] mb-1.5">{t('Coffee Variant', 'ಕಾಫಿ ವೈವಿಧ್ಯ')} <span className="text-red-500">*</span></label>
                    <select required className="w-full border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={formData.coffeeVariant || ''} onChange={(e) => setFormData({ ...formData, coffeeVariant: e.target.value })}>
                      <option value="">{t('— Select —', '— ಆಯ್ಕೆ ಮಾಡಿ —')}</option>
                      <option>Arabica Cherry</option>
                      <option>Arabica Parchment</option>
                      <option>Robusta Cherry</option>
                      <option>Robusta Parchment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#111111] dark:text-[#ffffff] mb-1.5">{t('Variant %', 'ವೈವಿಧ್ಯ %')} <span className="text-red-500">*</span></label>
                    <input required type="number" min="0" max="100" step="0.1" className="w-full border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" placeholder="e.g. 70" value={formData.coffeeVariantPct ?? ''} onChange={(e) => setFormData({ ...formData, coffeeVariantPct: e.target.value !== '' ? parseFloat(e.target.value) : null })} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#111111] dark:text-[#ffffff] mb-1.5">{t('Chicory %', 'ಚಿಕೊರಿ %')} <span className="text-red-500">*</span></label>
                    <input required type="number" min="0" max="100" step="0.1" className="w-full border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" placeholder="e.g. 30" value={formData.chicoryPct ?? ''} onChange={(e) => setFormData({ ...formData, chicoryPct: e.target.value !== '' ? parseFloat(e.target.value) : null })} />
                  </div>
                </div>
                <p className="text-[10px] text-amber-700 dark:text-amber-400">{t('Coffee % + Chicory % should equal 100', 'ಕಾಫಿ % + ಚಿಕೊರಿ % = 100 ಆಗಿರಬೇಕು')}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all">{t('Cancel', 'ರದ್ದುಮಾಡಿ')}</button>
                <button type="submit" disabled={!isAdmin} className="flex-1 gradient-coffee-cream text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">{t('Add Product', 'ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl slide-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/40"><svg className="w-5 h-5 text-amber-700 dark:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
              <h2 className="text-2xl font-bold text-brand-spectrum">{t('Edit Product', 'ಉತ್ಪನ್ನ ತಿದ್ದು')}</h2>
            </div>
            <form onSubmit={handleEditProduct} className="space-y-4">
              {editError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{editError}</div>}
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Product Name', 'ಉತ್ಪನ್ನದ ಹೆಸರು')} *</label><input required type="text" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} /></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Category', 'ವರ್ಗ')} *</label><select required className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}>{STORE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Price (₹)', 'ಬೆಲೆ (₹)')} *</label><input required type="number" min="1" step="0.01" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={editFormData.price || ''} onChange={(e) => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) })} /></div>
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Stock (units)', 'ಸ್ಟಾಕ್ (ಯೂನಿಟ್‌ಗಳು)')} *</label><input required type="number" min="0" step="1" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={editFormData.stock || ''} onChange={(e) => setEditFormData({ ...editFormData, stock: parseInt(e.target.value) })} /></div>
              </div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Description (optional)', 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)')}</label><textarea className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" rows={3} value={editFormData.description || ''} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} /></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Image URL (optional)', 'ಚಿತ್ರ URL (ಐಚ್ಛಿಕ)')}</label><input type="url" className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" placeholder="https://example.com/image.jpg" value={editFormData.imageUrl || ''} onChange={(e) => setEditFormData({ ...editFormData, imageUrl: e.target.value })} /></div>
              <div className={`rounded-xl p-4 space-y-3 ${isDark ? 'bg-amber-900/20 border border-amber-600/40' : 'bg-amber-50 border-2 border-amber-300'}`}>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">☕ {t('Coffee Composition', 'ಕಾಫಿ ಸಂಯೋಜನೆ')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-[#111111] dark:text-[#ffffff] mb-1.5">{t('Coffee Variant', 'ಕಾಫಿ ವೈವಿಧ್ಯ')}</label>
                    <select className="w-full border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" value={editFormData.coffeeVariant || ''} onChange={(e) => setEditFormData({ ...editFormData, coffeeVariant: e.target.value })}>
                      <option value="">{t('— Select —', '— ಆಯ್ಕೆ ಮಾಡಿ —')}</option>
                      <option>Arabica Cherry</option><option>Arabica Parchment</option><option>Robusta Cherry</option><option>Robusta Parchment</option>
                    </select>
                  </div>
                  <div><label className="block text-xs font-semibold text-[#111111] dark:text-[#ffffff] mb-1.5">{t('Variant %', 'ವೈವಿಧ್ಯ %')}</label><input type="number" min="0" max="100" step="0.1" className="w-full border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" placeholder="e.g. 70" value={editFormData.coffeeVariantPct ?? ''} onChange={(e) => setEditFormData({ ...editFormData, coffeeVariantPct: e.target.value !== '' ? parseFloat(e.target.value) : null })} /></div>
                  <div><label className="block text-xs font-semibold text-[#111111] dark:text-[#ffffff] mb-1.5">{t('Chicory %', 'ಚಿಕೊರಿ %')}</label><input type="number" min="0" max="100" step="0.1" className="w-full border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all" placeholder="e.g. 30" value={editFormData.chicoryPct ?? ''} onChange={(e) => setEditFormData({ ...editFormData, chicoryPct: e.target.value !== '' ? parseFloat(e.target.value) : null })} /></div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingProduct(null) }} className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all">{t('Cancel', 'ರದ್ದುಮಾಡಿ')}</button>
                <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">{t('Save Changes', 'ಬದಲಾವಣೆ ಉಳಿಸಿ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place Order Modal */}
      {showOrderModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-4xl w-full p-4 sm:p-8 shadow-2xl slide-in-up max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl gradient-emerald"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
              <div><h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">{t('Place Order', 'ಆರ್ಡರ್ ಮಾಡಿ')}</h2><p className="text-muted-safe text-sm">{selectedProduct.name}</p></div>
            </div>
            <form noValidate onSubmit={handlePlaceOrder} className="space-y-5">
              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 to-emerald-50 flex items-center justify-center flex-shrink-0">
                    {selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-full w-full object-cover" /> : <span className="text-4xl">☕</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-app-strong">{selectedProduct.name}</h3><span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">{categoryLabel(selectedProduct.category)}</span></div>
                    <p className="mt-1 text-sm text-app-muted">{selectedProduct.seller?.name ? `${t('Sold by', 'ಮಾರಾಟಗಾರ')}: ${selectedProduct.seller.name}` : t('Sold by Korana Store sellers', 'ಕೊರಾನಾ ಸ್ಟೋರ್ ಮಾರಾಟಗಾರರಿಂದ')}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="surface-app-panel-soft rounded-xl p-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Unit price', 'ಯೂನಿಟ್ ಬೆಲೆ')}</p><p className="mt-1.5 text-xl font-bold text-app-strong">₹{selectedProduct.price.toFixed(2)}</p></div>
                      <div className="surface-app-panel-soft rounded-xl p-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Stock', 'ಸ್ಟಾಕ್')}</p><p className="mt-1.5 text-xl font-bold text-app-strong">{selectedProduct.stock}</p></div>
                      <div className="surface-app-panel-soft rounded-xl p-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Total', 'ಒಟ್ಟು')}</p><p className="mt-1.5 text-xl font-bold text-app-strong">₹{(selectedProduct.price * orderData.quantity).toFixed(2)}</p></div>
                    </div>
                  </div>
                </div>
              </section>
              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div><h3 className="text-base font-bold text-app-strong">{t('Quantity & payment', 'ಪ್ರಮಾಣ ಮತ್ತು ಪಾವತಿ')}</h3><p className="mt-0.5 text-sm text-app-muted">{t('Review your quantity and COD total.', 'ಪ್ರಮಾಣ ಮತ್ತು COD ಒಟ್ಟು ಮೊತ್ತ ಪರಿಶೀಲಿಸಿ.')}</p></div>
                  <div className="surface-app-chip rounded-full px-3 py-1.5 text-xs font-semibold">CASH ON DELIVERY</div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Quantity', 'ಪ್ರಮಾಣ')} *</label>
                    <input required type="number" min="1" max={selectedProduct.stock} step="1" className="surface-app-input w-full rounded-xl px-4 py-3 text-lg font-semibold transition-all" value={orderData.quantity} onChange={(e) => { const v = parseInt(e.target.value || '1', 10); setOrderData({ ...orderData, quantity: Number.isFinite(v) ? v : 1 }); setOrderErrors((c) => ({ ...c, quantity: undefined, form: undefined })) }} />
                    <p className="mt-1.5 text-xs text-app-soft">{t('Available', 'ಲಭ್ಯ')}: {selectedProduct.stock}</p>
                    {orderErrors.quantity && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.quantity}</p>}
                  </div>
                  <div className="surface-app-panel-soft rounded-xl p-4">
                    <p className="text-sm font-semibold text-app-strong">CASH ON DELIVERY</p>
                    <p className="mt-1 text-xs text-app-muted">{t('Pay in cash when your order is delivered.', 'ಆರ್ಡರ್ ವಿತರಿಸಿದಾಗ ನಗದು ಪಾವತಿಸಿ.')}</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between text-app-muted"><span>{t('Unit price', 'ಯೂನಿಟ್ ಬೆಲೆ')}</span><span className="font-semibold text-app-body">₹{selectedProduct.price.toFixed(2)}</span></div>
                      <div className="flex justify-between text-app-muted"><span>{t('Quantity', 'ಪ್ರಮಾಣ')}</span><span className="font-semibold text-app-body">{orderData.quantity}</span></div>
                      <div className="flex justify-between border-t border-zinc-200/80 pt-2.5 text-app-body dark:border-white/10"><span className="font-semibold">{t('Total payable', 'ಪಾವತಿಸಬೇಕಾದ ಒಟ್ಟು')}</span><span className="text-lg font-bold">₹{(selectedProduct.price * orderData.quantity).toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              </section>
              <section className="surface-app-panel rounded-2xl p-5">
                <h3 className="text-base font-bold text-app-strong">{t('Delivery details', 'ವಿತರಣಾ ವಿವರಗಳು')}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Full name', 'ಪೂರ್ಣ ಹೆಸರು')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={orderData.customer.fullName} onChange={(e) => { setOrderData({ ...orderData, customer: { ...orderData.customer, fullName: e.target.value } }); setOrderErrors((c) => ({ ...c, fullName: undefined, form: undefined })) }} />{orderErrors.fullName && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.fullName}</p>}</div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" inputMode="numeric" maxLength={10} value={orderData.customer.mobileNumber} onChange={(e) => { setOrderData({ ...orderData, customer: { ...orderData.customer, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) } }); setOrderErrors((c) => ({ ...c, mobileNumber: undefined, form: undefined })) }} />{orderErrors.mobileNumber && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.mobileNumber}</p>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-semibold text-app-body mb-2">{t('Address line 1', 'ವಿಳಾಸ ಸಾಲು 1')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={orderData.customer.addressLine1} onChange={(e) => { setOrderData({ ...orderData, customer: { ...orderData.customer, addressLine1: e.target.value } }); setOrderErrors((c) => ({ ...c, addressLine1: undefined, form: undefined })) }} />{orderErrors.addressLine1 && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.addressLine1}</p>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-semibold text-app-body mb-2">{t('Address line 2', 'ವಿಳಾಸ ಸಾಲು 2')}</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={orderData.customer.addressLine2 || ''} onChange={(e) => setOrderData({ ...orderData, customer: { ...orderData.customer, addressLine2: e.target.value } })} /></div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Area / locality', 'ಪ್ರದೇಶ / ಲೋಕಾಲಿಟಿ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={orderData.customer.area} onChange={(e) => { setOrderData({ ...orderData, customer: { ...orderData.customer, area: e.target.value } }); setOrderErrors((c) => ({ ...c, area: undefined, form: undefined })) }} />{orderErrors.area && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.area}</p>}</div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Landmark', 'ಲ್ಯಾಂಡ್‌ಮಾರ್ಕ್')}</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={orderData.customer.landmark || ''} onChange={(e) => setOrderData({ ...orderData, customer: { ...orderData.customer, landmark: e.target.value } })} /></div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('City / town', 'ನಗರ / ಪಟ್ಟಣ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={orderData.customer.city} onChange={(e) => { setOrderData({ ...orderData, customer: { ...orderData.customer, city: e.target.value } }); setOrderErrors((c) => ({ ...c, city: undefined, form: undefined })) }} />{orderErrors.city && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.city}</p>}</div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('State', 'ರಾಜ್ಯ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={orderData.customer.state} onChange={(e) => { setOrderData({ ...orderData, customer: { ...orderData.customer, state: e.target.value } }); setOrderErrors((c) => ({ ...c, state: undefined, form: undefined })) }} />{orderErrors.state && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.state}</p>}</div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Pincode', 'ಪಿನ್‌ಕೋಡ್')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" inputMode="numeric" maxLength={6} value={orderData.customer.pincode} onChange={(e) => { setOrderData({ ...orderData, customer: { ...orderData.customer, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) } }); setOrderErrors((c) => ({ ...c, pincode: undefined, form: undefined })) }} />{orderErrors.pincode && <p className="mt-1.5 text-sm font-medium text-red-600">{orderErrors.pincode}</p>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-semibold text-app-body mb-2">{t('Order note', 'ಆರ್ಡರ್ ಟಿಪ್ಪಣಿ')}</label><textarea className="surface-app-input w-full rounded-xl px-4 py-3" rows={3} value={orderData.customer.orderNote || ''} onChange={(e) => setOrderData({ ...orderData, customer: { ...orderData.customer, orderNote: e.target.value } })} /></div>
                </div>
              </section>
              {orderErrors.form && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{orderErrors.form}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => !submittingOrder && setShowOrderModal(false)} className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all">{t('Cancel', 'ರದ್ದುಮಾಡಿ')}</button>
                <button type="submit" disabled={submittingOrder} className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:cursor-not-allowed disabled:opacity-70">{submittingOrder ? t('Placing order...', 'ಆರ್ಡರ್ ಮಾಡಲಾಗುತ್ತಿದೆ...') : t('Place COD Order', 'COD ಆರ್ಡರ್ ಮಾಡಿ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Raw Commodities Tab ───────────────────────────────────────────────────────
function RawTab() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const [listings, setListings] = useState<RawListing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showCodModal, setShowCodModal] = useState(false)
  const [selectedListing, setSelectedListing] = useState<RawListing | null>(null)
  const [filters, setFilters] = useState<RawListingFilters>({})
  const [formData, setFormData] = useState<CreateRawListingInput>({ commodity: RAW_COMMODITIES[0], quantityKg: 0, pricePerKg: 0, location: '' })
  const [offerData, setOfferData] = useState({ offerPrice: 0, quantity: 0, message: '' })
  const [codOrderData, setCodOrderData] = useState<CreateRawMarketplaceOrderInput>({ listingId: '', quantityKg: 0, customer: createEmptyCustomerDetails() })
  const [codErrors, setCodErrors] = useState<Partial<Record<keyof OrderCustomerDetails | 'quantityKg' | 'form', string>>>({})
  const [submittingCod, setSubmittingCod] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showEditListingModal, setShowEditListingModal] = useState(false)
  const [editingListing, setEditingListing] = useState<RawListing | null>(null)
  const [editListingData, setEditListingData] = useState<CreateRawListingInput>({ commodity: RAW_COMMODITIES[0], quantityKg: 0, pricePerKg: 0, location: '' })
  const [editListingError, setEditListingError] = useState<string | null>(null)
  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchListings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, filters])

  async function fetchListings() {
    try {
      setLoading(true)
      setLoadError(null)
      const params = new URLSearchParams()
      if (filters.commodity) params.set('commodity', filters.commodity)
      if (filters.location) params.set('location', filters.location)
      const res = await fetch(`/api/raw/listings?${params}`)
      if (!res.ok) { setLoadError((await extractErrorMessage(res)) || t('Failed to load listings', 'ಲಿಸ್ಟಿಂಗ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ')); return }
      const data = await res.json()
      setListings(data.listings || [])
    } catch { setLoadError(t('Failed to load listings', 'ಲಿಸ್ಟಿಂಗ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
    } finally { setLoading(false) }
  }

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) { setCreateError(t('Only the store owner can create listings.', 'ಸ್ಟೋರ್ ಮಾಲಿಕರು ಮಾತ್ರ ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಬಹುದು.')); return }
    try {
      setCreateError(null)
      const res = await fetch('/api/raw/listings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) {
        setShowCreateModal(false)
        setFormData({ commodity: RAW_COMMODITIES[0], quantityKg: 0, pricePerKg: 0, location: '', grade: '', description: '' })
        fetchListings()
      } else {
        setCreateError(res.status === 403 ? t('Only seller accounts can create raw marketplace listings.', 'ಮಾರಾಟಗಾರ ಖಾತೆಗಳಷ್ಟೇ ರಾ ಮಾರುಕಟ್ಟೆ ಲಿಸ್ಟಿಂಗ್‌ಗಳನ್ನು ರಚಿಸಬಹುದು.') : (await extractErrorMessage(res)) || t('Failed to create listing', 'ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch { setCreateError(t('Failed to create listing', 'ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ')) }
  }

  async function handleEditListing(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin || !editingListing) return
    try {
      setEditListingError(null)
      const body = {
        commodityName: editListingData.commodity,
        grade: editListingData.grade || null,
        quantityKg: editListingData.quantityKg,
        pricePerKg: editListingData.pricePerKg,
        location: editListingData.location,
        description: editListingData.description || null,
      }
      const res = await fetch(`/api/raw/listings/${editingListing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowEditListingModal(false)
        setEditingListing(null)
        fetchListings()
      } else {
        setEditListingError((await extractErrorMessage(res)) || t('Failed to update listing', 'ಲಿಸ್ಟಿಂಗ್ ಅಪ್ಡೇಟ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch {
      setEditListingError(t('Failed to update listing', 'ಲಿಸ್ಟಿಂಗ್ ಅಪ್ಡೇಟ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  async function handleDeleteListing(listingId: string, commodity: string) {
    if (!isAdmin) return
    if (!confirm(t(`Delete "${commodity}" listing? This cannot be undone.`, `"${commodity}" ಲಿಸ್ಟಿಂಗ್ ಅಳಿಸಬೇಕೇ? ಇದನ್ನು ರದ್ದು ಮಾಡಲಾಗುವುದಿಲ್ಲ.`))) return
    try {
      const res = await fetch(`/api/raw/listings/${listingId}`, { method: 'DELETE' })
      if (res.ok) {
        setListings((prev) => prev.filter((l) => l.id !== listingId))
      } else {
        alert((await extractErrorMessage(res)) || t('Failed to delete listing', 'ಲಿಸ್ಟಿಂಗ್ ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch {
      alert(t('Failed to delete listing', 'ಲಿಸ್ಟಿಂಗ್ ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  async function handleMakeOffer(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedListing) return
    try {
      const res = await fetch('/api/raw/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          ...offerData,
          // listing context for email notifications
          listingCommodity: selectedListing.commodity,
          listingLocation: selectedListing.location,
          listingAskingPrice: selectedListing.pricePerKg,
        }),
      })
      if (res.ok) { setShowOfferModal(false); setOfferData({ offerPrice: 0, quantity: 0, message: '' }); alert(t('Offer submitted! You will receive a confirmation email shortly.', 'ಆಫರ್ ಸಲ್ಲಿಸಲಾಗಿದೆ! ನಿಮಗೆ ಶೀಘ್ರದಲ್ಲಿ ಇಮೇಲ್ ಬರುತ್ತದೆ.')) }
      else { alert((await extractErrorMessage(res)) || t('Failed to create offer', 'ಆಫರ್ ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ')) }
    } catch { alert(t('Failed to create offer', 'ಆಫರ್ ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ')) }
  }

  async function handlePlaceCodOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedListing) { setCodErrors({ form: t('Please reopen the modal and try again.', 'ದಯವಿಟ್ಟು ಮೋಡಲ್ ಅನ್ನು ಮತ್ತೆ ತೆರೆಯಿರಿ ಮತ್ತು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.') }); return }
    const nextErrors: Partial<Record<keyof OrderCustomerDetails | 'quantityKg' | 'form', string>> = {}
    if (codOrderData.quantityKg <= 0) nextErrors.quantityKg = t('Quantity must be greater than zero', 'ಪ್ರಮಾಣ ಶೂನ್ಯಕ್ಕಿಂತ ಹೆಚ್ಚಿರಬೇಕು')
    else if (codOrderData.quantityKg > selectedListing.quantityKg) nextErrors.quantityKg = `${t('Available quantity is', 'ಲಭ್ಯ ಪ್ರಮಾಣ')} ${selectedListing.quantityKg} kg`
    for (const field of RAW_ORDER_REQUIRED_FIELDS) { if (!codOrderData.customer[field]?.trim()) nextErrors[field] = t('This field is required', 'ಈ ಕ್ಷೇತ್ರ ಕಡ್ಡಾಯವಾಗಿದೆ') }
    if (codOrderData.customer.mobileNumber && !/^[6-9]\d{9}$/.test(codOrderData.customer.mobileNumber.trim())) nextErrors.mobileNumber = t('Enter a valid 10-digit mobile number', 'ಮಾನ್ಯ 10 ಅಂಕೆಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ')
    if (codOrderData.customer.pincode && !/^\d{6}$/.test(codOrderData.customer.pincode.trim())) nextErrors.pincode = t('Enter a valid 6-digit pincode', 'ಮಾನ್ಯ 6 ಅಂಕೆಯ ಪಿನ್‌ಕೋಡ್ ನಮೂದಿಸಿ')
    if (Object.keys(nextErrors).length > 0) nextErrors.form = t('Please correct the highlighted fields before placing your COD order.', 'ನಿಮ್ಮ COD ಆರ್ಡರ್ ಮಾಡುವ ಮೊದಲು ಗುರುತಿಸಿದ ಕ್ಷೇತ್ರಗಳನ್ನು ಸರಿಪಡಿಸಿ.')
    setCodErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    try {
      setSubmittingCod(true)
      setCodErrors({})
      const res = await fetch('/api/raw/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: selectedListing.id, quantityKg: codOrderData.quantityKg, customer: codOrderData.customer }) })
      const payload = await res.json().catch(() => null)
      if (!res.ok) { setCodErrors((c) => ({ ...c, form: extractMessage(payload) || t('Failed to place COD request', 'COD ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ') })); return }
      const order = extractOrderResponse(payload)
      if (!order?.id) { setCodErrors((c) => ({ ...c, form: t('Order was created but confirmation could not be loaded.', 'ಆರ್ಡರ್ ರಚಿಸಲಾಗಿದೆ ಆದರೆ ದೃಢೀಕರಣವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.') })); return }
      setShowCodModal(false)
      setCodOrderData({ listingId: '', quantityKg: 0, customer: createEmptyCustomerDetails(session?.user?.name || '') })
      setCodErrors({})
      router.push(`/orders/${order.id}`)
    } catch { setCodErrors((c) => ({ ...c, form: t('Failed to place COD request', 'COD ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ') }))
    } finally { setSubmittingCod(false) }
  }

  async function handleOpenConversation(listing: RawListing, withIntro: boolean) {
    if (!listing.sellerId) { alert(t('Seller details unavailable', 'ಮಾರಾಟಗಾರ ವಿವರಗಳು ಲಭ್ಯವಿಲ್ಲ')); return }
    try {
      await sendMarketplaceMessage({
        recipientId: listing.sellerId,
        listingId: listing.id,
        listingName: listing.commodity,
        kind: 'raw',
        action: withIntro ? 'contact' : 'message',
        router,
        details: {
          pricePerKg: listing.pricePerKg,
          pricePerBag: listing.pricePerKg * 50,
          quantityKg: listing.quantityKg,
          location: listing.location,
          grade: listing.grade ?? undefined,
        },
      })
    } catch { alert(t('Failed to connect with seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಲು ವಿಫಲವಾಗಿದೆ')) }
  }

  return (
    <div className="space-y-4">
      {/* Mobile commodity filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden scrollbar-hide -mx-4 px-4">
        <button onClick={() => setFilters({ ...filters, commodity: undefined })} className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-all ${!filters.commodity ? 'bg-emerald-700 text-white shadow-md' : isDark ? 'bg-white/10 text-[#d8c8b3]' : 'bg-white border border-black/10 text-[#2f2f2f]'}`}>
          {t('All', 'ಎಲ್ಲ')}
        </button>
        {RAW_COMMODITIES.map(c => (
          <button key={c} onClick={() => setFilters({ ...filters, commodity: c })} className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-all ${filters.commodity === c ? 'bg-emerald-700 text-white shadow-md' : isDark ? 'bg-white/10 text-[#d8c8b3]' : 'bg-white border border-black/10 text-[#2f2f2f]'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="flex gap-6 lg:gap-8">
        {/* Filters Sidebar — desktop only */}
        <aside className="hidden lg:block w-64 flex-shrink-0 fade-in">
          <div className={`glass rounded-2xl shadow-lg p-6 sticky top-36 border ${isDark ? 'border-emerald-200/30' : 'border-black/10'}`}>
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              <h2 className="font-semibold text-lg text-brand-spectrum">{t('Filters', 'ಫಿಲ್ಟರ್‌ಗಳು')}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-[#dbcdbb]' : 'text-[#2f2f2f]'}`}>{t('Commodity', 'ವಸ್ತು')}</label>
                <select className="lux-input w-full rounded-xl px-3 py-2.5 transition-all text-sm" value={filters.commodity || ''} onChange={(e) => setFilters({ ...filters, commodity: e.target.value || undefined })}>
                  <option value="">{t('All Commodities', 'ಎಲ್ಲಾ ವಸ್ತುಗಳು')}</option>
                  {RAW_COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-[#dbcdbb]' : 'text-[#2f2f2f]'}`}>{t('Location', 'ಸ್ಥಳ')}</label>
                <input type="text" className="lux-input w-full rounded-xl px-3 py-2.5 transition-all text-sm" placeholder={t('City or region', 'ನಗರ ಅಥವಾ ಪ್ರದೇಶ')} value={filters.location || ''} onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })} />
              </div>
              <button onClick={() => setFilters({})} className="w-full text-sm lux-btn-primary px-4 py-2.5 rounded-xl font-semibold hover:shadow-lg transition-all">{t('Clear Filters', 'ಫಿಲ್ಟರ್ ತೆರವು')}</button>
            </div>
            <div className="mt-6 pt-6 border-t border-emerald-200/25 text-center">
              <p className="text-2xl font-bold text-emerald-600">{listings.length}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Active Listings', 'ಸಕ್ರಿಯ ಲಿಸ್ಟಿಂಗ್‌ಗಳು')}</p>
            </div>
          </div>
        </aside>

        {/* Listings grid */}
        <main className="flex-1 min-w-0">
          <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 slide-in-up">
            <p className={`text-sm font-medium ${isDark ? 'text-[#c8bca9]' : 'text-[#6b6b6b]'}`}>
              {loading ? t('Loading...', 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...') : `${listings.length} ${listings.length === 1 ? t('listing', 'ಲಿಸ್ಟಿಂಗ್') : t('listings', 'ಲಿಸ್ಟಿಂಗ್‌ಗಳು')} ${t('found', 'ಕಂಡುಬಂದವು')}`}
            </p>
            {isAdmin && (
              <button onClick={() => { setCreateError(null); setShowCreateModal(true) }} className="lux-btn-primary px-6 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('Add Listing', 'ಲಿಸ್ಟಿಂಗ್ ಸೇರಿಸಿ')}
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-16 glass rounded-2xl shadow-xl">
              <div className="flex justify-center gap-2 mb-4">{[0, 150, 300].map(d => <div key={d} className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
              <p className={`font-medium text-sm ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Loading marketplace...', 'ಮಾರುಕಟ್ಟೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
            </div>
          ) : loadError ? (
            <div className="text-center py-12 glass rounded-2xl shadow-xl fade-in">
              <p className="text-base font-semibold text-red-600">{loadError}</p>
              <button onClick={fetchListings} className="mt-4 surface-app-button-secondary rounded-xl px-5 py-2.5 font-semibold text-sm">{t('Retry', 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ')}</button>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 glass rounded-2xl shadow-xl fade-in">
              <div className="w-16 h-16 mx-auto mb-4 p-4 rounded-full gradient-emerald-coffee flex items-center justify-center">
                <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-2 text-card-strong">{t('No Listings Yet', 'ಇನ್ನೂ ಲಿಸ್ಟಿಂಗ್‌ಗಳಿಲ್ಲ')}</h3>
              <p className={`mb-4 text-sm ${isDark ? 'text-[#bbae9a]' : 'text-[#4a4a4a]'}`}>{t('New listings coming soon.', 'ಹೊಸ ಲಿಸ್ಟಿಂಗ್‌ಗಳು ಶೀಘ್ರದಲ್ಲಿ ಬರುತ್ತವೆ.')}</p>
              {isAdmin && <button onClick={() => setShowCreateModal(true)} className="lux-btn-primary px-6 py-2.5 rounded-xl font-semibold shadow-lg hover:scale-105 transition-all text-sm">{t('Create First Listing', 'ಮೊದಲ ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಿ')}</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {listings.map((listing, idx) => {
                const pricePerBag = listing.pricePerKg * 50
                return (
                  <div key={listing.id} className="surface-card rounded-2xl shadow hover:shadow-xl transition-all overflow-hidden card-hover fade-in flex flex-col" style={{ animationDelay: `${idx * 100}ms` }}>
                    {/* Top accent strip + commodity badge */}
                    <div className="h-2 w-full bg-gradient-to-r from-emerald-500 to-teal-400 flex-shrink-0" />
                    <div className="p-4 flex flex-col flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-base sm:text-lg text-card-strong leading-snug">{listing.commodity}</h3>
                        {listing.grade && <span className="flex-shrink-0 gradient-brand-spectrum text-white text-[10px] px-2.5 py-0.5 rounded-full font-semibold shadow">{listing.grade}</span>}
                      </div>
                      <p className="text-xs text-muted-safe mb-3">📍 {listing.location}</p>

                      {/* Price per bag (prominent) */}
                      <div className={`rounded-xl px-4 py-3 mb-2 ${isDark ? 'bg-emerald-900/30 border border-emerald-700/40' : 'bg-emerald-50 border border-emerald-200'}`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-0.5">{t('Price per 50 kg bag', '50 ಕೆಜಿ ಚೀಲಕ್ಕೆ ಬೆಲೆ')}</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">₹{pricePerBag.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-muted-safe mt-0.5">₹{listing.pricePerKg}/kg</p>
                      </div>

                      {/* Coffee variant row */}
                      <div className={`flex items-center justify-between py-1.5 px-3 rounded-xl mb-2 ${isDark ? 'bg-amber-900/30' : 'bg-amber-50 border border-amber-200/60'}`}>
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">☕ {listing.commodity}</span>
                        <span className="text-xs font-medium text-muted-safe">{listing.quantityKg.toLocaleString('en-IN')} kg {t('available', 'ಲಭ್ಯ')}</span>
                      </div>

                      {/* Seller row */}
                      <div className="flex items-center gap-2 text-xs text-muted-safe mb-3 px-1">
                        <div className="w-6 h-6 rounded-full gradient-coffee-cream flex items-center justify-center text-white font-bold text-[10px]">{listing.seller?.name?.[0]?.toUpperCase() || 'S'}</div>
                        <span className="font-medium">{listing.seller?.name || t('Korana Estate', 'ಕೊರಾನಾ ಎಸ್ಟೇಟ್')}</span>
                      </div>

                      {listing.description && <p className="text-xs mb-3 line-clamp-2 text-muted-safe">{listing.description}</p>}

                      {/* Actions */}
                      <div className="mt-auto space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => { setSelectedListing(listing); setOfferData({ offerPrice: listing.pricePerKg, quantity: Math.min(50, listing.quantityKg), message: '' }); setShowOfferModal(true) }} className="w-full gradient-coffee-cream text-white py-2.5 rounded-xl font-semibold text-sm shadow hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {t('Make Offer', 'ಆಫರ್ ಮಾಡಿ')}
                          </button>
                          <button onClick={() => { setSelectedListing(listing); setCodOrderData({ listingId: listing.id, quantityKg: Math.min(50, listing.quantityKg), customer: createEmptyCustomerDetails(session?.user?.name || '') }); setCodErrors({}); setShowCodModal(true) }} className="w-full gradient-brand-spectrum text-white py-2.5 rounded-xl font-semibold text-sm shadow hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            {t('Buy Now', 'ಈಗ ಖರೀದಿ')}
                          </button>
                        </div>
                        <button onClick={() => handleOpenConversation(listing, true)} className="w-full lux-btn-secondary py-2 rounded-xl font-semibold transition-all text-sm flex items-center justify-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          {t('Contact Seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ')}
                        </button>
                        {isAdmin && (
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setEditingListing(listing); setEditListingData({ commodity: listing.commodity, grade: listing.grade ?? '', quantityKg: listing.quantityKg, pricePerKg: listing.pricePerKg, location: listing.location, description: listing.description ?? '' }); setEditListingError(null); setShowEditListingModal(true) }} className="py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/30 dark:hover:bg-emerald-900/40 transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              {t('Edit', 'ತಿದ್ದು')}
                            </button>
                            <button onClick={() => handleDeleteListing(listing.id, listing.commodity)} className="py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/30 dark:hover:bg-red-900/40 transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              {t('Delete', 'ಅಳಿಸಿ')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Edit Listing Modal */}
      {showEditListingModal && editingListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl slide-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40"><svg className="w-5 h-5 text-emerald-700 dark:text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">{t('Edit Listing', 'ಲಿಸ್ಟಿಂಗ್ ತಿದ್ದು')}</h2>
            </div>
            <form onSubmit={handleEditListing} className="space-y-4">
              {editListingError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{editListingError}</div>}
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Commodity', 'ವಸ್ತು')} *</label><select required className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" value={editListingData.commodity} onChange={(e) => setEditListingData({ ...editListingData, commodity: e.target.value })}>{RAW_COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Grade (optional)', 'ಗ್ರೇಡ್ (ಐಚ್ಛಿಕ)')}</label><input type="text" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" placeholder={t('e.g., A, AA, Premium', 'ಉದಾ., A, AA, ಪ್ರೀಮಿಯಂ')} value={editListingData.grade || ''} onChange={(e) => setEditListingData({ ...editListingData, grade: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Quantity (kg)', 'ಪ್ರಮಾಣ (ಕೆಜಿ)')} *</label><input required type="number" min="0.1" step="0.1" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" value={editListingData.quantityKg || ''} onChange={(e) => setEditListingData({ ...editListingData, quantityKg: parseFloat(e.target.value) })} /></div>
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Price (₹/kg)', 'ಬೆಲೆ (₹/ಕೆಜಿ)')} *</label><input required type="number" min="1" step="1" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" value={editListingData.pricePerKg || ''} onChange={(e) => setEditListingData({ ...editListingData, pricePerKg: parseFloat(e.target.value) })} /></div>
              </div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Location', 'ಸ್ಥಳ')} *</label><input required type="text" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" value={editListingData.location} onChange={(e) => setEditListingData({ ...editListingData, location: e.target.value })} /></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Description (optional)', 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)')}</label><textarea className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" rows={3} value={editListingData.description || ''} onChange={(e) => setEditListingData({ ...editListingData, description: e.target.value })} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditListingModal(false); setEditingListing(null) }} className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all">{t('Cancel', 'ರದ್ದುಮಾಡಿ')}</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">{t('Save Changes', 'ಬದಲಾವಣೆ ಉಳಿಸಿ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Listing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl slide-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl gradient-coffee-cream"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">{t('Create New Listing', 'ಹೊಸ ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಿ')}</h2>
            </div>
            <form onSubmit={handleCreateListing} className="space-y-4">
              {createError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{createError}</div>}
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Commodity', 'ವಸ್ತು')} *</label><select required className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" value={formData.commodity} onChange={(e) => setFormData({ ...formData, commodity: e.target.value })}>{RAW_COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Grade (optional)', 'ಗ್ರೇಡ್ (ಐಚ್ಛಿಕ)')}</label><input type="text" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" placeholder={t('e.g., A, AA, Premium', 'ಉದಾ., A, AA, ಪ್ರೀಮಿಯಂ')} value={formData.grade || ''} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Quantity (kg)', 'ಪ್ರಮಾಣ (ಕೆಜಿ)')} *</label><input required type="number" min="0.1" step="0.1" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" value={formData.quantityKg || ''} onChange={(e) => setFormData({ ...formData, quantityKg: parseFloat(e.target.value) })} /></div>
                <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Price (₹/kg)', 'ಬೆಲೆ (₹/ಕೆಜಿ)')} *</label><input required type="number" min="1" step="1" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" value={formData.pricePerKg || ''} onChange={(e) => setFormData({ ...formData, pricePerKg: parseFloat(e.target.value) })} /></div>
              </div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Location', 'ಸ್ಥಳ')} *</label><input required type="text" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" placeholder={t('City or region', 'ನಗರ ಅಥವಾ ಪ್ರದೇಶ')} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} /></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Description (optional)', 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)')}</label><textarea className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" rows={3} placeholder={t('Additional details...', 'ಹೆಚ್ಚುವರಿ ವಿವರಗಳು...')} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all">{t('Cancel', 'ರದ್ದುಮಾಡಿ')}</button>
                <button type="submit" disabled={!isAdmin} className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">{t('Create Listing', 'ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಿ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Make Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-lg w-full p-4 sm:p-8 shadow-2xl slide-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl gradient-coffee-cream"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              <div><h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">{t('Make an Offer', 'ಆಫರ್ ನೀಡಿ')}</h2><p className="text-muted-safe text-sm">{selectedListing.commodity} · {selectedListing.location}</p></div>
            </div>
            <form onSubmit={handleMakeOffer} className="space-y-4">
              <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-white/10 border-emerald-500/30' : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'}`}>
                <p className="text-xs font-medium text-muted-safe mb-1">{t("Seller's Asking Price", 'ಮಾರಾಟಗಾರರ ಕೇಳುವ ಬೆಲೆ')}</p>
                <p className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>₹{selectedListing.pricePerKg}/kg</p>
              </div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Your Offer Price (₹/kg)', 'ನಿಮ್ಮ ಆಫರ್ ಬೆಲೆ (₹/ಕೆಜಿ)')} *</label><input required type="number" min="1" step="1" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-lg font-semibold" value={offerData.offerPrice || ''} onChange={(e) => setOfferData({ ...offerData, offerPrice: parseFloat(e.target.value) })} /></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Quantity (kg)', 'ಪ್ರಮಾಣ (ಕೆಜಿ)')} *</label><input required type="number" min="0.1" max={selectedListing.quantityKg} step="0.1" className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-lg font-semibold" value={offerData.quantity || ''} onChange={(e) => setOfferData({ ...offerData, quantity: parseFloat(e.target.value) })} /><p className="text-xs text-muted-safe mt-1">{t('Available', 'ಲಭ್ಯ')}: {selectedListing.quantityKg} kg</p></div>
              <div><label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Message (optional)', 'ಸಂದೇಶ (ಐಚ್ಛಿಕ)')}</label><textarea className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all" rows={3} placeholder={t('Add a message to the seller...', 'ಮಾರಾಟಗಾರರಿಗೆ ಸಂದೇಶ ಸೇರಿಸಿ...')} value={offerData.message} onChange={(e) => setOfferData({ ...offerData, message: e.target.value })} /></div>
              <div className="p-4 rounded-xl gradient-emerald-coffee"><p className="text-white/80 text-xs mb-1">{t('Total Offer Amount', 'ಒಟ್ಟು ಆಫರ್ ಮೊತ್ತ')}</p><p className="text-2xl font-bold text-white">₹{(offerData.offerPrice * offerData.quantity).toFixed(2)}</p></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOfferModal(false)} className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all">{t('Cancel', 'ರದ್ದುಮಾಡಿ')}</button>
                <button type="submit" className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all">{t('Submit Offer', 'ಆಫರ್ ಸಲ್ಲಿಸಿ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COD Order Modal */}
      {showCodModal && selectedListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-4xl w-full p-4 sm:p-8 shadow-2xl slide-in-up max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl gradient-brand-spectrum"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div>
              <div><h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">{t('Confirm COD Request', 'COD ವಿನಂತಿ ದೃಢೀಕರಿಸಿ')}</h2><p className="text-muted-safe text-sm">{selectedListing.commodity}{selectedListing.grade ? ` · ${selectedListing.grade}` : ''}</p></div>
            </div>
            <form noValidate onSubmit={handlePlaceCodOrder} className="space-y-5">
              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-app-strong">{selectedListing.commodity}</h3>{selectedListing.grade && <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">{selectedListing.grade}</span>}</div>
                    <p className="mt-1 text-sm text-app-muted">{selectedListing.seller?.name ? `${t('Seller', 'ಮಾರಾಟಗಾರ')}: ${selectedListing.seller.name}` : t('Seller details available after confirmation', 'ಮಾರಾಟಗಾರರ ವಿವರಗಳು ದೃಢೀಕರಣದ ನಂತರ ಲಭ್ಯವಾಗುತ್ತವೆ')}</p>
                    <p className="mt-0.5 text-xs text-app-soft">📍 {selectedListing.location || t('Location not specified', 'ಸ್ಥಳ ನಮೂದಿಸಲಾಗಿಲ್ಲ')}</p>
                  </div>
                  <div className="grid gap-2 min-w-[200px]">
                    <div className="surface-app-panel-soft rounded-xl p-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-soft">{t('Price', 'ಬೆಲೆ')}</p><p className="mt-1 text-xl font-bold text-app-strong">₹{selectedListing.pricePerKg}/kg</p></div>
                    <div className="surface-app-panel-soft rounded-xl p-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-soft">{t('Available', 'ಲಭ್ಯ')}</p><p className="mt-1 text-xl font-bold text-app-strong">{selectedListing.quantityKg} kg</p></div>
                  </div>
                </div>
              </section>
              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-base font-bold text-app-strong">{t('Order details', 'ಆರ್ಡರ್ ವಿವರಗಳು')}</h3>
                  <div className="surface-app-chip rounded-full px-3 py-1.5 text-xs font-semibold">CASH ON DELIVERY</div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Quantity (kg)', 'ಪ್ರಮಾಣ (ಕೆಜಿ)')} *</label>
                    <input type="number" min="0.1" max={selectedListing.quantityKg} step="0.1" className="surface-app-input w-full rounded-xl px-4 py-3 text-lg font-semibold" value={codOrderData.quantityKg || ''} onChange={(e) => { const v = Number(e.target.value); setCodOrderData({ ...codOrderData, quantityKg: Number.isFinite(v) ? v : 0 }); setCodErrors((c) => ({ ...c, quantityKg: undefined, form: undefined })) }} />
                    <p className="mt-1.5 text-xs text-app-soft">{t('Available', 'ಲಭ್ಯ')}: {selectedListing.quantityKg} kg</p>
                    {codErrors.quantityKg && <p className="mt-1.5 text-sm font-medium text-red-600">{codErrors.quantityKg}</p>}
                  </div>
                  <div className="surface-app-panel-soft rounded-xl p-4">
                    <p className="text-sm font-semibold text-app-strong">CASH ON DELIVERY</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between text-app-muted"><span>{t('Price per kg', 'ಪ್ರತಿ ಕೆಜಿ ಬೆಲೆ')}</span><span className="font-semibold text-app-body">₹{selectedListing.pricePerKg}</span></div>
                      <div className="flex justify-between text-app-muted"><span>{t('Quantity', 'ಪ್ರಮಾಣ')}</span><span className="font-semibold text-app-body">{codOrderData.quantityKg || 0} kg</span></div>
                      <div className="flex justify-between border-t border-zinc-200/80 pt-2.5 text-app-body dark:border-white/10"><span className="font-semibold">{t('Estimated total', 'ಅಂದಾಜು ಒಟ್ಟು')}</span><span className="text-lg font-bold">₹{((codOrderData.quantityKg || 0) * selectedListing.pricePerKg).toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              </section>
              <section className="surface-app-panel rounded-2xl p-5">
                <h3 className="text-base font-bold text-app-strong">{t('Buyer details', 'ಖರೀದಿದಾರರ ವಿವರಗಳು')}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Full name', 'ಪೂರ್ಣ ಹೆಸರು')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={codOrderData.customer.fullName} onChange={(e) => { setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, fullName: e.target.value } }); setCodErrors((c) => ({ ...c, fullName: undefined, form: undefined })) }} />{codErrors.fullName && <p className="mt-1.5 text-sm font-medium text-red-600">{codErrors.fullName}</p>}</div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" inputMode="numeric" maxLength={10} value={codOrderData.customer.mobileNumber} onChange={(e) => { setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) } }); setCodErrors((c) => ({ ...c, mobileNumber: undefined, form: undefined })) }} />{codErrors.mobileNumber && <p className="mt-1.5 text-sm font-medium text-red-600">{codErrors.mobileNumber}</p>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-semibold text-app-body mb-2">{t('Delivery address', 'ವಿತರಣಾ ವಿಳಾಸ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={codOrderData.customer.addressLine1} onChange={(e) => { setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, addressLine1: e.target.value } }); setCodErrors((c) => ({ ...c, addressLine1: undefined, form: undefined })) }} />{codErrors.addressLine1 && <p className="mt-1.5 text-sm font-medium text-red-600">{codErrors.addressLine1}</p>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-semibold text-app-body mb-2">{t('Address line 2', 'ವಿಳಾಸ ಸಾಲು 2')}</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={codOrderData.customer.addressLine2 || ''} onChange={(e) => setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, addressLine2: e.target.value } })} /></div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Landmark', 'ಲ್ಯಾಂಡ್‌ಮಾರ್ಕ್')}</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={codOrderData.customer.landmark || ''} onChange={(e) => setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, landmark: e.target.value } })} /></div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('City / town', 'ನಗರ / ಪಟ್ಟಣ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={codOrderData.customer.city} onChange={(e) => { setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, city: e.target.value } }); setCodErrors((c) => ({ ...c, city: undefined, form: undefined })) }} />{codErrors.city && <p className="mt-1.5 text-sm font-medium text-red-600">{codErrors.city}</p>}</div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('State', 'ರಾಜ್ಯ')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" value={codOrderData.customer.state} onChange={(e) => { setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, state: e.target.value } }); setCodErrors((c) => ({ ...c, state: undefined, form: undefined })) }} />{codErrors.state && <p className="mt-1.5 text-sm font-medium text-red-600">{codErrors.state}</p>}</div>
                  <div><label className="block text-sm font-semibold text-app-body mb-2">{t('Pincode', 'ಪಿನ್‌ಕೋಡ್')} *</label><input className="surface-app-input w-full rounded-xl px-4 py-3" inputMode="numeric" maxLength={6} value={codOrderData.customer.pincode} onChange={(e) => { setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) } }); setCodErrors((c) => ({ ...c, pincode: undefined, form: undefined })) }} />{codErrors.pincode && <p className="mt-1.5 text-sm font-medium text-red-600">{codErrors.pincode}</p>}</div>
                  <div className="md:col-span-2"><label className="block text-sm font-semibold text-app-body mb-2">{t('Buyer note', 'ಖರೀದಿದಾರರ ಟಿಪ್ಪಣಿ')}</label><textarea className="surface-app-input w-full rounded-xl px-4 py-3" rows={3} value={codOrderData.customer.orderNote || ''} onChange={(e) => setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, orderNote: e.target.value } })} /></div>
                </div>
              </section>
              {codErrors.form && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{codErrors.form}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => !submittingCod && setShowCodModal(false)} className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all">{t('Cancel', 'ರದ್ದುಮಾಡಿ')}</button>
                <button type="submit" disabled={submittingCod} className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:cursor-not-allowed disabled:opacity-70">{submittingCod ? t('Submitting...', 'ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...') : t('Confirm COD Request', 'COD ವಿನಂತಿ ದೃಢೀಕರಿಸಿ')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Marketplace Shell (tab switcher) ─────────────────────────────────────────
type MarketplaceTab = 'store' | 'raw'

function MarketplaceTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated: () => router.replace('/auth'),
  })
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()

  if (status === 'loading') return null

  const tab = (searchParams.get('tab') ?? 'store') as MarketplaceTab

  function setTab(newTab: MarketplaceTab) {
    router.replace(`/marketplace?tab=${newTab}`, { scroll: false })
  }

  const tabConfig = [
    {
      id: 'store' as const,
      label: t('Processed Products', 'ಸಂಸ್ಕರಿಸಿದ ಉತ್ಪನ್ನಗಳು'),
      sublabel: t('Coffee powder, roasted beans, spices & gift packs', 'ಕಾಫಿ ಪುಡಿ, ಹುರಿದ ಬೀಜಗಳು, ಮಸಾಲೆ & ಗಿಫ್ಟ್ ಪ್ಯಾಕ್'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      id: 'raw' as const,
      label: t('Raw Commodities', 'ಕಚ್ಚಾ ವಸ್ತುಗಳು'),
      sublabel: t('Farm-gate coffee, pepper, cardamom & arecanut', 'ಫಾರ್ಮ್‌ನಿಂದ ಕಾಫಿ, ಮೆಣಸು, ಏಲಕ್ಕಿ & ಅಡಿಕೆ'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        {/* Page header */}
        <div className="mb-6 pt-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-spectrum">{t('Marketplace', 'ಮಾರುಕಟ್ಟೆ')}</h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-[#c8bca9]' : 'text-[#6b6b6b]'}`}>
            {t('Korana Estate · Coffee, spices & farm produce', 'ಕೊರಾನಾ ಎಸ್ಟೇಟ್ · ಕಾಫಿ, ಮಸಾಲೆ & ಕೃಷಿ ಉತ್ಪನ್ನ')}
          </p>
        </div>

        {/* Tab switcher */}
        <div className={`rounded-2xl p-1.5 mb-6 border flex gap-1.5 ${isDark ? 'bg-[#111]/60 border-white/10' : 'bg-black/5 border-black/8'}`}>
          {tabConfig.map(tc => (
            <button
              key={tc.id}
              onClick={() => setTab(tc.id)}
              className={`flex-1 flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 font-semibold text-sm transition-all duration-200 ${
                tab === tc.id
                  ? isDark
                    ? 'bg-emerald-800/80 text-white shadow-md'
                    : 'bg-white text-emerald-800 shadow-md'
                  : isDark
                    ? 'text-[#c8bca9] hover:text-white hover:bg-white/8'
                    : 'text-[#6b6b6b] hover:text-[#2f2f2f] hover:bg-white/60'
              }`}
            >
              <span className={tab === tc.id ? 'text-emerald-400' : ''}>{tc.icon}</span>
              <span className="hidden sm:inline">{tc.label}</span>
              <span className="sm:hidden">{tc.id === 'store' ? t('Store', 'ಸ್ಟೋರ್') : t('Raw', 'ರಾ')}</span>
            </button>
          ))}
        </div>

        {/* Active tab sublabel */}
        <p className={`text-xs mb-4 ${isDark ? 'text-[#9e8e7a]' : 'text-[#8b8b8b]'}`}>
          {tabConfig.find(tc => tc.id === tab)?.sublabel}
        </p>

        {/* Tab content */}
        {tab === 'store' ? <StoreTab key="store" /> : <RawTab key="raw" />}
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense>
      <MarketplaceTabs />
    </Suspense>
  )
}
