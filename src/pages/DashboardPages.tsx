import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    ArrowDownLeft,
    ArrowUpRight,
    CircleDollarSign,
    Clock3,
    Heart,
    Plus,
    RefreshCw,
    ShieldCheck,
    TrendingUp,
    Users,
    Wallet,
} from "lucide-react";
import {
    Link,
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";
import { Brand } from "../components/Layout";
import { CachedImage } from "../components/CachedImage";
import { CampaignCard } from "../components/CampaignCard";
import {
    Button,
    Card,
    EmptyState,
    Field,
    Spinner,
    Status,
    TextareaField,
} from "../components/UI";
import { useAuth } from "../context/AuthContext";
import {
    adminApi,
    ApiError,
    authApi,
    campaignApi,
    dashboardApi,
    donationApi,
    roleRequestApi,
    withdrawalApi,
} from "../lib/api";
import {
    connectWallet,
    injectedWallet,
    signSiweMessage,
    siweMessage,
    switchWalletChain,
} from "../lib/ethereum";
import type {
    AdminDashboardSummary,
    AdminTransaction,
    AdminUser,
    AuditLog,
    Campaign,
    Donation,
    DonationPayment,
    OrganizerRoleRequest,
    Withdrawal,
} from "../lib/types";
import { formatDate, formatMoney, roleOf } from "../lib/utils";

function PageHeading({
    eyebrow,
    title,
    description,
    action,
}: {
    eyebrow: string;
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="page-heading">
            <div>
                <div className="eyebrow">{eyebrow}</div>
                <h1>{title}</h1>
                <p>{description}</p>
            </div>
            {action}
        </div>
    );
}

const TABLE_PAGE_SIZE = 15;

function PaginatedTable<T>({
    items,
    children,
}: {
    items: T[];
    children: (items: T[]) => ReactNode;
}) {
    const [page, setPage] = useState(1);
    const pageCount = Math.ceil(items.length / TABLE_PAGE_SIZE);
    const currentPage = Math.min(page, Math.max(pageCount, 1));
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE;

    useEffect(() => {
        if (page > pageCount) {
            setPage(Math.max(pageCount, 1));
        }
    }, [page, pageCount]);

    return (
        <>
            {children(items.slice(startIndex, startIndex + TABLE_PAGE_SIZE))}
            {pageCount > 1 && (
                <div className="table-pagination">
                    <span>
                        Showing {startIndex + 1}–
                        {Math.min(startIndex + TABLE_PAGE_SIZE, items.length)}{" "}
                        of {items.length}
                    </span>
                    <div className="table-pagination-controls">
                        <Button
                            variant="outline"
                            disabled={currentPage === 1}
                            onClick={() =>
                                setPage((current) => Math.max(current - 1, 1))
                            }
                        >
                            Previous
                        </Button>
                        <span>
                            Page {currentPage} of {pageCount}
                        </span>
                        <Button
                            variant="outline"
                            disabled={currentPage === pageCount}
                            onClick={() =>
                                setPage((current) =>
                                    Math.min(current + 1, pageCount),
                                )
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}

export function DashboardPage() {
    const { user } = useAuth();
    const role = roleOf(user);
    if (role === "organizer") return <OrganizerDashboard />;
    if (role === "administrator" || role === "admin") return <AdminDashboard />;
    return <DonorDashboard />;
}
function DonorDashboard() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const paymentReturnId = new URLSearchParams(location.search).get(
        "paymentDonation",
    );
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [paymentDonationId, setPaymentDonationId] =
        useState<string | null>(paymentReturnId);
    const [paymentStatus, setPaymentStatus] = useState("");
    const [paymentMessage, setPaymentMessage] = useState("");
    const [paymentError, setPaymentError] = useState("");
    const [checkingPayment, setCheckingPayment] = useState(false);
    const autoCheckId = useRef<string | null>(null);
    const load = useCallback(() => {
        setLoading(true);
        Promise.all([campaignApi.list(), donationApi.list()])
            .then(([c, d]) => {
                setCampaigns(c);
                setDonations(d);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    const verifyPayment = useCallback(
        async (donationId: string, automatic = false) => {
            setCheckingPayment(true);
            setPaymentError("");
            setPaymentStatus("processing");
            setPaymentMessage("Checking the Xendit payment status.");
            try {
                let payment: DonationPayment | null = null;
                const attempts = automatic ? 6 : 1;
                for (let attempt = 0; attempt < attempts; attempt++) {
                    payment = await donationApi.paymentStatus(donationId);
                    const status = payment.status.toLowerCase();
                    setPaymentStatus(status);
                    if (status !== "pending" || attempt === attempts - 1) {
                        break;
                    }
                    await new Promise<void>((resolve) => {
                        window.setTimeout(resolve, 2000);
                    });
                }
                if (!payment) return;
                const status = payment.status.toLowerCase();
                if (status === "confirmed") {
                    setPaymentMessage(
                        `${formatMoney(payment.amount, payment.currency)} contribution confirmed via ${payment.payment_method}.`,
                    );
                    load();
                } else if (status === "pending") {
                    setPaymentMessage(
                        "Xendit has not confirmed this payment yet. Check again in a moment.",
                    );
                } else {
                    setPaymentMessage(
                        `Xendit payment status: ${payment.status}.`,
                    );
                    load();
                }
            } catch (err: unknown) {
                setPaymentStatus("failed");
                setPaymentMessage("We could not verify this Xendit payment.");
                setPaymentError(
                    err instanceof Error
                        ? err.message
                        : "Please try checking the payment again.",
                );
            } finally {
                setCheckingPayment(false);
                if (automatic) {
                    navigate("/dashboard", { replace: true });
                }
            }
        },
        [load, navigate],
    );
    useEffect(() => {
        if (!paymentReturnId || autoCheckId.current === paymentReturnId) return;
        autoCheckId.current = paymentReturnId;
        setPaymentDonationId(paymentReturnId);
        void verifyPayment(paymentReturnId, true);
    }, [paymentReturnId, verifyPayment]);
    const totalByCurrency = donations
        .filter((d) => (d.status || "").toLowerCase() === "confirmed")
        .reduce<Record<string, number>>((totals, donation) => {
            const currency = donation.currency || "PHP";
            totals[currency] =
                (totals[currency] || 0) + Number(donation.amount || 0);
            return totals;
        }, {});
    const total =
        Object.entries(totalByCurrency)
            .map(([currency, amount]) => formatMoney(amount, currency))
            .join(" · ") || formatMoney(0);
    return (
        <>
            <PageHeading
                eyebrow="YOUR OVERVIEW"
                title={`Good to see you${user?.display_name || user?.name ? `, ${(user?.display_name || user?.name || "").split(" ")[0]}` : ""}.`}
                description="Here’s a look at your giving journey so far."
                action={
                    <Link to="/campaigns" className="btn btn-primary">
                        Explore campaigns <ArrowUpRight size={16} />
                    </Link>
                }
            />
            {paymentDonationId && (
                <Card className="payment-return-card">
                    <div className="stat-top">
                        <span>Checkout payment status</span>
                        <Status value={paymentStatus || "pending"} />
                    </div>
                    <p>{paymentMessage || "Verifying your payment."}</p>
                    {paymentError && (
                        <div className="inline-error">{paymentError}</div>
                    )}
                    {paymentStatus !== "confirmed" && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={checkingPayment}
                            onClick={() =>
                                void verifyPayment(paymentDonationId)
                            }
                        >
                            {checkingPayment
                                ? "Checking Xendit…"
                                : "Verify payment"}
                        </Button>
                    )}
                </Card>
            )}
            {error && <div className="inline-error">{error}</div>}
            <div className="stat-grid">
                <Card className="stat-card">
                    <div className="stat-top">
                        <span>Confirmed contributions</span>
                        <span className="stat-icon blue">
                            <CircleDollarSign />
                        </span>
                    </div>
                    <strong>{total}</strong>
                    <small>Confirmed records only</small>
                </Card>
                <Card className="stat-card">
                    <div className="stat-top">
                        <span>Donations made</span>
                        <span className="stat-icon neutral">
                            <Heart />
                        </span>
                    </div>
                    <strong>{donations.length}</strong>
                    <small>Contribution records</small>
                </Card>
                <Card className="stat-card">
                    <div className="stat-top">
                        <span>Campaigns to explore</span>
                        <span className="stat-icon dark">
                            <TrendingUp />
                        </span>
                    </div>
                    <strong>{campaigns.length}</strong>
                    <small>Published campaigns</small>
                </Card>
            </div>
            <div className="section-row">
                <div>
                    <h2>Recent donations</h2>
                    <p>Your latest contribution activity</p>
                </div>
                <Link to="/my-donations" className="inline-link">
                    View all <ArrowUpRight size={15} />
                </Link>
            </div>
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : donations.length ? (
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Record</th>
                                </tr>
                            </thead>
                            <tbody>
                                {donations.slice(0, 5).map((d) => (
                                    <tr key={d.id}>
                                        <td>
                                            <b>
                                                {(d.campaign as any)?.title ||
                                                    campaigns.find(
                                                        (c) =>
                                                            c.id ===
                                                            d.campaign_id,
                                                    )?.title ||
                                                    "Campaign contribution"}
                                            </b>
                                            <small>#{d.id.slice(0, 8)}</small>
                                        </td>
                                        <td>{formatDate(d.created_at)}</td>
                                        <td>
                                            <b>
                                                {formatMoney(
                                                    d.amount,
                                                    d.currency || "PHP",
                                                )}
                                            </b>
                                            {d.payment_currency === "ETH" &&
                                                d.currency !== "ETH" && (
                                                    <small>
                                                        {formatMoney(
                                                            d.payment_amount ||
                                                                0,
                                                            "ETH",
                                                        )}{" "}
                                                        paid
                                                    </small>
                                                )}
                                        </td>
                                        <td>
                                            <Status
                                                value={
                                                    d.transaction_status ||
                                                    d.status
                                                }
                                            />
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                {d.status?.toLowerCase() ===
                                                    "pending" &&
                                                    ["gcash", "maya"].includes(
                                                        (
                                                            d.payment_method ||
                                                            ""
                                                        ).toLowerCase(),
                                                    ) && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            disabled={
                                                                checkingPayment
                                                            }
                                                            onClick={() => {
                                                                setPaymentDonationId(
                                                                    d.id,
                                                                );
                                                                void verifyPayment(
                                                                    d.id,
                                                                );
                                                            }}
                                                        >
                                                            Verify payment
                                                        </Button>
                                                    )}
                                                <Link
                                                    className="inline-link"
                                                    to={`/donations/${d.id}`}
                                                >
                                                    View record{" "}
                                                    <ArrowUpRight size={14} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        title="Your giving story starts here"
                        description="When you contribute to a campaign, your donation activity will appear here."
                        action={
                            <Link to="/campaigns" className="btn btn-primary">
                                Explore campaigns
                            </Link>
                        }
                    />
                )}
            </Card>
            <div className="section-row">
                <div>
                    <h2>Causes you can support</h2>
                    <p>Discover campaigns making a difference</p>
                </div>
                <Link to="/campaigns" className="inline-link">
                    Explore all <ArrowUpRight size={15} />
                </Link>
            </div>
            {loading ? (
                <div className="center-loading">
                    <Spinner />
                </div>
            ) : (
                <div className="campaign-grid">
                    {campaigns.slice(0, 3).map((c) => (
                        <CampaignCard key={c.id} campaign={c} />
                    ))}
                </div>
            )}
        </>
    );
}
export function DonationsPage() {
    const [items, setItems] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        donationApi
            .list()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    return (
        <>
            <PageHeading
                eyebrow="YOUR ACTIVITY"
                title="My donations"
                description="A record of the contributions made through your Fundora account."
            />
            <Card className="table-card">
                {error && <div className="inline-error">{error}</div>}
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : items.length ? (
                    <PaginatedTable items={items}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Reference</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Record</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((d) => (
                                    <tr key={d.id}>
                                        <td>
                                            <b>
                                                {(d.campaign as any)?.title ||
                                                    d.campaign_title ||
                                                    "Campaign contribution"}
                                            </b>
                                        </td>
                                        <td>#{d.id.slice(0, 10)}</td>
                                        <td>{formatDate(d.created_at)}</td>
                                        <td>
                                            <b>
                                                {formatMoney(
                                                    d.amount,
                                                    d.currency || "PHP",
                                                )}
                                            </b>
                                            {d.payment_currency === "ETH" &&
                                                d.currency !== "ETH" && (
                                                    <small>
                                                        {formatMoney(
                                                            d.payment_amount ||
                                                                0,
                                                            "ETH",
                                                        )}{" "}
                                                        paid
                                                    </small>
                                                )}
                                        </td>
                                        <td>
                                            <Status
                                                value={
                                                    d.transaction_status ||
                                                    d.status
                                                }
                                            />
                                        </td>
                                        <td>
                                            <Link
                                                className="inline-link"
                                                to={`/donations/${d.id}`}
                                            >
                                                View record{" "}
                                                <ArrowUpRight size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No donations yet"
                        description="Your contributions will be listed here once you support a campaign."
                    />
                )}
            </Card>
        </>
    );
}
export function OrganizerDashboard() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        const refresh = () => {
            campaignApi
                .mine()
                .then((items) => {
                    if (active) {
                        setCampaigns(items);
                        setError("");
                    }
                })
                .catch((e) => {
                    if (active) setError(e.message);
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        };
        refresh();
        const interval = window.setInterval(refresh, 15000);
        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, []);
    const active = campaigns.filter((c) =>
        ["active", "published"].includes((c.status || "").toLowerCase()),
    ).length;
    return (
        <>
            <PageHeading
                eyebrow="ORGANIZER WORKSPACE"
                title="Your campaigns."
                description="Create, manage, and monitor the campaigns you organize."
            />
            {error && <div className="inline-error">{error}</div>}
            <div className="stat-grid">
                <Card className="stat-card">
                    <div className="stat-top">
                        <span>Campaigns visible</span>
                        <span className="stat-icon blue">
                            <Heart />
                        </span>
                    </div>
                    <strong>{campaigns.length}</strong>
                    <small>Returned by the campaign API</small>
                </Card>
                <Card className="stat-card">
                    <div className="stat-top">
                        <span>Published / active</span>
                        <span className="stat-icon neutral">
                            <TrendingUp />
                        </span>
                    </div>
                    <strong>{active}</strong>
                    <small>Based on campaign status</small>
                </Card>
                <Card className="stat-card">
                    <div className="stat-top">
                        <span>Drafts</span>
                        <span className="stat-icon dark">
                            <Clock3 />
                        </span>
                    </div>
                    <strong>
                        {
                            campaigns.filter(
                                (c) =>
                                    (c.status || "").toLowerCase() === "draft",
                            ).length
                        }
                    </strong>
                    <small>Awaiting publication</small>
                </Card>
            </div>
            <div className="section-row">
                <div>
                    <h2>Campaign management</h2>
                    <p>Campaign records returned by your backend</p>
                </div>
            </div>
            {loading ? (
                <div className="center-loading">
                    <Spinner />
                </div>
            ) : campaigns.length ? (
                <div className="campaign-grid">
                    {campaigns.map((c) => (
                        <div key={c.id} className="organizer-campaign-entry">
                            <CampaignCard
                                campaign={c}
                                linkTo={`/organizer/campaigns/${c.id}/edit`}
                            />
                            {c.review_feedback && (
                                <div className="inline-error">
                                    Administrator feedback: {c.review_feedback}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState
                    title="No campaigns found"
                    description="Create your first campaign to start organizing support."
                />
            )}
        </>
    );
}
export function CreateCampaignPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(!!id);
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        if (!id) return;
        campaignApi
            .mine()
            .then((items) => {
                const found = items.find((item) => item.id === id);
                if (!found)
                    throw new Error(
                        "Campaign not found or you do not have permission to edit it.",
                    );
                setCampaign(found);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);
    const toLocalDateTime = (value?: string | null) => {
        if (!value) return "";
        const date = new Date(value);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
    };
    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const submitForReview = f.get("submit_for_review") === "on";
        const startsAt = String(f.get("starts_at") || "");
        const endsAt = String(f.get("ends_at") || "");
        const fields = {
            title: String(f.get("title")),
            description: String(f.get("description")),
            category: String(f.get("category") || ""),
            beneficiary_name: String(f.get("beneficiary_name") || ""),
            beneficiary_details: String(f.get("beneficiary_details") || ""),
            supporting_info: String(f.get("supporting_info") || ""),
            image_url: String(f.get("image_url") || ""),
            goal_amount: String(f.get("goal_amount")),
            starts_at: startsAt ? new Date(startsAt).toISOString() : null,
            ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        };
        try {
            if (id) {
                await campaignApi.update(id, {
                    ...fields,
                    ...(submitForReview ? { status: "pending_review" } : {}),
                });
            } else {
                await campaignApi.create({
                    ...fields,
                    image_url: fields.image_url || null,
                    currency: "PHP",
                    network: "sepolia",
                    submit_for_review: submitForReview,
                });
            }
            navigate("/organizer/campaigns");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };
    if (loading)
        return (
            <div className="center-loading">
                <Spinner />
            </div>
        );
    if (id && !campaign)
        return (
            <>
                <PageHeading
                    eyebrow="CAMPAIGN SETUP"
                    title="Campaign unavailable."
                    description="This campaign could not be loaded for editing."
                />
                <div className="inline-error">
                    {error || "Campaign not found."}
                </div>
                <Link to="/organizer/campaigns" className="btn btn-outline">
                    Back to campaigns
                </Link>
            </>
        );
    const editableStatuses = ["draft", "rejected", "changes_requested"];
    const canSubmit =
        !!campaign &&
        editableStatuses.includes((campaign.status || "").toLowerCase());
    return (
        <>
            <PageHeading
                eyebrow="CAMPAIGN SETUP"
                title={id ? "Edit campaign." : "Create a campaign."}
                description={
                    id
                        ? "Update a draft or returned campaign, then resubmit it for review."
                        : "Share the story, set a goal, and invite your community to take part."
                }
            />
            <Card className="form-card">
                <form onSubmit={submit} className="form-grid">
                    <Field
                        label="Campaign title"
                        name="title"
                        defaultValue={campaign?.title || ""}
                        placeholder="e.g. A brighter classroom for every child"
                        required
                    />
                    <Field
                        label={`Fundraising goal (${campaign?.currency || "PHP"})`}
                        name="goal_amount"
                        type="number"
                        min={campaign?.currency === "ETH" ? "0.000000000000000001" : "1"}
                        step={campaign?.currency === "ETH" ? "0.000000000000000001" : "1"}
                        defaultValue={campaign?.goal_amount || ""}
                        placeholder="100000"
                        required
                    />
                    <Field
                        label="Campaign category"
                        name="category"
                        defaultValue={campaign?.category || ""}
                        placeholder="Education, health, community"
                    />
                    <Field
                        label="Beneficiary name"
                        name="beneficiary_name"
                        defaultValue={campaign?.beneficiary_name || ""}
                        placeholder="Person or organization"
                    />
                    <div className="full-field">
                        <TextareaField
                            label="Campaign story"
                            name="description"
                            rows={5}
                            defaultValue={campaign?.description || ""}
                            placeholder="Tell supporters what this campaign is for, who it helps, and how contributions will be used."
                            required
                        />
                    </div>
                    <div className="full-field">
                        <TextareaField
                            label="Beneficiary details"
                            name="beneficiary_details"
                            rows={3}
                            defaultValue={campaign?.beneficiary_details || ""}
                            placeholder="Additional information about the people or organization benefiting."
                        />
                    </div>
                    <div className="full-field">
                        <TextareaField
                            label="Supporting information"
                            name="supporting_info"
                            rows={3}
                            defaultValue={campaign?.supporting_info || ""}
                            placeholder="Links or context that help an administrator review this campaign."
                        />
                    </div>
                    <div className="full-field">
                        <Field
                            label="Cover image URL (optional)"
                            name="image_url"
                            type="url"
                            defaultValue={campaign?.image_url || ""}
                            placeholder="https://example.com/campaign.jpg"
                        />
                    </div>
                    <Field
                        label="Start date (optional)"
                        name="starts_at"
                        type="datetime-local"
                        defaultValue={toLocalDateTime(campaign?.starts_at)}
                    />
                    <Field
                        label="Deadline"
                        name="ends_at"
                        type="datetime-local"
                        defaultValue={toLocalDateTime(campaign?.ends_at)}
                    />
                    {(!id || canSubmit) && (
                        <label className="checkbox-line full-field">
                            <input type="checkbox" name="submit_for_review" />{" "}
                            {id
                                ? "Submit updated campaign for review"
                                : "Submit for administrator review"}
                        </label>
                    )}
                    {campaign?.review_feedback && (
                        <div className="full-field form-note">
                            <ShieldCheck size={16} /> Administrator feedback:{" "}
                            {campaign.review_feedback}
                        </div>
                    )}
                    {error && (
                        <div className="inline-error full-field">{error}</div>
                    )}
                    <div className="form-actions full-field">
                        <Link
                            to="/organizer/campaigns"
                            className="btn btn-outline"
                        >
                            Cancel
                        </Link>
                        <Button type="submit" disabled={busy}>
                            {busy
                                ? "Saving…"
                                : id
                                  ? "Save changes"
                                  : "Save campaign"}{" "}
                            <ArrowUpRight size={16} />
                        </Button>
                    </div>
                </form>
            </Card>
        </>
    );
}
export function AdminDashboard() {
    const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
    const [items, setItems] = useState<Withdrawal[]>([]);
    const [audit, setAudit] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [auditError, setAuditError] = useState("");
    const load = () => {
        setLoading(true);
        setError("");
        Promise.all([adminApi.summary(), adminApi.withdrawals()])
            .then(([stats, withdrawals]) => {
                setSummary(stats);
                setItems(withdrawals);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
        setAuditError("");
        adminApi
            .audit()
            .then(setAudit)
            .catch((e) => setAuditError(e.message));
    };
    useEffect(load, []);
    const donationValue =
        summary?.confirmed_donation_value
            .map((total) => formatMoney(total.amount, total.currency))
            .join(" · ") || "—";
    const pendingItems = items.filter(
        (i) => (i.status || "").toLowerCase() === "pending",
    );
    return (
        <>
            <PageHeading
                eyebrow="ADMINISTRATION"
                title="Platform overview."
                description="Monitor platform activity, recorded contributions, and withdrawal requests."
                action={
                    <Link to="/admin/withdrawals" className="btn btn-primary">
                        Review withdrawals <ArrowUpRight size={16} />
                    </Link>
                }
            />
            {error && <div className="inline-error">{error}</div>}
            {loading ? (
                <div className="center-loading">
                    <Spinner />
                </div>
            ) : (
                summary && (
                    <div className="stat-grid">
                        <Card className="stat-card">
                            <div className="stat-top">
                                <span>Registered users</span>
                                <span className="stat-icon blue">
                                    <Users />
                                </span>
                            </div>
                            <strong>{summary.total_users}</strong>
                            <small>
                                {summary.total_donors} donors ·{" "}
                                {summary.total_organizers} organizers
                            </small>
                        </Card>
                        <Card className="stat-card">
                            <div className="stat-top">
                                <span>Campaigns</span>
                                <span className="stat-icon neutral">
                                    <Heart />
                                </span>
                            </div>
                            <strong>{summary.total_campaigns}</strong>
                            <small>
                                {summary.active_campaigns} published or active
                            </small>
                        </Card>
                        <Card className="stat-card">
                            <div className="stat-top">
                                <span>Confirmed donations</span>
                                <span className="stat-icon dark">
                                    <CircleDollarSign />
                                </span>
                            </div>
                            <strong>{summary.confirmed_donations}</strong>
                            <small>{donationValue}</small>
                        </Card>
                        <Card className="stat-card">
                            <div className="stat-top">
                                <span>Pending withdrawals</span>
                                <span className="stat-icon blue">
                                    <Wallet />
                                </span>
                            </div>
                            <strong>{summary.pending_withdrawals}</strong>
                            <small>Awaiting an administrator decision</small>
                        </Card>
                        <Card className="stat-card">
                            <div className="stat-top">
                                <span>Blockchain transactions</span>
                                <span className="stat-icon neutral">
                                    <ShieldCheck />
                                </span>
                            </div>
                            <strong>{summary.total_transactions}</strong>
                            <small>
                                {summary.confirmed_transactions} confirmed ·{" "}
                                {summary.flagged_transactions} flagged for
                                review
                            </small>
                        </Card>
                    </div>
                )
            )}
            <div className="section-row">
                <div>
                    <h2>Recent withdrawal requests</h2>
                    <p>Administrator-only review queue</p>
                </div>
                <Link to="/admin/withdrawals" className="inline-link">
                    Open queue <ArrowUpRight size={15} />
                </Link>
            </div>
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : pendingItems.length ? (
                    <WithdrawalTable
                        items={pendingItems.slice(0, 5)}
                        onReviewed={load}
                    />
                ) : (
                    <EmptyState
                        title="Nothing to review"
                        description="New withdrawal requests will appear here when submitted."
                    />
                )}
            </Card>
            <div className="section-row">
                <div>
                    <h2>Recent platform activity</h2>
                    <p>Latest records from the administrative audit trail</p>
                </div>
                <Link to="/admin/audit" className="inline-link">
                    Open audit log <ArrowUpRight size={15} />
                </Link>
            </div>
            {auditError && <div className="inline-error">{auditError}</div>}
            <Card>
                {audit.length ? (
                    <div className="activity-list">
                        {audit.slice(0, 5).map((log) => (
                            <div key={log.id}>
                                <div>
                                    <b>{log.action.replaceAll(".", " ")}</b>
                                    <small>
                                        {log.actor_email || "System"} ·{" "}
                                        {log.entity_type}
                                        {log.entity_id
                                            ? ` #${log.entity_id.slice(0, 8)}`
                                            : ""}
                                    </small>
                                </div>
                                <time>{formatDate(log.created_at)}</time>
                            </div>
                        ))}
                    </div>
                ) : !auditError ? (
                    <EmptyState
                        title="No recent activity"
                        description="Administrative events will appear here as they are recorded."
                    />
                ) : null}
            </Card>
        </>
    );
}
function WithdrawalTable({
    items,
    onReviewed,
}: {
    items: Withdrawal[];
    onReviewed: () => void;
}) {
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const review = async (id: string, approve: boolean) => {
        let reason: string | undefined;
        if (!approve) {
            const entered = window.prompt(
                "Reason for rejecting this withdrawal",
            );
            if (entered === null) return;
            if (!entered.trim()) {
                setError("A rejection reason is required.");
                return;
            }
            reason = entered.trim();
        }
        setBusy(id);
        setError("");
        try {
            await withdrawalApi.review(
                id,
                approve ? "approve" : "reject",
                reason,
            );
            onReviewed();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy("");
        }
    };
    return (
        <>
            <PaginatedTable items={items}>
            {(pageItems) => (
                <div className="table-scroll">
                            <table>
                <thead>
                    <tr>
                        <th>Organizer</th>
                        <th>Campaign</th>
                        <th>Amount</th>
                        <th>Available balance</th>
                        <th>Destination</th>
                        <th>Purpose</th>
                        <th>Status</th>
                        <th>Review reason</th>
                        <th>Decision</th>
                    </tr>
                </thead>
                <tbody>
                    {pageItems.map((i) => (
                        <tr key={i.id}>
                            <td>{i.requester_email || "Organizer"}</td>
                            <td>
                                <b>
                                    {i.campaign_title ||
                                        (i.campaign as any)?.title ||
                                        i.campaign_id ||
                                        "Campaign"}
                                </b>
                                <small>{formatDate(i.created_at)}</small>
                            </td>
                            <td>
                                {formatMoney(i.amount, i.currency || "PHP")}
                            </td>
                            <td>
                                {formatMoney(
                                    i.available_balance,
                                    i.currency || "PHP",
                                )}
                            </td>
                            <td className="wallet-cell">
                                {i.destination_address ||
                                    i.wallet_address ||
                                    "—"}
                            </td>
                            <td>{i.purpose || "—"}</td>
                            <td>
                                <Status value={i.status} />
                            </td>
                            <td>{i.review_reason || "—"}</td>
                            <td>
                                {(i.status || "").toLowerCase() ===
                                "pending" ? (
                                    <div className="row-actions">
                                        <Button
                                            variant="outline"
                                            disabled={busy === i.id}
                                            onClick={() => review(i.id, false)}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            disabled={busy === i.id}
                                            onClick={() => review(i.id, true)}
                                        >
                                            {busy === i.id ? "…" : "Approve"}
                                        </Button>
                                    </div>
                                ) : (
                                    "—"
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
                            </table>
                        </div>
            )}
            </PaginatedTable>
            {error && <div className="inline-error">{error}</div>}
        </>
    );
}
export function WithdrawalsPage() {
    const [items, setItems] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const load = () => {
        setLoading(true);
        adminApi
            .withdrawals()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);
    const filtered =
        statusFilter === "all"
            ? items
            : items.filter((item) => item.status === statusFilter);
    return (
        <>
            <PageHeading
                eyebrow="ADMIN QUEUE"
                title="Withdrawal requests."
                description="Review and record a decision for each organizer withdrawal request."
                action={
                    <Button variant="outline" onClick={load}>
                        <RefreshCw size={15} /> Refresh
                    </Button>
                }
            />
            {error && <div className="inline-error">{error}</div>}
            <div className="admin-filters">
                <label className="field">
                    <span>Status</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All statuses</option>
                        {Array.from(
                            new Set(
                                items
                                    .map((item) => item.status)
                                    .filter(
                                        (value): value is string => !!value,
                                    ),
                            ),
                        ).map((status) => (
                            <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : filtered.length ? (
                    <WithdrawalTable items={filtered} onReviewed={load} />
                ) : (
                    <EmptyState
                        title="No matching requests"
                        description="There are no withdrawal requests for this status."
                    />
                )}
            </Card>
        </>
    );
}

export function ProfilePage() {
    const { user, reloadUser } = useAuth();
    const [displayName, setDisplayName] = useState(
        user?.display_name || user?.name || "",
    );
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [walletBusy, setWalletBusy] = useState(false);
    const [roleBusy, setRoleBusy] = useState(false);
    const [accessError, setAccessError] = useState("");
    const [accessSuccess, setAccessSuccess] = useState("");
    const [roleRequest, setRoleRequest] = useState<any>(null);
    useEffect(() => {
        setDisplayName(user?.display_name || user?.name || "");
        setAvatarUrl(user?.avatar_url || "");
    }, [user]);
    useEffect(() => {
        if (roleOf(user) === "donor")
            roleRequestApi
                .mine()
                .then(setRoleRequest)
                .catch((err) => setAccessError(err.message));
    }, [user]);
    const save = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            await authApi.updateMe({
                display_name: displayName,
                avatar_url: avatarUrl || null,
            });
            await reloadUser();
            setSuccess("Profile updated.");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };
    const requestRole = async () => {
        setRoleBusy(true);
        setAccessError("");
        setAccessSuccess("");
        try {
            const request: any = await roleRequestApi.requestOrganizer();
            setRoleRequest(request?.data ?? request);
            setAccessSuccess("Organizer access requested.");
        } catch (err: any) {
            setAccessError(err.message);
        } finally {
            setRoleBusy(false);
        }
    };
    const linkWallet = async () => {
        setWalletBusy(true);
        setAccessError("");
        setAccessSuccess("");
        try {
            await reloadUser();
            const wallet = injectedWallet();
            const address = await connectWallet(wallet);
            const challenge = await authApi.requestWalletLinkNonce(address);
            await switchWalletChain(wallet, challenge.chain_id);
            const message = siweMessage(challenge, address);
            const signature = await signSiweMessage(wallet, message, address);
            await reloadUser();
            await authApi.linkWallet(message, signature);
            await reloadUser();
            setAccessSuccess("Payout wallet linked to your profile.");
        } catch (err: any) {
            setAccessError(
                err instanceof ApiError && err.status === 401
                    ? "MetaMask is connected, but Fundora could not verify the signature. Retry and approve the signature request. If it persists, sign in again and check the SIWE settings."
                    : err instanceof Error
                      ? err.message
                      : String(err),
            );
        } finally {
            setWalletBusy(false);
        }
    };
    return (
        <>
            <PageHeading
                eyebrow="ACCOUNT"
                title="Profile settings."
                description="Manage your public Fundora profile."
            />
            <div className="profile-grid profile-settings-grid">
                <Card>
                    <form onSubmit={save} className="form-grid">
                        <Field
                            label="Display name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                        />
                        <Field
                            label="Avatar image URL"
                            type="url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://example.com/avatar.jpg"
                        />
                        <div className="field full-field">
                            <span>Email address</span>
                            <input value={user?.email || ""} readOnly />
                        </div>
                        {error && (
                            <div className="inline-error full-field">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="inline-success full-field">
                                {success}
                            </div>
                        )}
                        <div className="form-actions full-field">
                            <Button type="submit" disabled={busy}>
                                {busy ? "Saving…" : "Save profile"}{" "}
                                <ArrowUpRight size={16} />
                            </Button>
                        </div>
                    </form>
                </Card>
                <Card className="profile-access-card">
                    <div className="eyebrow">ACCOUNT ACCESS</div>
                    <section className="profile-access-section">
                        <div className="profile-access-heading">
                            <div>
                                <h2>Account role</h2>
                                <p>
                                    Your role determines which Fundora tools are
                                    available to you.
                                </p>
                            </div>
                            <Status value={roleOf(user)} />
                        </div>
                        {roleOf(user) === "donor" && (
                            <div className="profile-access-action">
                                <p>
                                    Request organizer access to create and
                                    manage campaigns.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={requestRole}
                                    disabled={
                                        roleBusy ||
                                        roleRequest?.status === "pending" ||
                                        roleRequest?.status === "approved"
                                    }
                                >
                                    {roleBusy
                                        ? "Submitting request…"
                                        : roleRequest?.status === "pending"
                                          ? "Organizer request pending"
                                          : roleRequest?.status === "approved"
                                            ? "Organizer request approved"
                                            : "Request organizer access"}
                                </Button>
                            </div>
                        )}
                    </section>
                    <section className="profile-access-section">
                        <div className="profile-access-heading">
                            <div>
                                <h2>Payout wallet</h2>
                                <p>
                                    ETH campaign contributions are sent directly
                                    to this wallet.
                                </p>
                            </div>
                            <span
                                className={`wallet-status ${user?.wallet_address ? "is-connected" : ""}`}
                            >
                                {user?.wallet_address
                                    ? "Connected"
                                    : "Not connected"}
                            </span>
                        </div>
                        {user?.wallet_address ? (
                            <div className="profile-wallet-address">
                                <span>MetaMask address</span>
                                <code>{user.wallet_address}</code>
                                <small>
                                    Wallet changes require Fundora support.
                                </small>
                            </div>
                        ) : (
                            <div className="profile-access-action">
                                <p>
                                    Connect MetaMask and sign a message to verify
                                    wallet ownership. No transaction or gas fee
                                    is required.
                                </p>
                                <Button
                                    type="button"
                                    onClick={linkWallet}
                                    disabled={walletBusy}
                                >
                                    <Wallet size={16} />
                                    {walletBusy
                                        ? "Connecting wallet…"
                                        : "Connect payout wallet"}
                                </Button>
                            </div>
                        )}
                    </section>
                    {accessError && (
                        <div className="inline-error" role="alert">
                            {accessError}
                        </div>
                    )}
                    {accessSuccess && (
                        <div
                            className="inline-success"
                            role="status"
                            aria-live="polite"
                        >
                            {accessSuccess}
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}

export function DonationsDetailPage() {
    const { id = "" } = useParams();
    const [item, setItem] = useState<any>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        donationApi
            .get(id)
            .then(setItem)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);
    if (loading)
        return (
            <div className="center-loading">
                <Spinner />
            </div>
        );
    if (error || !item)
        return (
            <div className="narrow-page">
                <EmptyState
                    title="Contribution record unavailable"
                    description={error || "This record could not be found."}
                    action={
                        <Link to="/my-donations" className="btn btn-outline">
                            Back to donations
                        </Link>
                    }
                />
            </div>
        );
    const receipt = item?.data ?? item;
    const isOffchainPayment = ["xendit", "mock"].includes(
        (receipt.payment_provider || "").toLowerCase(),
    );
    return (
        <div className="narrow-page print-page">
            <Card className="receipt-card">
                <div className="receipt-head">
                    <Brand />
                    <Status value={receipt.status} />
                </div>
                <div className="eyebrow">CONTRIBUTION RECORD</div>
                <h1>
                    {receipt.campaign_title ||
                        receipt.campaign?.title ||
                        "Campaign contribution"}
                </h1>
                <div className="receipt-grid">
                    <div>
                        <span>Reference</span>
                        <b>#{receipt.id}</b>
                    </div>
                    <div>
                        <span>Amount</span>
                        <b>
                            {formatMoney(
                                receipt.amount,
                                receipt.currency || "PHP",
                            )}
                        </b>
                    </div>
                    {receipt.payment_currency === "ETH" &&
                        receipt.currency !== "ETH" && (
                            <>
                                <div>
                                    <span>Paid on Sepolia</span>
                                    <b>
                                        {formatMoney(
                                            receipt.payment_amount,
                                            "ETH",
                                        )}
                                    </b>
                                </div>
                                <div>
                                    <span>Recorded conversion rate</span>
                                    <b>
                                        1 ETH ={" "}
                                        {formatMoney(
                                            receipt.exchange_rate,
                                            receipt.currency,
                                        )}
                                    </b>
                                    <small>
                                        {receipt.exchange_rate_provider} ·{" "}
                                        {formatDate(receipt.exchange_rate_at)}
                                    </small>
                                </div>
                            </>
                        )}
                    <div>
                        <span>Date</span>
                        <b>{formatDate(receipt.created_at)}</b>
                    </div>
                    <div>
                        <span>Contribution status</span>
                        <b>
                            {receipt.status || "Pending"}
                        </b>
                    </div>
                    {receipt.payment_provider && (
                        <>
                            <div>
                                <span>Payment provider</span>
                                <b>
                                    {receipt.payment_provider === "xendit"
                                        ? "Xendit"
                                        : "Fundora test simulator"}
                                </b>
                            </div>
                            <div>
                                <span>Payment method</span>
                                <b>{receipt.payment_method || "Not recorded"}</b>
                            </div>
                            {receipt.payment_reference && (
                                <div>
                                    <span>Provider reference</span>
                                    <b>{receipt.payment_reference}</b>
                                </div>
                            )}
                        </>
                    )}
                </div>
                {isOffchainPayment ? (
                    <div className="receipt-grid">
                        <div>
                            <span>Transaction hash</span>
                            <b>Not applicable — off-chain payment</b>
                        </div>
                        <div>
                            <span>Network</span>
                            <b>Not applicable</b>
                        </div>
                        <div>
                            <span>On-chain confirmation</span>
                            <b>Not applicable</b>
                        </div>
                        <div>
                            <span>Block</span>
                            <b>Not applicable</b>
                        </div>
                        <div>
                            <span>Confirmations</span>
                            <b>Not applicable</b>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="receipt-grid">
                            <div>
                                <span>Network</span>
                                <b>
                                    {receipt.transaction_network ||
                                        "Not recorded"}
                                </b>
                            </div>
                            <div>
                                <span>On-chain confirmation</span>
                                <b>
                                    {receipt.transaction_verified == null
                                        ? "Not available"
                                        : receipt.transaction_verified
                                          ? "Yes"
                                          : "No"}
                                </b>
                            </div>
                            <div>
                                <span>Block</span>
                                <b>{receipt.block_number ?? "Not available"}</b>
                            </div>
                            <div>
                                <span>Confirmations</span>
                                <b>{receipt.confirmations ?? "Not available"}</b>
                            </div>
                        </div>
                        <div className="receipt-hash">
                            <span>Transaction hash</span>
                            <code>
                                {receipt.transaction_hash || "Not recorded"}
                            </code>
                        </div>
                    </>
                )}
                <p className="receipt-warning">
                    {isOffchainPayment
                        ? "This record shows Fundora’s payment status for the off-chain contribution. It is not a tax receipt."
                        : "This record is not proof of payment or a tax receipt. It shows whether Fundora independently verified the Sepolia transaction."}
                </p>
                <div className="form-actions">
                    <Button variant="outline" onClick={() => window.print()}>
                        <ArrowUpRight size={16} /> Print record
                    </Button>
                    <Link to="/my-donations" className="btn btn-outline">
                        Back to history
                    </Link>
                </div>
            </Card>
        </div>
    );
}

export function OrganizerCampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        campaignApi
            .mine()
            .then(setCampaigns)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    return (
        <>
            <PageHeading
                eyebrow="ORGANIZER WORKSPACE"
                title="My campaigns."
                description="Create, edit, submit, and monitor your campaigns."
                action={
                    <Link
                        to="/organizer/campaigns/new"
                        className="btn btn-primary"
                    >
                        <Plus size={17} /> Create campaign
                    </Link>
                }
            />
            {error && <div className="inline-error">{error}</div>}
            {loading ? (
                <div className="center-loading">
                    <Spinner />
                </div>
            ) : campaigns.length ? (
                <div className="campaign-grid">
                    {campaigns.map((c) => (
                        <div key={c.id} className="organizer-campaign-entry">
                            <CampaignCard
                                campaign={c}
                                linkTo={`/organizer/campaigns/${c.id}/edit`}
                            />
                            {c.review_feedback && (
                                <div className="inline-error">
                                    Administrator feedback: {c.review_feedback}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState
                    title="No campaigns yet"
                    description="Create a campaign and submit it for administrator review."
                />
            )}
        </>
    );
}

export function OrganizerDonationsPage() {
    const [items, setItems] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState<Donation | null>(null);
    useEffect(() => {
        let active = true;
        const refresh = () => {
            donationApi
                .organizerList()
                .then((donations) => {
                    if (active) {
                        setItems(donations);
                        setError("");
                    }
                })
                .catch((e) => {
                    if (active) setError(e.message);
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        };
        refresh();
        const interval = window.setInterval(refresh, 15000);
        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, []);
    const isOffchainPayment = ["xendit", "mock"].includes(
        (selected?.payment_provider || "").toLowerCase(),
    );
    return (
        <>
            <PageHeading
                eyebrow="CAMPAIGN ACTIVITY"
                title="Donation records."
                description="Review campaign contributions, provider payments, and on-chain transaction details."
            />
            <Card className="table-card">
                {error && <div className="inline-error">{error}</div>}
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : items.length ? (
                    <PaginatedTable items={items}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Donor</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Payment / transaction</th>
                                    <th>Status</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((d) => (
                                    <tr key={d.id}>
                                        <td>
                                            <b>
                                                {d.campaign_title ||
                                                    d.campaign?.title ||
                                                    "Campaign"}
                                            </b>
                                            <small>#{d.id.slice(0, 8)}</small>
                                        </td>
                                        <td>
                                            {d.is_anonymous
                                                ? "Anonymous"
                                                : d.donor_name ||
                                                  "Fundora donor"}
                                        </td>
                                        <td>
                                            <b>
                                                {formatMoney(
                                                    d.amount,
                                                    d.currency || "PHP",
                                                )}
                                            </b>
                                            {d.payment_currency === "ETH" &&
                                                d.currency !== "ETH" && (
                                                    <small>
                                                        {formatMoney(
                                                            d.payment_amount ||
                                                                0,
                                                            "ETH",
                                                        )}{" "}
                                                        paid
                                                    </small>
                                                )}
                                        </td>
                                        <td>{formatDate(d.created_at)}</td>
                                        <td className="wallet-cell">
                                            {d.transaction_hash ||
                                                (d.payment_provider
                                                    ? `${d.payment_method || "Payment"} · ${d.payment_provider}`
                                                    : "—")}
                                        </td>
                                        <td>
                                            <Status
                                                value={
                                                    d.transaction_status ||
                                                    d.status
                                                }
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="table-name-button"
                                                onClick={() => setSelected(d)}
                                            >
                                                Inspect
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No donation records"
                        description="Confirmed and pending records for your campaigns will appear here."
                    />
                )}
            </Card>
            {selected && (
                <Card className="admin-campaign-details">
                    <div className="section-row">
                        <div>
                            <div className="eyebrow">DONATION DETAILS</div>
                            <h2>Contribution #{selected.id.slice(0, 8)}</h2>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setSelected(null)}
                        >
                            Close
                        </Button>
                    </div>
                    <dl>
                        <div>
                            <dt>Campaign</dt>
                            <dd>
                                {selected.campaign_title ||
                                    selected.campaign?.title ||
                                    selected.campaign_id ||
                                    "Campaign"}
                            </dd>
                        </div>
                        <div>
                            <dt>Donor</dt>
                            <dd>
                                {selected.is_anonymous
                                    ? "Anonymous"
                                    : selected.donor_name ||
                                      selected.donor_email ||
                                      "Fundora donor"}
                            </dd>
                        </div>
                        <div>
                            <dt>Amount</dt>
                            <dd>
                                {formatMoney(
                                    selected.amount,
                                    selected.currency || "PHP",
                                )}
                            </dd>
                        </div>
                        {selected.payment_provider && (
                            <>
                                <div>
                                    <dt>Payment provider</dt>
                                    <dd>
                                        {selected.payment_provider === "xendit"
                                            ? "Xendit"
                                            : "Fundora test simulator"}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Payment method</dt>
                                    <dd>
                                        {selected.payment_method ||
                                            "Not recorded"}
                                    </dd>
                                </div>
                                {selected.payment_reference && (
                                    <div>
                                        <dt>Provider reference</dt>
                                        <dd>{selected.payment_reference}</dd>
                                    </div>
                                )}
                            </>
                        )}
                        {selected.payment_currency === "ETH" &&
                            selected.currency !== "ETH" && (
                                <>
                                    <div>
                                        <dt>Paid on Sepolia</dt>
                                        <dd>
                                            {formatMoney(
                                                selected.payment_amount ??
                                                    undefined,
                                                "ETH",
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Recorded rate</dt>
                                        <dd>
                                            1 ETH ={" "}
                                            {formatMoney(
                                                selected.exchange_rate ??
                                                    undefined,
                                                selected.currency,
                                            )}
                                        </dd>
                                    </div>
                                </>
                            )}
                        <div>
                            <dt>Date</dt>
                            <dd>{formatDate(selected.created_at)}</dd>
                        </div>
                        <div>
                            <dt>Transaction hash</dt>
                            <dd>
                                {isOffchainPayment
                                    ? "Not applicable — off-chain payment"
                                    : selected.transaction_hash ||
                                      "Not recorded"}
                            </dd>
                        </div>
                        <div>
                            <dt>Network</dt>
                            <dd>
                                {isOffchainPayment
                                    ? "Not applicable"
                                    : selected.transaction_network ||
                                      "Not recorded"}
                            </dd>
                        </div>
                        <div>
                            <dt>Contribution status</dt>
                            <dd>{selected.status || "Unknown"}</dd>
                        </div>
                        <div>
                            <dt>On-chain transaction status</dt>
                            <dd>
                                {isOffchainPayment
                                    ? "Not applicable"
                                    : selected.transaction_status ||
                                      "Not recorded"}
                            </dd>
                        </div>
                        <div>
                            <dt>On-chain confirmation</dt>
                            <dd>
                                {isOffchainPayment
                                    ? "Not applicable"
                                    : selected.transaction_verified == null
                                      ? "Not available"
                                      : selected.transaction_verified
                                        ? "Yes"
                                        : "No"}
                            </dd>
                        </div>
                        <div>
                            <dt>Block</dt>
                            <dd>
                                {isOffchainPayment
                                    ? "Not applicable"
                                    : selected.block_number ?? "Not available"}
                            </dd>
                        </div>
                        <div>
                            <dt>Confirmations</dt>
                            <dd>
                                {isOffchainPayment
                                    ? "Not applicable"
                                    : selected.confirmations ??
                                      "Not available"}
                            </dd>
                        </div>
                    </dl>
                    <p className="provider-setup-note">
                        {isOffchainPayment
                            ? "GCash/Maya payments are off-chain. Fundora records provider confirmation; blockchain transaction details do not apply."
                            : "On-chain donation status is checked against the configured Sepolia RPC and Fundora contract."}
                    </p>
                </Card>
            )}
        </>
    );
}

export function OrganizerWithdrawalsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [items, setItems] = useState<Withdrawal[]>([]);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const load = () => {
        setLoading(true);
        Promise.all([
            campaignApi.mine(),
            withdrawalApi.list(),
            donationApi.organizerList(),
        ])
            .then(([c, w, d]) => {
                setCampaigns(c);
                setItems(w);
                setDonations(d);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);
    const availableBalance = (campaign: Campaign) =>
        Math.max(
            0,
            donations
                .filter(
                    (donation) =>
                        donation.campaign_id === campaign.id &&
                        donation.status?.toLowerCase() === "confirmed" &&
                        donation.payment_currency !== "ETH",
                )
                .reduce(
                    (total, donation) =>
                        total + Number(donation.amount || 0),
                    0,
                ) -
                items
                    .filter(
                        (item) =>
                            item.campaign_id === campaign.id &&
                            ["pending", "approved"].includes(
                                (item.status || "").toLowerCase(),
                            ),
                    )
                    .reduce(
                        (total, item) => total + Number(item.amount || 0),
                        0,
                    ),
        );
    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        const f = new FormData(e.currentTarget);
        try {
            await withdrawalApi.create({
                campaign_id: String(f.get("campaign_id")),
                amount: String(f.get("amount")),
                destination_address: String(f.get("destination_address")),
                purpose: String(f.get("purpose")),
            });
            e.currentTarget.reset();
            setSuccess(
                "Withdrawal request submitted for administrator review.",
            );
            load();
        } catch (err: any) {
            setError(err.message);
        }
    };
    return (
        <>
            <PageHeading
                eyebrow="FUNDS MANAGEMENT"
                title="Withdrawals."
                description="Submit withdrawal requests for admin review. Sandbox payments move no money; real GCash/Maya settlements go to Xendit, not directly to MetaMask."
            />
            <div className="profile-grid">
                <Card>
                    <form onSubmit={submit} className="form-grid">
                        <label className="field full-field">
                            <span>Campaign (withdrawable balance only)</span>
                            <select name="campaign_id" required>
                                <option value="">Select campaign</option>
                                {campaigns
                                    .filter((campaign) => campaign.currency !== "ETH")
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.title} ·{" "}
                                            {formatMoney(
                                                availableBalance(c),
                                                c.currency || "PHP",
                                            )}{" "}
                                            available
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <Field
                            label="Amount"
                            name="amount"
                            type="number"
                            min="1"
                            step="1"
                            required
                        />
                        <Field
                            label="Destination address"
                            name="destination_address"
                            required
                        />
                        <div className="full-field">
                            <TextareaField
                                label="Withdrawal purpose"
                                name="purpose"
                                rows={3}
                                required
                            />
                        </div>
                        {error && (
                            <div className="inline-error full-field">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="inline-success full-field">
                                {success}
                            </div>
                        )}
                        <div className="form-actions full-field">
                            <Button type="submit">
                                Submit request <ArrowUpRight size={16} />
                            </Button>
                        </div>
                    </form>
                </Card>
                <Card>
                    <div className="eyebrow">REQUEST STATUS</div>
                    <h2 className="profile-role">Approval is not a transfer</h2>
                    <p className="profile-copy-text">
                        Pending and approved requests reserve campaign balance.
                        Rejections release the reserved amount.
                    </p>
                </Card>
            </div>
            <div className="section-row">
                <div>
                    <h2>Withdrawal history</h2>
                    <p>Submitted requests and administrator decisions</p>
                </div>
            </div>
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : items.length ? (
                    <PaginatedTable items={items}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Amount</th>
                                    <th>Available balance</th>
                                    <th>Submitted</th>
                                    <th>Status</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((i) => (
                                    <tr key={i.id}>
                                        <td>
                                            <b>
                                                {i.campaign_title ||
                                                    i.campaign_id}
                                            </b>
                                        </td>
                                        <td>
                                            <b>
                                                {formatMoney(
                                                    i.amount,
                                                    i.currency || "PHP",
                                                )}
                                            </b>
                                        </td>
                                        <td>
                                            {formatMoney(
                                                i.available_balance,
                                                i.currency || "PHP",
                                            )}
                                        </td>
                                        <td>{formatDate(i.created_at)}</td>
                                        <td>
                                            <Status value={i.status} />
                                        </td>
                                        <td>{i.review_reason || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No withdrawal requests"
                        description="Your submitted withdrawal requests will appear here."
                    />
                )}
            </Card>
        </>
    );
}

export function AdminUsersPage() {
    const [items, setItems] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selected, setSelected] = useState<AdminUser | null>(null);
    const load = () => {
        setLoading(true);
        setError("");
        adminApi
            .users()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);
    const update = async (
        id: string,
        body: { role?: string; is_active?: boolean },
    ) => {
        setBusy(id);
        setError("");
        try {
            const updated = await adminApi.updateUser(id, body);
            setItems((current) =>
                current.map((item) => (item.id === id ? updated : item)),
            );
            setSelected((current) => (current?.id === id ? updated : current));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy("");
        }
    };
    const filtered = items.filter(
        (user) =>
            !["administrator", "admin"].includes(user.role.toLowerCase()) &&
            `${user.display_name || ""} ${user.email}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()) &&
            (roleFilter === "all" || user.role === roleFilter) &&
            (statusFilter === "all" ||
                (statusFilter === "active" ? user.is_active : !user.is_active)),
    );
    return (
        <>
            <PageHeading
                eyebrow="ADMINISTRATION"
                title="User management."
                description="Search accounts, inspect account details, and manage role and access status."
                action={
                    <Button variant="outline" onClick={load}>
                        <RefreshCw size={15} /> Refresh
                    </Button>
                }
            />
            {error && <div className="inline-error">{error}</div>}
            <div className="admin-filters">
                <Field
                    label="Search users"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or email"
                />
                <label className="field">
                    <span>Role</span>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="all">All roles</option>
                        <option value="donor">Donor</option>
                        <option value="organizer">Organizer</option>
                    </select>
                </label>
                <label className="field">
                    <span>Account status</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </label>
            </div>
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : filtered.length ? (
                    <PaginatedTable items={filtered}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <button
                                                className="table-name-button"
                                                onClick={() =>
                                                    setSelected(user)
                                                }
                                            >
                                                {user.display_name ||
                                                    user.email}
                                            </button>
                                            <small>{user.email}</small>
                                        </td>
                                        <td>
                                            <Status value={user.role} />
                                        </td>
                                        <td>
                                            <Status
                                                value={
                                                    user.is_active
                                                        ? "active"
                                                        : "suspended"
                                                }
                                            />
                                        </td>
                                        <td>{formatDate(user.created_at)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <Button
                                                    variant="outline"
                                                    disabled={busy === user.id}
                                                    onClick={() =>
                                                        void update(user.id, {
                                                            is_active:
                                                                !user.is_active,
                                                        })
                                                    }
                                                >
                                                    {busy === user.id
                                                        ? "Saving…"
                                                        : user.is_active
                                                          ? "Suspend"
                                                          : "Reactivate"}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No users match"
                        description="Try a different search or filter."
                    />
                )}
            </Card>
            {selected && (
                <Card className="admin-user-details">
                    <div className="section-row">
                        <div>
                            <div className="eyebrow">ACCOUNT DETAILS</div>
                            <h2>{selected.display_name || selected.email}</h2>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setSelected(null)}
                        >
                            Close
                        </Button>
                    </div>
                    <dl>
                        <div>
                            <dt>Email</dt>
                            <dd>{selected.email}</dd>
                        </div>
                        <div>
                            <dt>User ID</dt>
                            <dd>{selected.id}</dd>
                        </div>
                        <div>
                            <dt>Created</dt>
                            <dd>{formatDate(selected.created_at)}</dd>
                        </div>
                        <div>
                            <dt>Wallet address</dt>
                            <dd>
                                {selected.wallet_address || "Not connected"}
                            </dd>
                        </div>
                        <div>
                            <dt>Avatar URL</dt>
                            <dd>{selected.avatar_url || "Not set"}</dd>
                        </div>
                    </dl>
                    <div className="admin-user-controls">
                        <label className="field">
                            <span>Role</span>
                            <select
                                value={selected.role}
                                disabled={busy === selected.id}
                                onChange={(e) =>
                                    void update(selected.id, {
                                        role: e.target.value,
                                    })
                                }
                            >
                                <option value="donor">Donor</option>
                                <option
                                    value="organizer"
                                    disabled={selected.role !== "organizer"}
                                >
                                    Organizer (approved requests only)
                                </option>
                                <option value="administrator">
                                    Administrator
                                </option>
                            </select>
                        </label>
                        <p className="provider-setup-note">
                            Organizer access is granted through the role-request
                            review flow.
                        </p>
                    </div>
                </Card>
            )}
        </>
    );
}

export function AdminRoleRequestsPage() {
    const [items, setItems] = useState<OrganizerRoleRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const load = () => {
        setLoading(true);
        setError("");
        roleRequestApi
            .pending()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);
    const review = async (id: string, decision: "approved" | "rejected") => {
        setBusy(id);
        setError("");
        try {
            await roleRequestApi.review(id, decision);
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy("");
        }
    };
    return (
        <>
            <PageHeading
                eyebrow="ADMINISTRATION"
                title="Organizer access requests."
                description="Review donor requests for organizer access."
                action={
                    <Button variant="outline" onClick={load}>
                        <RefreshCw size={15} /> Refresh
                    </Button>
                }
            />
            {error && <div className="inline-error">{error}</div>}
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : items.length ? (
                    <PaginatedTable items={items}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Applicant</th>
                                    <th>Requested role</th>
                                    <th>Submitted</th>
                                    <th>Decision</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <b>
                                                {item.display_name ||
                                                    item.email}
                                            </b>
                                            <small>{item.email}</small>
                                        </td>
                                        <td>
                                            <Status
                                                value={item.requested_role}
                                            />
                                        </td>
                                        <td>{formatDate(item.created_at)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <Button
                                                    variant="outline"
                                                    disabled={busy === item.id}
                                                    onClick={() =>
                                                        review(
                                                            item.id,
                                                            "rejected",
                                                        )
                                                    }
                                                >
                                                    Reject
                                                </Button>
                                                <Button
                                                    disabled={busy === item.id}
                                                    onClick={() =>
                                                        review(
                                                            item.id,
                                                            "approved",
                                                        )
                                                    }
                                                >
                                                    {busy === item.id
                                                        ? "Saving…"
                                                        : "Approve"}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No requests to review"
                        description="Organizer access requests will appear here."
                    />
                )}
            </Card>
        </>
    );
}

export function AdminCampaignsPage() {
    const [items, setItems] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selected, setSelected] = useState<Campaign | null>(null);
    const load = () => {
        setLoading(true);
        setError("");
        adminApi
            .campaigns()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);
    const review = async (
        id: string,
        decision: "approve" | "reject" | "request_changes",
    ) => {
        const reason =
            decision === "approve"
                ? undefined
                : window.prompt(
                      decision === "reject"
                          ? "Reason for rejection"
                          : "Requested corrections",
                  );
        if (decision !== "approve" && reason === null) return;
        if (decision !== "approve" && !reason?.trim()) {
            setError("A reason is required.");
            return;
        }
        try {
            await adminApi.reviewCampaign(
                id,
                decision,
                reason?.trim() || undefined,
            );
            load();
        } catch (e: any) {
            setError(e.message);
        }
    };
    const filtered = items.filter(
        (c) =>
            `${c.title} ${c.category || ""} ${c.beneficiary_name || ""}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()) &&
            (statusFilter === "all" || c.status === statusFilter),
    );
    return (
        <>
            <PageHeading
                eyebrow="ADMINISTRATION"
                title="Campaign management."
                description="Filter submissions, inspect campaign details, and record review decisions."
                action={
                    <Button variant="outline" onClick={load}>
                        <RefreshCw size={15} /> Refresh
                    </Button>
                }
            />
            {error && <div className="inline-error">{error}</div>}
            <div className="admin-filters">
                <Field
                    label="Search campaigns"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Title, category, beneficiary"
                />
                <label className="field">
                    <span>Status</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All statuses</option>
                        {Array.from(
                            new Set(
                                items
                                    .map((c) => c.status)
                                    .filter(
                                        (value): value is string => !!value,
                                    ),
                            ),
                        ).map((status) => (
                            <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : filtered.length ? (
                    <PaginatedTable items={filtered}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Goal</th>
                                    <th>Deadline</th>
                                    <th>Status</th>
                                    <th>Decision</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((c) => (
                                    <tr key={c.id}>
                                        <td>
                                            <button
                                                className="table-name-button"
                                                onClick={() => setSelected(c)}
                                            >
                                                {c.title}
                                            </button>
                                            <small>
                                                {c.category || "Uncategorized"}{" "}
                                                ·{" "}
                                                {c.beneficiary_name ||
                                                    "Beneficiary not set"}
                                            </small>
                                        </td>
                                        <td>
                                            {formatMoney(
                                                c.goal_amount,
                                                c.currency || "PHP",
                                            )}
                                        </td>
                                        <td>
                                            {formatDate(c.ends_at || undefined)}
                                        </td>
                                        <td>
                                            <Status value={c.status} />
                                        </td>
                                        <td>
                                            {c.status === "pending_review" ? (
                                                <div className="row-actions">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() =>
                                                            review(
                                                                c.id,
                                                                "reject",
                                                            )
                                                        }
                                                    >
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() =>
                                                            review(
                                                                c.id,
                                                                "request_changes",
                                                            )
                                                        }
                                                    >
                                                        Corrections
                                                    </Button>
                                                    <Button
                                                        onClick={() =>
                                                            review(
                                                                c.id,
                                                                "approve",
                                                            )
                                                        }
                                                    >
                                                        Approve
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No campaigns match"
                        description="Try a different search or status filter."
                    />
                )}
            </Card>
            {selected && (
                <Card className="admin-campaign-details">
                    <div className="section-row">
                        <div>
                            <div className="eyebrow">CAMPAIGN DETAILS</div>
                            <h2>{selected.title}</h2>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setSelected(null)}
                        >
                            Close
                        </Button>
                    </div>
                    <p>
                        {selected.description ||
                            "No campaign description provided."}
                    </p>
                    <dl>
                        <div>
                            <dt>Organizer</dt>
                            <dd>
                                {selected.organizer_name || "Name not provided"}
                                {selected.organizer_id
                                    ? ` · ${selected.organizer_id}`
                                    : ""}
                            </dd>
                        </div>
                        <div>
                            <dt>Beneficiary</dt>
                            <dd>
                                {selected.beneficiary_name || "Not provided"}
                            </dd>
                        </div>
                        <div>
                            <dt>Beneficiary details</dt>
                            <dd>
                                {selected.beneficiary_details || "Not provided"}
                            </dd>
                        </div>
                        <div>
                            <dt>Goal</dt>
                            <dd>
                                {formatMoney(
                                    selected.goal_amount,
                                    selected.currency || "PHP",
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>Raised</dt>
                            <dd>
                                {formatMoney(
                                    selected.raised_amount,
                                    selected.currency || "PHP",
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>Deadline</dt>
                            <dd>{formatDate(selected.ends_at || undefined)}</dd>
                        </div>
                        <div>
                            <dt>Supporting information</dt>
                            <dd>
                                {selected.supporting_info || "Not provided"}
                            </dd>
                        </div>
                    </dl>
                    {selected.image_url && (
                        <CachedImage
                            className="admin-campaign-image"
                            src={selected.image_url}
                            alt="Campaign cover"
                        />
                    )}
                </Card>
            )}
        </>
    );
}

export function AdminDonationsPage() {
    const [items, setItems] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selected, setSelected] = useState<Donation | null>(null);
    useEffect(() => {
        adminApi
            .donations()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    const filtered = items.filter(
        (d) =>
            `${d.campaign_title || d.campaign?.title || ""} ${d.donor_email || ""} ${d.id}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()) &&
            (statusFilter === "all" || d.status === statusFilter),
    );
    return (
        <>
            <PageHeading
                eyebrow="ADMINISTRATION"
                title="Donation management."
                description="Search and inspect contribution records. Donation records are not manually editable."
            />
            <div className="admin-filters">
                <Field
                    label="Search donations"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Campaign, donor, reference"
                />
                <label className="field">
                    <span>Status</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All statuses</option>
                        {Array.from(
                            new Set(
                                items
                                    .map((d) => d.status)
                                    .filter(
                                        (value): value is string => !!value,
                                    ),
                            ),
                        ).map((status) => (
                            <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <Card className="table-card">
                {error && <div className="inline-error">{error}</div>}
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : filtered.length ? (
                    <PaginatedTable items={filtered}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Donor</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((d) => (
                                    <tr key={d.id}>
                                        <td>
                                            <button
                                                className="table-name-button"
                                                onClick={() => setSelected(d)}
                                            >
                                                {d.campaign_title ||
                                                    d.campaign?.title ||
                                                    d.campaign_id ||
                                                    "Campaign"}
                                            </button>
                                            <small>#{d.id.slice(0, 8)}</small>
                                        </td>
                                        <td>
                                            {d.is_anonymous
                                                ? "Anonymous"
                                                : d.donor_email ||
                                                  "Unknown donor"}
                                        </td>
                                        <td>
                                            <b>
                                                {formatMoney(
                                                    d.amount,
                                                    d.currency || "PHP",
                                                )}
                                            </b>
                                        </td>
                                        <td>{formatDate(d.created_at)}</td>
                                        <td>
                                            <Status
                                                value={
                                                    d.transaction_status ||
                                                    d.status
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No donation records match"
                        description="Try a different search or status filter."
                    />
                )}
            </Card>
            {selected && (
                <Card className="admin-campaign-details">
                    <div className="section-row">
                        <div>
                            <div className="eyebrow">DONATION DETAILS</div>
                            <h2>Contribution #{selected.id.slice(0, 8)}</h2>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setSelected(null)}
                        >
                            Close
                        </Button>
                    </div>
                    <dl>
                        <div>
                            <dt>Campaign</dt>
                            <dd>
                                {selected.campaign_title ||
                                    selected.campaign?.title ||
                                    selected.campaign_id ||
                                    "Campaign"}
                            </dd>
                        </div>
                        <div>
                            <dt>Donor reference</dt>
                            <dd>
                                {selected.is_anonymous
                                    ? "Anonymous"
                                    : selected.donor_email ||
                                      selected.donor_name ||
                                      "Not available"}
                            </dd>
                        </div>
                        <div>
                            <dt>Amount</dt>
                            <dd>
                                {formatMoney(
                                    selected.amount,
                                    selected.currency || "PHP",
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>Created</dt>
                            <dd>{formatDate(selected.created_at)}</dd>
                        </div>
                        <div>
                            <dt>Contribution status</dt>
                            <dd>{selected.status || "Unknown"}</dd>
                        </div>
                        <div>
                            <dt>Transaction status</dt>
                            <dd>
                                {selected.transaction_status || "Not recorded"}
                            </dd>
                        </div>
                        <div>
                            <dt>Transaction hash</dt>
                            <dd>{selected.transaction_hash || "Not linked"}</dd>
                        </div>
                    </dl>
                </Card>
            )}
        </>
    );
}

export function AdminTransactionsPage() {
    const [items, setItems] = useState<AdminTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selected, setSelected] = useState<AdminTransaction | null>(null);
    const load = () => {
        setLoading(true);
        adminApi
            .transactions()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);
    const flag = async (t: AdminTransaction) => {
        const note = window.prompt("Investigation note", t.review_note || "");
        if (note === null) return;
        const reviewNote = note.trim() || null;
        try {
            await adminApi.flagTransaction(t.id, reviewNote);
            setSelected((current) =>
                current?.id === t.id
                    ? { ...current, review_note: reviewNote }
                    : current,
            );
            load();
        } catch (e: any) {
            setError(e.message);
        }
    };
    const filtered = items.filter(
        (t) =>
            `${t.campaign_title || ""} ${t.tx_hash} ${t.network} ${t.from_address || ""} ${t.to_address || ""}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()) &&
            (statusFilter === "all" || t.status === statusFilter),
    );
    return (
        <>
            <PageHeading
                eyebrow="ADMINISTRATION"
                title="Transaction monitoring."
                description="Review verified Sepolia donation transactions and submitted withdrawal records."
                action={
                    <Button variant="outline" onClick={load}>
                        <RefreshCw size={15} /> Refresh
                    </Button>
                }
            />
            {error && <div className="inline-error">{error}</div>}
            <div className="admin-filters">
                <Field
                    label="Search transactions"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Campaign, hash, address, network"
                />
                <label className="field">
                    <span>Status</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All statuses</option>
                        {Array.from(
                            new Set(
                                items
                                    .map((t) => t.status)
                                    .filter(
                                        (value): value is string => !!value,
                                    ),
                            ),
                        ).map((status) => (
                            <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <Card className="table-card">
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : filtered.length ? (
                    <PaginatedTable items={filtered}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Hash</th>
                                    <th>Network</th>
                                    <th>Confirmations</th>
                                    <th>Status</th>
                                    <th>Review</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((t) => (
                                    <tr key={t.id}>
                                        <td>
                                            <button
                                                className="table-name-button"
                                                onClick={() => setSelected(t)}
                                            >
                                                {t.campaign_title ||
                                                    "Linked request"}
                                            </button>
                                            <small>
                                                {t.amount
                                                    ? formatMoney(
                                                          t.amount,
                                                          t.currency || "PHP",
                                                      )
                                                    : ""}
                                            </small>
                                        </td>
                                        <td className="wallet-cell">
                                            {t.tx_hash}
                                        </td>
                                        <td>{t.network}</td>
                                        <td>{t.confirmations}</td>
                                        <td>
                                            <Status value={t.status} />
                                        </td>
                                        <td>
                                            <Button
                                                variant="outline"
                                                onClick={() => flag(t)}
                                            >
                                                {t.review_note
                                                    ? "Edit note"
                                                    : "Flag"}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No transactions match"
                        description="Try a different search or status filter."
                    />
                )}
            </Card>
            {selected && (
                <Card className="admin-campaign-details">
                    <div className="section-row">
                        <div>
                            <div className="eyebrow">TRANSACTION DETAILS</div>
                            <h2>{selected.tx_hash}</h2>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setSelected(null)}
                        >
                            Close
                        </Button>
                    </div>
                    <dl>
                        <div>
                            <dt>Network</dt>
                            <dd>{selected.network}</dd>
                        </div>
                        <div>
                            <dt>From</dt>
                            <dd>{selected.from_address || "Not available"}</dd>
                        </div>
                        <div>
                            <dt>To</dt>
                            <dd>{selected.to_address || "Not available"}</dd>
                        </div>
                        <div>
                            <dt>Amount</dt>
                            <dd>
                                {selected.amount
                                    ? formatMoney(
                                          selected.amount,
                                          selected.currency || "PHP",
                                      )
                                    : "Not available"}
                            </dd>
                        </div>
                        <div>
                            <dt>Block</dt>
                            <dd>{selected.block_number ?? "Not available"}</dd>
                        </div>
                        <div>
                            <dt>Confirmations</dt>
                            <dd>{selected.confirmations}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd>{selected.status}</dd>
                        </div>
                        <div>
                            <dt>On-chain verification</dt>
                            <dd>{selected.verified ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                            <dt>Recorded</dt>
                            <dd>{formatDate(selected.created_at)}</dd>
                        </div>
                        <div>
                            <dt>Review note</dt>
                            <dd>
                                {selected.review_note ||
                                    "No investigation note"}
                            </dd>
                        </div>
                    </dl>
                    <p className="provider-setup-note">
                        Donation confirmations are verified against the
                        configured Sepolia RPC. Withdrawal transaction
                        submissions are not independently verified.
                    </p>
                </Card>
            )}
        </>
    );
}

export function AdminAuditPage() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        adminApi
            .audit()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);
    return (
        <>
            <PageHeading
                eyebrow="ADMINISTRATION"
                title="Audit log."
                description="Administrative and operational records maintained for accountability."
            />
            <Card className="table-card">
                {error && <div className="inline-error">{error}</div>}
                {loading ? (
                    <div className="center-loading">
                        <Spinner />
                    </div>
                ) : items.length ? (
                    <PaginatedTable items={items}>
                        {(pageItems) => (
                            <div className="table-scroll">
                                <table>
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Actor</th>
                                    <th>Entity</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((l) => (
                                    <tr key={l.id}>
                                        <td>
                                            <b>{l.action}</b>
                                        </td>
                                        <td>{l.actor_email || "System"}</td>
                                        <td>
                                            <b>{l.entity_type}</b>
                                            <small>{l.entity_id || "—"}</small>
                                        </td>
                                        <td>{formatDate(l.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                                </table>
                            </div>
                        )}
                    </PaginatedTable>
                ) : (
                    <EmptyState
                        title="No audit records"
                        description="Administrative actions will appear here."
                    />
                )}
            </Card>
        </>
    );
}
