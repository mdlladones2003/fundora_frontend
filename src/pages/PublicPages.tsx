import { useEffect, useState, type FormEvent } from "react";
import {
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    HeartHandshake,
    Menu,
    ShieldCheck,
    Sparkles,
    Users,
    Wallet,
    X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Brand, GlobalSearch } from "../components/Layout";
import { CachedImage } from "../components/CachedImage";
import { CampaignCard } from "../components/CampaignCard";
import { Button, Card, EmptyState, Spinner, Status } from "../components/UI";
import {
    ApiError,
    adminApi,
    campaignApi,
    donationApi,
    transactionApi,
} from "../lib/api";
import type {
    Campaign,
    CampaignAnalytics,
    DonationPayment,
} from "../lib/types";
import {
    filterCampaigns,
    formatMoney,
    isCampaignEditable,
    roleOf,
    type CampaignDateFilter,
    type CampaignFilter,
} from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Field, TextareaField } from "../components/UI";

function PublicHeader({ landing = false }: { landing?: boolean }) {
    const { signedIn } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const accountPath = signedIn ? "/dashboard" : "/login";
    return (
        <header className="marketing-nav">
            <Brand to={landing ? "/" : undefined} />
            <nav
                id="public-navigation"
                className={mobileMenuOpen ? "public-nav-open" : ""}
            >
                <a
                    href={landing ? "#campaigns" : "/campaigns"}
                    onClick={() => setMobileMenuOpen(false)}
                >
                    Explore
                </a>
                <a
                    href={landing ? "#how-it-works" : "/#how-it-works"}
                    onClick={() => setMobileMenuOpen(false)}
                >
                    How it works
                </a>
            </nav>
            {signedIn && <GlobalSearch compact />}
            <button
                type="button"
                className="public-nav-toggle"
                aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={mobileMenuOpen}
                aria-controls="public-navigation"
                onClick={() => setMobileMenuOpen((open) => !open)}
            >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="nav-cta">
                <Link to={accountPath} className="nav-signin">
                    {signedIn ? "Overview" : "Sign in"}
                </Link>
                <Link to={accountPath} className="btn btn-primary">
                    {signedIn ? "Open dashboard" : "Start giving"}{" "}
                    <ArrowUpRight size={16} />
                </Link>
            </div>
        </header>
    );
}

function PublicFooter() {
    return (
        <footer className="marketing-footer">
            <Brand to="/" />
            <span>Thoughtful giving. Stronger communities.</span>
            <small>© {new Date().getFullYear()} Fundora</small>
        </footer>
    );
}

