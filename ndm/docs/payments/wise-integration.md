# Wise Payment Integration

Negosyo Digital uses [Wise](https://wise.com) to automate creator payouts via bank transfer. All withdrawals are processed exclusively through Wise — GCash and Maya have been removed from the payout flow.

---

## Architecture

```
Creator taps "Withdraw Funds"
        ↓
wallet.tsx → useMutation(api.withdrawals.create)
        ↓
convex/withdrawals.ts: create()
  ├── Validate minimum ₱100
  ├── Validate sufficient balance
  ├── Deduct balance (optimistic)
  ├── Insert withdrawal record (status: pending)
  └── Schedule: internal.wise.initiateTransfer
        ↓
convex/wise.ts: initiateTransfer()  [Convex action]
  ├── POST /v1/accounts          → create recipient
  ├── POST /v3/quotes            → get PHP quote
  ├── POST /v1/transfers         → create transfer
  ├── POST /v3/profiles/.../payments → fund & execute
  └── withdrawals.setWiseTransferIds (status: processing)
        ↓
Wise processes transfer (minutes to hours)
        ↓
Wise webhook → https://diligent-ibex-454.convex.site/wise-webhook
        ↓
convex/http.ts: /wise-webhook
  └── withdrawals.updateByTransactionRef (status: completed | failed)
        ↓  (on failure)
  └── withdrawals.markFailed → restore creator balance
```

---

## Files Changed

| File | Change |
|---|---|
| `convex/schema.ts` | Removed `gcash`/`maya` from unions; added `wiseTransferId`, `wiseRecipientId`, `bankCode`, `accountHolderName`, `bankName`, `failureReason` to `withdrawals`; added `bankName`/`bankCode` to `payoutMethods` |
| `services/wise.ts` | **NEW** — Pure Wise API client (no Convex deps, fully testable) |
| `convex/wise.ts` | **NEW** — Convex internal action orchestrating the full transfer flow |
| `convex/withdrawals.ts` | Added `setWiseTransferIds`, `markFailed` internal mutations; updated `create()` to trigger Wise |
| `convex/http.ts` | Added `/wise-webhook` HTTP action |
| `app/(app)/(tabs)/wallet.tsx` | Added withdrawal modal with bank details form |

---

## Environment Variables

Set these in your **Convex Dashboard → Settings → Environment Variables**:

| Variable | Description | Required |
|---|---|---|
| `WISE_SANDBOX_TOKEN` | Sandbox API token | Dev |
| `WISE_SANDBOX_PROFILE_ID` | Sandbox business profile ID | Dev |
| `WISE_API_TOKEN` | Production API token | Prod |
| `WISE_PROFILE_ID` | Production business profile ID | Prod |
| `WISE_SANDBOX` | Set to `"false"` to enable production mode | Both |

The app defaults to **sandbox mode** unless `WISE_SANDBOX=false` is explicitly set.

---

## Getting Wise Sandbox Credentials

### Step 1 — Create a sandbox account
Go to [sandbox.transferwise.tech](https://sandbox.transferwise.tech) and register.

### Step 2 — Generate a sandbox API token
Settings → Developer Tools → API Tokens → Add new token.

Required permissions:
- `transfers.read` / `transfers.create` / `transfers.execute`
- `recipients.read` / `recipients.write`
- `balances.read`
- `webhooks.manage`

### Step 3 — Get your profile ID
```bash
curl -X GET "https://api.sandbox.transferwise.tech/v1/profiles" \
  -H "Authorization: Bearer YOUR_SANDBOX_TOKEN"
```
Use the `id` of the `BUSINESS` type profile.

### Step 4 — Add a PHP balance
```bash
# Create PHP balance
curl -X POST "https://api.sandbox.transferwise.tech/v4/profiles/{profileId}/balances" \
  -H "Authorization: Bearer YOUR_SANDBOX_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-idempotence-uuid: $(uuidgen)" \
  -d '{"currency": "PHP", "type": "STANDARD"}'

# Top up (sandbox only)
curl -X POST "https://api.sandbox.transferwise.tech/v1/simulation/balance/topup" \
  -H "Authorization: Bearer YOUR_SANDBOX_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"profileId": YOUR_PROFILE_ID, "balanceId": YOUR_BALANCE_ID, "currency": "PHP", "amount": 100000}'
```

### Step 5 — Set up webhook
In Wise Sandbox → Settings → Developer Tools → Webhooks:
- URL: `https://diligent-ibex-454.convex.site/wise-webhook`
- Event: **Transfer update events**

---

## Philippine Bank Codes (BSP Routing Codes)

Use these in the **BSP Bank Code** field:

| Bank | BSP Routing Code |
|---|---|
| BDO Unibank | `010530667` |
| Bank of the Philippine Islands (BPI) | `010040018` |
| Metrobank | `010269996` |
| UnionBank | `010841031` |
| Security Bank | `010371004` |
| Landbank | `010570010` |
| PNB | `010270013` |
| RCBC | `010570564` |

---

## Testing

### Setup (first time)
```bash
cd ndm
npm install
```

### Run all tests
```bash
npm test
```

### Run with watch mode (development)
```bash
npm run test:watch
```

### Run with coverage report
```bash
npm run test:coverage
```

### Test files

| File | What it tests |
|---|---|
| `__tests__/services/wise.test.ts` | Wise API client — all API functions, error handling, URL switching |
| `__tests__/wallet.test.tsx` | Wallet UI — balance display, modal open/close, form validation, mutation calls |
| `__tests__/convex/withdrawals.test.ts` | Business logic — minimum amount, balance checks, state mapping, deductions |

### Coverage targets
- Branches: 70%
- Functions: 70%
- Lines: 70%

---

## Wise Transfer State Machine

Wise fires the `/wise-webhook` endpoint on every state change. These are the states that matter:

| Wise State | Withdrawal Status | Action |
|---|---|---|
| `processing` | `processing` | No side effects |
| `outgoing_payment_sent` | `completed` | Update `totalWithdrawn`, send push notification |
| `cancelled` | `failed` | Restore creator balance |
| `funds_refunded` | `failed` | Restore creator balance |
| `bounced_back` | `failed` | Restore creator balance |
| `charged_back` | `failed` | Restore creator balance |

---

## Switching to Production

1. Complete **KYB verification** at wise.com (1–3 business days)
2. Fund your Wise business balance with PHP
3. In Convex Dashboard, add `WISE_API_TOKEN` and `WISE_PROFILE_ID`
4. Set `WISE_SANDBOX=false`
5. Update webhook URL in **production** Wise account (same endpoint)
6. Test with a small real transfer before going live

---

## Known Limitations

- **GCash and Maya** are not supported by Wise — bank transfer only
- **Wise PHP balance** must be funded before transfers can execute
- **KYB required** — production transfers blocked until Wise approves the business account
- The `bankCode` field requires the BSP routing code, not the bank name

---

## Troubleshooting

**`[Wise] Missing WISE_SANDBOX_TOKEN`**
→ Add the environment variable in Convex Dashboard.

**`Wise 422` on createRecipient**
→ Invalid bank code or account number format. Verify the BSP routing code.

**`Wise 422` on fundTransfer — `not_enough_funds`**
→ Top up your Wise PHP balance via the sandbox simulation endpoint or the Wise dashboard.

**Withdrawal stuck at `pending`**
→ The `initiateTransfer` action may have failed silently. Check Convex logs (Dashboard → Logs). The withdrawal will be marked `failed` and the balance restored automatically.

**Webhook not firing**
→ Ensure the webhook is configured in the correct environment (sandbox vs production) and the Convex deployment is live.
