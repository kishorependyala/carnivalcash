# 🎪 CarnivalCash — Implementation Plan

## Current Status
Core app is live. All major features implemented. Next phase: real SMS OTP verification.

---

## Phase 8 — Real SMS OTP (Provider TBD)

### Context
- One-time charity event, ~200 users, ~250 total SMSs
- JWT will be extended **8h → 30 days** so users log in once and stay in
- **Phase A:** only `7327154415` gets real SMS; everyone else uses dev flow (phone = code)
- **Phase B (go-live):** remove whitelist — real SMS for all numbers

---

## SMS Provider Options

| Provider | Setup | Per SMS | ~250 SMS event | 100k SMS | Notes |
|---|---|---|---|---|---|
| **Azure ACS Toll-Free** | $2/mo number | $0.0075 | ~$4 | $750 | No registration, all-Azure ✅ |
| **Azure ACS 10DLC** | $6 one-time + $1/mo | $0.003 | ~$7 | $300 | Cheapest at scale, needs brand/campaign reg |
| **AWS SNS** | Free | $0.00645 | ~$2 | $645 | Cheapest small scale, separate AWS account |
| **Firebase Blaze** | Free | $0.010 | ~$2.50 | $1,000 | Needs reCAPTCHA + Firebase JS SDK on frontend |
| **Twilio Verify** | Free | $0.05/verify | ~$12.50 | $5,000 | Simplest API, most expensive |

> **Decision pending.** Recommendation: **Azure ACS Toll-Free** for this event (~$4 total, no registration needed, keeps everything in Azure).

---

## Architecture (same regardless of provider)

```
User enters phone
  → POST /api/auth/request-code
      → Backend generates 6-digit OTP (expires in 10 min)
      → Saves to data/otp/<phone>.json
      → SMS provider sends OTP to user's phone
  → User enters 6-digit code
  → POST /api/auth/verify { phone, code }
      → Backend checks OTP matches + not expired
      → Deletes OTP file
      → Issues 30-day JWT
```

**Dev fallback** (no credentials set): existing `phone == code` flow unchanged.

---

## Implementation Steps

### Step 0 — Provider Setup (manual, after decision)

**Azure ACS Toll-Free (recommended):**
1. Azure Portal → Create resource → **Communication Services** → name `carnivalcash-comm`
2. **Phone Numbers → Get number** → Toll-Free, SMS-enabled (~$2/month)
3. **Settings → Keys** → copy Connection String
4. Set env vars: `ACS_CONNECTION_STRING`, `ACS_PHONE_NUMBER`

**AWS SNS:**
1. AWS Console → SNS → Text messaging → Sandbox → add verified number
2. Request move out of sandbox for production
3. Set env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**Firebase:**
1. Firebase console → new project → Enable Phone Auth → upgrade to Blaze
2. Download service account JSON → `base64 -i key.json | tr -d '\n'`
3. Set env var: `FIREBASE_CREDENTIALS` (base64 JSON)
4. Frontend env vars: `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN`, `REACT_APP_FIREBASE_PROJECT_ID`

**All credentials go in:**
- Local: `.env` (gitignored)
- Azure App Service: Configuration → Application Settings
- GitHub Actions: Repository Secrets

---

### Step 1 — Backend

**Install (based on chosen provider):**
```bash
pip install azure-communication-sms   # Azure ACS
pip install boto3                      # AWS SNS
pip install firebase-admin             # Firebase
```

**New: `backend/app/storage/otp_store.py`**
- `save_otp(phone, code, expires_at)`
- `get_otp(phone)` → `{ code, expiresAt }` or `None`
- `delete_otp(phone)`
- Files at `data/otp/<normalizedPhone>.json`

**New: `backend/app/utils/sms_otp.py`**
- `generate_otp()` → 6-digit string
- `send_otp(phone)` → detects which env vars are set, routes to right provider
- `verify_otp(phone, code)` → checks file, returns bool, deletes on success
- No env vars set → log OTP to server console (dev mode)

**Changes to `backend/app/blueprints/auth.py`:**
- `POST /api/auth/request-code`:
  - Phase A: if normalized phone == `7327154415` → `send_otp(phone)`
  - Phase B: always call `send_otp(phone)`
  - Otherwise → existing no-op
- `POST /api/auth/verify`:
  - OTP file exists? → `verify_otp(phone, code)` → JWT on match
  - No file → fall back to `phone == code` (dev)
  - **JWT `exp`: 8h → 30 days**

---

### Step 2 — Frontend

**ACS / AWS path** — no new dependencies:
- `LoginPage.jsx`: change hint text to "Enter the 6-digit code sent to your phone"

**Firebase path** — additional work:
- `npm install firebase`
- New `frontend/src/firebase.js` — initialize app, export `auth`
- `LoginPage.jsx`: add invisible `RecaptchaVerifier`, use `signInWithPhoneNumber()` + `confirmationResult.confirm(code)` → send `idToken` to backend

---

### Step 3 — Phase B: Go live for all numbers
- Remove `if phone == '7327154415'` check
- Keep `phone == code` fallback only when no SMS credentials are set

---

## Cost Summary (200-user event)

| Provider | Total |
|---|---|
| Azure ACS Toll-Free | ~$4 |
| Azure ACS 10DLC | ~$7 (first time) |
| AWS SNS | ~$2 |
| Firebase | ~$2.50 |
| Twilio | ~$12.50 |
