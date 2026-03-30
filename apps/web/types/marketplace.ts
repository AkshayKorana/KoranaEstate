// Marketplace TypeScript Types

export interface User {
  id: string
  name: string | null
  email: string
}

export interface ConversationParticipantUser {
  id: string
  fullName?: string | null
  role?: string | null
}

export interface ConversationParticipant {
  id?: string
  userId?: string
  user?: ConversationParticipantUser
}

// Raw Marketplace Types
export interface RawListing {
  id: string
  sellerId: string
  commodity: string
  grade: string | null
  quantityKg: number
  pricePerKg: number
  location: string
  description: string | null
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  seller?: User
  offers?: RawOffer[]
}

export interface RawOffer {
  id: string
  listingId: string
  buyerId: string
  offerPrice: number
  quantity: number
  message: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  createdAt: Date | string
  updatedAt: Date | string
  listing?: RawListing
  buyer?: User
}

// Store/E-commerce Types
export interface Product {
  id: string
  sellerId: string
  name: string
  category: string
  price: number
  stock: number
  description: string | null
  imageUrl: string | null
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  seller?: User
  orders?: Order[]
}

export interface OrderCustomerDetails {
  fullName: string
  mobileNumber: string
  addressLine1: string
  addressLine2?: string
  area: string
  city: string
  state: string
  pincode: string
  landmark?: string
  orderNote?: string
}

export type OrderSourceType = 'STORE' | 'RAW_MARKETPLACE'
export type OrderPaymentMethod = 'COD'
export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export interface Order {
  id: string
  buyerId: string
  sourceType: OrderSourceType
  paymentMethod: OrderPaymentMethod
  status: OrderStatus
  rawProductId?: string | null
  totalPrice: number
  shippingAddress: string | null
  customer: OrderCustomerDetails
  itemName: string
  itemCategory: string | null
  itemImageUrl: string | null
  sellerName: string | null
  sellerId: string | null
  location: string | null
  unitLabel: string
  quantity: number
  unitPrice: number
  createdAt: Date | string
  updatedAt: Date | string
  buyer?: User
  product?: Product
  listing?: RawListing
}

// Chat Types
export interface Conversation {
  id: string
  buyerId: string
  sellerId: string
  lastMessageAt: Date | string
  createdAt: Date | string
  participants?: ConversationParticipant[]
  buyer?: User
  seller?: User
  messages?: Message[]
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  content: string
  isRead: boolean
  createdAt: Date | string
  conversation?: Conversation
  sender?: User
}

// API Response Types
export interface PaginationInfo {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface RawListingsResponse {
  listings: RawListing[]
  pagination?: PaginationInfo
}

export interface ProductsResponse {
  products: Product[]
  pagination?: PaginationInfo
}

export interface OrdersResponse {
  orders: Order[]
}

export interface OffersResponse {
  offers: RawOffer[]
}

export interface ConversationsResponse {
  conversations: Conversation[]
}

export interface MessagesResponse {
  messages: Message[]
}

// Form Types
export interface CreateRawListingInput {
  commodity: string
  grade?: string
  quantityKg: number
  pricePerKg: number
  location: string
  description?: string
}

export interface CreateRawOfferInput {
  listingId: string
  offerPrice: number
  quantity: number
  message?: string
}

export interface CreateProductInput {
  name: string
  category: string
  price: number
  stock: number
  description?: string
  imageUrl?: string
}

export interface CreateOrderInput {
  productId: string
  quantity: number
  customer: OrderCustomerDetails
}

export interface CreateRawMarketplaceOrderInput {
  listingId: string
  quantityKg: number
  customer: OrderCustomerDetails
}

export interface CreateConversationInput {
  sellerId: string
}

export interface CreateMessageInput {
  conversationId: string
  content: string
}

// Search/Filter Types
export interface RawListingFilters {
  commodity?: string
  location?: string
  minPrice?: number
  maxPrice?: number
  minQuantity?: number
  grade?: string
  limit?: number
  offset?: number
}

export interface ProductFilters {
  category?: string
  limit?: number
  offset?: number
}

// Estate Essentials Marketplace
export interface EstateListing {
  id: string
  sellerId: string
  title: string
  category: string
  subcategory: string | null
  listingType: 'Product' | 'Service' | string
  price: number
  unit: string
  quantity: number | null
  location: string
  description: string | null
  contactPhone: string | null
  isActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  seller?: User
}

export interface CreateEstateListingInput {
  title: string
  category: string
  subcategory?: string
  listingType: string
  price: number
  unit: string
  quantity?: number | null
  location: string
  description?: string
  contactPhone?: string
}

export interface HomeStay {
  id: string
  title?: string
  name?: string
  location: string
  pricePerNight: number
  description?: string | null
  imageUrl?: string | null
  imageUrls?: string[] | null
  amenities?: string[] | null
  maxGuests?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  hostId?: string | null
  host?: { id: string; name?: string | null; email?: string | null } | null
  createdAt?: Date | string
  updatedAt?: Date | string
}
