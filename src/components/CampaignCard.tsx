import { ArrowUpRight, CalendarDays, Heart, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { CachedImage } from "./CachedImage";
import type { Campaign } from "../lib/types";
import {
    formatDate,
    formatMoney,
    formatStatusLabel,
    isCampaignClosed,
} from "../lib/utils";
export function CampaignCard({
    campaign,
}: {
    campaign: Campaign;
}) {
    const goal = Number(campaign.goal_amount || 0),
        raised = Number(campaign.raised_amount || 0);
    const progress =
        goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    const amountLeft = Math.max(0, goal - raised);
    const daysLeft = campaign.ends_at
        ? Math.max(
              0,
              Math.ceil(
                  (new Date(campaign.ends_at).getTime() - Date.now()) /
                      86400000,
              ),
          )
        : null;
    const closed = isCampaignClosed(campaign);
    const status = campaign.status || "active";
    const href = `/campaigns/${campaign.id}`;
    return (
        <article className="campaign-card">
            <Link to={href} className="campaign-image">
                {campaign.image_url ? (
                    <CachedImage src={campaign.image_url} alt="" />
                ) : (
                    <div className="campaign-placeholder">
                        <Heart size={38} />
                        <span>Make an impact</span>
                    </div>
                )}
                {status.trim().toLowerCase() !== "published" && (
                    <span className="image-chip">
                        {formatStatusLabel(status)}
                    </span>
                )}
                <span className="campaign-image-shade" />
                <span className="campaign-image-metrics">
                    <span>
                        <Users size={13} />
                        <b>{campaign.donor_count ?? 0}</b>
                        <small>donors</small>
                    </span>
                    <span>
                        <b>{progress}%</b>
                        <small>of goal</small>
                    </span>
                    <span>
                        <CalendarDays size={13} />
                        <b>
                            {closed
                                ? "Closed"
                                : daysLeft === null
                                  ? "No deadline"
                                  : `${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}
                        </b>
                    </span>
                </span>
                <span className="campaign-image-progress">
                    <span style={{ width: `${progress}%` }} />
                </span>
            </Link>
            <div className="campaign-body">
                <Link to={href} className="campaign-title">
                    {campaign.title}
                </Link>
                {campaign.created_at && (
                    <small className="campaign-posted">
                        Posted {formatDate(campaign.created_at)}
                    </small>
                )}
                <div className="campaign-amounts">
                    <span>
                        <small>Raised</small>
                        <b>{formatMoney(raised, campaign.currency || "PHP")}</b>
                    </span>
                    <span>
                        <small>Goal</small>
                        <b>{formatMoney(goal, campaign.currency || "PHP")}</b>
                    </span>
                    <span>
                        <small>Left</small>
                        <b>
                            {formatMoney(amountLeft, campaign.currency || "PHP")}
                        </b>
                    </span>
                </div>
                <div className="campaign-card-actions">
                    <Link className="campaign-link" to={href}>
                        View campaign <ArrowUpRight size={16} />
                    </Link>
                </div>
            </div>
        </article>
    );
}
