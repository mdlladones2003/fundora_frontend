import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
    Bell,
    ChevronDown,
    CircleUserRound,
    HeartHandshake,
    LayoutDashboard,
    LogOut,
    Menu,
    ShieldCheck,
    Users,
    Wallet,
    FolderKanban,
    ReceiptText,
    ScrollText,
    CircleDollarSign,
    Search,
    X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { roleOf } from "../lib/utils";
import {
    adminApi,
    campaignApi,
    donationApi,
    notificationApi,
} from "../lib/api";
import type { AdminUser, Campaign, Donation, Notification } from "../lib/types";

export function Brand({ light = false, to }: { light?: boolean; to?: string }) {
    const { signedIn } = useAuth();
    return (
        <Link
            to={to ?? (signedIn ? "/dashboard" : "/")}
            className={`brand ${light ? "brand-light" : ""}`}
        >
            <span className="brand-icon">
                <HeartHandshake size={20} />
            </span>
            <span>
                fundora<span className="brand-dot">.</span>
            </span>
        </Link>
    );
}

function NotificationMenu() {
    const [items, setItems] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const menuRef = useRef<HTMLDivElement>(null);
    const unreadCount = items.filter((item) => !item.read_at).length;

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setItems(await notificationApi.list());
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Notifications could not be loaded.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadNotifications();
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !menuRef.current?.contains(event.target)
            ) {
                setOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [loadNotifications]);

    const toggle = () => {
        const nextOpen = !open;
        setOpen(nextOpen);
        if (nextOpen) void loadNotifications();
    };

    const openNotification = async (item: Notification) => {
        if (!item.read_at) {
            try {
                await notificationApi.markRead(item.id);
                setItems((current) =>
                    current.map((notification) =>
                        notification.id === item.id
                            ? {
                                  ...notification,
                                  read_at: new Date().toISOString(),
                              }
                            : notification,
                    ),
                );
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "This notification could not be marked as read.",
                );
                return;
            }
        }
        setOpen(false);
        if (item.href?.startsWith("/")) navigate(item.href);
    };

    return (
        <div className="notification-menu" ref={menuRef}>
            <button
                className="icon-button notification-trigger"
                title="Notifications"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={open}
                onClick={toggle}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="notification-count">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>
            {open && (
                <section
                    className="notification-panel"
                    aria-label="Notifications"
                >
                    <div className="notification-panel-heading">
                        <strong>Notifications</strong>
                        <span>
                            {unreadCount
                                ? `${unreadCount} unread`
                                : "All caught up"}
                        </span>
                    </div>
                    {error && <div className="inline-error">{error}</div>}
                    {loading ? (
                        <div className="notification-empty">Loading…</div>
                    ) : items.length ? (
                        <div className="notification-list">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    className={`notification-item ${item.read_at ? "" : "unread"}`}
                                    onClick={() => void openNotification(item)}
                                >
                                    <strong>{item.title}</strong>
                                    <span>{item.body}</span>
                                    <small>
                                        {new Date(
                                            item.created_at,
                                        ).toLocaleString()}
                                    </small>
                                </button>
                            ))}
                        </div>
                    ) : (
                        !error && (
                            <div className="notification-empty">
                                No notifications yet.
                            </div>
                        )
                    )}
                </section>
            )}
        </div>
    );
}

