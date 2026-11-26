import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AppLayout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import {
    AdminDashboard,
    AdminCampaignsPage,
    AdminRoleRequestsPage,
    AdminUsersPage,
    AdminDonationsPage,
    AdminTransactionsPage,
    AdminAuditPage,
    CreateCampaignPage,
    DashboardPage,
    DonationsPage,
    DonationsDetailPage,
    ProfilePage,
    WithdrawalsPage,
    OrganizerCampaignsPage,
    OrganizerDonationsPage,
    OrganizerWithdrawalsPage,
} from "./pages/DashboardPages";
import {
    CampaignDetailPage,
    ExploreCampaignsPage,
    HomePage,
    VerifyPage,
} from "./pages/PublicPages";
import { Spinner } from "./components/UI";
import { roleOf } from "./lib/utils";

function RequireAuth({ children }: { children: ReactNode }) {
    const { signedIn, loading } = useAuth();
    const location = useLocation();
    if (loading)
        return (
            <div className="full-screen-loading">
                <Spinner />
            </div>
        );
    if (!signedIn)
        return (
            <Navigate
                to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}
                replace
            />
        );
    return <>{children}</>;
}
function RequireRole({
    roles,
    children,
}: {
    roles: string[];
    children: ReactNode;
}) {
    const { user } = useAuth();
    const role = roleOf(user);
    if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
    return <>{children}</>;
}

function CampaignsRoute() {
    const { signedIn } = useAuth();
    return signedIn ? (
        <AppLayout>
            <ExploreCampaignsPage embedded />
        </AppLayout>
    ) : (
        <ExploreCampaignsPage />
    );
}

function CampaignDetailRoute() {
    const { signedIn } = useAuth();
    return signedIn ? (
        <AppLayout>
            <CampaignDetailPage embedded />
        </AppLayout>
    ) : (
        <CampaignDetailPage />
    );
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/campaigns" element={<CampaignsRoute />} />
            <Route path="/campaigns/:id" element={<CampaignDetailRoute />} />
            <Route path="/verify/:hash" element={<VerifyPage />} />
            <Route
                element={
                    <RequireAuth>
                        <AppLayout />
                    </RequireAuth>
                }
            >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                    path="/donations/:id"
                    element={<DonationsDetailPage />}
                />
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                    path="/my-donations"
                    element={
                        <RequireRole
                            roles={[
                                "donor",
                                "organizer",
                                "administrator",
                                "admin",
                            ]}
                        >
                            <DonationsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/organizer/campaigns"
                    element={
                        <RequireRole
                            roles={["organizer", "administrator", "admin"]}
                        >
                            <OrganizerCampaignsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/organizer/campaigns/new"
                    element={
                        <RequireRole
                            roles={["organizer", "administrator", "admin"]}
                        >
                            <CreateCampaignPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/organizer/campaigns/:id/edit"
                    element={
                        <RequireRole
                            roles={["organizer", "administrator", "admin"]}
                        >
                            <CreateCampaignPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/organizer/donations"
                    element={
                        <RequireRole
                            roles={["organizer", "administrator", "admin"]}
                        >
                            <OrganizerDonationsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/organizer/withdrawals"
                    element={
                        <RequireRole
                            roles={["organizer", "administrator", "admin"]}
                        >
                            <OrganizerWithdrawalsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/admin/users"
                    element={
                        <RequireRole roles={["administrator", "admin"]}>
                            <AdminUsersPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/admin/role-requests"
                    element={
                        <RequireRole roles={["administrator", "admin"]}>
                            <AdminRoleRequestsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/admin/campaigns"
                    element={
                        <RequireRole roles={["administrator", "admin"]}>
                            <AdminCampaignsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/admin/donations"
                    element={
                        <RequireRole roles={["administrator", "admin"]}>
                            <AdminDonationsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/admin/transactions"
                    element={
                        <RequireRole roles={["administrator", "admin"]}>
                            <AdminTransactionsPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/admin/audit"
                    element={
                        <RequireRole roles={["administrator", "admin"]}>
                            <AdminAuditPage />
                        </RequireRole>
                    }
                />
                <Route
                    path="/admin/withdrawals"
                    element={
                        <RequireRole roles={["administrator", "admin"]}>
                            <WithdrawalsPage />
                        </RequireRole>
                    }
                />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
