/**
 * Type definitions for x402 payment middleware
 * These will be exported when published as npm package
 *
 * NOTE: These types are blockchain-agnostic
 */

/**
 * Route Configuration
 *
 * Defines payment requirements for a specific API route.
 *
 * Example usage:
 * ```typescript
 * const routes: Record<string, RouteConfig> = {
 *   '/api/premium/weather': {
 *     price: '1000000',  // 0.1 XLM (in stroops)
 *     network: 'testnet',
 *     config: {
 *       description: 'Premium weather data',
 *       mimeType: 'application/json'
 *     }
 *   }
 * };
 * ```
 */
export type RouteConfig = {
  /** Payment amount in stroops (1 XLM = 10^7 stroops) */
  price: string;

  /** Stellar network: 'testnet', 'mainnet', or 'futurenet' (defaults to 'testnet') */
  network?: string;

  /** Optional configuration */
  config?: {
    /** Human-readable description of the resource */
    description?: string;

    /** MIME type of the response (e.g., 'application/json') */
    mimeType?: string;

    /** JSON schema of the response (for documentation) */
    outputSchema?: Record<string, any>;

    /** Maximum timeout in seconds */
    maxTimeoutSeconds?: number;
  };
};

/**
 * Facilitator Configuration
 *
 * Specifies where the facilitator service is located.
 * The facilitator handles blockchain interactions (verify & settle).
 *
 * Example:
 * ```typescript
 * const facilitatorConfig: FacilitatorConfig = {
 *   url: 'https://facilitator.example.com/api'
 * };
 * ```
 */
export type FacilitatorConfig = {
  /** Base URL of the facilitator service (required) */
  url: string;
};
