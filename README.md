# Fundora React Frontend

React + TypeScript frontend for the Fundora Rust Axum API.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Reusable shadcn-inspired UI primitives
- Lucide icons
- React Router
- Fetch-based API client with JWT refresh/retry
- Urbanist font and the Fundora 60/30/10 palette

## Requirements

- Node.js 20+ recommended
- npm
- Fundora Axum API running locally (default: `http://localhost:8080`)

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

Build:

```bash
npm run build
```

## Configure the Rust API

Set `.env`:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_USE_CREDENTIALS=false
```

The API base URL includes `/api/v1`. Do not append `/api/v1` a second time in endpoint calls.

### Backend CORS

Allow the frontend development origin (`http://localhost:5173`) in the Axum CORS configuration. Allow:
- Methods: `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `OPTIONS`
- Headers: `Content-Type`, `Authorization`
- Credentials only if the backend uses cookies.

If using `credentials: include`, configure an explicit allowed origin (not `*`) and `Access-Control-Allow-Credentials: true`.

## Implemented API calls

The endpoint names below follow the Fundora Postman collection supplied for this project.

| Frontend feature | Method | Endpoint |
|---|---|---|
| Request email OTP | POST | `/auth/email/request` |
| Verify email OTP | POST | `/auth/email/verify` |
| Load current user | GET | `/auth/me` |
| Refresh rotating tokens | POST | `/auth/refresh` |
| Logout | POST | `/auth/logout` |
| List campaigns | GET | `/campaigns` |
| Campaign detail | GET | `/campaigns/{id}` |
| Create campaign | POST | `/campaigns` |
| Update campaign | PATCH | `/campaigns/{id}` |
| Create GCash/Maya payment | POST | `/donations` |
| Check payment status | GET | `/donations/{id}/payment-status` |
| List donor donations | GET | `/donations/my` |
| List withdrawals | GET | `/withdrawals` |
| Review withdrawal | POST | `/withdrawals/{id}/review` |
| Transaction lookup | GET | `/transactions/{hash}` |

Donors contribute in PHP through GCash or Maya without connecting MetaMask.
Debug builds default to a local payment simulator with a clearly labeled
confirmation action; it does not collect money. To use Xendit Test Mode, set
`PAYMENT_MODE=xendit`, `XENDIT_SECRET_KEY`, and `XENDIT_WEBHOOK_TOKEN` in the
backend environment, then configure Xendit payment-session completion and
expiry webhooks to call `/api/v1/webhooks/xendit`. The backend verifies each
webhook against Xendit before confirming the donation and updating the campaign
total.

Xendit test credentials require a Xendit account in Test Mode. Real GCash/Maya
settlements are paid to the merchant's Xendit account; they do not transfer
directly to an organizer's MetaMask wallet. The campaign PHP total is Fundora's
ledger value, not a representation of funds held in a wallet. Organizer wallet
linking remains separate from donor checkout.

### API response expectations

- OTP verification returns `access_token` and `refresh_token`, plus a user profile or a profile available through `/auth/me`.
- `/auth/me` returns a user object. The client accepts either a direct user or common `{ user }` / `{ data }` wrappers.
- Campaign list returns an array, or `{ data: [...] }`, `{ items: [...] }`, or `{ campaigns: [...] }`.
- Donation and withdrawal list parsing accepts the same common list wrappers.
- API errors may return `{ error }` or `{ message }`.

If your Axum response structs differ, update the small adapter functions in `src/lib/api.ts` and `src/context/AuthContext.tsx`. Do not change server authorization to fit frontend assumptions.

## Authentication and roles

- Email OTP is implemented using the project's exact routes and request field `code`.
- Access/refresh token pair is stored in `sessionStorage` for this starter, cleared on logout, and rotated through `/auth/refresh` after a 401.
- For production, prefer an HttpOnly + Secure refresh-token cookie (with CSRF protections) if the backend supports it. Avoid long-lived credentials in `localStorage`.
- A new public account should be assigned the `donor` role by the backend. The frontend does not send a role during sign-up.
- Organizer and administrator routes are protected in the UI, but the Axum API must enforce role checks independently.
- Do not create organizer/admin accounts through a public form. Provision/approve privileged users through your backend/admin process.
- Google sign-in requires matching frontend/backend client IDs and the exact frontend origin (scheme, host, and port) in the OAuth client's Authorized JavaScript origins in Google Cloud Console. Local Vite development uses `http://localhost:5173`.
- Apple sign-in uses Apple Sign in with Apple JS and requires matching `VITE_APPLE_CLIENT_ID` / `APPLE_CLIENT_ID` values plus a registered `VITE_APPLE_REDIRECT_URI`.
- MetaMask/SIWE sign-in requires a compatible browser wallet and backend `SIWE_DOMAIN`, `SIWE_URI`, and `SIWE_CHAIN_ID` configuration. New wallet accounts require an email address; existing accounts are never linked by email matching alone.
- Email sign-in requires a configured Resend API key and sender. Resend's test sender may restrict delivery to authorized recipients; verify a sending domain to deliver codes to other addresses.

