import type { AdminDashboardSummary, AdminTransaction, AdminUser, AuditLog, Campaign, Donation, DonationPayment, OrganizerRoleRequest, SiweNonce, Withdrawal } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const USE_CREDENTIALS = import.meta.env.VITE_USE_CREDENTIALS === 'true'
const ACCESS_KEY = 'fundora_access_token'
const REFRESH_KEY = 'fundora_refresh_token'

export const tokenStore = {
  getAccess: () => sessionStorage.getItem(ACCESS_KEY),
  getRefresh: () => sessionStorage.getItem(REFRESH_KEY),
  set: (access?: string, refresh?: string) => {
    if (access) sessionStorage.setItem(ACCESS_KEY, access)
    if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => { sessionStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(REFRESH_KEY) },
}

export class ApiError extends Error {
  status: number
  details: unknown
  constructor(message: string, status: number, details?: unknown) { super(message); this.name = 'ApiError'; this.status = status; this.details = details }
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) return false
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: USE_CREDENTIALS ? 'include' : 'same-origin',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const payload: any = await parseResponse(response)
    if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
      tokenStore.clear()
      return false
    }
    tokenStore.set(payload.access_token, payload.refresh_token)
    return true
  } catch { return false }
}

let refreshPromise: Promise<boolean> | null = null

export async function request<T = any>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const access = tokenStore.getAccess()
  if (access) headers.set('Authorization', `Bearer ${access}`)
  const response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init, headers, credentials: USE_CREDENTIALS ? 'include' : init.credentials,
  })
  if (response.status === 401 && retry && !path.includes('/auth/refresh') && !path.includes('/auth/email/')) {
    refreshPromise ??= refreshSession().finally(() => { refreshPromise = null })
    const refreshed = await refreshPromise
    if (refreshed) return request<T>(path, init, false)
    tokenStore.clear()
    window.dispatchEvent(new Event('fundora:session-expired'))
  }
  const payload: any = await parseResponse(response)
  if (!response.ok) {
    const responseMessage =
      typeof payload === 'string' && payload.trim()
        ? payload.trim()
        : `Request failed (${response.status})`
    const message = payload?.error || payload?.message || responseMessage
    throw new ApiError(String(message), response.status, payload)
  }
  return payload as T
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

export const authApi = {
  requestEmailOtp: (email: string) => request('/auth/email/request', json('POST', { email }), false),
  verifyEmailOtp: (email: string, code: string) => request<any>('/auth/email/verify', json('POST', { email, code }), false),
  me: () => request<any>('/auth/me'),
  logout: (refresh_token?: string) => request('/auth/logout', json('POST', { refresh_token })),
  updateMe: (body: { display_name: string; avatar_url?: string | null }) => request('/auth/me', json('PATCH', body)),
  verifyGoogle: (id_token: string, nonce: string) => request<any>('/auth/google', json('POST', { id_token, nonce }), false),
  verifyApple: (id_token: string, nonce: string) => request<any>('/auth/apple', json('POST', { id_token, nonce }), false),
  requestSiweNonce: (wallet_address: string) => request<SiweNonce>('/auth/siwe/nonce', json('POST', { wallet_address }), false),
  verifySiwe: (message: string, signature: string, email?: string) => request<any>('/auth/siwe/verify', json('POST', { message, signature, email }), false),
  requestWalletLinkNonce: (wallet_address: string) => request<SiweNonce>('/auth/wallet/link/nonce', json('POST', { wallet_address })),
  linkWallet: (message: string, signature: string) => request('/auth/wallet/link', json('POST', { message, signature })),
}

export const paymentApi = {
  config: () => request<{ chain_id: number; contract_address: `0x${string}`; minimum_confirmations: number }>('/payments/config'),
}

export const campaignApi = {
  list: async () => {
    const payload: any = await request('/campaigns')
    const data = payload?.data ?? payload
    return (Array.isArray(data) ? data : data?.items ?? data?.campaigns ?? []) as Campaign[]
  },
  get: (id: string) => request<Campaign>(`/campaigns/${encodeURIComponent(id)}`),
  create: (body: Partial<Campaign> & { network?: string; contract_address?: string }) => request('/campaigns', json('POST', body)),
  update: (id: string, body: Partial<Campaign>) => request(`/campaigns/${encodeURIComponent(id)}`, json('PATCH', body)),
  mine: async () => {
    const payload: any = await request('/campaigns/mine')
    const data = payload?.data ?? payload
    return (Array.isArray(data) ? data : data?.items ?? data?.campaigns ?? []) as Campaign[]
  },
}

