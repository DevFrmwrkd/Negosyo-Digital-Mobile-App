import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  createRecipient,
  createQuote,
  createTransfer,
  fundTransfer,
  WiseConfig,
  WiseError,
} from "../services/wise";

// ---------------------------------------------------------------------------
// Config helper
// ---------------------------------------------------------------------------

function getWiseConfig(): WiseConfig {
  const isSandbox = process.env.WISE_SANDBOX !== "false";
  const token = isSandbox
    ? process.env.WISE_SANDBOX_TOKEN
    : process.env.WISE_API_TOKEN;
  const profileIdRaw = isSandbox
    ? process.env.WISE_SANDBOX_PROFILE_ID
    : process.env.WISE_PROFILE_ID;

  if (!token) throw new Error(`[Wise] Missing ${isSandbox ? "WISE_SANDBOX_TOKEN" : "WISE_API_TOKEN"}`);
  if (!profileIdRaw) throw new Error(`[Wise] Missing ${isSandbox ? "WISE_SANDBOX_PROFILE_ID" : "WISE_PROFILE_ID"}`);

  const profileId = parseInt(profileIdRaw, 10);
  if (isNaN(profileId)) throw new Error(`[Wise] Invalid profile ID: "${profileIdRaw}" — must be a number`);

  return {
    token,
    profileId,
    sandbox: isSandbox,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full Wise transfer flow for a bank_transfer withdrawal.
 *
 * Steps:
 *  1. Create Wise recipient (bank account)
 *  2. Create quote (PHP → PHP local transfer)
 *  3. Create transfer
 *  4. Fund & execute transfer from Wise balance
 *  5. Store Wise IDs on the withdrawal record → status: processing
 *
 * On any failure the withdrawal is marked failed and the creator's balance
 * is restored.
 */
export const initiateTransfer = internalAction({
  args: {
    withdrawalId: v.id("withdrawals"),
    accountHolderName: v.string(),
    accountNumber: v.string(),
    bankCode: v.string(),
    city: v.string(),
    amountPHP: v.number(),
  },
  handler: async (ctx, args) => {
    const config = getWiseConfig();

    console.log(`[Wise] Config: profileId=${config.profileId}, sandbox=${config.sandbox}`);
    console.log(`[Wise] Initiating transfer for withdrawal ${args.withdrawalId}, amount ₱${args.amountPHP}`);

    try {
      // 1. Create recipient
      const recipient = await createRecipient(config, {
        accountHolderName: args.accountHolderName,
        accountNumber: args.accountNumber,
        bankCode: args.bankCode,
        city: args.city,
      });
      console.log(`[Wise] Recipient created: ${recipient.id}`);

      // 2. Create quote
      const quote = await createQuote(config, args.amountPHP);
      console.log(`[Wise] Quote created: ${quote.id}`);

      // 3. Create transfer
      const transfer = await createTransfer(
        config,
        recipient.id,
        quote.id,
        args.withdrawalId
      );
      console.log(`[Wise] Transfer created: ${transfer.id}`);

      // 4. Fund & execute
      await fundTransfer(config, transfer.id);
      console.log(`[Wise] Transfer funded: ${transfer.id}`);

      // 5. Store Wise IDs on the withdrawal record → processing
      await ctx.runMutation(internal.withdrawals.setWiseTransferIds, {
        withdrawalId: args.withdrawalId,
        wiseTransferId: String(transfer.id),
        wiseRecipientId: String(recipient.id),
      });

      console.log(`[Wise] Transfer ${transfer.id} is now processing`);
    } catch (err) {
      const message =
        err instanceof WiseError
          ? `Wise ${err.statusCode}: ${JSON.stringify(err.body)}`
          : String(err);

      console.error(`[Wise] initiateTransfer failed for ${args.withdrawalId}: ${message}`);

      await ctx.runMutation(internal.withdrawals.markFailed, {
        withdrawalId: args.withdrawalId,
        reason: message,
      });
    }
  },
});