export function HomePage() {
    const { signedIn } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        campaignApi
            .list()
            .then(setCampaigns)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reduceMotion) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const words = [
                            ...entry.target.querySelectorAll(".tagline-word"),
                        ];
                        words.forEach((word, index) =>
                            window.setTimeout(
                                () => word.classList.add("word-active"),
                                index * 70,
                            ),
                        );
                        observer.disconnect();
                    }
                });
            },
            { threshold: 0.12 },
        );
        const moment = document.querySelector(".tagline-moment");
        if (moment) observer.observe(moment);
        return () => observer.disconnect();
    }, []);
    const featured = campaigns.slice(0, 3);
    return (
        <div className="marketing">
            <a className="skip-link" href="#main-content">
                Skip to content
            </a>
            <PublicHeader landing />
            <main id="main-content">
                <section className="hero" data-enter>
                    <div className="hero-copy">
                        <div className="eyebrow">
                            <span className="eyebrow-dot" /> COMMUNITY
                            FUNDRAISING
                        </div>
                        <h1>
                            Where giving
                            <br />
                            <span>meets transparency.</span>
                        </h1>
                        <p>
                            Discover community campaigns, contribute to a cause,
                            and follow each contribution record in one place.
                        </p>
                        <div className="hero-actions">
                            <Link to="/campaigns" className="btn btn-primary">
                                Explore campaigns <ArrowRight size={17} />
                            </Link>
                            {!signedIn && (
                                <Link to="/login" className="btn btn-outline">
                                    Create account
                                </Link>
                            )}
                        </div>
                        <div className="hero-trust">
                            <span>
                                <ShieldCheck size={16} /> Contribution records
                            </span>
                            <span>
                                <HeartHandshake size={16} /> Campaign activity
                            </span>
                        </div>
                    </div>
                    <div className="hero-art">
                        <div className="hero-orbit orbit-one" />
                        <div className="hero-orbit orbit-two" />
                        <div className="hero-center">
                            <div className="hero-heart">
                                <HeartHandshake size={62} />
                            </div>
                            <span>
                                Campaign
                                <br />
                                contribution
                            </span>
                        </div>
                        <div className="floating-note note-one">
                            <span className="note-icon">
                                <Users size={17} />
                            </span>
                            <div>
                                <b>Campaign goal</b>
                                <small>Track funding progress</small>
                            </div>
                        </div>
                        <div className="floating-note note-two">
                            <span className="note-icon blue">
                                <Sparkles size={17} />
                            </span>
                            <div>
                                <b>Contribution history</b>
                                <small>Review recorded status</small>
                            </div>
                        </div>
                        <div className="floating-stat">
                            <b>STATUS</b>
                            <small>recorded</small>
                        </div>
                    </div>
                </section>
                <section className="trust-strip section-reveal">
                    <div>
                        <ShieldCheck />
                        <b>Campaign records</b>
                        <span>Goals, dates, and funding progress</span>
                    </div>
                    <div>
                        <Wallet />
                        <b>Contribution history</b>
                        <span>Keep each request in one account</span>
                    </div>
                    <div>
                        <Users />
                        <b>Community campaigns</b>
                        <span>Support causes near you or online</span>
                    </div>
                </section>
                <section
                    className="tagline-moment"
                    aria-label="Contribution tracking statement"
                >
                    <p>
                        {"See where support goes. Follow each contribution from request to recorded status."
                            .split(" ")
                            .map((word, index) => (
                                <span
                                    className="tagline-word"
                                    key={`${word}-${index}`}
                                >
                                    {word}{" "}
                                </span>
                            ))}
                    </p>
                </section>
                <section
                    id="campaigns"
                    className="section-block section-reveal"
                >
                    <div className="section-heading">
                        <div>
                            <div className="eyebrow">EXPLORE CAMPAIGNS</div>
                            <h2>
                                Choose a cause
                                <br />
                                to support.
                            </h2>
                        </div>
                        <p>
                            Review the campaign goal, description, and progress
                            before you contribute.
                        </p>
                    </div>
                    {loading ? (
                        <div className="center-loading">
                            <Spinner />
                        </div>
                    ) : error ? (
                        <EmptyState
                            title="Campaigns could not load"
                            description={`${error}. Check that your Rust API is running and VITE_API_BASE_URL is correct.`}
                        />
                    ) : featured.length ? (
                        <div className="campaign-grid">
                            {featured.map((c) => (
                                <CampaignCard key={c.id} campaign={c} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="The next story starts here"
                            description="There are no published campaigns yet. Check back soon for causes to support."
                        />
                    )}
                    {campaigns.length > 3 && (
                        <div className="section-more">
                            <span>{campaigns.length} campaigns available</span>
                            <a href="#campaigns">
                                Browse featured <ArrowUpRight size={16} />
                            </a>
                        </div>
                    )}
                </section>
                <section
                    id="how-it-works"
                    className="how-section section-reveal"
                >
                    <div className="how-intro">
                        <div className="eyebrow">HOW IT WORKS</div>
                        <h2>
                            Find, contribute,
                            <br />
                            and track.
                        </h2>
                        <p>
                            Browse campaign goals, complete a secure payment,
                            and follow its status from your account.
                        </p>
                        <Link
                            to={signedIn ? "/dashboard" : "/login"}
                            className="btn btn-primary"
                        >
                            {signedIn ? "Open dashboard" : "Create account"}{" "}
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                    <div className="how-steps">
                        <div>
                            <span>01</span>
                            <div>
                                <h3>Find a campaign</h3>
                                <p>
                                    Read the campaign story, goal, deadline, and
                                    available contribution details.
                                </p>
                            </div>
                        </div>
                        <div>
                            <span>02</span>
                            <div>
                                <h3>Submit a contribution</h3>
                                <p>
                                    Review your amount, then complete payment
                                    through Xendit’s hosted checkout.
                                </p>
                            </div>
                        </div>
                        <div>
                            <span>03</span>
                            <div>
                                <h3>Check its status</h3>
                                <p>
                                    Open My donations to review the record and
                                    its payment and transaction status.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <PublicFooter />
        </div>
    );
}

export function ExploreCampaignsPage({
    embedded = false,
}: {
    embedded?: boolean;
} = {}) {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<CampaignFilter>("all");
    const [dateFilter, setDateFilter] =
        useState<CampaignDateFilter>("newest");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const ownedCampaigns =
            roleOf(user) === "organizer"
                ? campaignApi.mine()
                : Promise.resolve([]);
        const visibleCampaigns =
            roleOf(user) === "administrator" || roleOf(user) === "admin"
                ? adminApi.campaigns()
                : campaignApi.list();
        Promise.all([visibleCampaigns, ownedCampaigns])
            .then(([publicCampaigns, mine]) => {
                const byId = new Map(
                    [...publicCampaigns, ...mine].map((campaign) => [
                        campaign.id,
                        campaign,
                    ]),
                );
                setCampaigns([...byId.values()]);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [user]);
    const filtered = filterCampaigns(campaigns, filter, dateFilter).filter(
        (campaign) =>
            `${campaign.title} ${campaign.description || ""} ${campaign.category || ""}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
    );
    const intro = embedded ? (
        <div className="page-heading">
            <div>
                <div className="eyebrow">EXPLORE CAMPAIGNS</div>
                <h1>Find a cause worth backing.</h1>
                <p>Browse campaigns and compare each fundraiser’s progress.</p>
            </div>
        </div>
    ) : (
        <div className="section-heading">
            <div>
                <div className="eyebrow">EXPLORE CAMPAIGNS</div>
                <h2>Find a cause worth backing.</h2>
            </div>
            <p>
                Browse campaigns and compare each fundraiser’s progress.
            </p>
        </div>
    );
    const page = (
        <section
            className={
                embedded ? "portal-explore" : "explore-page section-block"
            }
        >
            {intro}
            <div className="portal-explore-content">
                <div className="explore-tools">
                    <Field
                        label="Search campaigns"
                        name="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search title or cause"
                    />
                    <label className="field">
                        <span>Date posted</span>
                        <select
                            value={dateFilter}
                            onChange={(e) =>
                                setDateFilter(
                                    e.target.value as CampaignDateFilter,
                                )
                            }
                        >
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="week">
                                Posted in the last 7 days
                            </option>
                            <option value="month">
                                Posted in the last 30 days
                            </option>
                        </select>
                    </label>
                </div>
                <div
                    className="campaign-filter-tabs"
                    role="group"
                    aria-label="Filter campaigns"
                >
                    {(
                        [
                            ["all", "All campaigns"],
                            ["goal-reached", "Goal reached"],
                            ["goal-unreached", "Goal unreached"],
                            ["closed", "Closed"],
                            ["draft", "Draft"],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            className={filter === value ? "active" : ""}
                            onClick={() => setFilter(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : error ? (
                    <div className="inline-error">{error}</div>
                ) : filtered.length ? (
                    <div className="campaign-grid">
                        {filtered.map((c) => (
                            <CampaignCard key={c.id} campaign={c} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No campaigns match"
                        description={
                            filter === "draft" && roleOf(user) !== "organizer"
                                ? "Draft campaigns are only visible to their organizers."
                                : "Try a different search or filter."
                        }
                    />
                )}
            </div>
        </section>
    );
    return embedded ? (
        page
    ) : (
        <div className="marketing">
            <PublicHeader />
            {page}
            <PublicFooter />
        </div>
    );
}

export function CampaignDetailPage({
    embedded = false,
}: {
    embedded?: boolean;
} = {}) {
    const { id = "" } = useParams();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [donationError, setDonationError] = useState("");
    const [viewTrackingError, setViewTrackingError] = useState("");
    const [success, setSuccess] = useState("");
    const [reviewingDonation, setReviewingDonation] = useState(false);
    const [donationDraft, setDonationDraft] = useState<{
        amount: number;
        is_anonymous: boolean;
        message: string;
    } | null>(null);
    const [donationAmount, setDonationAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"GCASH" | "MAYA">(
        "GCASH",
    );
    const [pendingPayment, setPendingPayment] =
        useState<DonationPayment | null>(null);
    const [confirmedDonationId, setConfirmedDonationId] = useState("");
    const [organizerAnalytics, setOrganizerAnalytics] =
        useState<CampaignAnalytics | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState("");
    const { signedIn, user } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        let active = true;
        const loadCampaign = async () => {
            setLoading(true);
            setError("");
            setCampaign(null);
            setViewTrackingError("");
            try {
                let loadedCampaign: Campaign;
                try {
                    loadedCampaign = await campaignApi.get(id);
                } catch (publicError) {
                    const role = roleOf(user);
                    const mayViewPrivate = [
                        "organizer",
                        "administrator",
                        "admin",
                    ].includes(role);
                    if (
                        !mayViewPrivate ||
                        !(publicError instanceof ApiError) ||
                        publicError.status !== 404
                    ) {
                        throw publicError;
                    }
                    const ownedCampaigns = await campaignApi.mine();
                    const ownedCampaign = ownedCampaigns.find(
                        (item) => item.id === id,
                    );
                    if (!ownedCampaign) throw publicError;
                    loadedCampaign = ownedCampaign;
                }
                if (!active) return;
                setCampaign(loadedCampaign);
                const isPublic = [
                    "published",
                    "active",
                    "completed",
                ].includes(
                    (loadedCampaign.status || "").trim().toLowerCase(),
                );
                if (!isPublic) return;
                try {
                    let sessionId = sessionStorage.getItem(
                        "fundora_campaign_view_session",
                    );
                    if (!sessionId) {
                        sessionId = window.crypto.randomUUID();
                        sessionStorage.setItem(
                            "fundora_campaign_view_session",
                            sessionId,
                        );
                    }
                    void campaignApi
                        .trackView(id, sessionId)
                        .catch((viewError: unknown) => {
                            if (active) {
                                setViewTrackingError(
                                    viewError instanceof Error
                                        ? viewError.message
                                        : "Campaign view analytics could not be recorded.",
                                );
                            }
                        });
                } catch (viewError) {
                    setViewTrackingError(
                        viewError instanceof Error
                            ? viewError.message
                            : "Campaign view analytics could not be recorded.",
                    );
                }
            } catch (loadError) {
                if (active) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Campaign could not be loaded.",
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        void loadCampaign();
        return () => {
            active = false;
        };
    }, [id, user?.id, user?.role]);
    const isOrganizerOwner =
        roleOf(user) === "organizer" &&
        !!user?.id &&
        campaign?.organizer_id === user.id;
    const canContribute = ["donor", "organizer"].includes(roleOf(user));
    useEffect(() => {
        if (!campaign || !isOrganizerOwner) {
            setOrganizerAnalytics(null);
            setAnalyticsError("");
            setAnalyticsLoading(false);
            return;
        }
        let active = true;
        setOrganizerAnalytics(null);
        setAnalyticsError("");
        setAnalyticsLoading(true);
        campaignApi
            .organizerAnalytics()
            .then((items) => {
                if (active) {
                    setOrganizerAnalytics(
                        items.find((item) => item.campaign_id === campaign.id) ??
                            null,
                    );
                }
            })
            .catch((analyticsLoadError: unknown) => {
                if (active) {
                    setAnalyticsError(
                        analyticsLoadError instanceof Error
                            ? analyticsLoadError.message
                            : "Campaign analytics could not be loaded.",
                    );
                }
            })
            .finally(() => {
                if (active) setAnalyticsLoading(false);
            });
        return () => {
            active = false;
        };
    }, [campaign?.id, campaign?.organizer_id, isOrganizerOwner]);
    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        const donationId = query.get("paymentDonation");
        if (query.has("paymentCanceled")) {
            setSuccess("Checkout was canceled. No contribution was recorded.");
            return;
        }
        if (!donationId || !signedIn) return;
        donationApi
            .paymentStatus(donationId)
            .then(async (payment) => {
                if (payment.status === "confirmed") {
                    setConfirmedDonationId(payment.id);
                    setSuccess(
                        `${formatMoney(payment.amount, payment.currency)} contribution confirmed via ${payment.payment_method}.`,
                    );
                    setCampaign(await campaignApi.get(id));
                } else if (["failed", "expired"].includes(payment.status)) {
                    setDonationError(
                        `Xendit payment ${payment.status}. Enter your contribution amount to try again.`,
                    );
                } else {
                    setPendingPayment(payment);
                    setSuccess(
                        "Checkout returned to Fundora. The payment is still being confirmed by Xendit.",
                    );
                }
            })
            .catch((e) => setDonationError(e.message));
    }, [id, signedIn]);
    const goal = Number(campaign?.goal_amount || 0),
        raised = Number(campaign?.raised_amount || 0),
        maxContribution = Math.min(goal, 100_000),
        pct = goal ? Math.min(100, (raised / goal) * 100) : 0;
    const dailyStatistics = organizerAnalytics?.daily_statistics ?? [];
    const maxDailyDonation = Math.max(
        0,
        ...dailyStatistics.map((day) => Number(day.amount)),
    );
    const reviewDonation = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!campaign) return;
        if (!signedIn) {
            navigate(
                `/login?returnTo=${encodeURIComponent(`/campaigns/${id}`)}`,
            );
            return;
        }
        setDonationError("");
        setSuccess("");
        setConfirmedDonationId("");
        const form = new FormData(e.currentTarget);
        const amountValue = form.get("amount");
        const amount = Number(amountValue);
        if (
            typeof amountValue !== "string" ||
            !amountValue.trim() ||
            !Number.isFinite(amount) ||
            amount < 1 ||
            amount > maxContribution ||
            Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8
        ) {
            setDonationError(
                `Enter an amount from ${formatMoney(1, "PHP")} up to ${formatMoney(maxContribution, "PHP")} with up to two decimal places.`,
            );
            return;
        }
        setDonationDraft({
            amount,
            is_anonymous: form.get("is_anonymous") === "on",
            message: String(form.get("message") || "").trim(),
        });
        setReviewingDonation(true);
    };
    const submitDonation = async () => {
        if (!campaign || !donationDraft) return;
        setBusy(true);
        setDonationError("");
        setSuccess("");
        try {
            const payment = await donationApi.create({
                campaign_id: campaign.id,
                amount: donationDraft.amount,
                payment_method: paymentMethod,
                is_anonymous: donationDraft.is_anonymous,
                message: donationDraft.message,
            });
            setReviewingDonation(false);
            setDonationDraft(null);
            if (payment.checkout_url) {
                window.location.assign(payment.checkout_url);
                return;
            }
            setPendingPayment(payment);
            setSuccess(
                `Test ${payment.payment_method} checkout created. No real money is being collected.`,
            );
        } catch (err: any) {
            setDonationError(err.message);
        } finally {
            setBusy(false);
        }
    };
    const refreshPaymentStatus = async () => {
        if (!pendingPayment) return;
        setBusy(true);
        setDonationError("");
        try {
            const payment = await donationApi.paymentStatus(pendingPayment.id);
            setPendingPayment(payment.status === "pending" ? payment : null);
            if (payment.status === "confirmed") {
                setConfirmedDonationId(payment.id);
                setSuccess(
                    `${formatMoney(payment.amount, payment.currency)} contribution confirmed via ${payment.payment_method}.`,
                );
                setCampaign(await campaignApi.get(id));
            } else if (["failed", "expired"].includes(payment.status)) {
                setDonationError(
                    `Xendit payment ${payment.status}. Review your contribution and try again.`,
                );
            } else {
                setSuccess(
                    `Payment status: ${payment.status}. Xendit will notify Fundora when it is confirmed.`,
                );
            }
        } catch (err: any) {
            setDonationError(err.message);
        } finally {
            setBusy(false);
        }
    };
    const simulatePayment = async () => {
        if (!pendingPayment) return;
        setBusy(true);
        setDonationError("");
        try {
            const payment = await donationApi.simulatePayment(
                pendingPayment.id,
            );
            setPendingPayment(null);
            setConfirmedDonationId(payment.id);
            setSuccess(
                `${formatMoney(payment.amount, payment.currency)} test contribution confirmed via ${payment.payment_method}.`,
            );
            setCampaign(await campaignApi.get(id));
        } catch (err: any) {
            setDonationError(err.message);
        } finally {
            setBusy(false);
        }
    };
    const content = (
        <main className="public-campaign-content">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : error || !campaign ? (
                    <div className="narrow-page">
                        <EmptyState
                            title="Campaign unavailable"
                            description={
                                error || "This campaign could not be found."
                            }
                            action={
                                <Link
                                    className="btn btn-outline"
                                    to="/campaigns"
                                >
                                    Browse campaigns
                                </Link>
                            }
                        />
                    </div>
                ) : (
                    <div className="detail-page">
                        <Link to="/campaigns" className="back-link">
                            ← Browse campaigns
                        </Link>
                        <div className="campaign-detail-heading">
                            <div className="eyebrow">
                                {campaign.category || "Community campaign"}
                            </div>
                            <h1>{campaign.title}</h1>
                            <p>
                                {campaign.description ||
                                    "Every contribution helps this campaign move closer to its goal."}
                            </p>
                        </div>
                        {isOrganizerOwner && isCampaignEditable(campaign) && (
                            <div className="campaign-detail-actions">
                                <Link
                                    className="btn btn-outline"
                                    to={`/organizer/campaigns/${campaign.id}/edit`}
                                >
                                    Edit campaign
                                </Link>
                            </div>
                        )}
                        <div className="detail-grid">
                            <div>
                                <div className="detail-image">
                                    {campaign.image_url ? (
                                        <CachedImage
                                            src={campaign.image_url}
                                            alt=""
                                        />
                                    ) : (
                                        <div className="campaign-placeholder">
                                            <HeartHandshake size={56} />
                                        </div>
                                    )}
                                </div>
                                <div className="detail-copy">
                                    <h2>Campaign details</h2>
                                    {campaign.beneficiary_name && (
                                        <p>
                                            <strong>Beneficiary:</strong>{" "}
                                            {campaign.beneficiary_name}
                                        </p>
                                    )}
                                    {campaign.beneficiary_details && (
                                        <p>{campaign.beneficiary_details}</p>
                                    )}
                                    {campaign.supporting_info && (
                                        <p>{campaign.supporting_info}</p>
                                    )}
                                    {campaign.ends_at && (
                                        <p>
                                            <strong>Campaign deadline:</strong>{" "}
                                            {new Date(
                                                campaign.ends_at,
                                            ).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                                {isOrganizerOwner && (
                                    <Card className="campaign-detail-analytics">
                                        <div className="campaign-analytics-heading">
                                            <div>
                                                <div className="eyebrow">
                                                    ORGANIZER WORKSPACE
                                                </div>
                                                <h2>Campaign analytics</h2>
                                            </div>
                                            <span>Last 7 days</span>
                                        </div>
                                        {analyticsError && (
                                            <div
                                                className="inline-error"
                                                role="status"
                                            >
                                                {analyticsError}
                                            </div>
                                        )}
                                        {analyticsLoading ? (
                                            <div className="center-loading">
                                                <Spinner />
                                            </div>
                                        ) : organizerAnalytics ? (
                                            <>
                                                <div className="organizer-analytics-stats">
                                                    <div>
                                                        <span>Campaign views</span>
                                                        <strong>
                                                            {organizerAnalytics.views_count}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        <span>Total donors</span>
                                                        <strong>
                                                            {organizerAnalytics.total_donors}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        <span>Donated today</span>
                                                        <strong>
                                                            {formatMoney(
                                                                organizerAnalytics.donations_today,
                                                                campaign.currency ||
                                                                    "PHP",
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>
                                                <div
                                                    className="campaign-donation-chart"
                                                    role="img"
                                                    aria-label={`${campaign.title}: confirmed donations during the last seven days`}
                                                >
                                                    {dailyStatistics.map(
                                                        (day) => {
                                                            const amount =
                                                                Number(
                                                                    day.amount,
                                                                );
                                                            const height =
                                                                maxDailyDonation >
                                                                0
                                                                    ? Math.max(
                                                                          amount >
                                                                              0
                                                                              ? 5
                                                                              : 2,
                                                                          (amount /
                                                                              maxDailyDonation) *
                                                                              100,
                                                                      )
                                                                    : 2;
                                                            return (
                                                                <div
                                                                    className="campaign-donation-day"
                                                                    key={
                                                                        day.date
                                                                    }
                                                                    title={`${new Date(`${day.date}T12:00:00`).toLocaleDateString("en-PH")}: ${formatMoney(day.amount, campaign.currency || "PHP")}`}
                                                                >
                                                                    <span className="campaign-donation-bar-track">
                                                                        <i
                                                                            style={{
                                                                                height: `${height}%`,
                                                                            }}
                                                                        />
                                                                    </span>
                                                                    <small>
                                                                        {new Date(
                                                                            `${day.date}T12:00:00`,
                                                                        ).toLocaleDateString(
                                                                            "en-PH",
                                                                            {
                                                                                weekday:
                                                                                    "short",
                                                                            },
                                                                        )}
                                                                    </small>
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                                </div>
                                                <div className="campaign-chart-caption">
                                                    Confirmed donations · last
                                                    7 days
                                                </div>
                                            </>
                                        ) : (
                                            !analyticsError && (
                                                <p className="form-note">
                                                    No donation statistics are
                                                    available yet.
                                                </p>
                                            )
                                        )}
                                    </Card>
                                )}
                            </div>
                            <Card className="donate-panel">
                                {viewTrackingError && (
                                    <div className="inline-error" role="status">
                                        Campaign views could not be updated:{" "}
                                        {viewTrackingError}
                                    </div>
                                )}
                                {campaign.status?.trim().toLowerCase() !==
                                    "published" && (
                                    <Status value={campaign.status} />
                                )}
                                <h2>Be part of the impact.</h2>
                                <p>
                                    Your contribution can help this campaign
                                    reach its goal.
                                </p>
                                <div className="detail-progress">
                                    <div>
                                        <b>
                                            {formatMoney(
                                                raised,
                                                campaign.currency || "PHP",
                                            )}
                                        </b>
                                        <span>raised</span>
                                    </div>
                                    <strong>{pct.toFixed(0)}%</strong>
                                </div>
                                <div className="progress-track">
                                    <span style={{ width: `${pct}%` }} />
                                </div>
                                <div className="goal-line">
                                    <span>Campaign goal</span>
                                    <b>
                                        {formatMoney(
                                            goal,
                                            campaign.currency || "PHP",
                                        )}
                                    </b>
                                </div>
                                {signedIn &&
                                canContribute &&
                                (campaign.currency || "PHP") === "PHP" ? (
                                    <form
                                        onSubmit={reviewDonation}
                                        className="donate-form"
                                    >
                                        {!reviewingDonation ? (
                                            <>
                                                <Field
                                                    label={`Contribution amount (${campaign.currency || "PHP"})`}
                                                    name="amount"
                                                    type="number"
                                                    min="1"
                                                    max={maxContribution}
                                                    step="0.01"
                                                    placeholder="1000"
                                                    value={donationAmount}
                                                    onChange={(event) =>
                                                        setDonationAmount(
                                                            event.target.value,
                                                        )
                                                    }
                                                    required
                                                />
                                        <div className="field">
                                            <span>Payment method</span>
                                            <div
                                                className="payment-method-options"
                                                role="radiogroup"
                                                aria-label="Payment method"
                                            >
                                                <label className="checkbox-line payment-method-choice">
                                                    <input
                                                        type="radio"
                                                        name="payment_method"
                                                        value="GCASH"
                                                        checked={
                                                            paymentMethod ===
                                                            "GCASH"
                                                        }
                                                        onChange={() =>
                                                            setPaymentMethod(
                                                                "GCASH",
                                                            )
                                                        }
                                                    />
                                                    GCash
                                                </label>
                                                <label className="checkbox-line payment-method-choice">
                                                    <input
                                                        type="radio"
                                                        name="payment_method"
                                                        value="MAYA"
                                                        checked={
                                                            paymentMethod ===
                                                            "MAYA"
                                                        }
                                                        onChange={() =>
                                                            setPaymentMethod(
                                                                "MAYA",
                                                            )
                                                        }
                                                    />
                                                    Maya
                                                </label>
                                            </div>
                                        </div>
                                        <TextareaField
                                            label="Message (optional)"
                                            name="message"
                                            rows={2}
                                            placeholder="Leave a message for the organizer"
                                        />
                                        <label className="checkbox-line">
                                            <input
                                                type="checkbox"
                                                name="is_anonymous"
                                            />{" "}
                                            Make my contribution anonymous
                                        </label>
                                            </>
                                        ) : (
                                            <div className="payment-review-panel">
                                                <div className="eyebrow">
                                                    REVIEW CONTRIBUTION
                                                </div>
                                                <div className="payment-review-row">
                                                    <span>Contribution</span>
                                                    <strong>
                                                        {formatMoney(
                                                            donationDraft?.amount,
                                                            campaign.currency || "PHP",
                                                        )}
                                                    </strong>
                                                </div>
                                                <div className="payment-review-row">
                                                    <span>Payment method</span>
                                                    <strong>
                                                        {paymentMethod === "GCASH"
                                                            ? "GCash"
                                                            : "Maya"}
                                                    </strong>
                                                </div>
                                                <div className="payment-review-row">
                                                    <span>Donor name</span>
                                                    <strong>
                                                        {donationDraft?.is_anonymous
                                                            ? "Anonymous"
                                                            : "Shown to campaign organizer"}
                                                    </strong>
                                                </div>
                                                {donationDraft?.message && (
                                                    <div className="payment-review-message">
                                                        {donationDraft.message}
                                                    </div>
                                                )}
                                                <p>
                                                    You’ll complete payment on
                                                    Xendit’s secure hosted
                                                    checkout. Fundora records
                                                    the contribution after the
                                                    provider confirms payment.
                                                </p>
                                                <div className="payment-review-actions">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            setReviewingDonation(false)
                                                        }
                                                    >
                                                        Edit contribution
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            void submitDonation()
                                                        }
                                                    >
                                                        {busy
                                                            ? "Preparing checkout…"
                                                            : "Continue to payment"}
                                                        <ArrowRight size={16} />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {donationError && (
                                            <div className="inline-error">
                                                {donationError}
                                            </div>
                                        )}
                                        {success && (
                                            <div className="inline-success">
                                                <CheckCircle2 size={15} />
                                                {success}
                                            </div>
                                        )}
                                        {confirmedDonationId && (
                                            <div className="payment-receipt-links">
                                                <Link
                                                    className="btn btn-outline"
                                                    to={`/donations/${confirmedDonationId}`}
                                                >
                                                    View donation receipt
                                                </Link>
                                                <Link
                                                    className="inline-link"
                                                    to="/my-donations"
                                                >
                                                    Donation history
                                                </Link>
                                            </div>
                                        )}
                                        {!reviewingDonation && (
                                            <Button type="submit" disabled={busy}>
                                                Review contribution{" "}
                                                <ArrowRight size={16} />
                                            </Button>
                                        )}
                                        {pendingPayment &&
                                            !pendingPayment.checkout_url && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={simulatePayment}
                                                >
                                                    Simulate successful{" "}
                                                    {pendingPayment.payment_method ===
                                                    "GCASH"
                                                        ? "GCash"
                                                        : "Maya"}{" "}
                                                    test payment
                                                </Button>
                                            )}
                                        {pendingPayment?.checkout_url && (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        window.location.assign(
                                                            pendingPayment.checkout_url!,
                                                        )
                                                    }
                                                >
                                                    Continue to hosted checkout
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={
                                                        refreshPaymentStatus
                                                    }
                                                >
                                                    Check payment status
                                                </Button>
                                            </>
                                        )}
                                    </form>
                                ) : signedIn && !canContribute ? (
                                    <div className="form-note">
                                        Only donor and organizer accounts can
                                        contribute to campaigns.
                                    </div>
                                ) : signedIn ? (
                                    <div className="form-note">
                                        GCash and Maya contributions are
                                        currently available for PHP-denominated
                                        campaigns.
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() =>
                                            navigate(
                                                `/login?returnTo=${encodeURIComponent(`/campaigns/${id}`)}`,
                                            )
                                        }
                                    >
                                        Sign in to contribute{" "}
                                        <ArrowRight size={16} />
                                    </Button>
                                )}
                            </Card>
                        </div>
                    </div>
                )}
        </main>
    );
    return embedded ? (
        <div className="portal-campaign-detail">{content}</div>
    ) : (
        <div className="marketing public-campaign-page">
            <PublicHeader />
            {content}
            <PublicFooter />
        </div>
    );
}

export function VerifyPage() {
    const { hash = "" } = useParams();
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        transactionApi
            .get(hash)
            .then(setResult)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [hash]);
    return (
        <div className="verify-page">
            <Brand />
            <Card className="verify-card">
                <div className="verify-icon">
                    <ShieldCheck size={32} />
                </div>
                <div className="eyebrow">FUNDORA TRANSACTION LOOKUP</div>
                <h1>Transaction verification</h1>
                <p className="hash-text">{hash}</p>
                {loading ? (
                    <Spinner />
                ) : error ? (
                    <div className="inline-error">{error}</div>
                ) : (
                    <>
                        <Status
                            value={
                                result?.status ||
                                result?.data?.status ||
                                "Retrieved"
                            }
                        />
                        <pre>
                            {JSON.stringify(result?.data ?? result, null, 2)}
                        </pre>
                    </>
                )}
                <Link to="/" className="btn btn-outline">
                    Return to Fundora
                </Link>
            </Card>
        </div>
    );
}
