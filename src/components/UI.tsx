import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn, formatStatusLabel } from '../lib/utils'
export function Button({ className, variant='primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'outline'|'ghost'|'danger' }) {
  return <button className={cn('btn', `btn-${variant}`, className)} {...props} />
}
export function Card({ children, className }: { children: ReactNode; className?: string }) { return <section className={cn('card', className)}>{children}</section> }
export function Field({ label, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className={cn('field', className)}><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>
}
export function TextareaField({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="field"><span>{label}</span><textarea {...props} /></label>
}
export function Status({ value }: { value?: string }) {
  const state = (value || 'unknown').toLowerCase()
  return <span className={`status status-${state.replace(/[_\s]+/g,'-')}`}>{formatStatusLabel(value)}</span>
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark">✳</div><h3>{title}</h3><p>{description}</p>{action}</div>
}
export function Spinner() { return <span className="spinner" aria-label="Loading" /> }
