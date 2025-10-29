/**
 * Facilitator Client for Stellar x402
 *
 * Wrapper functions for interacting with the x402 facilitator service.
 * This abstracts away the facilitator API calls from protected routes.
 *
 * The facilitator handles blockchain interactions:
 * - /verify: Checks if payment is valid (fast, no blockchain submission)
 * - /settle: Submits payment to blockchain (slower, actual settlement)
 */

import type {
  VerifyRequest,
  VerifyResponse,
  SettleRequest,
  SettleResponse,
} from "./x402-protocol-types";

/**
 * Legacy interface for backward compatibility
 * @deprecated Use VerifyRequest from x402-protocol-types
 */
export interface VerifyPaymentRequest {
  signedTransaction: string;  // XDR encoded signed transaction
  expectedRecipient: string;
  expectedAmount: string;
  expectedNetwork: string;
}

/**
 * Legacy interface for backward compatibility
 * @deprecated Use VerifyResponse from x402-protocol-types
 */
export interface VerifyPaymentResponse {
  valid: boolean;
  error?: string;
  message?: string;
}

/**
 * Legacy interface for backward compatibility
 * @deprecated Use SettleResponse from x402-protocol-types
 */
export interface SettlePaymentResponse {
  settled: boolean;
  transactionHash?: string;
  amount?: string;
  recipient?: string;
  network?: string;
  timestamp?: string;
  status?: string;
  error?: string;
  message?: string;
}

/**
 * Verify a payment through the facilitator (does NOT submit to blockchain)
 *
 * This is FAST (~50ms) because it only validates the transaction structure
 * and signature without actually submitting to the Stellar network.
 *
 * @param facilitatorUrl - URL of the facilitator verify endpoint
 * @param signedTransaction - XDR encoded signed transaction
 * @param expectedRecipient - Expected payment recipient address (G...)
 * @param expectedAmount - Expected payment amount in stroops
 * @param expectedNetwork - Expected network (stellar-testnet/stellar-mainnet)
 * @returns Verification result (valid/invalid)
 */
export async function verifyPayment(
  facilitatorUrl: string,
  signedTransaction: string,
  expectedRecipient: string,
  expectedAmount: string,
  expectedNetwork: string = "stellar-testnet"
): Promise<VerifyPaymentResponse> {
  try {
    const response = await fetch(facilitatorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signedTransaction,
        expectedRecipient,
        expectedAmount,
        expectedNetwork,
      }),
    });

    const data = (await response.json()) as VerifyPaymentResponse;

    if (!response.ok) {
      return {
        valid: false,
        error: data.error || "Verification failed",
        message: data.message || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    return {
      valid: false,
      error: "Network error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Settle a payment through the facilitator (submits to blockchain)
 *
 * This is SLOW (~5-7 seconds) because it actually submits the transaction
 * to the Stellar network and waits for confirmation.
 *
 * @param facilitatorUrl - URL of the facilitator settle endpoint
 * @param signedTransaction - XDR encoded signed transaction
 * @param expectedNetwork - Expected network (stellar-testnet/stellar-mainnet)
 * @returns Settlement result with transaction hash
 */
export async function settlePayment(
  facilitatorUrl: string,
  signedTransaction: string,
  expectedNetwork: string = "stellar-testnet"
): Promise<SettlePaymentResponse> {
  try {
    const response = await fetch(facilitatorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signedTransaction,
        expectedNetwork,
      }),
    });

    const data = (await response.json()) as SettlePaymentResponse;

    if (!response.ok) {
      return {
        settled: false,
        error: data.error || "Settlement failed",
        message: data.message || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    return {
      settled: false,
      error: "Network error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create an x402 payment response object for successful payments
 *
 * This is included in the X-Payment-Response header
 *
 * @param settlementResult - Result from the facilitator settlement
 * @returns Payment response object for X-Payment-Response header
 */
export function createPaymentResponse(settlementResult: SettlePaymentResponse) {
  return {
    transactionHash: settlementResult.transactionHash,
    amount: settlementResult.amount,
    currency: "XLM",  // Changed from APT to XLM
    recipient: settlementResult.recipient,
    network: settlementResult.network,
    timestamp: settlementResult.timestamp,
    status: settlementResult.status,
  };
}

/**
 * Verify payment with facilitator (convenience wrapper)
 *
 * Automatically appends /verify to the facilitator base URL
 *
 * @param facilitatorUrl - Facilitator base URL (e.g., "https://facilitator.com")
 * @param signedTransaction - XDR encoded signed transaction
 * @param expectedRecipient - Expected payment recipient
 * @param expectedAmount - Expected payment amount in stroops
 * @param expectedNetwork - Expected network
 * @returns Verification result
 */
export async function verifyPaymentSimple(
  facilitatorUrl: string,
  signedTransaction: string,
  expectedRecipient: string,
  expectedAmount: string,
  expectedNetwork: string = "stellar-testnet"
): Promise<VerifyPaymentResponse> {
  if (!facilitatorUrl) {
    throw new Error("Facilitator URL is required - no default available");
  }
  return verifyPayment(
    `${facilitatorUrl}/verify`,
    signedTransaction,
    expectedRecipient,
    expectedAmount,
    expectedNetwork
  );
}

/**
 * Settle payment with facilitator (convenience wrapper)
 *
 * Automatically appends /settle to the facilitator base URL
 *
 * @param facilitatorUrl - Facilitator base URL (e.g., "https://facilitator.com")
 * @param signedTransaction - XDR encoded signed transaction
 * @param expectedNetwork - Expected network
 * @returns Settlement result
 */
export async function settlePaymentSimple(
  facilitatorUrl: string,
  signedTransaction: string,
  expectedNetwork: string = "stellar-testnet"
): Promise<SettlePaymentResponse> {
  if (!facilitatorUrl) {
    throw new Error("Facilitator URL is required - no default available");
  }
  return settlePayment(
    `${facilitatorUrl}/settle`,
    signedTransaction,
    expectedNetwork
  );
}
