import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { authApi, tokenStore } from "../lib/api";
import { roleOf } from "../lib/utils";
import type { User } from "../lib/types";

type AuthContextValue = {
    user: User | null;
    loading: boolean;
    signedIn: boolean;
    signInWithEmail: (email: string, code: string) => Promise<void>;
    signInWithGoogle: (idToken: string, nonce: string) => Promise<void>;
    signInWithApple: (idToken: string, nonce: string) => Promise<void>;
    signInWithSiwe: (
        message: string,
        signature: string,
        email?: string,
    ) => Promise<void>;
    requestSiweNonce: (
        walletAddress: string,
    ) => ReturnType<typeof authApi.requestSiweNonce>;
    requestOtp: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    reloadUser: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(payload: any): User {
    const user =
        payload?.user ?? payload?.data?.user ?? payload?.data ?? payload;
    return { ...user, role: roleOf(user) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const reloadUser = useCallback(async () => {
        const payload = await authApi.me();
        setUser(normalizeUser(payload));
    }, []);

    useEffect(() => {
        let active = true;
        const boot = async () => {
            if (!tokenStore.getAccess() && !tokenStore.getRefresh()) {
                if (active) setLoading(false);
                return;
            }
            try {
                const payload = await authApi.me();
                if (active) setUser(normalizeUser(payload));
            } catch {
                tokenStore.clear();
                if (active) setUser(null);
            } finally {
                if (active) setLoading(false);
            }
        };
        boot();
        const onExpired = () => setUser(null);
        window.addEventListener("fundora:session-expired", onExpired);
        return () => {
            active = false;
            window.removeEventListener("fundora:session-expired", onExpired);
        };
    }, []);

    const requestOtp = useCallback(async (email: string) => {
        await authApi.requestEmailOtp(email);
    }, []);
    const establishSession = useCallback(
        async (payload: any) => {
            if (!payload?.access_token || !payload?.refresh_token)
                throw new Error(
                    "The API did not return both access_token and refresh_token.",
                );
            tokenStore.set(payload.access_token, payload.refresh_token);
            try {
                await reloadUser();
            } catch (error) {
                tokenStore.clear();
                setUser(null);
                throw error;
            }
        },
        [reloadUser],
    );
    const signInWithEmail = useCallback(
        async (email: string, code: string) => {
            await establishSession(await authApi.verifyEmailOtp(email, code));
        },
        [establishSession],
    );
    const signInWithGoogle = useCallback(
        async (idToken: string, nonce: string) => {
            await establishSession(await authApi.verifyGoogle(idToken, nonce));
        },
        [establishSession],
    );
    const signInWithApple = useCallback(
        async (idToken: string, nonce: string) => {
            await establishSession(await authApi.verifyApple(idToken, nonce));
        },
        [establishSession],
    );
    const signInWithSiwe = useCallback(
        async (message: string, signature: string, email?: string) => {
            await establishSession(
                await authApi.verifySiwe(message, signature, email),
            );
        },
        [establishSession],
    );
    const requestSiweNonce = useCallback(
        (walletAddress: string) => authApi.requestSiweNonce(walletAddress),
        [],
    );
    const signOut = useCallback(async () => {
        const refresh = tokenStore.getRefresh() || undefined;
        try {
            await authApi.logout(refresh);
        } finally {
            tokenStore.clear();
            setUser(null);
        }
    }, []);

    const value = useMemo(
        () => ({
            user,
            loading,
            signedIn: !!user,
            requestOtp,
            signInWithEmail,
            signInWithGoogle,
            signInWithApple,
            signInWithSiwe,
            requestSiweNonce,
            signOut,
            reloadUser,
        }),
        [
            user,
            loading,
            requestOtp,
            signInWithEmail,
            signInWithGoogle,
            signInWithApple,
            signInWithSiwe,
            requestSiweNonce,
            signOut,
            reloadUser,
        ],
    );
    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
export function useAuth() {
    const value = useContext(AuthContext);
    if (!value) throw new Error("useAuth must be used inside AuthProvider");
    return value;
}
