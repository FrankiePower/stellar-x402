/**
 * Official x402 Protocol Type Definitions for Stellar
 * Based on: https://github.com/coinbase/x402
 */

/**
 * Payment Required Response (402 response body)
 *
 * This is what the server returns when it requires payment.
 * It tells the client HOW to pay.
 */
export interface PaymentRequiredResponse {
  /** Version of the x402 payment protocol */
  x402Version: number;

  /** List of payment requirements that the resource server accepts */
  accepts: PaymentRequirements[];

  /** Error message (optional) */
  error?: string;
}

/**
 * Payment Requirements
 *
 * Specifies the payment details:
 * - What blockchain network
 * - How much to pay
 * - Who to pay
 * - What you're buying
 */
export interface PaymentRequirements {
  /** Scheme of the payment protocol to use (e.g., "stellar-transfer") */
  scheme: string;

  /** Network of the blockchain to send payment on (e.g., "stellar-testnet", "stellar-mainnet") */
  network: string;

  /** Maximum amount required to pay for the resource in stroops (1 XLM = 10^7 stroops) */
  maxAmountRequired: string;

  /** URL of resource to pay for */
  resource: string;

  /** Description of the resource */
  description: string;

  /** MIME type of the resource response */
  mimeType: string;

  /** Output schema of the resource response (optional) */
  outputSchema?: object | null;

  /** Stellar address to pay value to (G... format) */
  payTo: string;

  /** Maximum time in seconds for the resource server to respond */
  maxTimeoutSeconds: number;

  /** Extra information about the payment details specific to the scheme */
  extra?: object | null;
}

/**
 * Payment Payload (X-PAYMENT header content, base64 encoded JSON)
 *
 * This is what the CLIENT sends in the X-PAYMENT header.
 *
 * - Stellar: Transaction envelope (XDR) already contains signatures
 */
export interface PaymentPayload {
  /** Version of the x402 payment protocol */
  x402Version: number;

  /** Scheme value of the accepted paymentRequirements */
  scheme: string;

  /** Network id of the accepted paymentRequirements */
  network: string;

  /**
   * Scheme-dependent payload for Stellar:
   * - transaction: XDR-encoded transaction envelope (contains signatures)
   * OR
   * - transaction: XDR-encoded transaction
   * - signatures: Array of XDR-encoded signatures (if separate)
   */
  payload: {
    /** XDR-encoded transaction envelope (includes signatures) */
    transaction: string;
    /** Optional: Array of XDR-encoded signatures if not in envelope */
    signatures?: string[];
  };
}

/**
 * Facilitator /verify endpoint request
 *
 * The API server sends this to verify a payment WITHOUT submitting to blockchain.
 */
export interface VerifyRequest {
  /** Version of the x402 payment protocol */
  x402Version: number;

  /** The X-PAYMENT header value (base64 encoded PaymentPayload) */
  paymentHeader: string;

  /** The payment requirements being verified against */
  paymentRequirements: PaymentRequirements;
}

/**
 * Facilitator /verify endpoint response
 *
 * Tells if the payment is valid (correct amount, recipient, signature).
 */
export interface VerifyResponse {
  /** Whether the payment is valid */
  isValid: boolean;

  /** Reason for invalidity (if isValid is false) */
  invalidReason: string | null;
}

/**
 * Facilitator /settle endpoint request
 *
 * After verification, the API server sends this to SUBMIT the transaction
 * to the Stellar blockchain.
 */
export interface SettleRequest {
  /** Version of the x402 payment protocol */
  x402Version: number;

  /** The X-PAYMENT header value (base64 encoded PaymentPayload) */
  paymentHeader: string;

  /** The payment requirements being settled */
  paymentRequirements: PaymentRequirements;
}

/**
 * Facilitator /settle endpoint response
 *
 * Result of submitting the transaction to Stellar.
 */
export interface SettleResponse {
  /** Whether the payment was successful */
  success: boolean;

  /** Error message from the facilitator server (if success is false) */
  error: string | null;

  /** Transaction hash of the settled payment */
  txHash: string | null;

  /** Network id of the blockchain the payment was settled on */
  networkId: string | null;
}

/**
 * X-PAYMENT-RESPONSE header content (base64 encoded JSON)
 *
 * The server includes this in the response after successful payment.
 * It contains the settlement details (transaction hash, etc.)
 */
export interface PaymentResponseHeader {
  /** Settlement response from facilitator */
  settlement: SettleResponse;
}

// Constants
export const X402_VERSION = 1;

/**
 * Stellar payment scheme
 * Uses "stellar-payment" to indicate a standard Stellar payment operation
 */
export const STELLAR_SCHEME = "stellar-payment";

// Stellar-specific network identifiers
// These match the official Stellar network passphrases
export const STELLAR_MAINNET = "stellar-mainnet";
export const STELLAR_TESTNET = "stellar-testnet";
export const STELLAR_FUTURENET = "stellar-futurenet";

/**
 * Helper: Map network name to Stellar network passphrase
 */
export const NETWORK_PASSPHRASES: Record<string, string> = {
  [STELLAR_MAINNET]: "Public Global Stellar Network ; September 2015",
  [STELLAR_TESTNET]: "Test SDF Network ; September 2015",
  [STELLAR_FUTURENET]: "Test SDF Future Network ; October 2022",
};