## Current UI pages

- Public campaign landing page and campaign cards
- Campaign detail page with authenticated donation-request submission
- Email OTP sign-in / registration
- Donor dashboard and donation history
- Organizer dashboard and create-campaign form
- Administrator overview and withdrawal review queue
- Transaction lookup page at `/verify/:hash`

## Important integration notes

1. Campaign API `GET /campaigns` is used for public listing and organizer overview. If the backend later exposes a dedicated organizer-owned endpoint, update `campaignApi.list()` to use it and scope records server-side.
2. `GET /donations` and `GET /withdrawals` are wired to the resource collection paths. Confirm those list routes are present in your current Axum router. If not, add them or adjust `donationApi.list()` / `withdrawalApi.list()`.
3. The frontend never trusts a client-supplied role for authorization. Role checks here are only navigation/UX; API middleware and handlers remain authoritative.
4. Campaign create uses the current Postman payload shape (`title`, `description`, `image_url`, `goal_amount`, `currency`, `network`, `contract_address`, `starts_at`, `ends_at`). Replace placeholder contract/network defaults with your backend's actual campaign deployment configuration before production.
5. The campaign detail page submits `campaign_id`, `amount`, `payment_method`, `is_anonymous`, and `message` to `POST /donations`. The backend accepts PHP campaigns and confirms contributions only from the local simulator or a verified Xendit session. Xendit records display their provider reference; blockchain hash, network, block, and confirmation fields are marked not applicable because GCash/Maya are off-chain. A successful Xendit checkout returns donors to `/dashboard` when `FRONTEND_ORIGIN` is public HTTPS; local HTTP origins omit the redirect URL. A backend poller verifies pending Xendit sessions every 30 seconds as a webhook fallback, and the dashboard offers a manual retry while confirmation is pending.

## Project structure

```text
src/
  components/       Shared layout, cards, UI primitives
  context/          Authentication state
  lib/              API client, types, formatting helpers
  pages/            Public, auth, donor, organizer, admin pages
  App.tsx
  main.tsx
  styles.css
```

## Troubleshooting

- `Failed to fetch`: check that Axum is running and `.env` points to the correct port.
- CORS error: allow `http://localhost:5173` in the Rust API.
- 401 loop: verify `/auth/refresh` accepts `{ "refresh_token": "..." }` and returns a newly rotated pair.
- OTP request returns 500: check `EMAIL_FROM`, `RESEND_API_KEY`, email provider setup, and backend logs.
- Sign-in succeeds but role is donor: expected for new public accounts; organizer/admin roles must be assigned server-side.
- Organizer/admin page redirects: inspect `/auth/me` and ensure it returns the assigned role under `role`, `role_name`, `role.name`, or `roles[0].name`.

## Not yet included

- Live-mode payment processing and organizer payouts
- Upload service for campaign images
- Live notifications
- Full campaign edit/archive UX
- End-to-end tests against a running backend

These are not represented as completed integrations.
