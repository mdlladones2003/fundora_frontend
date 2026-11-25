import { useEffect, useState, type FormEvent } from "react";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    HeartHandshake,
    Mail,
    Wallet,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Brand } from "../components/Layout";
import { Button, Field } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import {
    connectWallet,
    injectedWallet,
    signSiweMessage,
} from "../lib/ethereum";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentity = {
    accounts?: {
        id?: {
            initialize: (options: {
                client_id: string;
                nonce: string;
                callback: (response: GoogleCredentialResponse) => void;
            }) => void;
            renderButton: (
                container: HTMLElement,
                options: {
                    theme: "outline";
                    size: "large";
                    shape: "pill";
                    text: "continue_with";
                    width: number;
                    logo_alignment: "left";
                },
            ) => void;
        };
    };
};

type AppleIdentity = {
    auth: {
        init: (options: {
            clientId: string;
            scope: string;
            redirectURI: string;
            state: string;
            nonce: string;
            usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
            authorization?: { id_token?: string; state?: string };
        }>;
    };
};

let appleSdkPromise: Promise<void> | null = null;

function loadAppleSdk() {
    const apple = (window as Window & { AppleID?: AppleIdentity }).AppleID;
    if (apple?.auth) return Promise.resolve();
    if (appleSdkPromise) return appleSdkPromise;

    appleSdkPromise = new Promise<void>((resolve, reject) => {
        let script = document.querySelector<HTMLScriptElement>(
            "script[data-apple-identity]",
        );
        if (!script) {
            script = document.createElement("script");
            script.src =
                "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
            script.async = true;
            script.dataset.appleIdentity = "true";
        }
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
            "error",
            () => {
                script?.remove();
                appleSdkPromise = null;
                reject(
                    new Error(
                        "Apple sign-in could not load. You can continue with another method.",
                    ),
                );
            },
            { once: true },
        );
        if (!script.isConnected) document.head.appendChild(script);
    });
    return appleSdkPromise;
}

function createProviderNonce() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
}

function AppleLogo() {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
        >
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.044-2.04.027-3.912 1.183-4.96 3.015-2.115 3.66-.54 9.075 1.515 12.045 1.005 1.455 2.19 3.09 3.75 3.03 1.5-.06 2.07-.975 3.885-.975 1.8 0 2.325.975 3.945.945 1.635-.03 2.67-1.485 3.66-2.94 1.155-1.68 1.62-3.315 1.65-3.405-.03-.03-3.18-1.215-3.21-4.8-.03-3 2.445-4.425 2.565-4.5-1.395-2.04-3.57-2.265-4.335-2.325-1.965-.15-3.615 1.08-4.515 1.08zm3.3-3.03c.81-.975 1.35-2.325 1.2-3.675-1.17.045-2.58.78-3.42 1.755-.75.855-1.41 2.22-1.23 3.525 1.305.105 2.64-.66 3.45-1.605z" />
        </svg>
    );
}

