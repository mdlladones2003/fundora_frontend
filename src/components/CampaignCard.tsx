import { ArrowUpRight, Heart, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CachedImage } from './CachedImage'
import type { Campaign } from '../lib/types'
import { formatMoney, formatStatusLabel } from '../lib/utils'
export function CampaignCard({ campaign, linkTo }: { campaign: Campaign; linkTo?: string }) {
  const goal = Number(campaign.goal_amount || 0), raised = Number(campaign.raised_amount || 0)
  const progress = goal > 0 ? Math.min(100, Math.round(raised / goal * 100)) : 0
  const href = linkTo || `/campaigns/${campaign.id}`
  return <article className="campaign-card">
    <Link to={href} className="campaign-image">
      {campaign.image_url ? <CachedImage src={campaign.image_url} alt=""/> : <div className="campaign-placeholder"><Heart size={38}/><span>Make an impact</span></div>}
      <span className="image-chip">{formatStatusLabel(campaign.status || 'active')}</span>
    </Link>
    <div className="campaign-body">
      <div className="campaign-meta"><span><MapPin size={13}/> Community campaign</span><span>{progress}% funded</span></div>
      <Link to={href} className="campaign-title">{campaign.title}</Link>
      <p>{campaign.description || 'Read this campaign’s goal and submit a contribution request.'}</p>
      <div className="progress-track"><span style={{width:`${progress}%`}}/></div>
      <div className="campaign-amounts"><span><b>{formatMoney(raised,campaign.currency || 'PHP')}</b><small> raised</small></span><span><small>Goal </small><b>{formatMoney(goal,campaign.currency || 'PHP')}</b></span></div>
      <Link className="campaign-link" to={href}>{linkTo ? 'Manage campaign' : 'View campaign'} <ArrowUpRight size={16}/></Link>
    </div>
  </article>
}
