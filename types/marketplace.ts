// Marketplace TypeScript Types

export interface User {
  id: string
  name: string | null
  email: string
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

export interface Order {
  id: string
  buyerId: string
  productId: string
  quantity: number
  totalPrice: number
  status: 'PLACED' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  shippingAddress: string | null
  phone: string | null
  createdAt: Date | string
  updatedAt: Date | string
  buyer?: User
  product?: Product
}

// Chat Types
export interface Conversation {
  id: string
  buyerId: string
  sellerId: string
  lastMessageAt: Date | string
  createdAt: Date | string
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
  shippingAddress?: string
  phone?: string
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
