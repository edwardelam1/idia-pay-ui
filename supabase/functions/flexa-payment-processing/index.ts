/* =============================================================================
 * RETAIL CHECKOUT INTENT GENERATOR
 * -----------------------------------------------------------------------------
 * Securely produces a retail checkout session intent for the IDIA Pay terminal.
 *
 * DEPLOYMENT
 *   Deploy via the Supabase CLI:
 *     supabase functions deploy flexa-payment-processing
 *
 * REQUIRED EDGE ENVIRONMENT SECRETS
 *   - SUPABASE_SERVICE_ROLE_KEY   (privileged ledger writes)
 *   - BASE_RPC_URL                (settlement network RPC endpoint)
 *   - FLEXA_API_KEY               (retail connect network credential)
 *
 * REQUEST  (POST, application/json)
 *   { amount: number, currency: "USDC", locationId: string }
 *
 * RESPONSE (200)
 *   { sessionId: string, status: "awaiting_signature" }
 * ============================================================================= */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.info("[BEGIN: retail-intent] Request received.");

  if (req.method === "OPTIONS") {
    console.info("[END: retail-intent] CORS preflight handled.");
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.error("[END: retail-intent] CRITICAL FAILURE. Offset: MethodGuard | Reason: Non-POST method.");
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ---------------------------------------------------------------------
    // 1. Variable extraction
    // ---------------------------------------------------------------------
    console.info("[BEGIN: retail-intent.extract] Parsing inbound JSON payload.");
    const body = await req.json();
    const { amount, currency, locationId } = body ?? {};
    console.info(
      `[PROCESS: retail-intent.extract] amount=${amount} currency=${currency} locationId=${locationId}`,
    );

    if (typeof amount !== "number" || amount <= 0) {
      console.error("[END: retail-intent.extract] CRITICAL FAILURE. Offset: AmountGuard | Reason: Invalid amount.");
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (currency !== "USDC") {
      console.error(
        `[END: retail-intent.extract] CRITICAL FAILURE. Offset: CurrencyGuard | Reason: Unsupported currency '${currency}'. Only USDC is accepted.`,
      );
      return new Response(JSON.stringify({ error: "Unsupported currency. Only USDC is accepted." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!locationId || typeof locationId !== "string") {
      console.error("[END: retail-intent.extract] CRITICAL FAILURE. Offset: LocationGuard | Reason: Missing locationId.");
      return new Response(JSON.stringify({ error: "Missing locationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.info("[END: retail-intent.extract] Payload accepted.");

    // ---------------------------------------------------------------------
    // 2. Retail Connect SDK invocation (server-side intent generation)
    // ---------------------------------------------------------------------
    console.info("[BEGIN: retail-intent.generate] Generating retail checkout session intent.");

    /* -----------------------------------------------------------------
     * TODO: Invoke the Retail Connect SDK server-side to generate a
     *       signed checkout intent bound to (amount, currency=USDC,
     *       locationId). Replace the mock below with the real network
     *       call once the SDK key is wired through edge secrets.
     *
     *   const intent = await retailConnect.intents.create({
     *     amount, currency: "USDC", locationId,
     *   });
     *   const sessionId = intent.id;
     * ----------------------------------------------------------------- */

    const sessionId = crypto.randomUUID();
    console.info(`[PROCESS: retail-intent.generate] Mock session minted. sessionId=${sessionId}`);
    console.info("[END: retail-intent.generate] Intent ready for terminal handshake.");

    // ---------------------------------------------------------------------
    // 3. Response
    // ---------------------------------------------------------------------
    console.info("[BEGIN: retail-intent.respond] Serializing 200 response.");
    const responseBody = { sessionId, status: "awaiting_signature" as const };
    console.info(
      `[END: retail-intent.respond] SUCCESS. sessionId=${sessionId} status=awaiting_signature`,
    );

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(
      "[END: retail-intent] CRITICAL FAILURE. Offset: UnhandledException | Reason:",
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
