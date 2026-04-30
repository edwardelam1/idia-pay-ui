/* =============================================================================
 * NFC PAYMENT PROCESSOR — Hybrid Settlement + Retail Clearing Rail
 * -----------------------------------------------------------------------------
 * Handles the IDIA Life tap "Omni-Payload": settles a USDC charge over the
 * settlement network and clears the scanned retail intent. Every transaction
 * MUST carry an Auditable Consent Artifact (ACA) — the immutable cryptographic
 * proof of the user's consent for THIS transaction instance.
 *
 * DEPLOYMENT
 *   Deploy via the Supabase CLI:
 *     supabase functions deploy process-nfc-payment
 *
 * REQUIRED EDGE ENVIRONMENT SECRETS
 *   - SUPABASE_SERVICE_ROLE_KEY   (privileged ledger writes)
 *   - BASE_RPC_URL                (settlement network RPC endpoint)
 *   - FLEXA_API_KEY               (retail connect network credential)
 *
 * REQUEST (POST, application/json)
 *   {
 *     nfcPayload: {
 *       scanned_intent: string,   // retail checkout session id
 *       aca_hash: string,         // identity beacon + consent proof
 *       base_signature: string    // signed USDC payload
 *     },
 *     locationId: string,
 *     items: unknown[],
 *     totalAmount: number
 *   }
 * ============================================================================= */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.info("[BEGIN: process-nfc-payment] Request received.");

  if (req.method === "OPTIONS") {
    console.info("[END: process-nfc-payment] CORS preflight handled.");
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.error(
      "[END: process-nfc-payment] CRITICAL FAILURE. Offset: MethodGuard | Reason: Non-POST method.",
    );
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ---------------------------------------------------------------------
    // 0. Privileged client
    // ---------------------------------------------------------------------
    console.info("[PROCESS: process-nfc-payment] Bootstrapping privileged Supabase client.");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ---------------------------------------------------------------------
    // 1. Omni-Payload extraction & validation
    // ---------------------------------------------------------------------
    console.info("[BEGIN: process-nfc-payment.extract] Parsing Omni-Payload.");
    const { nfcPayload, locationId, items, totalAmount } = await req.json();

    const scanned_intent: string | undefined = nfcPayload?.scanned_intent;
    const aca_hash: string | undefined = nfcPayload?.aca_hash;
    const base_signature: string | undefined = nfcPayload?.base_signature;

    console.info(
      `[PROCESS: process-nfc-payment.extract] scanned_intent=${!!scanned_intent} aca_hash=${!!aca_hash} base_signature=${!!base_signature} locationId=${locationId} totalAmount=${totalAmount}`,
    );

    if (!scanned_intent || !aca_hash || !base_signature || !locationId || typeof totalAmount !== "number") {
      console.error(
        "[END: process-nfc-payment.extract] CRITICAL FAILURE. Offset: PayloadGuard | Reason: Missing required Omni-Payload fields.",
      );
      return new Response(
        JSON.stringify({ error: "Invalid Omni-Payload", success: false }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    console.info("[END: process-nfc-payment.extract] Omni-Payload accepted.");

    // ---------------------------------------------------------------------
    // 2. ACA Consent Application (MANDATORY)
    //    The ACA marks the immutable instance of consent for THIS
    //    transaction. No ACA → no transaction. Period.
    // ---------------------------------------------------------------------
    console.info("[BEGIN: process-nfc-payment.aca] Validating Auditable Consent Artifact.");
    console.info(
      "[PROCESS: process-nfc-payment.aca] Applying ACA as cryptographic proof of consent for transaction instance.",
    );

    const { data: acaRecord, error: acaError } = await supabaseClient
      .from("aca_consent_artifacts")
      .select("id, hash, status, expires_at")
      .eq("hash", aca_hash)
      .maybeSingle();

    const acaIsValid =
      !acaError &&
      acaRecord &&
      acaRecord.status === "active" &&
      (!acaRecord.expires_at || new Date(acaRecord.expires_at).getTime() > Date.now());

    if (!acaIsValid) {
      console.error(
        `[END: process-nfc-payment.aca] CRITICAL FAILURE. Offset: ACAGuard | Reason: ACA missing or invalid. dbError=${acaError?.message ?? "none"}`,
      );
      return new Response(
        JSON.stringify({ error: "Auditable Consent Artifact missing or invalid", success: false }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    console.info(`[END: process-nfc-payment.aca] ACA verified. acaId=${acaRecord.id}`);

    // ---------------------------------------------------------------------
    // 3. Settlement network broadcast (USDC)
    // ---------------------------------------------------------------------
    console.info("[BEGIN: process-nfc-payment.settle] Preparing USDC settlement broadcast.");

    /* -----------------------------------------------------------------
     * TODO: Invoke the Settlement Network account SDK to broadcast
     *       `base_signature` to the settlement network and obtain a
     *       confirmed transaction id. Replace the mock below with the
     *       real RPC call once the SDK is wired up.
     *
     *   const tx = await settlementAccount.broadcast({
     *     signedPayload: base_signature,
     *     asset: "USDC",
     *   });
     *   const blockchainTxId = tx.hash;
     * ----------------------------------------------------------------- */

    const blockchainTxId = `mock-settle-${crypto.randomUUID()}`;
    console.info(`[END: process-nfc-payment.settle] Mock settlement complete. blockchainTxId=${blockchainTxId}`);

    // ---------------------------------------------------------------------
    // 4. Retail intent clearing
    // ---------------------------------------------------------------------
    console.info("[BEGIN: process-nfc-payment.clear] Clearing scanned retail intent.");

    /* -----------------------------------------------------------------
     * TODO: Invoke the Retail Connect SDK to clear `scanned_intent` and
     *       finalize the retail-side bookkeeping. Replace this scaffold
     *       with the real SDK call once credentials are wired up.
     *
     *   await retailConnect.intents.clear(scanned_intent, {
     *     settlementTxId: blockchainTxId,
     *   });
     * ----------------------------------------------------------------- */

    console.info(`[END: process-nfc-payment.clear] Mock clear complete. scanned_intent=${scanned_intent}`);

    // ---------------------------------------------------------------------
    // 5. Ledger write — POS transaction
    //    The aca_hash is appended into nfc_payload to immutably mark the
    //    consent for this ledger entry.
    // ---------------------------------------------------------------------
    console.info("[PROCESS: process-nfc-payment] Creating POS transaction ledger entry.");
    const { data: transaction, error: transactionError } = await supabaseClient
      .from("pos_transactions")
      .insert({
        location_id: locationId,
        total_amount: totalAmount,
        payment_method: "USDC (NFC)",
        payment_processor: "base_flexa_hybrid",
        idia_usd_amount: totalAmount,
        nfc_payload: {
          scanned_intent,
          base_signature,
          aca_hash, // immutable consent stamp on the ledger entry
          settlement_tx_id: blockchainTxId,
        },
        status: "pending_verification",
      })
      .select()
      .single();

    if (transactionError) {
      console.error(
        "[END: process-nfc-payment] CRITICAL FAILURE. Offset: POSLedgerInsert | Reason:",
        transactionError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to create transaction", success: false }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ---------------------------------------------------------------------
    // 6. Ledger write — NFC transaction
    // ---------------------------------------------------------------------
    console.info("[PROCESS: process-nfc-payment] Creating NFC transaction record.");
    const derivedWalletAddress = `derived:${aca_hash.substring(0, 16)}`;
    const { data: nfcTransaction, error: nfcError } = await supabaseClient
      .from("nfc_transactions")
      .insert({
        transaction_id: transaction.id,
        customer_wallet_address: derivedWalletAddress,
        idia_amount: totalAmount,
        usd_equivalent: totalAmount,
        exchange_rate: 1,
        signature_payload: base_signature,
        verification_status: "verified",
      })
      .select()
      .single();

    if (nfcError) {
      console.error(
        "[PROCESS: process-nfc-payment] NFC ledger insert failed — rolling back POS entry. Reason:",
        nfcError,
      );
      await supabaseClient.from("pos_transactions").delete().eq("id", transaction.id);
      console.error(
        "[END: process-nfc-payment] CRITICAL FAILURE. Offset: NFCLedgerInsert | Reason: Rolled back POS entry.",
      );
      return new Response(
        JSON.stringify({ error: "Failed to process NFC payment", success: false }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ---------------------------------------------------------------------
    // 7. Finalize POS transaction
    // ---------------------------------------------------------------------
    console.info("[PROCESS: process-nfc-payment] Marking POS transaction completed.");
    await supabaseClient
      .from("pos_transactions")
      .update({ status: "completed" })
      .eq("id", transaction.id);

    // ---------------------------------------------------------------------
    // 8. Merchant notification
    // ---------------------------------------------------------------------
    console.info("[PROCESS: process-nfc-payment] Inserting merchant notification.");
    await supabaseClient.from("merchant_notifications").insert({
      facility_id: locationId,
      notification_type: "order_received",
      title: "USDC Payment Received",
      message: `Successfully processed ${totalAmount} USDC payment`,
      payload: {
        transaction_id: transaction.id,
        amount: totalAmount,
        currency: "USDC",
        settlement_tx_id: blockchainTxId,
      },
      priority: 2,
    });

    // ---------------------------------------------------------------------
    // 9. Done
    // ---------------------------------------------------------------------
    console.info(
      `[END: process-nfc-payment] SUCCESS. transactionId=${transaction.id} nfcTransactionId=${nfcTransaction.id} settlementTxId=${blockchainTxId}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        nfc_transaction_id: nfcTransaction.id,
        settlement_tx_id: blockchainTxId,
        verification_status: "verified",
        blockchain_processing: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      "[END: process-nfc-payment] CRITICAL FAILURE. Offset: UnhandledException | Reason:",
      error,
    );
    return new Response(
      JSON.stringify({ error: (error as Error)?.message ?? "Unknown error", success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
