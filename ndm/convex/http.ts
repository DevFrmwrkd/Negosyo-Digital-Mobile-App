import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * Airtable Webhook Endpoint
 *
 * Called by Airtable automation when AI image generation is complete.
 * Downloads the enhanced image and stores it in Convex/R2 storage.
 *
 * URL: https://diligent-ibex-454.convex.site/airtable-webhook
 *
 * Airtable Automation Setup:
 * 1. Trigger: "When record matches conditions" → ai_output is not empty
 * 2. Action: "Run a script" with the code below
 *
 * Airtable Script:
 * ```javascript
 * let config = input.config();
 * let table = base.getTable('Table 1');
 * let record = await table.selectRecordAsync(config.recordId);
 *
 * if (record) {
 *   let aiOutput = record.getCellValue('ai_output');
 *   let imageUrl = aiOutput && aiOutput[0] ? aiOutput[0].url : '';
 *
 *   await fetch('https://diligent-ibex-454.convex.site/airtable-webhook', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       convexRecordId: record.getCellValue('convex_record_id'),
 *       enhancedImageUrl: imageUrl,
 *       status: 'done'
 *     })
 *   });
 * }
 * ```
 */
http.route({
  path: "/airtable-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      console.log("[Airtable Webhook] Received:", JSON.stringify(body));

      // Validate required fields
      if (!body.convexRecordId) {
        console.error("[Airtable Webhook] Missing convexRecordId");
        return new Response(
          JSON.stringify({ error: "Missing convexRecordId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const convexRecordId = body.convexRecordId;
      const status = body.status || "done";

      // Handle enhancedImageUrl - can be string or Airtable attachment array
      let enhancedImageUrl = "";
      if (body.enhancedImageUrl) {
        if (typeof body.enhancedImageUrl === "string") {
          enhancedImageUrl = body.enhancedImageUrl;
        } else if (Array.isArray(body.enhancedImageUrl) && body.enhancedImageUrl[0]?.url) {
          // Airtable attachment format: [{url: "...", filename: "..."}]
          enhancedImageUrl = body.enhancedImageUrl[0].url;
        }
      }

      console.log(`[Airtable Webhook] Processing: convexId=${convexRecordId}, imageUrl=${enhancedImageUrl?.substring(0, 50)}...`);

      // Only process if we have an enhanced image URL
      if (enhancedImageUrl && (status === "done" || status === "complete")) {
        // Schedule the image download and storage
        await ctx.runAction(internal.airtable.downloadAndStoreEnhancedImage, {
          submissionId: convexRecordId,
          sourceImageUrl: enhancedImageUrl,
        });

        console.log(`[Airtable Webhook] Scheduled image download for ${convexRecordId}`);
      } else {
        console.log(`[Airtable Webhook] No image URL or status not done: status=${status}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Webhook received" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[Airtable Webhook] Error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Health check endpoint
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ status: "ok", timestamp: Date.now() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

/**
 * Wise Webhook Endpoint
 *
 * Receives transfer state change events from Wise and updates
 * the corresponding withdrawal record in the database.
 *
 * URL: https://diligent-ibex-454.convex.site/wise-webhook
 *
 * Wise State → Withdrawal Status mapping:
 *   outgoing_payment_sent → completed
 *   cancelled             → failed
 *   funds_refunded        → failed
 *   bounced_back          → failed
 *   processing            → processing
 */
http.route({
  path: "/wise-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      console.log("[Wise Webhook] Received:", JSON.stringify(body));

      const eventType = body.event_type;

      // Only handle transfer state changes
      if (eventType !== "transfers#state-change") {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const transferId = String(body.data?.resource?.id);
      const currentState: string = body.data?.current_state;

      if (!transferId || !currentState) {
        console.error("[Wise Webhook] Missing transferId or currentState");
        return new Response(JSON.stringify({ error: "Invalid payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Map Wise transfer states to withdrawal statuses
      const stateMap: Record<string, "processing" | "completed" | "failed"> = {
        processing: "processing",
        outgoing_payment_sent: "completed",
        cancelled: "failed",
        funds_refunded: "failed",
        bounced_back: "failed",
        charged_back: "failed",
      };

      const withdrawalStatus = stateMap[currentState];

      if (!withdrawalStatus) {
        // Unrecognised state — acknowledge and ignore
        console.log(`[Wise Webhook] Unhandled state: ${currentState}`);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(internal.withdrawals.updateByTransactionRef, {
        transactionRef: transferId,
        status: withdrawalStatus,
      });

      console.log(`[Wise Webhook] Updated transfer ${transferId} → ${withdrawalStatus}`);

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[Wise Webhook] Error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
