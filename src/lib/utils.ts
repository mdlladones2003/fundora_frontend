import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function formatMoney(value: number | string | undefined, currency = 'PHP') {
  const amount = Number(value ?? 0)
  if (currency === 'ETH') {
    return `${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 18 }).format(Number.isFinite(amount) ? amount : 0)} ETH`
  }
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)
}
export function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}
export function formatStatusLabel(value?: string) {
  return (value || 'Unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b[a-z]/g, letter => letter.toUpperCase())
}
export type CampaignFilter = 'all' | 'goal-reached' | 'goal-unreached' | 'closed' | 'draft'
export type CampaignDateFilter = 'newest' | 'oldest' | 'week' | 'month'
export function isCampaignClosed(campaign: { status?: string; ends_at?: string | null }) {
  const status = (campaign.status || '').toLowerCase()
  return ['completed', 'closed', 'archived'].includes(status)
    || Boolean(campaign.ends_at && new Date(campaign.ends_at).getTime() <= Date.now())
}
export function isCampaignEditable(campaign: { status?: string | null }) {
  const status = (campaign.status || '').trim().toLowerCase()
  return !['published', 'active', 'paused', 'completed', 'archived'].includes(status)
}
export function filterCampaigns<T extends {
  status?: string
  raised_amount?: number | string
  goal_amount?: number | string
  ends_at?: string | null
  created_at?: string
}>(campaigns: T[], filter: CampaignFilter, dateFilter: CampaignDateFilter) {
  const now = Date.now()
  const cutoff = dateFilter === 'week' ? now - 7 * 86400000
    : dateFilter === 'month' ? now - 30 * 86400000 : null
  return campaigns
    .filter((campaign) => {
      const status = (campaign.status || '').toLowerCase()
      const goal = Number(campaign.goal_amount || 0)
      const raised = Number(campaign.raised_amount || 0)
      if (filter === 'goal-reached' && (goal <= 0 || raised < goal)) return false
      if (filter === 'goal-unreached' && (goal <= 0 || raised >= goal)) return false
      if (filter === 'closed' && !isCampaignClosed(campaign)) return false
      if (filter === 'draft' && status !== 'draft') return false
      if (cutoff !== null) {
        const postedAt = campaign.created_at ? new Date(campaign.created_at).getTime() : Number.NaN
        if (!Number.isFinite(postedAt) || postedAt < cutoff) return false
      }
      return true
    })
    .sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateFilter === 'oldest' ? aDate - bDate : bDate - aDate
    })
}
export function roleOf(user: any): string {
  const role = user?.role ?? user?.role_name ?? user?.role?.name ?? user?.roles?.[0]?.name ?? 'donor'
  return String(role).toLowerCase()
}
export function unwrap<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) return payload.data as T
  return payload as T
}
