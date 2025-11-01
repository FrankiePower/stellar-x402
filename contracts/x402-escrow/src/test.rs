#![cfg(test)]

use crate::{X402EscrowContract, X402EscrowContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_open_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let amount: i128 = 1_000_000; // 0.1 XLM in stroops

    // Open escrow
    let escrow_id = client.open_escrow(&client_addr, &server_addr, &amount);
    assert_eq!(escrow_id, 0);

    // Verify escrow was created
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.client, client_addr);
    assert_eq!(escrow.server, server_addr);
    assert_eq!(escrow.balance, amount);
    assert_eq!(escrow.client_closed, false);
    assert_eq!(escrow.server_closed, false);

    // Verify balance
    let balance = client.get_escrow_balance(&escrow_id);
    assert_eq!(balance, amount);
}

#[test]
fn test_find_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let amount: i128 = 1_000_000;

    // Open escrow
    let escrow_id = client.open_escrow(&client_addr, &server_addr, &amount);

    // Find escrow
    let found_id = client.find_escrow(&client_addr, &server_addr);
    assert_eq!(found_id, Some(escrow_id));

    // Non-existent escrow
    let other_addr = Address::generate(&env);
    let not_found = client.find_escrow(&client_addr, &other_addr);
    assert_eq!(not_found, None);
}

#[test]
fn test_create_and_settle_payment() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let escrow_amount: i128 = 10_000_000; // 1 XLM
    let payment_amount: i128 = 1_000_000; // 0.1 XLM

    // Open escrow
    let escrow_id = client.open_escrow(&client_addr, &server_addr, &escrow_amount);

    // Create payment
    let payment_id = client.create_payment(&escrow_id, &payment_amount);
    assert_eq!(payment_id, 0);

    // Verify payment was created but not settled
    let payment = client.get_payment(&payment_id);
    assert_eq!(payment.escrow_id, escrow_id);
    assert_eq!(payment.amount, payment_amount);
    assert_eq!(payment.settled, false);

    // Balance should still be the same (payment not settled yet)
    let balance_before = client.get_escrow_balance(&escrow_id);
    assert_eq!(balance_before, escrow_amount);

    // Settle payment
    let settled = client.settle_payment(&payment_id);
    assert_eq!(settled, true);

    // Verify payment is now settled
    let payment_after = client.get_payment(&payment_id);
    assert_eq!(payment_after.settled, true);

    // Balance should be reduced
    let balance_after = client.get_escrow_balance(&escrow_id);
    assert_eq!(balance_after, escrow_amount - payment_amount);
}

#[test]
fn test_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let initial_amount: i128 = 5_000_000; // 0.5 XLM
    let deposit_amount: i128 = 2_000_000; // 0.2 XLM

    // Open escrow
    let escrow_id = client.open_escrow(&client_addr, &server_addr, &initial_amount);

    // Deposit additional funds
    client.deposit(&escrow_id, &deposit_amount);

    // Verify balance increased
    let balance = client.get_escrow_balance(&escrow_id);
    assert_eq!(balance, initial_amount + deposit_amount);
}

#[test]
fn test_escrow_closure() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let amount: i128 = 3_000_000;

    // Open escrow
    let escrow_id = client.open_escrow(&client_addr, &server_addr, &amount);

    // Client closes first - should return None
    let result1 = client.client_close_escrow(&escrow_id);
    assert_eq!(result1, None);

    // Escrow should still exist
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.client_closed, true);
    assert_eq!(escrow.server_closed, false);

    // Server closes - should return remaining balance
    let result2 = client.server_close_escrow(&escrow_id);
    assert_eq!(result2, Some(amount));

    // Find escrow should return None after closure
    let found = client.find_escrow(&client_addr, &server_addr);
    assert_eq!(found, None);
}

#[test]
#[should_panic(expected = "Insufficient escrow balance")]
fn test_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let escrow_amount: i128 = 1_000_000; // 0.1 XLM
    let payment_amount: i128 = 2_000_000; // 0.2 XLM (more than escrow)

    // Open escrow
    let escrow_id = client.open_escrow(&client_addr, &server_addr, &escrow_amount);

    // Try to create payment exceeding escrow balance - should panic
    client.create_payment(&escrow_id, &payment_amount);
}

#[test]
#[should_panic(expected = "Escrow already exists for this client-server pair")]
fn test_duplicate_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let amount: i128 = 1_000_000;

    // Open escrow
    client.open_escrow(&client_addr, &server_addr, &amount);

    // Try to open same escrow again - should panic
    client.open_escrow(&client_addr, &server_addr, &amount);
}

#[test]
#[should_panic(expected = "Payment already settled")]
fn test_double_settlement() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(X402EscrowContract, ());
    let client = X402EscrowContractClient::new(&env, &contract_id);

    let client_addr = Address::generate(&env);
    let server_addr = Address::generate(&env);
    let escrow_amount: i128 = 10_000_000;
    let payment_amount: i128 = 1_000_000;

    // Open escrow and create payment
    let escrow_id = client.open_escrow(&client_addr, &server_addr, &escrow_amount);
    let payment_id = client.create_payment(&escrow_id, &payment_amount);

    // Settle payment
    client.settle_payment(&payment_id);

    // Try to settle again - should panic
    client.settle_payment(&payment_id);
}
