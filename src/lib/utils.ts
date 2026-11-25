import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function formatMoney(value: number | string | undefined, currency = 'PHP') {
  const amount = Number(value ?? 0)
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
export function roleOf(user: any): string {
  const role = user?.role ?? user?.role_name ?? user?.role?.name ?? user?.roles?.[0]?.name ?? 'donor'
  return String(role).toLowerCase()
}
export function unwrap<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) return payload.data as T
  return payload as T
}
