import assert from 'node:assert/strict'

const WEB_BASE = process.env.SMOKE_WEB_BASE || 'http://localhost:3000'
const API_BASE = process.env.SMOKE_API_BASE || 'http://localhost:4000/api/v1'
const RUN_ID = `${Date.now()}`
const PASSWORD = 'Test@12345'

const RAW_COMMODITIES = [
  'Arabica Cherry',
  'Arabica Parchment',
  'Robusta Cherry',
  'Robusta Parchment',
  'Cardamom',
  'Arecanut',
  'Pepper',
]

const STORE_CATEGORIES = [
  'Coffee Powder',
  'Roasted Beans',
  'Pepper Powder',
  'Cardamom Powder',
  'Ground Spices',
  'Gift Packs',
]

const ESTATE_CASES = [
  { category: 'Fertilizer', listingType: 'Product', unit: 'per_bag' },
  { category: 'Manure', listingType: 'Product', unit: 'per_bag' },
  { category: 'Pesticide', listingType: 'Product', unit: 'per_item' },
  { category: 'Labor', listingType: 'Service', unit: 'per_day' },
  { category: 'Worker', listingType: 'Service', unit: 'per_day' },
  { category: 'Workers', listingType: 'Service', unit: 'per_day' },
  { category: 'Machinery', listingType: 'Service', unit: 'per_day' },
  { category: 'Vehicle Service', listingType: 'Service', unit: 'fixed' },
  { category: 'Pick-Up and other Vehicle services', listingType: 'Service', unit: 'fixed' },
  { category: 'Tools', listingType: 'Product', unit: 'per_item' },
  { category: 'Irrigation', listingType: 'Product', unit: 'per_item' },
  { category: 'Estate Equipments', listingType: 'Product', unit: 'per_item' },
]

class CookieJar {
  constructor() {
    this.cookies = new Map()
  }

  addFromResponse(response) {
    const setCookie = response.headers.getSetCookie?.() ?? []
    for (const header of setCookie) {
      const [pair] = header.split(';', 1)
      const idx = pair.indexOf('=')
      if (idx <= 0) continue
      const name = pair.slice(0, idx)
      const value = pair.slice(idx + 1)
      if (!value) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }
}

async function request(url, options = {}, jar) {
  const headers = new Headers(options.headers || {})
  if (jar) {
    const cookie = jar.header()
    if (cookie) headers.set('cookie', cookie)
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual',
  })

  if (jar) jar.addFromResponse(response)
  return response
}

async function readJson(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : {}
}

async function getCsrfToken(jar) {
  const res = await request(`${WEB_BASE}/api/auth/csrf`, {}, jar)
  assert.equal(res.status, 200, 'csrf endpoint should succeed')
  const data = await readJson(res)
  assert.ok(data.csrfToken, 'csrf token missing')
  return data.csrfToken
}

