/**
 * Stellar Blockchain Utilities for x402
 *
 * It provides functions for:
 * - Initializing Stellar clients (Horizon & Soroban RPC)
 * - Creating keypairs from secret keys
 * - Building and signing transactions
 * - Submitting payments
 * - Checking balances
 */

import {
  Keypair,
  Networks,
  Operation,
  Asset,
  TransactionBuilder,
  Horizon,
  Transaction,
  BASE_FEE,
  Account as StellarAccount,
} from "@stellar/stellar-sdk";

/**
 * Payment request structure
 */
export interface X402PaymentRequest {
  amount: string;      // Amount in XLM (e.g., "0.1")
  recipient: string;   // Stellar address (G...)
  network: string;     // "stellar-testnet", "stellar-mainnet", etc.
  memo?: string;       // Optional memo
}

/**
 * Payment response structure
 */
export interface X402PaymentResponse {
  transactionHash: string;
  sender: string;
  amount: string;
  recipient: string;
  timestamp: number;
}

/**
 * Get Horizon server instance based on network
 *
 * Horizon is Stellar's REST API for accessing the network.
 *
 *
 * @param network - Network name (stellar-testnet, stellar-mainnet, testnet, mainnet, etc.)
 * @returns Horizon.Server instance
 */
export function getHorizonClient(network: string = "stellar-testnet"): Horizon.Server {
  // Map x402 network identifiers to Horizon URLs
  let horizonUrl: string;
  let allowHttp = false;

  // Handle different network name formats
  const normalizedNetwork = network.toLowerCase()
    .replace("stellar-", "")  // Remove "stellar-" prefix if present
    .replace("public", "mainnet");  // "public" is Stellar's name for mainnet

  switch (normalizedNetwork) {
    case "mainnet":
      horizonUrl = "https://horizon.stellar.org";
      break;
    case "testnet":
      horizonUrl = "https://horizon-testnet.stellar.org";
      break;
    case "futurenet":
      horizonUrl = "https://horizon-futurenet.stellar.org";
      break;
    case "local":
    case "standalone":
      horizonUrl = "http://localhost:8000";
      allowHttp = true;
      break;
    default:
      // Default to testnet if unknown
      console.warn(`Unknown network "${network}", defaulting to testnet`);
      horizonUrl = "https://horizon-testnet.stellar.org";
  }

  return new Horizon.Server(horizonUrl, { allowHttp });
}

/**
 * Get network passphrase for a given network
 *
 * Network passphrases are used when signing transactions.
 * They ensure transactions can't be replayed across networks.
 *
 * @param network - Network name
 * @returns Network passphrase string
 */
export function getNetworkPassphrase(network: string = "stellar-testnet"): string {
  const normalizedNetwork = network.toLowerCase()
    .replace("stellar-", "")
    .replace("public", "mainnet");

  switch (normalizedNetwork) {
    case "mainnet":
      return Networks.PUBLIC;  // "Public Global Stellar Network ; September 2015"
    case "testnet":
      return Networks.TESTNET;  // "Test SDF Network ; September 2015"
    case "futurenet":
      return Networks.FUTURENET;  // "Test SDF Future Network ; October 2022"
    case "local":
    case "standalone":
      return Networks.STANDALONE;  // "Standalone Network ; February 2017"
    default:
      console.warn(`Unknown network "${network}", defaulting to testnet`);
      return Networks.TESTNET;
  }
}

/**
 * Create a Keypair from a secret key
 *
 * Stellar secret keys start with 'S' (e.g., SBZVMB74P76QZ3222UZCUGDKDNDQZPDOPVCHFDQFMHZQ7EUYZ2BRQZ4Q)
 *
 * @param secretKey - Stellar secret key (S...)
 * @returns Keypair object
 */
