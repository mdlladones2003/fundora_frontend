import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Bell, ChevronDown, CircleUserRound, HeartHandshake, LayoutDashboard, LogOut, Menu, Plus, ShieldCheck, Users, Wallet, FolderKanban, ReceiptText, ScrollText, CircleDollarSign, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { roleOf } from '../lib/utils'
import { notificationApi } from '../lib/api'
import type { Notification } from '../lib/types'

export function Brand({ light=false, to }: { light?: boolean; to?: string }) {
  const { signedIn } = useAuth()
  return <Link to={to ?? (signedIn ? '/dashboard' : '/')} className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-icon"><HeartHandshake size={20}/></span><span>fundora<span className="brand-dot">.</span></span></Link>
}

function NotificationMenu() {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const unreadCount = items.filter(item => !item.read_at).length

  const loadNotifications = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await notificationApi.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notifications could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) void loadNotifications()
  }

  const openNotification = async (item: Notification) => {
    if (!item.read_at) {
      try {
        await notificationApi.markRead(item.id)
        setItems(current => current.map(notification =>
          notification.id === item.id
            ? { ...notification, read_at: new Date().toISOString() }
            : notification,
        ))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This notification could not be marked as read.')
        return
      }
    }
    setOpen(false)
    if (item.href?.startsWith('/')) navigate(item.href)
  }

  return <div className="notification-menu">
    <button className="icon-button notification-trigger" title="Notifications" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} onClick={toggle}>
      <Bell size={18}/>{unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section className="notification-panel" aria-label="Notifications">
      <div className="notification-panel-heading"><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</span></div>
      {error && <div className="inline-error">{error}</div>}
      {loading ? <div className="notification-empty">Loading…</div>
        : items.length ? <div className="notification-list">{items.map(item => <button key={item.id} className={`notification-item ${item.read_at ? '' : 'unread'}`} onClick={() => void openNotification(item)}>
          <strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString()}</small>
        </button>)}</div>
          : !error && <div className="notification-empty">No notifications yet.</div>}
    </section>}
  </div>
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const role = roleOf(user)
  const displayName = user?.display_name || user?.name || user?.full_name || 'Fundora user'
  const links = role === 'administrator' || role === 'admin'
    ? [{to:'/dashboard',label:'Overview',icon:LayoutDashboard},{to:'/admin/users',label:'Users',icon:Users},{to:'/admin/role-requests',label:'Role requests',icon:ShieldCheck},{to:'/admin/campaigns',label:'Campaigns',icon:FolderKanban},{to:'/admin/donations',label:'Donations',icon:ReceiptText},{to:'/admin/transactions',label:'Transactions',icon:CircleDollarSign},{to:'/admin/withdrawals',label:'Withdrawals',icon:Wallet},{to:'/admin/audit',label:'Audit log',icon:ScrollText}]
    : role === 'organizer'
    ? [{to:'/dashboard',label:'Overview',icon:LayoutDashboard},{to:'/organizer/campaigns',label:'My campaigns',icon:HeartHandshake},{to:'/organizer/campaigns/new',label:'Create campaign',icon:Plus},{to:'/organizer/donations',label:'Donations',icon:ReceiptText},{to:'/organizer/withdrawals',label:'Withdrawals',icon:Wallet},{to:'/profile',label:'Profile',icon:CircleUserRound}]
    : [{to:'/dashboard',label:'Overview',icon:LayoutDashboard},{to:'/my-donations',label:'My donations',icon:HeartHandshake},{to:'/profile',label:'Profile',icon:CircleUserRound}]
  const logout = async () => { await signOut(); navigate('/login') }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand to="/dashboard"/><button className="icon-button mobile-close" onClick={()=>setMobileOpen(false)}><X/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">
        {links.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/dashboard'} onClick={()=>setMobileOpen(false)} className={({isActive})=>`side-link ${isActive?'active':''}`}><Icon size={18}/>{label}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><ShieldCheck size={18}/></div><strong>Give with confidence</strong><p>Track campaigns and keep up with every contribution.</p><Link to="/campaigns">Explore campaigns <ArrowUpRight size={14}/></Link></div>
        <button className="profile-row" onClick={logout}><span className="avatar">{displayName.charAt(0).toUpperCase()}</span><span className="profile-copy"><b>{displayName}</b><small>{user?.email || role}</small></span><LogOut size={17}/></button>
      </div>
    </aside>
    {mobileOpen && <button className="mobile-backdrop" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button>
        <div className="breadcrumb">Workspace <span>/</span> <b>{role === 'administrator' || role === 'admin' ? 'Administration' : role === 'organizer' ? 'Organizer' : 'Donor'}</b></div>
        <div className="topbar-actions"><NotificationMenu/><span className="topbar-divider"/><span className="topbar-user"><CircleUserRound size={19}/>{user?.display_name || user?.name || user?.full_name || user?.email || 'Account'}<ChevronDown size={14}/></span></div>
      </header>
      <div className="page-content"><Outlet/></div>
    </main>
  </div>
}
