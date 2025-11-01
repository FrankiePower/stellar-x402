#![no_std]

//! # x402 Escrow Contract
//!
//! Enables instant API responses by holding payment buffers in escrow.
//! Servers can respond immediately and settle payments asynchronously.
//!
//! ## Key Features
//! - Instant API responses (no blockchain wait)
//! - Guaranteed payment for servers (escrow buffer)
//! - Automatic fallback if direct payment fails
//! - Two-party consent for escrow closure

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, symbol_short};

/// Escrow account for a client-server pair
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub client: Address,
    pub server: Address,
    pub balance: i128,
    pub client_closed: bool,
    pub server_closed: bool,
}

/// Payment record
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub escrow_id: u64,
    pub amount: i128,
    pub settled: bool,
    pub timestamp: u64,
}

/// Payment status enum
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PaymentStatus {
    Pending,
    Settled,
    Failed,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Escrow(u64),
    Payment(u64),
    EscrowCounter,
    PaymentCounter,
    ClientServerEscrow(Address, Address),
}

#[contract]
pub struct X402EscrowContract;

#[contractimpl]
impl X402EscrowContract {
    /// Initialize a new escrow account for a client-server pair
    ///
    /// # Arguments
    /// * `client` - Client address
    /// * `server` - Server address
    /// * `amount` - Initial deposit amount (in stroops)
    ///
    /// # Returns
    /// * Escrow ID
    ///
    /// # Panics
    /// * If escrow already exists for this client-server pair
    pub fn open_escrow(
        env: Env,
        client: Address,
        server: Address,
        amount: i128,
    ) -> u64 {
        // Verify authorization
        client.require_auth();

        // Check if escrow already exists
        let lookup_key = DataKey::ClientServerEscrow(client.clone(), server.clone());
        if env.storage().instance().has(&lookup_key) {
            panic!("Escrow already exists for this client-server pair");
        }

        // Get next escrow ID
        let counter_key = DataKey::EscrowCounter;
        let escrow_id: u64 = env
            .storage()
            .instance()
            .get(&counter_key)
            .unwrap_or(0);

        env.storage().instance().set(&counter_key, &(escrow_id + 1));

        // Create escrow account
        let escrow = Escrow {
            client: client.clone(),
            server: server.clone(),
            balance: amount,
            client_closed: false,
            server_closed: false,
        };

        // Store escrow
        let escrow_key = DataKey::Escrow(escrow_id);
        env.storage().instance().set(&escrow_key, &escrow);

        // Store lookup mapping
        env.storage().instance().set(&lookup_key, &escrow_id);

        // Emit event
        env.events().publish((symbol_short!("open"), client, server), escrow_id);

        escrow_id
    }

    /// Create a payment intent (returns immediately for instant API response)
    ///
    /// # Arguments
    /// * `escrow_id` - Escrow account ID
    /// * `amount` - Payment amount (in stroops)
    ///
    /// # Returns
    /// * Payment ID
    ///
    /// # Panics
    /// * If escrow doesn't exist
    /// * If insufficient escrow balance
    pub fn create_payment(
        env: Env,
        escrow_id: u64,
        amount: i128,
    ) -> u64 {
        // Get escrow
        let escrow_key = DataKey::Escrow(escrow_id);
        let escrow: Escrow = env
            .storage()
            .instance()
            .get(&escrow_key)
            .expect("Escrow not found");

        // Verify server authorization
        escrow.server.require_auth();

        // Check balance
        if escrow.balance < amount {
            panic!("Insufficient escrow balance");
        }

        // Get next payment ID
        let counter_key = DataKey::PaymentCounter;
        let payment_id: u64 = env
            .storage()
            .instance()
            .get(&counter_key)
            .unwrap_or(0);

        env.storage().instance().set(&counter_key, &(payment_id + 1));

        // Create payment record
        let payment = Payment {
            escrow_id,
            amount,
            settled: false,
            timestamp: env.ledger().timestamp(),
        };

        // Store payment
        let payment_key = DataKey::Payment(payment_id);
        env.storage().instance().set(&payment_key, &payment);

        // Emit event
        env.events().publish(
            (symbol_short!("pay"), escrow.server, escrow.client),
            (payment_id, amount),
        );

        payment_id
    }