export const donationApi = {
  create: (body: {
    campaign_id: string
    amount: number
    payment_method: 'GCASH' | 'MAYA'
    is_anonymous: boolean
    message?: string
  }) => request<DonationPayment>('/donations', json('POST', body)),
  paymentStatus: (id: string) => request<DonationPayment>(`/donations/${encodeURIComponent(id)}/payment-status`),
  simulatePayment: (id: string) => request<DonationPayment>(`/donations/${encodeURIComponent(id)}/simulate-payment`, json('POST')),
  verify: (id: string, transaction_hash: string) => request<{ donation_id: string; status: string; transaction_hash: string; confirmations: number }>(`/donations/${encodeURIComponent(id)}/verify`, json('POST', { transaction_hash })),
  list: async () => {
    const payload: any = await request('/donations/my')
    const data = payload?.data ?? payload
    return (Array.isArray(data) ? data : data?.items ?? data?.donations ?? []) as Donation[]
  },
  get: (id: string) => request<any>(`/donations/${encodeURIComponent(id)}`),
  organizerList: async () => {
    const payload: any = await request('/organizer/donations')
    const data = payload?.data ?? payload
    return (Array.isArray(data) ? data : data?.items ?? data?.donations ?? []) as Donation[]
  },
}

export const withdrawalApi = {
  list: async () => {
    const payload: any = await request('/withdrawals/mine')
    const data = payload?.data ?? payload
    return (Array.isArray(data) ? data : data?.items ?? data?.withdrawals ?? []) as Withdrawal[]
  },
  create: (body: { campaign_id: string; amount: string; destination_address: string; purpose: string }) => request('/withdrawals', json('POST', body)),
  review: (id: string, decision: 'approve' | 'reject', reason?: string) => request(`/withdrawals/${encodeURIComponent(id)}/review`, json('POST', { decision, reason })),
}

export const transactionApi = {
  get: (hash: string) => request(`/transactions/${encodeURIComponent(hash)}`),
  record: (body: any) => request('/transactions', json('POST', body)),
}

export const notificationApi = {
  list: () => request<any[]>('/notifications/mine'),
  markRead: (id: string) => request(`/notifications/${encodeURIComponent(id)}/read`, json('PATCH')),
}

export const roleRequestApi = {
  mine: () => request<any>('/role-requests/organizer'),
  requestOrganizer: () => request('/role-requests/organizer', json('POST')),
  pending: () => request<OrganizerRoleRequest[]>('/admin/role-requests'),
  review: (id: string, decision: 'approved' | 'rejected') => request(`/admin/role-requests/${encodeURIComponent(id)}/review`, json('POST', { decision })),
}

export const dashboardApi = {
  summary: () => request<any>('/dashboard/summary'),
}

export const adminApi = {
  summary: () => request<AdminDashboardSummary>('/admin/summary'),
  users: () => request<AdminUser[]>('/admin/users'),
  updateUser: (id: string, body: { role?: string; is_active?: boolean }) => request(`/admin/users/${encodeURIComponent(id)}`, json('PATCH', body)),
  campaigns: () => request<Campaign[]>('/admin/campaigns'),
  reviewCampaign: (id: string, decision: 'approve' | 'reject' | 'request_changes', reason?: string) => request(`/admin/campaigns/${encodeURIComponent(id)}/review`, json('POST', { decision, reason })),
  donations: () => request<Donation[]>('/admin/donations'),
  transactions: () => request<AdminTransaction[]>('/admin/transactions'),
  flagTransaction: (id: string, note: string | null) => request(`/admin/transactions/${encodeURIComponent(id)}/flag`, json('PATCH', { note })),
  withdrawals: () => request<Withdrawal[]>('/admin/withdrawals'),
  audit: () => request<AuditLog[]>('/admin/audit-logs'),
}

export const apiConfig = { baseUrl: API_BASE }
