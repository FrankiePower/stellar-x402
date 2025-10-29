# Stellar x402 - Build Roadmap

Building Stellar x402 by replicating Aptos x402 file-by-file.

---

## 📋 Aptos x402 - File-by-File Build Order

### 🎯 PHASE 1: Foundation (Types & Constants)
These files have NO blockchain code - just TypeScript types

#### ✅ File 1: `lib/x402-protocol-types.ts` ⭐ START HERE
- **What it does:** Defines the x402 protocol types (PaymentRequiredResponse, PaymentRequirements, etc.)
- **Blockchain-specific?** NO - This is protocol standard
- **Copy to Stellar?** YES - Almost identical, just change network names
- **Dependencies:** None
- **Time estimate:** 15 minutes

#### ⏳ File 2: `lib/x402-types.ts`
- **What it does:** Configuration types (RouteConfig, FacilitatorConfig)
- **Blockchain-specific?** NO
- **Copy to Stellar?** YES - Identical
- **Dependencies:** None
- **Time estimate:** 15 minutes

---

### 🎯 PHASE 2: Blockchain Utilities
This is where Aptos-specific code lives

#### ⏳ File 3: `lib/aptos-utils.ts` ⭐ CRITICAL - This becomes `stellar-utils.ts`
- **What it does:**
  - `getAptosClient()` - Initialize blockchain client
  - `getAccountFromPrivateKey()` - Create account from private key
  - `signAndSubmitPayment()` - Submit transaction
  - `getAccountBalance()` - Check balance
- **Blockchain-specific?** YES - 100% Aptos code
- **Copy to Stellar?** NO - Rewrite with Stellar SDK
- **Dependencies:** `@aptos-labs/ts-sdk` → `@stellar/stellar-sdk`
- **Time estimate:** 3-4 hours
- **This is the MAIN file you need to understand deeply!**

---

### 🎯 PHASE 3: Facilitator (Blockchain Interaction)

#### ⏳ File 4: `app/api/facilitator/verify/route.ts` ⭐ COMPLEX
- **What it does:**
  - Receives payment header (base64 JSON)
  - Decodes to get transaction + signature
  - Deserializes BCS bytes → Transaction object
  - Checks: Is amount correct? Is recipient correct?
  - Returns: `{isValid: true/false}`
- **Blockchain-specific?** YES - Uses Aptos BCS deserialization
- **Copy to Stellar?** Rewrite with XDR deserialization
- **Dependencies:** File 1, File 3
- **Time estimate:** 3-4 hours
- **Key Aptos concept:** BCS deserialization
- **Key Stellar concept:** XDR deserialization

#### ⏳ File 5: `app/api/facilitator/settle/route.ts` ⭐ COMPLEX
- **What it does:**
  - Receives payment header
  - Deserializes transaction + signature
  - Submits to Aptos blockchain
  - Waits for confirmation
  - Returns transaction hash
- **Blockchain-specific?** YES - Aptos transaction submission
- **Copy to Stellar?** Rewrite with Stellar submission
- **Dependencies:** File 1, File 3
- **Time estimate:** 2-3 hours

---

### 🎯 PHASE 4: Middleware (Seller Side)

#### ⏳ File 6: `lib/facilitator-client.ts`
- **What it does:** Helper functions to call verify/settle endpoints
- **Blockchain-specific?** NO - Just HTTP calls
- **Copy to Stellar?** YES - Identical
- **Dependencies:** File 1
- **Time estimate:** 30 minutes

#### ⏳ File 7: `lib/x402-middleware.ts` ⭐ IMPORTANT
- **What it does:**
  - Intercepts API requests
  - Checks for X-PAYMENT header
  - If no payment → Return 402
  - If payment → Verify → Settle → Return resource
- **Blockchain-specific?** NO - Uses facilitator
- **Copy to Stellar?** YES - Almost identical (just network names)
- **Dependencies:** File 1, File 2, File 6
- **Time estimate:** 1-2 hours

---

### 🎯 PHASE 5: Client Wrapper (Buyer Side)

#### ⏳ File 8: `lib/x402-axios.ts` ⭐ VERY IMPORTANT
- **What it does:**
  - Makes HTTP request
  - Receives 402
  - Builds Aptos transaction
  - Signs transaction
  - Encodes to BCS → base64
  - Retries with X-PAYMENT header
- **Blockchain-specific?** YES - Aptos transaction building
- **Copy to Stellar?** Rewrite with Stellar transaction building
- **Dependencies:** File 1, and Aptos SDK
- **Time estimate:** 3 hours
- **This is the CLIENT-SIDE magic!**

