# USDC Payment Rail Refactor — NFC Processor + New Retail Intent Generator

## Context

The existing code refers to a non-existent "IDIA-USD" asset. The real rail is **USDC stablecoin**, settled over our settlement network and cleared through our retail connect network. We will:

1. Refactor `supabase/functions/process-nfc-payment/index.ts` to consume the new "Omni-Payload" (`scanned_intent`, `aca_hash`, `base_signature`) and enforce the Auditable Consent Artifact (ACA) as the immutable proof of consent for every transaction instance.
2. Create a new edge function `supabase/functions/flexa-payment-processing/index.ts` that mints a retail checkout session intent.
3. Sweep the rest of the platform for "IDIA-USD" labels and rename to USDC.

Per directive: **no third-party brand names appear in identifiers, log tags, UI strings, or comments**. The only place external SDK names appear is inside neutral `// TODO:` scaffold comments referring to "Settlement Network SDK" and "Retail Connect SDK" — never the vendor names. Function/folder names that already contain `flexa` or `base` (e.g. the `flexa-payment-processing` folder name and the `base_flexa_hybrid` payment_processor string) are kept ONLY because the user's own request explicitly names them; everything else is generic.

## Deliverable 1 — New file: `supabase/functions/flexa-payment-processing/index.ts`

- POST endpoint, JSON body: `{ amount: number, currency: "USDC", locationId: string }`.
- Hard-validates `currency === "USDC"` (rejects anything else with 400).
- Mints a mock `sessionId = crypto.randomUUID()`.
- Returns 200 `{ sessionId, status: "awaiting_signature" }`.
- Header comment block documents:
  - Deployment via Supabase CLI.
  - Required edge env: `SUPABASE_SERVICE_ROLE_KEY`, `BASE_RPC_URL`, `FLEXA_API_KEY`.
- Granular `[BEGIN: …] / [PROCESS: …] / [END: …]` logs around: extract → generate → respond, plus CRITICAL FAILURE on the catch path.
- Structured `// TODO:` scaffold block where the Retail Connect SDK call will live (no vendor name).

## Deliverable 2 — Refactor: `supabase/functions/process-nfc-payment/index.ts`

Header comment block documents deployment + the three required env secrets.

Logical flow with `[BEGIN/PROCESS/END]` logs at every step:

1. **Extract Omni-Payload** — pull `scanned_intent`, `aca_hash`, `base_signature` from `nfcPayload`. Reject 400 if any are missing.
2. **ACA Consent Application (mandatory)** — remove the old `validate_nfc_signature` RPC. Use the admin Supabase client to look up `aca_hash` in `aca_consent_artifacts`, require status `active` and unexpired. Log: `"Applying ACA as cryptographic proof of consent for transaction instance."`. 401 if invalid.
3. **Settlement broadcast scaffold** — `// TODO:` block for the Settlement Network account SDK to broadcast `base_signature`. Mint a mock `blockchainTxId`.
4. **Retail clearing scaffold** — `// TODO:` block for the Retail Connect SDK to clear `scanned_intent`.
5. **`pos_transactions` insert** — keep, but:
   - `payment_method: "USDC (NFC)"`
   - `payment_processor: "base_flexa_hybrid"` (string the user explicitly mandated)
   - `nfc_payload` JSONB now carries `{ scanned_intent, base_signature, aca_hash, settlement_tx_id }` — `aca_hash` is the immutable consent stamp.
6. **`nfc_transactions` insert** — keep; map `customer_wallet_address` to a derived placeholder (`derived:<aca_hash[:16]>`), `signature_payload` to `base_signature`, `idia_amount` and `usd_equivalent` both = `totalAmount`, `exchange_rate = 1`.
7. **Status update** to `completed`.
8. **`merchant_notifications` insert** — same shape as before, but title/message/payload reference USDC instead of IDIA-USD.
9. **Catch block** — wrapped with `[END: process-nfc-payment] CRITICAL FAILURE …` log.

## Deliverable 3 — Platform-wide "IDIA-USD" → "USDC" rename

After the edge functions, search the project for any remaining `IDIA-USD` / `IDIA USD` / `idia_usd` references in user-facing or runtime code and rename to USDC (preserving the existing `idia_usd_amount` column name, since that's a DB schema identifier — the column simply stores the USDC amount now, and renaming would require a DB migration the user did not request). I will:
- `rg -n "IDIA[- ]USD|idia[- ]usd"` across `src/`.
- Update labels, toasts, comments, and any UI copy to "USDC".
- Leave the column name `idia_usd_amount` alone unless the user asks for a migration.

## Files touched

- **Created:** `supabase/functions/flexa-payment-processing/index.ts`
- **Rewritten:** `supabase/functions/process-nfc-payment/index.ts`
- **Edited (string rename only):** any `src/**` file referring to "IDIA-USD" — list will be reported after `rg` sweep, expected scope is small (a handful of POS/checkout components and notifications).

## Out of scope

- No DB migration. The existing schema already has `aca_consent_artifacts`-style ledger; if it does not, the ACA lookup will fail safely with a 401 at runtime and we will then add the table in a follow-up turn. (If you want me to verify the table exists before refactoring, say so and I will run a `read_query` first.)
- The `idia_usd_amount` column is left in place; only the label "IDIA-USD" is purged from code and UI.
- Pre-existing Supabase type errors in unrelated modules remain untouched.

## Verification

- Re-read both files to confirm the logging pattern is uniform and no third-party brand names leaked into identifiers, strings, or non-TODO comments.
- `rg "IDIA-USD|idia-usd"` across the whole repo — expect only DB column names to remain.
- Deploy both functions and tail logs via the Supabase Functions dashboard.
