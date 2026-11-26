export type Role = 'donor' | 'organizer' | 'administrator' | 'admin' | string

export interface User {
  id: string
  email?: string
  name?: string
  full_name?: string
  role?: Role
  role_name?: Role
  status?: string
  avatar_url?: string
  wallet_address?: string
  display_name?: string
  is_active?: boolean
  created_at?: string
}

export interface SiweNonce {
  nonce: string
  domain: string
  uri: string
  chain_id: number
  statement: string
  issued_at: string
  expires_at: string
  requires_email?: boolean
}

export interface Campaign {
  id: string
  title: string
  description?: string
  image_url?: string | null
  goal_amount?: number | string
  raised_amount?: number | string
  currency?: string
  status?: string
  starts_at?: string | null
  ends_at?: string | null
  organizer_id?: string
  organizer_name?: string | null
  organizer_wallet_address?: `0x${string}` | null
  organizer?: { id?: string; name?: string }
  created_at?: string
  category?: string
  donor_count?: number
  beneficiary_name?: string
  beneficiary_details?: string
  supporting_info?: string
  review_feedback?: string
  submit_for_review?: boolean
}

export interface CampaignDailyStatistic {
  date: string
  amount: number | string
}

export interface CampaignAnalytics {
  campaign_id: string
  views_count: number
  total_donors: number
  donations_today: number | string
  daily_statistics: CampaignDailyStatistic[]
}

export interface Donation {
  id: string
  campaign_id?: string
  campaign?: Campaign | { title?: string }
  amount?: string | number
  currency?: string
  payment_amount?: string | number | null
  payment_currency?: string | null
  exchange_rate?: string | number | null
  exchange_rate_provider?: string | null
  exchange_rate_at?: string | null
  payment_method?: string | null
  payment_provider?: string | null
  payment_reference?: string | null
  status?: string
  created_at?: string
  transaction_hash?: string
  donor_wallet_address?: string | null
  campaign_title?: string
  donor_name?: string
  donor_email?: string
  confirmed_at?: string
  transaction_network?: string
  transaction_status?: string
  transaction_verified?: boolean
  block_number?: number
  confirmations?: number
  is_anonymous?: boolean
}

export interface DonationPayment {
  id: string
  campaign_id: string
  amount: string | number
  currency: string
  status: string
  payment_method: 'GCASH' | 'MAYA' | string
  checkout_url: string | null
  test_mode: boolean
}

export interface Withdrawal {
  id: string
  campaign_id?: string
  campaign?: Campaign | { title?: string }
  amount?: string | number
  currency?: string
  wallet_address?: string
  purpose?: string
  status?: string
  created_at?: string
  campaign_title?: string
  destination_address?: string
  review_reason?: string | null
  available_balance?: number | string
  requester_email?: string
}

export interface Notification {
  id: string
  title: string
  body: string
  href?: string
  created_at: string
  read_at?: string | null
}

export interface AdminUser {
  id: string
  email: string
  display_name?: string | null
  avatar_url?: string | null
  wallet_address?: string | null
  is_active: boolean
  created_at: string
  role: string
}

export interface AdminDashboardSummary {
  total_users: number
  total_donors: number
  total_organizers: number
  total_campaigns: number
  active_campaigns: number
  confirmed_donations: number
  pending_withdrawals: number
  total_transactions: number
  confirmed_transactions: number
  flagged_transactions: number
  confirmed_donation_value: Array<{ currency: string; amount: number | string }>
}

export interface OrganizerRoleRequest {
  id: string
  user_id: string
  email: string
  display_name?: string
  requested_role: string
  status: string
  created_at: string
  reviewed_at?: string | null
}

export interface AdminTransaction {
  id: string
  donation_id?: string
  withdrawal_id?: string
  network: string
  tx_hash: string
  from_address?: string
  to_address?: string
  block_number?: number
  confirmations: number
  status: string
  verified: boolean
  created_at: string
  confirmed_at?: string
  amount?: number | string
  currency?: string
  campaign_title?: string
  review_note?: string | null
  flagged_by?: string
  flagged_at?: string
}

export interface AuditLog {
  id: string
  actor_id?: string
  actor_email?: string
  action: string
  entity_type: string
  entity_id?: string
  details: unknown
  created_at: string
}
