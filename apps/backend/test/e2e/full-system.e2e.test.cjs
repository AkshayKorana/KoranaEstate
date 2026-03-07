const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const request = require('supertest')
const { io } = require('socket.io-client')
const { PrismaClient } = require('@prisma/client')

const API_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4000/api/v1'
const WS_BASE_URL = process.env.E2E_WS_URL || 'http://localhost:4000'
const prisma = new PrismaClient()

const stage = (name) => {
  // eslint-disable-next-line no-console
  console.log(`\n[E2E] ${name}`)
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

function loadEnvValue(key) {
  if (process.env[key]) return process.env[key]
  const envPath = path.resolve(__dirname, '../../.env')
  if (!fs.existsSync(envPath)) return ''
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const k = trimmed.slice(0, idx)
    if (k !== key) continue
    const raw = trimmed.slice(idx + 1).trim()
    return raw.replace(/^"/, '').replace(/"$/, '')
  }
  return ''
}

function makeEmail(prefix, runId) {
  return `${prefix}.${runId}@example.com`
}

function connectSocket(token) {
  return io(`${WS_BASE_URL}/chat`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token },
  })
}

function waitForConnect(socket, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), timeoutMs)
    socket.on('connect', () => {
      clearTimeout(timer)
      resolve()
    })
    socket.on('connect_error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })
}

function waitForEvent(socket, event, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

function emitWithAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (err, response) => {
      if (err) {
        reject(err)
        return
      }
      resolve(response)
    })
  })
}

async function registerUser(email, fullName, password, role) {
  const res = await request(API_BASE_URL).post('/auth/register').send({ email, fullName, password, role }).expect(201)
  expect(res.body.user.email).toBe(email)
  expect(res.body.accessToken).toBeTruthy()
  expect(res.body.refreshToken).toBeTruthy()
  return res.body
}

async function loginUser(email, password) {
  const res = await request(API_BASE_URL).post('/auth/login').send({ email, password }).expect(200)
  expect(res.body.user.email).toBe(email)
  expect(res.body.accessToken).toBeTruthy()
  expect(res.body.refreshToken).toBeTruthy()
  return res.body
}