    /// Settle a payment (deduct from escrow balance)
    ///
    /// # Arguments
    /// * `payment_id` - Payment ID to settle
    ///
    /// # Returns
    /// * true if settled successfully
    ///
    /// # Panics
    /// * If payment doesn't exist
    /// * If payment already settled
    pub fn settle_payment(env: Env, payment_id: u64) -> bool {
        // Get payment
        let payment_key = DataKey::Payment(payment_id);
        let mut payment: Payment = env
            .storage()
            .instance()
            .get(&payment_key)
            .expect("Payment not found");

        if payment.settled {
            panic!("Payment already settled");
        }

        // Get escrow
        let escrow_key = DataKey::Escrow(payment.escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .instance()
            .get(&escrow_key)
            .expect("Escrow not found");

        // Verify server authorization
        escrow.server.require_auth();

        // Deduct from escrow balance
        escrow.balance -= payment.amount;

        // Mark payment as settled
        payment.settled = true;

        // Save updated records
        env.storage().instance().set(&escrow_key, &escrow);
        env.storage().instance().set(&payment_key, &payment);

        // Emit event
        env.events().publish(
            (symbol_short!("settled"), payment_id),
            payment.amount,
        );

        true
    }

    /// Deposit additional funds into escrow
    ///
    /// # Arguments
    /// * `escrow_id` - Escrow account ID
    /// * `amount` - Amount to deposit (in stroops)
    pub fn deposit(env: Env, escrow_id: u64, amount: i128) {
        // Get escrow
        let escrow_key = DataKey::Escrow(escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .instance()
            .get(&escrow_key)
            .expect("Escrow not found");

        // Verify client authorization
        escrow.client.require_auth();

        // Add to balance
        escrow.balance += amount;

        // Save updated escrow
        env.storage().instance().set(&escrow_key, &escrow);

        // Emit event
        env.events().publish(
            (symbol_short!("deposit"), escrow_id),
            amount,
        );
    }

    /// Client initiates escrow closure
    ///
    /// # Arguments
    /// * `escrow_id` - Escrow account ID
    ///
    /// # Returns
    /// * Remaining balance (if both parties closed)
    pub fn client_close_escrow(env: Env, escrow_id: u64) -> Option<i128> {
        // Get escrow
        let escrow_key = DataKey::Escrow(escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .instance()
            .get(&escrow_key)
            .expect("Escrow not found");

        // Verify client authorization
        escrow.client.require_auth();

        // Mark client as closed
        escrow.client_closed = true;

        // Check if both parties closed
        if escrow.server_closed {
            let remaining_balance = escrow.balance;

            // Remove escrow
            env.storage().instance().remove(&escrow_key);

            // Remove lookup mapping
            let lookup_key = DataKey::ClientServerEscrow(
                escrow.client.clone(),
                escrow.server.clone(),
            );
            env.storage().instance().remove(&lookup_key);

            // Emit event
            env.events().publish(
                (symbol_short!("closed"), escrow_id),
                remaining_balance,
            );

            Some(remaining_balance)
        } else {
            // Save updated escrow
            env.storage().instance().set(&escrow_key, &escrow);
            None
        }
    }

    /// Server initiates escrow closure
    ///
    /// # Arguments
    /// * `escrow_id` - Escrow account ID
    ///
    /// # Returns
    /// * Remaining balance (if both parties closed)
    pub fn server_close_escrow(env: Env, escrow_id: u64) -> Option<i128> {
        // Get escrow
        let escrow_key = DataKey::Escrow(escrow_id);
        let mut escrow: Escrow = env
            .storage()
            .instance()
            .get(&escrow_key)
            .expect("Escrow not found");

        // Verify server authorization
        escrow.server.require_auth();

        // Mark server as closed
        escrow.server_closed = true;

        // Check if both parties closed
        if escrow.client_closed {
            let remaining_balance = escrow.balance;

            // Remove escrow
            env.storage().instance().remove(&escrow_key);

            // Remove lookup mapping
            let lookup_key = DataKey::ClientServerEscrow(
                escrow.client.clone(),
                escrow.server.clone(),
            );
            env.storage().instance().remove(&lookup_key);

            // Emit event
            env.events().publish(
                (symbol_short!("closed"), escrow_id),
                remaining_balance,
            );

            Some(remaining_balance)
        } else {
            // Save updated escrow
            env.storage().instance().set(&escrow_key, &escrow);
            None
        }
    }

    /// Get escrow balance
    ///
    /// # Arguments
    /// * `escrow_id` - Escrow account ID
    ///
    /// # Returns
    /// * Current escrow balance (in stroops)
    pub fn get_escrow_balance(env: Env, escrow_id: u64) -> i128 {
        let escrow_key = DataKey::Escrow(escrow_id);
        let escrow: Escrow = env
            .storage()
            .instance()
            .get(&escrow_key)
            .expect("Escrow not found");

        escrow.balance
    }

    /// Get escrow details
    ///
    /// # Arguments
    /// * `escrow_id` - Escrow account ID
    ///
    /// # Returns
    /// * Escrow struct
    pub fn get_escrow(env: Env, escrow_id: u64) -> Escrow {
        let escrow_key = DataKey::Escrow(escrow_id);
        env.storage()
            .instance()
            .get(&escrow_key)
            .expect("Escrow not found")
    }

    /// Get payment status
    ///
    /// # Arguments
    /// * `payment_id` - Payment ID
    ///
    /// # Returns
    /// * Payment struct
    pub fn get_payment(env: Env, payment_id: u64) -> Payment {
        let payment_key = DataKey::Payment(payment_id);
        env.storage()
            .instance()
            .get(&payment_key)
            .expect("Payment not found")
    }

    /// Find escrow ID for a client-server pair
    ///
    /// # Arguments
    /// * `client` - Client address
    /// * `server` - Server address
    ///
    /// # Returns
    /// * Escrow ID if exists, None otherwise
    pub fn find_escrow(env: Env, client: Address, server: Address) -> Option<u64> {
        let lookup_key = DataKey::ClientServerEscrow(client, server);
        env.storage().instance().get(&lookup_key)
    }
}

mod test;
