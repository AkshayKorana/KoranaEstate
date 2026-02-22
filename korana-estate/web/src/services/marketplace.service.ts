import { apiRequest } from './api-client'

export const marketplaceService = {
  list: () => apiRequest('/marketplace/listings'),
  create: (payload: unknown) => apiRequest('/marketplace/listings', 'POST', payload),
  bid: (id: string, payload: unknown) => apiRequest(`/marketplace/listings/${id}/bids`, 'POST', payload),
}