describe('Full live-system E2E', () => {
  const runId = Date.now()
  const password = 'TestPass#12345'
  const webhookSecret = loadEnvValue('PAYMENT_WEBHOOK_SECRET')

  const state = {
    users: {
      buyer: { id: '', email: makeEmail('buyer', runId), fullName: 'E2E Buyer', accessToken: '', refreshToken: '' },
      seller: { id: '', email: makeEmail('seller', runId), fullName: 'E2E Seller', accessToken: '', refreshToken: '' },
      admin: { id: '', email: makeEmail('admin', runId), fullName: 'E2E Admin', accessToken: '', refreshToken: '' },
    },
    ids: {
      marketPriceIds: [],
      rawListingId: '',
      bidId: '',
      productId: '',
      orderAId: '',
      orderBId: '',
      paymentAId: '',
      paymentBId: '',
      payoutAId: '',
      payoutBId: '',
      disputeAId: '',
      reviewBId: '',
      sellerRatingId: '',
      conversationId: '',
      messageId: '',
      homeStayId: '',
      subscriptionId: '',
    },
    sockets: [],
  }

  beforeAll(async () => {
    stage(`Bootstrapping run id: ${runId}`)
  })

  afterAll(async () => {
    stage('Cleanup: deleting generated test data')
    for (const socket of state.sockets) {
      if (socket && socket.connected) socket.disconnect()
    }

    if (state.ids.marketPriceIds.length) {
      await prisma.marketPrice.deleteMany({ where: { id: { in: state.ids.marketPriceIds } } })
    }

    if (state.ids.messageId) {
      await prisma.message.deleteMany({ where: { id: state.ids.messageId } })
    }
    if (state.ids.conversationId) {
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: state.ids.conversationId } })
      await prisma.conversation.deleteMany({ where: { id: state.ids.conversationId } })
    }

    if (state.ids.bidId) {
      await prisma.bid.deleteMany({ where: { id: state.ids.bidId } })
    }
    if (state.ids.rawListingId) {
      await prisma.rawProduct.deleteMany({ where: { id: state.ids.rawListingId } })
    }

    if (state.ids.disputeAId) {
      await prisma.dispute.deleteMany({ where: { id: state.ids.disputeAId } })
    }
    if (state.ids.reviewBId) {
      await prisma.review.deleteMany({ where: { id: state.ids.reviewBId } })
    }
    if (state.ids.payoutAId || state.ids.payoutBId) {
      await prisma.payout.deleteMany({ where: { id: { in: [state.ids.payoutAId, state.ids.payoutBId].filter(Boolean) } } })
    }
    if (state.ids.paymentAId || state.ids.paymentBId) {
      await prisma.payment.deleteMany({
        where: { id: { in: [state.ids.paymentAId, state.ids.paymentBId].filter(Boolean) } },
      })
    }
    if (state.ids.orderAId || state.ids.orderBId) {
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: [state.ids.orderAId, state.ids.orderBId].filter(Boolean) } },
      })
      await prisma.order.deleteMany({ where: { id: { in: [state.ids.orderAId, state.ids.orderBId].filter(Boolean) } } })
    }

    if (state.ids.productId) {
      await prisma.retailProduct.deleteMany({ where: { id: state.ids.productId } })
    }

    if (state.ids.homeStayId) {
      await prisma.homeStay.deleteMany({ where: { id: state.ids.homeStayId } })
    }

    if (state.ids.subscriptionId) {
      await prisma.subscription.deleteMany({ where: { id: state.ids.subscriptionId } })
    }

    if (state.ids.sellerRatingId) {
      await prisma.sellerRating.deleteMany({ where: { id: state.ids.sellerRatingId } })
    }

    const userIds = [state.users.buyer.id, state.users.seller.id, state.users.admin.id].filter(Boolean)
    if (userIds.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }

    await prisma.$disconnect()
  })

  it('1) Health check: GET /health returns 200', async () => {
    stage('Health check')
    const res = await request(API_BASE_URL).get('/health').expect(200)
    expect(res.body.status).toBe('ok')
  })

  it('2) Auth flow: register/login/refresh/users/me', async () => {
    stage('Auth flow - register users')
    const sellerReg = await registerUser(state.users.seller.email, state.users.seller.fullName, password, 'SELLER')
    const buyerReg = await registerUser(state.users.buyer.email, state.users.buyer.fullName, password, 'BUYER')
    const adminReg = await registerUser(state.users.admin.email, state.users.admin.fullName, password, 'BUYER')

    state.users.seller.id = sellerReg.user.id
    state.users.buyer.id = buyerReg.user.id
    state.users.admin.id = adminReg.user.id

    await prisma.user.update({
      where: { id: state.users.admin.id },
      data: { role: 'ADMIN' },
    })

    stage('Auth flow - login users')
    const sellerLogin = await loginUser(state.users.seller.email, password)
    const buyerLogin = await loginUser(state.users.buyer.email, password)
    const adminLogin = await loginUser(state.users.admin.email, password)

    state.users.seller.accessToken = sellerLogin.accessToken
    state.users.seller.refreshToken = sellerLogin.refreshToken
    state.users.buyer.accessToken = buyerLogin.accessToken
    state.users.buyer.refreshToken = buyerLogin.refreshToken
    state.users.admin.accessToken = adminLogin.accessToken
    state.users.admin.refreshToken = adminLogin.refreshToken

    stage('Auth flow - refresh token')
    const refreshRes = await request(API_BASE_URL)
      .post('/auth/refresh')
      .send({ refreshToken: state.users.buyer.refreshToken })
      .expect(200)
    expect(refreshRes.body.accessToken).toBeTruthy()
    state.users.buyer.accessToken = refreshRes.body.accessToken
    state.users.buyer.refreshToken = refreshRes.body.refreshToken

    stage('Auth flow - users/me')
    const meRes = await request(API_BASE_URL)
      .get('/users/me')
      .set(authHeader(state.users.buyer.accessToken))
      .expect(200)
    expect(meRes.body.email).toBe(state.users.buyer.email)
    expect(meRes.body.id).toBe(state.users.buyer.id)
  })

  it('3) Home stays flow: create/list/get/owner delete protection', async () => {
    stage('Home stays - create listing')
    const createRes = await request(API_BASE_URL)
      .post('/home-stays')
      .set(authHeader(state.users.seller.accessToken))
      .send({
        title: `E2E Coffee Estate Stay ${runId}`,
        description: 'Automated E2E homestay listing',
        location: 'Chikmagalur',
        pricePerNight: 2200,
      })
      .expect(201)
    state.ids.homeStayId = createRes.body.id
    expect(createRes.body.ownerId).toBe(state.users.seller.id)

    stage('Home stays - list and get')
    const listRes = await request(API_BASE_URL).get('/home-stays').expect(200)
    expect(Array.isArray(listRes.body)).toBe(true)
    expect(listRes.body.some((row) => row.id === state.ids.homeStayId)).toBe(true)

    const getRes = await request(API_BASE_URL).get(`/home-stays/${state.ids.homeStayId}`).expect(200)
    expect(getRes.body.id).toBe(state.ids.homeStayId)

    stage('Home stays - buyer cannot delete owner listing')
    await request(API_BASE_URL)
      .delete(`/home-stays/${state.ids.homeStayId}`)
      .set(authHeader(state.users.buyer.accessToken))
      .expect(403)

    stage('Home stays - owner delete listing')
    await request(API_BASE_URL)
      .delete(`/home-stays/${state.ids.homeStayId}`)
      .set(authHeader(state.users.seller.accessToken))
      .expect(200)

    const fromDb = await prisma.homeStay.findUnique({ where: { id: state.ids.homeStayId } })
    expect(fromDb).toBeNull()
    state.ids.homeStayId = ''
  })

  it('4) Marketplace flow: create listing/fetch/place bid/verify DB', async () => {
    stage('Marketplace - create listing by seller')
    const listingRes = await request(API_BASE_URL)
      .post('/marketplace/listings')
      .set(authHeader(state.users.seller.accessToken))
      .send({
        title: `E2E Raw Listing ${runId}`,
        commodityType: 'COFFEE',
        commodityName: 'Arabica',
        grade: 'A',
        quantityKg: 300,
        pricePerKg: 350,
        description: 'Automated raw listing',
      })
      .expect(201)
    state.ids.rawListingId = listingRes.body.id
    expect(listingRes.body.sellerId).toBe(state.users.seller.id)

    stage('Marketplace - fetch listings')
    const listRes = await request(API_BASE_URL)
      .get('/marketplace/listings')
      .set(authHeader(state.users.buyer.accessToken))
      .expect(200)
    expect(Array.isArray(listRes.body)).toBe(true)
    expect(listRes.body.some((row) => row.id === state.ids.rawListingId)).toBe(true)

    stage('Marketplace - place bid by buyer')
    const bidRes = await request(API_BASE_URL)
      .post(`/marketplace/listings/${state.ids.rawListingId}/bids`)
      .set(authHeader(state.users.buyer.accessToken))
      .send({
        amountPerKg: 325,
        quantityKg: 100,
        note: 'Automated bid for e2e validation',
      })
      .expect(201)
    state.ids.bidId = bidRes.body.id
    expect(bidRes.body.rawProductId).toBe(state.ids.rawListingId)
    expect(bidRes.body.buyerId).toBe(state.users.buyer.id)

    const bidDb = await prisma.bid.findUnique({ where: { id: state.ids.bidId } })
    expect(bidDb).toBeTruthy()
    expect(bidDb.rawProductId).toBe(state.ids.rawListingId)
  })

  it('5) Store, order, payment, payout, review, dispute/admin flow', async () => {
    if (!webhookSecret) {
      throw new Error('PAYMENT_WEBHOOK_SECRET is required for payment webhook validation in E2E tests')
    }

    stage('Store - create product')
    const productRes = await request(API_BASE_URL)
      .post('/store/products')
      .set(authHeader(state.users.seller.accessToken))
      .send({
        title: `E2E Roast Beans ${runId}`,
        category: 'Coffee Powder',
        price: 640,
        stock: 40,
        description: 'E2E store product',
      })
      .expect(201)
    state.ids.productId = productRes.body.id

    const createPaidOrder = async (label) => {
      stage(`Orders - create order ${label}`)
      const orderRes = await request(API_BASE_URL)
        .post('/orders')
        .set(authHeader(state.users.buyer.accessToken))
        .send({
          items: [{ retailProductId: state.ids.productId, quantity: 2, unitPrice: 640 }],
          shippingAddress: `E2E Street ${label}`,
        })
        .expect(201)
      const orderId = orderRes.body.id

      stage(`Payments - create payment intent ${label}`)
      const paymentRes = await request(API_BASE_URL)
        .post('/payments')
        .set(authHeader(state.users.buyer.accessToken))
        .send({
          provider: 'RAZORPAY',
          orderId,
        })
        .expect(201)

      const paymentId = paymentRes.body.id
      const providerPaymentId = paymentRes.body.providerPaymentId

      stage(`Payments - webhook success ${label}`)
      const payload = {
        provider: 'RAZORPAY',
        providerPaymentId,
        status: 'SUCCESS',
        orderId,
        amount: Number(orderRes.body.totalAmount),
        currency: 'INR',
      }
      const rawBody = JSON.stringify(payload)
      const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')

      await request(API_BASE_URL)
        .post('/payments/webhook')
        .set('x-korana-signature', signature)
        .send(payload)
        .expect(200)

      const paymentDb = await prisma.payment.findUnique({ where: { id: paymentId } })
      expect(paymentDb).toBeTruthy()
      expect(paymentDb.status).toBe('SUCCESS')

      const orderDb = await prisma.order.findUnique({ where: { id: orderId } })
      expect(orderDb.status).toBe('PAID')

      const payoutDb = await prisma.payout.findFirst({ where: { orderId } })
      expect(payoutDb).toBeTruthy()
      expect(payoutDb.status).toBe('PENDING')

      return { orderId, paymentId, payoutId: payoutDb.id }
    }

    const orderA = await createPaidOrder('A')
    state.ids.orderAId = orderA.orderId
    state.ids.paymentAId = orderA.paymentId
    state.ids.payoutAId = orderA.payoutId

    stage('Admin - hold payout A')
    await request(API_BASE_URL)
      .patch(`/admin/payouts/${state.ids.payoutAId}/hold`)
      .set(authHeader(state.users.admin.accessToken))
      .send({ holdReason: 'E2E hold validation' })
      .expect(200)

    stage('Admin - release held payout A should fail')
    await request(API_BASE_URL)
      .patch(`/admin/payouts/${state.ids.payoutAId}/release`)
      .set(authHeader(state.users.admin.accessToken))
      .expect(400)

    stage('Buyer - raise dispute on order A')
    const disputeRes = await request(API_BASE_URL)
      .post(`/orders/${state.ids.orderAId}/dispute`)
      .set(authHeader(state.users.buyer.accessToken))
      .send({ reason: 'E2E dispute reason' })
      .expect(201)
    state.ids.disputeAId = disputeRes.body.id

    stage('Admin - list and resolve dispute A')
    const disputesRes = await request(API_BASE_URL)
      .get('/admin/disputes')
      .set(authHeader(state.users.admin.accessToken))
      .expect(200)
    expect(disputesRes.body.some((row) => row.id === state.ids.disputeAId)).toBe(true)

    await request(API_BASE_URL)
      .patch(`/admin/disputes/${state.ids.disputeAId}/resolve`)
      .set(authHeader(state.users.admin.accessToken))
      .send({ status: 'RESOLVED' })
      .expect(200)

    const orderB = await createPaidOrder('B')
    state.ids.orderBId = orderB.orderId
    state.ids.paymentBId = orderB.paymentId
    state.ids.payoutBId = orderB.payoutId

    stage('Buyer - confirm order B')
    await request(API_BASE_URL)
      .patch(`/orders/${state.ids.orderBId}/confirm`)
      .set(authHeader(state.users.buyer.accessToken))
      .expect(200)

    stage('Admin - release payout B')
    const releaseRes = await request(API_BASE_URL)
      .patch(`/admin/payouts/${state.ids.payoutBId}/release`)
      .set(authHeader(state.users.admin.accessToken))
      .expect(200)
    expect(releaseRes.body.status).toBe('TRANSFERRED')

    stage('Buyer - review seller on order B')
    const reviewRes = await request(API_BASE_URL)
      .post(`/orders/${state.ids.orderBId}/review`)
      .set(authHeader(state.users.buyer.accessToken))
      .send({ rating: 5, comment: 'Great delivery' })
      .expect(201)
    state.ids.reviewBId = reviewRes.body.id

    const rating = await prisma.sellerRating.findUnique({ where: { sellerId: state.users.seller.id } })
    expect(rating).toBeTruthy()
    expect(Number(rating.totalReviews)).toBeGreaterThan(0)
    state.ids.sellerRatingId = rating.id

    stage('Admin - metrics')
    const metricsRes = await request(API_BASE_URL)
      .get('/admin/metrics')
      .set(authHeader(state.users.admin.accessToken))
      .expect(200)
    expect(Number(metricsRes.body.totalOrders)).toBeGreaterThanOrEqual(2)
  })

  it('6) Chat flow: conversation + websocket event + persisted messages', async () => {
    stage('Chat - create conversation')
    const convoRes = await request(API_BASE_URL)
      .post('/chat/conversations')
      .set(authHeader(state.users.buyer.accessToken))
      .send({ participantId: state.users.seller.id })
      .expect(201)
    state.ids.conversationId = convoRes.body.id

    stage('Chat - connect websocket clients')
    const buyerSocket = connectSocket(state.users.buyer.accessToken)
    const sellerSocket = connectSocket(state.users.seller.accessToken)
    state.sockets.push(buyerSocket, sellerSocket)

    await waitForConnect(buyerSocket)
    await waitForConnect(sellerSocket)

    stage('Chat - join conversation room')
    const joinBuyer = await emitWithAck(buyerSocket, 'conversation:join', { conversationId: state.ids.conversationId })
    const joinSeller = await emitWithAck(sellerSocket, 'conversation:join', { conversationId: state.ids.conversationId })
    expect(joinBuyer.success).toBe(true)
    expect(joinSeller.success).toBe(true)

    stage('Chat - send message via HTTP and validate websocket event')
    const wsMessagePromise = waitForEvent(sellerSocket, 'message:new')
    const messageRes = await request(API_BASE_URL)
      .post('/chat/messages')
      .set(authHeader(state.users.buyer.accessToken))
      .send({
        conversationId: state.ids.conversationId,
        content: `E2E chat message ${runId}`,
      })
      .expect(201)
    state.ids.messageId = messageRes.body.id

    const wsPayload = await wsMessagePromise
    expect(wsPayload.id).toBe(state.ids.messageId)
    expect(wsPayload.conversationId).toBe(state.ids.conversationId)

    stage('Chat - fetch messages and verify DB persistence')
    const messagesRes = await request(API_BASE_URL)
      .get(`/chat/conversations/${state.ids.conversationId}/messages`)
      .set(authHeader(state.users.buyer.accessToken))
      .expect(200)
    expect(messagesRes.body.some((msg) => msg.id === state.ids.messageId)).toBe(true)

    const dbMessage = await prisma.message.findUnique({ where: { id: state.ids.messageId } })
    expect(dbMessage).toBeTruthy()
    expect(dbMessage.content).toContain(`E2E chat message ${runId}`)
  })

  it('7) Additional modules: subscriptions, market intelligence, admin verify, users reputation', async () => {
    stage('Subscriptions - admin grants PRO to buyer')
    const now = new Date()
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const subscriptionRes = await request(API_BASE_URL)
      .post(`/subscriptions/${state.users.buyer.id}`)
      .set(authHeader(state.users.admin.accessToken))
      .send({
        planType: 'PRO',
        status: 'ACTIVE',
        startDate: now.toISOString(),
        endDate: nextMonth.toISOString(),
      })
      .expect(201)
    state.ids.subscriptionId = subscriptionRes.body.id

    const mySubRes = await request(API_BASE_URL)
      .get('/subscriptions/me')
      .set(authHeader(state.users.buyer.accessToken))
      .expect(200)
    expect(mySubRes.body.planType).toBe('PRO')

    stage('Market intelligence - admin ingests data, buyer fetches chart + advanced')
    const commodityName = `E2E_COMMODITY_${runId}`
    const ingested = await request(API_BASE_URL)
      .post('/market-intelligence/prices')
      .set(authHeader(state.users.admin.accessToken))
      .send({
        commodityName,
        market: 'E2E_Market',
        priceInrPerKg: 440.5,
        observedAt: new Date().toISOString(),
      })
      .expect(201)
    state.ids.marketPriceIds.push(ingested.body.id)

    const chartRes = await request(API_BASE_URL).get(`/market-intelligence/${commodityName}/chart`).expect(200)
    expect(Array.isArray(chartRes.body)).toBe(true)
    expect(chartRes.body.some((row) => row.id === ingested.body.id)).toBe(true)

    const advancedRes = await request(API_BASE_URL)
      .get(`/market-intelligence/${commodityName}/advanced`)
      .set(authHeader(state.users.buyer.accessToken))
      .expect(200)
    expect(Array.isArray(advancedRes.body.series)).toBe(true)
    expect(advancedRes.body.stats).toBeTruthy()

    stage('Admin verify user + users reputation endpoint')
    await request(API_BASE_URL)
      .patch(`/admin/users/${state.users.seller.id}/verify`)
      .set(authHeader(state.users.admin.accessToken))
      .send({ verified: true, verificationLevel: 'BASIC' })
      .expect(200)

    const reputationRes = await request(API_BASE_URL)
      .get(`/users/${state.users.seller.id}/reputation`)
      .set(authHeader(state.users.buyer.accessToken))
      .expect(200)
    expect(reputationRes.body.id).toBe(state.users.seller.id)
    expect(reputationRes.body.sellerRating).toBeTruthy()
  })

  it('8) Authorization sanity: non-admin cannot access admin endpoints', async () => {
    stage('Authorization guard validation')
    await request(API_BASE_URL)
      .get('/admin/metrics')
      .set(authHeader(state.users.buyer.accessToken))
      .expect(403)
  })
})
