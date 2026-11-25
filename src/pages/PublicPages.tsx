import { useEffect, useState, type FormEvent } from "react";
import {
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    HeartHandshake,
    ShieldCheck,
    Sparkles,
    Users,
    Wallet,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Brand } from "../components/Layout";
import { CachedImage } from "../components/CachedImage";
import { CampaignCard } from "../components/CampaignCard";
import { Button, Card, EmptyState, Spinner, Status } from "../components/UI";
import {
    campaignApi,
    donationApi,
    transactionApi,
} from "../lib/api";
import type { Campaign, DonationPayment } from "../lib/types";
import { formatMoney } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Field, TextareaField } from "../components/UI";

function PublicHeader({ landing = false }: { landing?: boolean }) {
    const { signedIn } = useAuth();
    const accountPath = signedIn ? "/dashboard" : "/login";
    return (
        <header className="marketing-nav">
            <Brand to={landing ? "/" : undefined} />
            <nav>
                <Link to={landing ? "#campaigns" : "/campaigns"}>Explore</Link>
                <Link to="/#how-it-works">How it works</Link>
            </nav>
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
                            Fundora records contribution requests and shows
                            transaction updates supplied by the configured
                            backend.
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
                                    Enter an amount and confirm the contribution
                                    request. The form does not process payment.
                                </p>
                            </div>
                        </div>
                        <div>
                            <span>03</span>
                            <div>
                                <h3>Check its status</h3>
                                <p>
                                    Open My donations to review the record and
                                    its on-chain transaction status.
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

export function ExploreCampaignsPage() {
    const { signedIn } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        campaignApi
            .list()
            .then(setCampaigns)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    const filtered = campaigns.filter((c) => {
        const matchesText =
            `${c.title} ${c.description || ""} ${c.category || ""}`
                .toLowerCase()
                .includes(query.toLowerCase());
        const matchesStatus =
            status === "all" || (c.status || "active").toLowerCase() === status;
        return matchesText && matchesStatus;
    });
    return (
        <div className="marketing">
            <PublicHeader />
            <section className="explore-page section-block">
                <div className="section-heading">
                    <div>
                        <div className="eyebrow">EXPLORE CAMPAIGNS</div>
                        <h2>Find a cause worth backing.</h2>
                    </div>
                    <p>
                        Browse published campaigns and follow each fundraiser's
                        progress.
                    </p>
                </div>
                <div className="explore-tools">
                    <Field
                        label="Search campaigns"
                        name="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search title or cause"
                    />
                    <label className="field">
                        <span>Status</span>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="all">All statuses</option>
                            <option value="published">Published</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                        </select>
                    </label>
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
                        description="Try a different search or status filter."
                    />
                )}
            </section>
            <PublicFooter />
        </div>
    );
}

export function CampaignDetailPage() {
    const { id = "" } = useParams();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [donationError, setDonationError] = useState("");
    const [success, setSuccess] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"GCASH" | "MAYA">(
        "GCASH",
    );
    const [pendingPayment, setPendingPayment] =
        useState<DonationPayment | null>(null);
    const { signedIn } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        campaignApi
            .get(id)
            .then((r: any) => setCampaign(r?.data ?? r?.campaign ?? r))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);
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
                    setSuccess(
                        `${formatMoney(payment.amount, payment.currency)} contribution confirmed via ${payment.payment_method}.`,
                    );
                    setCampaign(await campaignApi.get(id));
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
        pct = goal ? Math.min(100, (raised / goal) * 100) : 0;
    const contribute = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!campaign) return;
        if (!signedIn) {
            navigate(
                `/login?returnTo=${encodeURIComponent(`/campaigns/${id}`)}`,
            );
            return;
        }
        setBusy(true);
        setDonationError("");
        setSuccess("");
        const formElement = e.currentTarget;
        const form = new FormData(formElement);
        try {
            const amountValue = form.get("amount");
            const amount = Number(amountValue);
            if (
                typeof amountValue !== "string" ||
                !amountValue.trim() ||
                !Number.isFinite(amount)
            ) {
                throw new Error("Enter a valid contribution amount.");
            }
            const payment = await donationApi.create({
                campaign_id: campaign.id,
                amount,
                payment_method: paymentMethod,
                is_anonymous: form.get("is_anonymous") === "on",
                message: String(form.get("message") || ""),
            });
            formElement.reset();
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
            setSuccess(
                payment.status === "confirmed"
                    ? `${formatMoney(payment.amount, payment.currency)} contribution confirmed via ${payment.payment_method}.`
                    : `Payment status: ${payment.status}. Xendit will notify Fundora when it is confirmed.`,
            );
            if (payment.status === "confirmed") {
                setCampaign(await campaignApi.get(id));
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
    return (
        <div className="marketing public-campaign-page">
            <PublicHeader />
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
                            </div>
                            <Card className="donate-panel">
                                <Status value={campaign.status} />
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
                                (campaign.currency || "PHP") === "PHP" ? (
                                    <form
                                        onSubmit={contribute}
                                        className="donate-form"
                                    >
                                        <Field
                                            label={`Contribution amount (${campaign.currency || "PHP"})`}
                                            name="amount"
                                            type="number"
                                            min="1"
                                            max="100000"
                                            step="0.01"
                                            placeholder="1000"
                                            required
                                        />
                                        <div className="field">
                                            <span>Payment method</span>
                                            <label className="checkbox-line">
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
                                            <label className="checkbox-line">
                                                <input
                                                    type="radio"
                                                    name="payment_method"
                                                    value="MAYA"
                                                    checked={
                                                        paymentMethod === "MAYA"
                                                    }
                                                    onChange={() =>
                                                        setPaymentMethod("MAYA")
                                                    }
                                                />
                                                Maya
                                            </label>
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
                                        <Button type="submit" disabled={busy}>
                                            {busy
                                                ? "Preparing checkout…"
                                                : `Continue with ${paymentMethod === "GCASH" ? "GCash" : "Maya"}`}{" "}
                                            <ArrowRight size={16} />
                                        </Button>
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