async function signUp(email, name) {
  const res = await request(`${WEB_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password: PASSWORD }),
  })
  assert.equal(res.status, 201, `signup failed for ${email}`)
  const data = await readJson(res)
  assert.equal(data.user.email, email)
}

async function signIn(email, password, jar, expectedStatuses = [200, 302]) {
  const csrf = await getCsrfToken(jar)
  const body = new URLSearchParams({
    csrfToken: csrf,
    email,
    password,
    callbackUrl: `${WEB_BASE}/`,
    json: 'true',
  })
  const res = await request(`${WEB_BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, jar)
  assert.ok(expectedStatuses.includes(res.status), `sign in returned ${res.status}`)
  return res
}

async function getSession(jar) {
  const res = await request(`${WEB_BASE}/api/auth/session`, {}, jar)
  assert.equal(res.status, 200, 'session request failed')
  return readJson(res)
}

async function signOut(jar) {
  const csrf = await getCsrfToken(jar)
  const body = new URLSearchParams({
    csrfToken: csrf,
    callbackUrl: `${WEB_BASE}/auth`,
    json: 'true',
  })
  const res = await request(`${WEB_BASE}/api/auth/signout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }, jar)
  assert.ok([200, 302].includes(res.status), `sign out returned ${res.status}`)
}

async function backendLogin(email) {
  const res = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  assert.equal(res.status, 200, `backend login failed for ${email}`)
  return readJson(res)
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

async function checkPage(path, jar, label) {
  const res = await request(`${WEB_BASE}${path}`, {}, jar)
  assert.equal(res.status, 200, `${label} page should render`)
}

async function main() {
  const buyerEmail = `smoke.buyer.${RUN_ID}@example.com`
  const sellerEmail = `smoke.seller.${RUN_ID}@example.com`

  const buyerJar = new CookieJar()
  const sellerJar = new CookieJar()

  console.log('[smoke] auth signup')
  await signUp(buyerEmail, 'Smoke Buyer')
  await signUp(sellerEmail, 'Smoke Seller')

  console.log('[smoke] auth invalid login')
  const invalidJar = new CookieJar()
  await signIn(buyerEmail, 'WrongPass#1', invalidJar, [401])
  const invalidSession = await getSession(invalidJar)
  assert.ok(!invalidSession?.user, 'invalid login should not create session')

  console.log('[smoke] auth login + session persistence')
  await signIn(buyerEmail, PASSWORD, buyerJar)
  await signIn(sellerEmail, PASSWORD, sellerJar)
  const buyerSession = await getSession(buyerJar)
  const sellerSession = await getSession(sellerJar)
  assert.equal(buyerSession.user?.email, buyerEmail)
  assert.equal(sellerSession.user?.email, sellerEmail)

  console.log('[smoke] protected route unauthorized')
  const unauthorized = await request(`${WEB_BASE}/api/raw/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commodity: 'Arabica Cherry', quantityKg: 10, pricePerKg: 320, location: 'Kodagu' }),
  })
  assert.equal(unauthorized.status, 401)

  console.log('[smoke] backend auth for homestays')
  const sellerBackend = await backendLogin(sellerEmail)
  const homestayRes = await request(`${API_BASE}/home-stays`, {
    method: 'POST',
    headers: {
      ...authHeader(sellerBackend.accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `Smoke Homestay ${RUN_ID}`,
      description: 'Smoke-created homestay for listing verification',
      location: 'Madikeri',
      pricePerNight: 3200,
    }),
  })
  assert.equal(homestayRes.status, 201, 'homestay create should succeed')
  const homestay = await readJson(homestayRes)
  assert.ok(homestay.id, 'homestay id missing')

  console.log('[smoke] raw marketplace all commodities')
  const rawListingIds = []
  for (const commodity of RAW_COMMODITIES) {
    const res = await request(`${WEB_BASE}/api/raw/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commodity,
        grade: 'A',
        quantityKg: 100 + rawListingIds.length,
        pricePerKg: 300 + rawListingIds.length * 5,
        location: 'Kodagu',
        description: `Smoke listing for ${commodity}`,
      }),
    }, sellerJar)
    assert.equal(res.status, 201, `raw listing create failed for ${commodity}`)
    const data = await readJson(res)
    rawListingIds.push(data.listing.id)

    const listRes = await request(`${WEB_BASE}/api/raw/listings?commodity=${encodeURIComponent(commodity)}`, {}, sellerJar)
    assert.equal(listRes.status, 200)
    const listData = await readJson(listRes)
    assert.ok(Array.isArray(listData.listings) && listData.listings.some((row) => row.id === data.listing.id))
  }

  console.log('[smoke] raw offers')
  const offerRes = await request(`${WEB_BASE}/api/raw/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listingId: rawListingIds[0],
      offerPrice: 315,
      quantity: 20,
      message: 'Smoke offer',
    }),
  }, buyerJar)
  assert.equal(offerRes.status, 201, 'raw offer should succeed')

  console.log('[smoke] estate essentials all supported categories')
  for (const [index, estateCase] of ESTATE_CASES.entries()) {
    const res = await request(`${WEB_BASE}/api/estate/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Smoke ${estateCase.category} ${RUN_ID}`,
        category: estateCase.category,
        listingType: estateCase.listingType,
        unit: estateCase.unit,
        price: 1000 + index * 25,
        quantity: estateCase.listingType === 'Product' ? 10 + index : null,
        location: 'Kodagu',
        description: `Smoke estate listing for ${estateCase.category}`,
        contactPhone: '9999999999',
      }),
    }, sellerJar)
    assert.equal(res.status, 201, `estate listing create failed for ${estateCase.category}`)
  }
  const estateListRes = await request(`${WEB_BASE}/api/estate/listings?limit=500`, {}, sellerJar)
  assert.equal(estateListRes.status, 200)
  const estateList = await readJson(estateListRes)
  for (const estateCase of ESTATE_CASES) {
    assert.ok(estateList.listings.some((row) => row.category === estateCase.category), `estate category missing: ${estateCase.category}`)
  }

  console.log('[smoke] store all supported categories')
  const productIds = []
  for (const [index, category] of STORE_CATEGORIES.entries()) {
    const res = await request(`${WEB_BASE}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Smoke ${category} ${RUN_ID}`,
        category,
        price: 200 + index * 50,
        stock: 25 + index,
        description: `Smoke product for ${category}`,
      }),
    }, sellerJar)
    assert.equal(res.status, 201, `store product create failed for ${category}`)
    const data = await readJson(res)
    productIds.push(data.product.id)

    const listRes = await request(`${WEB_BASE}/api/products?category=${encodeURIComponent(category)}`, {}, sellerJar)
    assert.equal(listRes.status, 200)
    const listData = await readJson(listRes)
    assert.ok(Array.isArray(listData.products) && listData.products.some((row) => row.id === data.product.id))
  }

  console.log('[smoke] store order')
  const orderRes = await request(`${WEB_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: productIds[0],
      quantity: 2,
      shippingAddress: 'Smoke Address, Madikeri',
      phone: '9999999999',
    }),
  }, buyerJar)
  assert.equal(orderRes.status, 201, 'store order should succeed')

  console.log('[smoke] messaging')
  const sellerSessionAfterCreate = await getSession(sellerJar)
  const conversationRes = await request(`${WEB_BASE}/api/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId: sellerSessionAfterCreate.user.id,
    }),
  }, buyerJar)
  assert.ok([200, 201].includes(conversationRes.status), 'conversation should be created or reused')
  const conversationData = await readJson(conversationRes)
  const conversationId = conversationData.id || conversationData.conversation?.id
  assert.ok(conversationId, 'conversation id missing')

  const messageText = `Smoke message ${RUN_ID}`
  const messageRes = await request(`${WEB_BASE}/api/chat/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      content: messageText,
    }),
  }, buyerJar)
  assert.equal(messageRes.status, 201, 'message should send')

  const messagesRes = await request(`${WEB_BASE}/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {}, buyerJar)
  assert.equal(messagesRes.status, 200)
  const messagesData = await readJson(messagesRes)
  const messageRows = Array.isArray(messagesData) ? messagesData : (messagesData.messages || [])
  assert.ok(messageRows.some((row) => row.content === messageText), 'message should persist in thread')

  const convosRes = await request(`${WEB_BASE}/api/chat/conversations`, {}, buyerJar)
  assert.equal(convosRes.status, 200)
  const convosData = await readJson(convosRes)
  const conversationRows = Array.isArray(convosData) ? convosData : (convosData.conversations || [])
  assert.ok(Array.isArray(conversationRows), 'conversations should load')

  console.log('[smoke] page loads')
  await checkPage('/auth', undefined, 'auth')
  await checkPage('/home-stays', undefined, 'home-stays')
  await checkPage(`/home-stays/${homestay.id}`, undefined, 'home-stay detail')
  await checkPage('/raw-marketplace', sellerJar, 'raw marketplace')
  await checkPage('/estate-marketplace', sellerJar, 'estate marketplace')
  await checkPage('/store', sellerJar, 'store')
  await checkPage(`/messages?conversationId=${encodeURIComponent(conversationId)}`, buyerJar, 'messages')

  console.log('[smoke] auth logout')
  await signOut(buyerJar)
  const signedOutSession = await getSession(buyerJar)
  assert.ok(!signedOutSession?.user, 'logout should clear session')

  console.log('[smoke] PASS')
}

main().catch((error) => {
  console.error('[smoke] FAIL', error)
  process.exit(1)
})