export function getKeypairFromSecret(secretKey: string): Keypair {
  try {
    return Keypair.fromSecret(secretKey);
  } catch (error) {
    throw new Error(`Invalid Stellar secret key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build a payment transaction
 *
 * This creates a transaction but DOES NOT submit it.
 * The transaction needs to be signed before submission.
 *
 * @param sourceKeypair - Sender's keypair
 * @param destinationAddress - Recipient's address (G...)
 * @param amount - Amount in XLM (e.g., "0.1")
 * @param network - Network name
 * @param memo - Optional memo
 * @returns Built transaction (not yet signed)
 */
export async function buildPaymentTransaction(
  sourceKeypair: Keypair,
  destinationAddress: string,
  amount: string,
  network: string = "stellar-testnet",
  memo?: string
): Promise<Transaction> {
  const horizon = getHorizonClient(network);
  const networkPassphrase = getNetworkPassphrase(network);

  // Load the source account from the network
  // This gets the current sequence number needed for the transaction
  const sourceAccount = await horizon.loadAccount(sourceKeypair.publicKey());

  // Build the transaction
  const transactionBuilder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,  // 100 stroops (0.00001 XLM)
    networkPassphrase: networkPassphrase,
  });

  // Add payment operation
  transactionBuilder.addOperation(
    Operation.payment({
      destination: destinationAddress,
      asset: Asset.native(),  // XLM
      amount: amount,  // Amount in XLM (e.g., "0.1")
    })
  );

  // Add memo if provided
  if (memo) {
    transactionBuilder.addMemo(Horizon.Memo.text(memo));
  }

  // Set timeout (transaction expires after 3 minutes)
  transactionBuilder.setTimeout(180);

  // Build the transaction
  const transaction = transactionBuilder.build();

  return transaction;
}

/**
 * Sign and submit a payment transaction
 *
 * This is the COMPLETE flow: build → sign → submit
 *
 * @param sourceKeypair - Sender's keypair
 * @param destinationAddress - Recipient's address
 * @param amount - Amount in XLM
 * @param network - Network name
 * @param memo - Optional memo
 * @returns Transaction hash
 */
export async function signAndSubmitPayment(
  sourceKeypair: Keypair,
  destinationAddress: string,
  amount: string,
  network: string = "stellar-testnet",
  memo?: string
): Promise<string> {
  const horizon = getHorizonClient(network);

  // Build the transaction
  const transaction = await buildPaymentTransaction(
    sourceKeypair,
    destinationAddress,
    amount,
    network,
    memo
  );

  // Sign the transaction
  transaction.sign(sourceKeypair);

  // Submit to the network
  try {
    const result = await horizon.submitTransaction(transaction);
    return result.hash;
  } catch (error: any) {
    // Horizon errors are detailed
    if (error.response?.data) {
      console.error("Transaction submission failed:", error.response.data);
      throw new Error(`Transaction failed: ${JSON.stringify(error.response.data.extras?.result_codes)}`);
    }
    throw error;
  }
}

/**
 * Get account balance in stroops
 *
 * Returns native XLM balance in stroops (1 XLM = 10^7 stroops)
 *
 * @param accountAddress - Stellar address (G...)
 * @param network - Network name
 * @returns Balance in stroops as string
 */
export async function getAccountBalance(
  accountAddress: string,
  network: string = "stellar-testnet"
): Promise<string> {
  try {
    const horizon = getHorizonClient(network);
    const account = await horizon.loadAccount(accountAddress);

    // Find native (XLM) balance
    const nativeBalance = account.balances.find(
      (balance) => balance.asset_type === "native"
    );

    if (!nativeBalance) {
      return "0";
    }

    // Convert XLM to stroops (multiply by 10^7)
    const xlmAmount = parseFloat(nativeBalance.balance);
    const stroops = Math.floor(xlmAmount * 10_000_000);

    return stroops.toString();
  } catch (error) {
    console.error("Error getting account balance:", error);
    return "0";
  }
}

/**
 * Verify a transaction exists and matches expected parameters
 *
 * @param transactionHash - Transaction hash to verify
 * @param network - Network name
 * @param expectedSender - Expected source account (optional)
 * @param expectedRecipient - Expected destination (optional)
 * @param expectedAmount - Expected amount in XLM (optional)
 * @returns true if transaction is valid
 */
export async function verifyTransaction(
  transactionHash: string,
  network: string = "stellar-testnet",
  expectedSender?: string,
  expectedRecipient?: string,
  expectedAmount?: string
): Promise<boolean> {
  try {
    const horizon = getHorizonClient(network);
    const transaction = await horizon.transactions().transaction(transactionHash).call();

    // Check if transaction was successful
    if (!transaction.successful) {
      console.error("Transaction was not successful");
      return false;
    }

    // If no expected values provided, just check if transaction exists
    if (!expectedSender && !expectedRecipient && !expectedAmount) {
      return true;
    }

    // Check sender
    if (expectedSender && transaction.source_account !== expectedSender) {
      console.error("Sender mismatch");
      return false;
    }

    // For more detailed validation, we need to check operations
    const operations = await horizon
      .operations()
      .forTransaction(transactionHash)
      .call();

    // Look for payment operations
    const paymentOp = operations.records.find(
      (op: any) => op.type === "payment" && op.asset_type === "native"
    );

    if (!paymentOp) {
      console.error("No payment operation found");
      return false;
    }

    // Check recipient
    if (expectedRecipient && paymentOp.to !== expectedRecipient) {
      console.error("Recipient mismatch");
      return false;
    }

    // Check amount
    if (expectedAmount && paymentOp.amount !== expectedAmount) {
      console.error("Amount mismatch");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return false;
  }
}

/**
 * Wait for transaction to be confirmed
 *
 * Note: Stellar has ~5 second block time, so transactions are usually
 * confirmed very quickly. This function polls until the transaction appears.
 *
 * @param transactionHash - Transaction hash to wait for
 * @param network - Network name
 * @param timeoutSeconds - Maximum time to wait (default: 30s)
 * @returns true if transaction was found and successful
 */
export async function waitForTransaction(
  transactionHash: string,
  network: string = "stellar-testnet",
  timeoutSeconds: number = 30
): Promise<boolean> {
  const horizon = getHorizonClient(network);
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const transaction = await horizon
        .transactions()
        .transaction(transactionHash)
        .call();

      return transaction.successful;
    } catch (error: any) {
      // 404 means transaction not found yet - keep waiting
      if (error.response?.status === 404) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        continue;
      }
      // Other errors
      throw error;
    }
  }

  throw new Error(`Transaction not found after ${timeoutSeconds} seconds`);
}

/**
 * Convert XLM to stroops
 *
 * @param xlm - Amount in XLM (e.g., "0.1")
 * @returns Amount in stroops (e.g., "1000000")
 */
export function xlmToStroops(xlm: string): string {
  const xlmAmount = parseFloat(xlm);
  const stroops = Math.floor(xlmAmount * 10_000_000);
  return stroops.toString();
}

/**
 * Convert stroops to XLM
 *
 * @param stroops - Amount in stroops (e.g., "1000000")
 * @returns Amount in XLM (e.g., "0.1")
 */
export function stroopsToXlm(stroops: string): string {
  const stroopsAmount = parseInt(stroops);
  const xlm = stroopsAmount / 10_000_000;
  return xlm.toString();
}