type SearchResult = {
    label: string;
    detail: string;
    href: string;
    type: "Campaign" | "Donor" | "Page";
};

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
    const { user } = useAuth();
    const role = roleOf(user);
    const [query, setQuery] = useState("");
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [open, setOpen] = useState(false);
    const [loadedRole, setLoadedRole] = useState("");
    const searchRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const term = query.trim().toLowerCase();

    useEffect(() => {
        if (term.length < 2) {
            setOpen(false);
            setError("");
            return;
        }
        setOpen(true);
        if (loadedRole === role) return;
        let active = true;
        const timer = window.setTimeout(() => {
            setLoading(true);
            const campaignRequest =
                role === "administrator" || role === "admin"
                    ? adminApi.campaigns()
                    : campaignApi.list();
            Promise.all([
                Promise.all([
                    campaignRequest,
                    role === "organizer"
                        ? campaignApi.mine()
                        : Promise.resolve([] as Campaign[]),
                ]).then(([publicItems, ownedItems]) => {
                    const byId = new Map(
                        [...publicItems, ...ownedItems].map((campaign) => [
                            campaign.id,
                            campaign,
                        ]),
                    );
                    return [...byId.values()];
                }),
                role === "organizer"
                    ? donationApi.organizerList()
                    : Promise.resolve([] as Donation[]),
                role === "administrator" || role === "admin"
                    ? adminApi.users()
                    : Promise.resolve([] as AdminUser[]),
            ])
                .then(([campaignItems, donationItems, userItems]) => {
                    if (!active) return;
                    setCampaigns(campaignItems);
                    setDonations(donationItems);
                    setUsers(userItems);
                    setError("");
                    setLoadedRole(role);
                })
                .catch((searchError: unknown) => {
                    if (active) {
                        setError(
                            searchError instanceof Error
                                ? searchError.message
                                : "Search results could not be loaded.",
                        );
                    }
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        }, 180);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [loadedRole, role, term]);

    useEffect(() => {
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !searchRef.current?.contains(event.target)
            ) {
                setOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, []);

    const results: SearchResult[] = [];
    campaigns
        .filter((campaign) =>
            `${campaign.title} ${campaign.description || ""} ${campaign.category || ""}`
                .toLowerCase()
                .includes(term),
        )
        .slice(0, 4)
        .forEach((campaign) => {
            const isManageable = ["draft", "pending_review", "changes_requested", "rejected"].includes(
                (campaign.status || "").toLowerCase(),
            );
            results.push({
                label: campaign.title,
                detail: `${campaign.category || "Campaign"} · ${campaign.status || "active"}`,
                href:
                    isManageable && role === "organizer"
                        ? `/organizer/campaigns/${campaign.id}/edit`
                        : role === "administrator" || role === "admin"
                          ? `/admin/campaigns?search=${encodeURIComponent(campaign.title)}`
                          : `/campaigns/${campaign.id}`,
                type: "Campaign",
            });
        });

    const matchedDonors = new Set<string>();
    donations.forEach((donation) => {
        const name = donation.is_anonymous
            ? "Anonymous donor"
            : donation.donor_name || "Fundora donor";
        const key = name.toLowerCase();
        if (key.includes(term) && !matchedDonors.has(key)) {
            matchedDonors.add(key);
            results.push({
                label: name,
                detail: donation.campaign_title || "Campaign donor",
                href: `/organizer/donations?search=${encodeURIComponent(name)}`,
                type: "Donor",
            });
        }
    });
    users
        .filter(
            (item) =>
                item.role === "donor" &&
                `${item.display_name || ""} ${item.email}`.toLowerCase().includes(term),
        )
        .slice(0, 4)
        .forEach((item) => {
            results.push({
                label: item.display_name || item.email,
                detail: item.email,
                href: `/admin/users?search=${encodeURIComponent(term)}`,
                type: "Donor",
            });
        });

    const pages = [
        { label: "Explore campaigns", href: "/campaigns" },
        { label: "My donations", href: "/my-donations" },
        { label: "My campaigns", href: "/organizer/campaigns" },
        { label: "Create campaign", href: "/organizer/campaigns/new" },
        { label: "Profile settings", href: "/profile" },
    ];
    pages
        .filter(
            (page) =>
                page.label.toLowerCase().includes(term) &&
                (!page.href.startsWith("/organizer/") || role === "organizer"),
        )
        .forEach((page) =>
            results.push({
                label: page.label,
                detail: "Page",
                href: page.href,
                type: "Page",
            }),
        );

    const selectResult = (result: SearchResult) => {
        navigate(result.href);
        setQuery("");
        setOpen(false);
    };

    return (
        <div
            className={`global-search ${compact ? "global-search-compact" : ""}`}
            ref={searchRef}
        >
            <button
                type="button"
                className="global-search-icon"
                aria-label="Focus search"
                onClick={() =>
                    searchRef.current?.querySelector("input")?.focus()
                }
            >
                <Search size={16} aria-hidden="true" />
            </button>
            <input
                type="search"
                value={query}
                placeholder="Search campaigns, donors…"
                aria-label="Search campaigns, donors, and pages"
                aria-expanded={open}
                aria-controls="global-search-results"
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => {
                    if (term.length >= 2) setOpen(true);
                }}
            />
            {open && term.length >= 2 && (
                <div
                    className="global-search-results"
                    id="global-search-results"
                    role="listbox"
                    aria-label="Search results"
                >
                    {error ? (
                        <div className="global-search-message">{error}</div>
                    ) : loading ? (
                        <div className="global-search-message">Searching…</div>
                    ) : results.length ? (
                        results.slice(0, 8).map((result, index) => (
                            <button
                                type="button"
                                role="option"
                                aria-selected="false"
                                key={`${result.type}-${result.href}-${index}`}
                                onClick={() => selectResult(result)}
                            >
                                <span>
                                    <b>{result.label}</b>
                                    <small>{result.detail}</small>
                                </span>
                                <em>{result.type}</em>
                            </button>
                        ))
                    ) : (
                        <div className="global-search-message">
                            No matching campaigns, donors, or pages.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function AccountMenu() {
    const { user, signOut } = useAuth();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const displayName =
        user?.display_name || user?.name || user?.full_name || user?.email || "Account";

    useEffect(() => {
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !menuRef.current?.contains(event.target)
            ) {
                setOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, []);

    const logout = async () => {
        await signOut();
        navigate("/login");
    };

    return (
        <div className="account-menu" ref={menuRef}>
            <button
                type="button"
                className="topbar-user"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((value) => !value)}
            >
                <CircleUserRound size={19} />
                <span>{displayName}</span>
                <ChevronDown size={14} />
            </button>
            {open && (
                <div className="account-menu-panel" role="menu">
                    <Link
                        to="/profile"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                    >
                        Profile settings
                    </Link>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => void logout()}
                    >
                        <LogOut size={15} /> Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

export function AppLayout({ children }: { children?: ReactNode } = {}) {
    const { user } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const role = roleOf(user);
    const links =
        role === "administrator" || role === "admin"
            ? [
                  {
                      to: "/dashboard",
                      label: "Overview",
                      icon: LayoutDashboard,
                  },
                  { to: "/campaigns", label: "Explore campaigns", icon: HeartHandshake },
                  { to: "/admin/users", label: "Users", icon: Users },
                  {
                      to: "/admin/role-requests",
                      label: "Role requests",
                      icon: ShieldCheck,
                  },
                  {
                      to: "/admin/campaigns",
                      label: "Campaigns",
                      icon: FolderKanban,
                  },
                  {
                      to: "/admin/donations",
                      label: "Donations",
                      icon: ReceiptText,
                  },
                  {
                      to: "/admin/transactions",
                      label: "Transactions",
                      icon: CircleDollarSign,
                  },
                  {
                      to: "/admin/withdrawals",
                      label: "Withdrawals",
                      icon: Wallet,
                  },
                  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
              ]
            : role === "organizer"
              ? [
                    {
                        to: "/dashboard",
                        label: "Overview",
                        icon: LayoutDashboard,
                    },
                    {
                        to: "/organizer/campaigns",
                        label: "Manage campaigns",
                        icon: HeartHandshake,
                    },
                    {
                        to: "/organizer/donations",
                        label: "Donations",
                        icon: ReceiptText,
                    },
                    {
                        to: "/organizer/withdrawals",
                        label: "Withdrawals",
                        icon: Wallet,
                    },
                ]
              : [
                    {
                        to: "/dashboard",
                        label: "Overview",
                        icon: LayoutDashboard,
                    },
                    { to: "/campaigns", label: "Explore campaigns", icon: HeartHandshake },
                    {
                        to: "/my-donations",
                        label: "My donations",
                        icon: HeartHandshake,
                    },
                ];
    return (
        <div className="app-shell">
            <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
                <div className="sidebar-top">
                    <Brand to="/dashboard" />
                    <button
                        className="icon-button mobile-close"
                        onClick={() => setMobileOpen(false)}
                    >
                        <X />
                    </button>
                </div>
                <div className="workspace-label">WORKSPACE</div>
                <nav className="side-nav">
                    {links.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === "/dashboard"}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                                `side-link ${isActive ? "active" : ""}`
                            }
                        >
                            <Icon size={18} />
                            {label}
                        </NavLink>
                    ))}
                </nav>
            </aside>
            {mobileOpen && (
                <button
                    className="mobile-backdrop"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close menu"
                />
            )}
            <main className="main-area">
                <header className="topbar">
                    <button
                        className="icon-button mobile-menu"
                        onClick={() => setMobileOpen(true)}
                    >
                        <Menu />
                    </button>
                    <div className="breadcrumb">
                        Workspace <span>/</span>{" "}
                        <b>
                            {role === "administrator" || role === "admin"
                                ? "Administration"
                                : role === "organizer"
                                  ? "Organizer"
                                  : "Donor"}
                        </b>
                    </div>
                    <div className="topbar-actions">
                        <GlobalSearch />
                        <NotificationMenu />
                        <span className="topbar-divider" />
                        <AccountMenu />
                    </div>
                </header>
                <div className="page-content">
                    {children ?? <Outlet />}
                </div>
            </main>
        </div>
    );
}