---

### 🎯 PHASE 6: Public API & Examples

#### ⏳ File 9: `lib/index.ts`
- **What it does:** Main exports (what users import)
- **Blockchain-specific?** NO
- **Copy to Stellar?** YES - Just change import names
- **Time estimate:** 15 minutes

#### ⏳ File 10: `middleware.ts` (Demo configuration)
- **What it does:** Example middleware setup
- **Blockchain-specific?** Partially (recipient address format)
- **Copy to Stellar?** YES - Change address format
- **Time estimate:** 15 minutes

#### ⏳ File 11: `app/api/protected/weather/route.ts`
- **What it does:** Example protected API route
- **Blockchain-specific?** NO
- **Copy to Stellar?** YES - Identical
- **Time estimate:** 15 minutes

#### ⏳ File 12: `scripts/test-x402-axios.ts`
- **What it does:** Interactive test script
- **Blockchain-specific?** YES - Uses Aptos functions
- **Copy to Stellar?** Rewrite with Stellar functions
- **Time estimate:** 1 hour

---

## 🔥 BUILD ORDER - Recommended Path

### Step 1-2: Copy Protocol Types (30 minutes)
✅ Copy File 1 & 2 → Change `aptos-testnet` to `stellar-testnet`

### Step 3: Build Stellar Utils (3-4 hours) ⭐ HARDEST PART
🔨 Study `lib/aptos-utils.ts` deeply
🔨 Rewrite as `stellar-utils.ts` using Stellar SDK
🔨 Focus on: Transaction building, signing, submission

### Step 4-5: Build Facilitator (4-5 hours) ⭐ SECOND HARDEST
🔨 Study `app/api/facilitator/verify/route.ts`
🔨 Learn XDR deserialization (Stellar's version of BCS)
🔨 Study `app/api/facilitator/settle/route.ts`
🔨 Learn Stellar transaction submission

### Step 6-7: Build Middleware (2 hours)
🔨 Copy `lib/facilitator-client.ts` (minimal changes)
🔨 Copy `lib/x402-middleware.ts` (minimal changes)

### Step 8: Build Client Wrapper (3 hours)
🔨 Study `lib/x402-axios.ts`
🔨 Rewrite as `stellar-x402-fetch.ts`

### Step 9-12: Examples & Testing (2 hours)
🔨 Copy remaining files with Stellar addresses

---

## 📊 Total Time Estimate: 16-20 hours

---

## 🔑 Key Differences: Aptos vs Stellar

| Aspect | **Aptos** | **Stellar** |
|--------|-----------|-------------|
| **Transaction Format** | BCS (Binary Canonical Serialization) | XDR (External Data Representation) |
| **Signing** | Ed25519 (same) | Ed25519 (same) |
| **Address Format** | `0x...` (hex) | `G...` (base32) |
| **Native Currency** | APT | XLM (Lumens) |
| **Amount Units** | Octas (10^-8 APT) | Stroops (10^-7 XLM) |
| **Finality** | ~1-3 seconds | ~5-7 seconds (5s ledger close) |
| **Gas/Fees** | Gas units | Fixed fees (100 stroops base) |
| **Transaction Submission** | Via Aptos SDK | Via Horizon or Soroban RPC |
| **Multi-sig** | Separate concept | Built into transaction envelope |

---

## 📝 Notes

### Transaction Building
**Aptos:**
```typescript
const transaction = await aptos.transaction.build.simple({
  sender: account.accountAddress,
  data: {
    function: "0x1::aptos_account::transfer",
    functionArguments: [recipient, amount]
  }
});
```

**Stellar:**
```typescript
const transaction = new TransactionBuilder(account, {
  fee: '1000',
  networkPassphrase: Networks.TESTNET
})
.addOperation(Operation.payment({
  destination: recipient,
  asset: Asset.native(),
  amount: '0.1'
}))
.setTimeout(180)
.build();
```

### Serialization
**Aptos:** `transaction.bcsToBytes()` → Binary
**Stellar:** `transaction.toXDR()` → Base64 string

### Signatures
**Aptos:** Separate from transaction, added during submission
**Stellar:** Part of transaction envelope, can have multiple signatures

---

## 🚀 Current Status

- [ ] Phase 1: Foundation (Types)
- [ ] Phase 2: Blockchain Utilities
- [ ] Phase 3: Facilitator
- [ ] Phase 4: Middleware
- [ ] Phase 5: Client Wrapper
- [ ] Phase 6: Examples & Testing