export function AuthPage() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"email" | "otp">("email");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const {
        requestOtp,
        signInWithEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithSiwe,
        requestSiweNonce,
    } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const returnTo = params.get("returnTo") || "/dashboard";
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim();
    const appleRedirectUri =
        import.meta.env.VITE_APPLE_REDIRECT_URI?.trim() ||
        window.location.origin;

    const requestCode = async () => {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            await requestOtp(email.trim());
            setStep("otp");
            setNotice("Check your inbox for your sign-in code.");
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not send a sign-in code. Try again.",
            );
        } finally {
            setBusy(false);
        }
    };

    const sendOtp = async (event: FormEvent) => {
        event.preventDefault();
        await requestCode();
    };

    const verify = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            await signInWithEmail(email.trim(), code.trim());
            navigate(returnTo, { replace: true });
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not verify the code. Try again.",
            );
        } finally {
            setBusy(false);
        }
    };

    const signInWithAppleAccount = async () => {
        if (!appleClientId) {
            setError(
                "Apple sign-in is not configured. Continue with another method.",
            );
            return;
        }
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const nonce = createProviderNonce();
            const state = createProviderNonce();
            await loadAppleSdk();
            const apple = (window as Window & { AppleID?: AppleIdentity })
                .AppleID;
            if (!apple?.auth)
                throw new Error(
                    "Apple sign-in could not initialize. Try again.",
                );
            apple.auth.init({
                clientId: appleClientId,
                scope: "name email",
                redirectURI: appleRedirectUri,
                state,
                nonce,
                usePopup: true,
            });
            const response = await apple.auth.signIn();
            if (response.authorization?.state !== state)
                throw new Error(
                    "Apple sign-in state did not match. Please try again.",
                );
            const idToken = response.authorization?.id_token;
            if (!idToken)
                throw new Error(
                    "Apple did not return a sign-in token. Please try again.",
                );
            await signInWithApple(idToken, nonce);
            navigate(returnTo, { replace: true });
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Apple sign-in failed. Please try again.",
            );
        } finally {
            setBusy(false);
        }
    };

    const signInWithWallet = async () => {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const ethereum = injectedWallet();
            const walletAddress = await connectWallet(ethereum);

            const challenge = await requestSiweNonce(walletAddress);
            if (challenge.requires_email && !email.trim()) {
                throw new Error(
                    "Enter your email address above to create an account for this wallet.",
                );
            }
            const activeChain = await ethereum.request({
                method: "eth_chainId",
            });
            if (
                typeof activeChain !== "string" ||
                Number.parseInt(activeChain, 16) !== challenge.chain_id
            ) {
                await ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [
                        { chainId: `0x${challenge.chain_id.toString(16)}` },
                    ],
                });
            }
            const message = [
                `${challenge.domain} wants you to sign in with your Ethereum account:`,
                walletAddress,
                "",
                challenge.statement,
                "",
                `URI: ${challenge.uri}`,
                "Version: 1",
                `Chain ID: ${challenge.chain_id}`,
                `Nonce: ${challenge.nonce}`,
                `Issued At: ${new Date(challenge.issued_at).toISOString()}`,
                `Expiration Time: ${new Date(challenge.expires_at).toISOString()}`,
            ].join("\n");
            const signature = await signSiweMessage(
                ethereum,
                message,
                walletAddress,
            );
            await signInWithSiwe(message, signature, email.trim() || undefined);
            navigate(returnTo, { replace: true });
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Wallet sign-in failed. Please try again.",
            );
        } finally {
            setBusy(false);
        }
    };

    useEffect(() => {
        if (!googleClientId) return;

        const container = document.getElementById("google-sign-in");
        if (!container) return;

        let resizeObserver: ResizeObserver | undefined;
        const identity = (window as Window & { google?: GoogleIdentity })
            .google;
        const googleNonce = createProviderNonce();

        const mountButton = () => {
            const google = (window as Window & { google?: GoogleIdentity })
                .google;
            const googleId = google?.accounts?.id;
            if (!googleId) {
                setError(
                    "Google sign-in could not load. You can continue with email.",
                );
                return;
            }

            googleId.initialize({
                client_id: googleClientId,
                nonce: googleNonce,
                callback: async (response) => {
                    if (!response.credential) {
                        setError(
                            "Google did not return a sign-in credential. Please try again.",
                        );
                        return;
                    }
                    setBusy(true);
                    setError("");
                    try {
                        await signInWithGoogle(
                            response.credential,
                            googleNonce,
                        );
                        navigate(returnTo, { replace: true });
                    } catch (err: unknown) {
                        setError(
                            err instanceof Error
                                ? err.message
                                : "Google sign-in failed. Please try again.",
                        );
                    } finally {
                        setBusy(false);
                    }
                },
            });

            const renderButton = () => {
                const width = Math.min(
                    400,
                    Math.floor(container.getBoundingClientRect().width),
                );
                if (
                    !width ||
                    (container.classList.contains("google-sign-in-ready") &&
                        container.dataset.buttonWidth === String(width))
                )
                    return;

                const fallback = container.querySelector(
                    ".google-sign-in-fallback",
                );
                Array.from(container.childNodes).forEach((node) => {
                    if (node !== fallback) node.remove();
                });
                container.classList.remove("google-sign-in-ready");

                try {
                    googleId.renderButton(container, {
                        theme: "outline",
                        size: "large",
                        shape: "pill",
                        text: "continue_with",
                        width,
                        logo_alignment: "left",
                    });
                } catch {
                    Array.from(container.childNodes).forEach((node) => {
                        if (node !== fallback) node.remove();
                    });
                    setError(
                        "Google sign-in button could not render. You can continue with another method.",
                    );
                    return;
                }

                const hasGoogleButton = Array.from(container.children).some(
                    (child) => child !== fallback,
                );
                if (!hasGoogleButton) {
                    Array.from(container.childNodes).forEach((node) => {
                        if (node !== fallback) node.remove();
                    });
                    setError(
                        "Google sign-in button could not render. You can continue with another method.",
                    );
                    return;
                }
                container.classList.add("google-sign-in-ready");
                container.dataset.buttonWidth = String(width);
            };

            renderButton();
            resizeObserver = new ResizeObserver(renderButton);
            resizeObserver.observe(container);
        };

        if (identity?.accounts?.id) {
            mountButton();
            return () => resizeObserver?.disconnect();
        }

        let script = document.querySelector<HTMLScriptElement>(
            "script[data-google-identity]",
        );
        const onLoad = () => mountButton();
        const onError = () => {
            script?.remove();
            setError(
                "Google sign-in could not load. You can continue with email.",
            );
        };
        if (!script) {
            script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.dataset.googleIdentity = "true";
        }
        script.addEventListener("load", onLoad);
        script.addEventListener("error", onError);
        if (!script.isConnected) document.head.appendChild(script);

        return () => {
            resizeObserver?.disconnect();
            script?.removeEventListener("load", onLoad);
            script?.removeEventListener("error", onError);
        };
    }, [googleClientId, navigate, returnTo, signInWithGoogle]);

    return (
        <div className="auth-page">
            <div className="auth-aside">
                <Brand light />
                <div className="auth-aside-content">
                    <div className="auth-illustration">
                        <div className="auth-circle">
                            <HeartHandshake size={76} />
                        </div>
                        <span className="auth-spark spark-a">✳</span>
                        <span className="auth-spark spark-b">✦</span>
                        <span className="auth-spark spark-c">✳</span>
                    </div>
                    <div className="eyebrow light-eyebrow">
                        GIVING WITH CONFIDENCE
                    </div>
                    <h1>
                        Support a cause.
                        <br />
                        <span>Follow its impact.</span>
                    </h1>
                    <p>
                        Find community campaigns and keep your contribution
                        history together in one place.
                    </p>
                </div>
                <div className="auth-aside-foot">
                    Every campaign. Every contribution. One record.
                </div>
            </div>

            <div className="auth-main">
                <Link to="/" className="auth-back">
                    <ArrowLeft size={16} /> Back to Fundora
                </Link>
                <div className="auth-form-wrap">
                    <div className="auth-form-icon">
                        <Mail size={22} />
                    </div>
                    <div className="eyebrow">WELCOME TO FUNDORA</div>
                    <h2>
                        {step === "email"
                            ? "Sign in or create an account"
                            : "Enter your sign-in code"}
                    </h2>
                    <p>
                        {step === "email"
                            ? "Choose an account method to continue."
                            : `Enter the code sent to ${email}.`}
                    </p>
                    {step === "email" ? (
                        <>
                            <form
                                onSubmit={sendOtp}
                                className="auth-form auth-email-form"
                            >
                                <div className="field auth-email-field">
                                    <label htmlFor="auth-email">
                                        Email address
                                    </label>
                                    <div className="auth-email-input-row">
                                        <input
                                            id="auth-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(event) =>
                                                setEmail(event.target.value)
                                            }
                                            required
                                        />
                                        <Button
                                            type="submit"
                                            aria-label={
                                                busy
                                                    ? "Sending sign-in code"
                                                    : "Send sign-in code"
                                            }
                                            disabled={busy || !email.trim()}
                                        >
                                            <ArrowRight size={17} />
                                        </Button>
                                    </div>
                                </div>
                            </form>
                            <div className="auth-divider">
                                <span>or continue with</span>
                            </div>
                            <div className="auth-provider-list">
                                <div
                                    id="google-sign-in"
                                    className="google-sign-in"
                                    aria-label="Continue with Google"
                                >
                                    <button
                                        type="button"
                                        className="provider-button google-sign-in-fallback"
                                        disabled
                                    >
                                        Continue with Google
                                    </button>
                                </div>
                                {!googleClientId && (
                                    <div className="provider-setup-note">
                                        Set VITE_GOOGLE_CLIENT_ID to enable
                                        Google sign-in.
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="provider-button provider-button-apple"
                                    onClick={signInWithAppleAccount}
                                    disabled={busy || !appleClientId}
                                >
                                    <AppleLogo /> Continue with Apple
                                </button>
                                {!appleClientId && (
                                    <div className="provider-setup-note">
                                        Set VITE_APPLE_CLIENT_ID and register
                                        the redirect URL to enable Apple.
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="provider-button"
                                    onClick={signInWithWallet}
                                    disabled={busy}
                                >
                                    <Wallet size={18} /> Continue with MetaMask
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={verify} className="auth-form">
                            <Field
                                label="6-digit verification code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000000"
                                value={code}
                                onChange={(event) =>
                                    setCode(
                                        event.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 6),
                                    )
                                }
                                maxLength={6}
                                required
                            />
                            <Button
                                type="submit"
                                disabled={busy || code.length !== 6}
                            >
                                {busy ? "Verifying…" : "Verify and sign in"}{" "}
                                <ArrowRight size={17} />
                            </Button>
                            <button
                                type="button"
                                className="text-action"
                                onClick={() => {
                                    setStep("email");
                                    setCode("");
                                    setError("");
                                    setNotice("");
                                }}
                            >
                                Use a different email
                            </button>
                            <button
                                type="button"
                                className="text-action"
                                onClick={requestCode}
                                disabled={busy}
                            >
                                Resend code
                            </button>
                        </form>
                    )}
                    {notice && (
                        <div className="inline-success">
                            <CheckCircle2 size={16} />
                            {notice}
                        </div>
                    )}
                    {error && (
                        <div className="inline-error" role="alert">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
