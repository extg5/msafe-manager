module from_msafe::drain {
    use std::signer;
    use std::hash;
    use std::bcs;

    use aptos_std::table::{Self, Table};
    use aptos_framework::chain_id;
    use aptos_framework::timestamp;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;

    use msafe::registry as ms_registry;

    // Constants.

    /// Seed to generate a module Resource Account.
    const SEED: vector<u8> = b"from_msafe_resource_signer_seed";
    /// Msafe status of normal multisig.
    const MSAFE_NORMAL: u8 = 0;
    /// Week in seconds.
    const WEEK_IN_SEC: u64 = 604800;

    // Errors.

    /// When function is called by not an owner.
    const ERR_SIGNER_NOT_OWNER: u64 = 100;
    /// When msafe wallet are not owned by provided address.
    const ERR_BAD_MSAFE: u64 = 101;
    /// When no drain wallet for Msafe address.
    const ERR_NO_DRAIN_WALLET: u64 = 102;
    /// When msafe wallet address are not allowed.
    const ERR_MSAFE_ADDR_NOT_ALLOWED: u64 = 103;
    /// When withdrawal is not allowed for Msafe wallet.
    const ERR_WITHRAWAL_NOT_ALLOWED: u64 = 104;
    /// When asset is not allowed to withdraw from Msafe wallet.
    const ERR_ASSET_NOT_ALLOWED: u64 = 105;
    /// When amount exceeds max allowed.
    const ERR_AMOUNT_EXCEES_ALLOWED: u64 = 106;
    /// When wallet for Msafe wallet not found.
    const ERR_WALLET_NOT_FOUND: u64 = 107;
    /// When bad request ID provided.
    const ERR_BAD_REQUEST_ID: u64 = 108;
    /// When request already executed.
    const ERR_REQUEST_EXECUTED: u64 = 109;
    /// When balance is incorrect after Msafe multisig withrawal.
    const ERR_INVALID_BALANCE: u64 = 110;

    // Resources.

    enum Status has store, copy, drop {
        Created,
        Executed,
    }

    struct WithdrawalRequest has store, copy {
        receiver: address,
        fa_metadata: Object<Metadata>,
        amount: u64,

        status: Status,
        payload: vector<u8>,
    }

    struct Wallet has store, copy {
        ms_address: address,
        request_count: u64,
        withdrawals: vector<WithdrawalRequest>,
    }

    struct FromMsafeState has key {
        signer_cap: SignerCapability,
        paused: bool,

        // List of allowed msigs.
        allowed_msigs: Table<address, bool>,
        // Mapping of multisig_addr to it drain wallet.
        wallets: Table<address, Wallet>,
        // Mapping: Msafe => Asset => Amount.
        allowed_assets: Table<address, Table<address, u64>>,
    }

    // Drain initialization.

    /// Module initialization. Called after deploy.
    public entry fun init(admin: &signer) {
        assert!(signer::address_of(admin) == @owner, ERR_SIGNER_NOT_OWNER);

        let (_, signer_cap) =
            account::create_resource_account(admin, SEED);

        move_to<FromMsafeState>(
            admin,
            FromMsafeState {
                signer_cap,
                paused: false,
                allowed_msigs: table::new(),
                wallets: table::new(),
                allowed_assets: table::new(),
            }
        );
    }

    // Msafe wallet whitelist.

    /// Allow msafe wallet to use drain module.
    public entry fun allow_msafe(admin: &signer, msafe_wallet_addr: address, owner: address) acquires FromMsafeState {
        assert!(signer::address_of(admin) == @owner, ERR_SIGNER_NOT_OWNER);

        let (_pendings, owned) =
            ms_registry::get_owned_msafes(owner);
        assert!(owned.contains_key(&msafe_wallet_addr), ERR_BAD_MSAFE);

        let state = borrow_global_mut<FromMsafeState>(@owner);
        state.allowed_msigs.add(msafe_wallet_addr, true);
    }

    /// Disallow msafe wallet to use drain module.
    public entry fun disallow_msafe(admin: &signer, msafe_wallet_addr: address) acquires FromMsafeState {
        assert!(signer::address_of(admin) == @owner, ERR_SIGNER_NOT_OWNER);

        let state = borrow_global_mut<FromMsafeState>(@owner);
        state.allowed_msigs.remove(msafe_wallet_addr);
    }

    // Msafe withdrawal whitelist.

    /// Allow withrawal of asset for specific Msafe wallet.
    public entry fun allow_withdrawal(
        admin: &signer,
        msafe_wallet_addr: address,
        fa_metadata: Object<Metadata>,
        amount: u64,
    ) acquires FromMsafeState {
        assert!(signer::address_of(admin) == @owner, ERR_SIGNER_NOT_OWNER);

        let state = borrow_global_mut<FromMsafeState>(@owner);
        assert!(state.allowed_msigs.contains(msafe_wallet_addr), ERR_MSAFE_ADDR_NOT_ALLOWED);

        if (!state.allowed_assets.contains(msafe_wallet_addr)) {
            state.allowed_assets.add(msafe_wallet_addr, table::new());
        };

        let asset_permits = state.allowed_assets.borrow_mut(msafe_wallet_addr);
        let metadata = object::object_address(&fa_metadata);

        if (!asset_permits.contains(metadata)) {
            asset_permits.add(metadata, 0);
        };

        let permit = asset_permits.borrow_mut(metadata);
        *permit = *permit + amount;
    }

    /// Creates withdrawal request for drain wallet from Msafe wallet.
    public entry fun create_withdrawal_request(
        msafe_owner: &signer,
        msafe_wallet_addr: address,
        sequence_number: u64,
        receiver: address,
        metadata_addr: address,
        amount: u64
    ) acquires FromMsafeState {
        let state = borrow_global_mut<FromMsafeState>(@owner);
        assert!(state.allowed_msigs.contains(msafe_wallet_addr), ERR_MSAFE_ADDR_NOT_ALLOWED);

        // Check owner.
        let (_pendings, owned) =
            ms_registry::get_owned_msafes(signer::address_of(msafe_owner));
        assert!(owned.contains_key(&msafe_wallet_addr), ERR_BAD_MSAFE);

        // Check asset and amount permissions.
        assert!(state.allowed_assets.contains(msafe_wallet_addr), ERR_WITHRAWAL_NOT_ALLOWED);

        let asset_permits = state.allowed_assets.borrow_mut(msafe_wallet_addr);
        assert!(asset_permits.contains(metadata_addr), ERR_ASSET_NOT_ALLOWED);

        let permit = asset_permits.borrow_mut(metadata_addr);
        assert!(*permit >= amount, ERR_AMOUNT_EXCEES_ALLOWED);

        // Create wallet if not exists.
        if (!state.wallets.contains(msafe_wallet_addr)) {
            state.wallets.add(msafe_wallet_addr, Wallet {
                ms_address: msafe_wallet_addr,
                request_count: 0,
                withdrawals: vector[],
            })
        };
        let wallet = state.wallets.borrow_mut(msafe_wallet_addr);

        // Create withdrawal request.
        let fa_metadata = object::address_to_object<Metadata>(metadata_addr);
        let request_id = wallet.request_count;
        let request = WithdrawalRequest {
            receiver,
            fa_metadata,
            amount,
            status: Status::Created,
            payload: get_payload(msafe_wallet_addr, sequence_number, request_id),
        };
        wallet.withdrawals.push_back(request);

        wallet.request_count = request_id + 1;

        *permit = *permit - amount;
    }

    /// Withdraw func to be called by multisig.
    public entry fun withdraw(msafe_wallet_acc: &signer, request_id: u64) acquires FromMsafeState {
        // Check wallet exists and permitted to withdraw.
        let state = borrow_global_mut<FromMsafeState>(@owner);
        let msafe_wallet_addr = signer::address_of(msafe_wallet_acc);
        assert!(state.allowed_msigs.contains(msafe_wallet_addr), ERR_MSAFE_ADDR_NOT_ALLOWED);
        assert!(state.wallets.contains(msafe_wallet_addr), ERR_WALLET_NOT_FOUND);

        // Check withdrawal request.
        let wallet = state.wallets.borrow_mut(msafe_wallet_addr);
        assert!(wallet.request_count > 0 && request_id < wallet.withdrawals.length(), ERR_BAD_REQUEST_ID);
        let request = wallet.withdrawals.borrow_mut(request_id);
        assert!(request.status == Status::Created, ERR_REQUEST_EXECUTED);

        // Get withrawal params.
        let receiver = request.receiver;
        let metadata = request.fa_metadata;
        let amount = request.amount;

        // Check receiver balance before tx.
        let balance_before = primary_fungible_store::balance(receiver, metadata);

        // Withdraw from Msafe multisig wallet.
        let assets = primary_fungible_store::withdraw(msafe_wallet_acc, metadata, amount);

        // Deposit to receiver.
        primary_fungible_store::deposit(receiver, assets);

        // Revert TX if balance is wrong after withdrawal.
        let balance_after = primary_fungible_store::balance(receiver, metadata);
        assert!(balance_after == balance_before + amount, ERR_INVALID_BALANCE);

        // Mark request as finished.
        request.status = Status::Executed;
    }

    #[view]
    public fun get_payload(
        msafe_wallet_addr: address,
        sequence_number: u64,
        request_id: u64,
    ): vector<u8> {
        // 1) Domain separator = sha3_256("APTOS::RawTransaction")
        let total: vector<u8> = hash::sha3_256(b"APTOS::RawTransaction");

        // 2) Sender = NEW MSafe address
        let sender = bcs::to_bytes(&msafe_wallet_addr);
        total.append(sender);

        // 3) sequence_number
        total.append(bcs::to_bytes(&sequence_number));

        // 4) payload type (0 = Script, 1 = ModuleBundle, 2 = EntryFunction)
        let payload_type: u8 = 2;
        total.append(bcs::to_bytes(&payload_type));

        // 5–7) EntryFunction = ModuleId{ addr, module }, function name, both as BCS strings
        let deployer = @from_msafe;
        let module_name: vector<u8> = b"drain"; // BCS(string) == 0x0d + bytes
        let function_name: vector<u8> = b"withdraw";    // BCS(string) == 0x08 + bytes
        total.append(bcs::to_bytes(&deployer));
        total.append(bcs::to_bytes(&module_name));
        total.append(bcs::to_bytes(&function_name));

        // 8) ty_args: empty vec<TypeTag>. For an empty vec, BCS is just a single 0x00.
        let empty_ty_args: vector<u8> = bcs::to_bytes(&vector<u8>[]); // this is just 0x00
        total.append(empty_ty_args);

        // 9) args: vec<vector<u8>>, where each inner vector is BCS(value)
        // Request ID.
        total.append(bcs::to_bytes(&request_id));

        // This encodes as:
        //   0x01                           (args length)
        //   0x0e                           (inner vec length = 14)
        //     0x0d "Momentum Safe"         (BCS string bytes)

        // 10–13) Gas / expiration / chain id
        let max_gas: u64 = 12000;
        let gas_price: u64 = 120;
        let exp_timestamp: u64 = timestamp::now_seconds() + WEEK_IN_SEC;    // <-- timestamp of exparation (now + one week)
        let chain_id: u8 = chain_id::get();

        total.append(bcs::to_bytes(&max_gas));
        total.append(bcs::to_bytes(&gas_price));
        total.append(bcs::to_bytes(&exp_timestamp));
        total.append(bcs::to_bytes(&chain_id));

        // Msafe withdraw tx payload
        total
    }

    // View functions

    #[view]
    /// Check is drain module initialized.
    public fun is_initialized(): bool { exists<FromMsafeState>(@owner) }

    #[view]
    /// Check is darin module paused.
    public fun is_paused(): bool acquires FromMsafeState { borrow_global<FromMsafeState>(@owner).paused }

    #[view]
    /// Get drain state (FromMsafeState) fields.
    public fun get_drain_state_fields(): (address, bool) acquires FromMsafeState  {
        let state = borrow_global<FromMsafeState>(@owner);
        (account::get_signer_capability_address(&state.signer_cap), state.paused)
    }

    #[view]
    /// Is Msafe wallet allowed in drain module.
    public fun is_wallet_allowed(msafe_wallet_addr: address): bool acquires FromMsafeState {
        let state = borrow_global<FromMsafeState>(@owner);
        *state.allowed_msigs.borrow(msafe_wallet_addr)
    }

    #[view]
    /// Get drain wallet.
    public fun get_drain_wallet(msafe_wallet_addr: address): Wallet acquires FromMsafeState {
        let state = borrow_global<FromMsafeState>(@owner);
        *state.wallets.borrow(msafe_wallet_addr)
    }

    #[view]
    /// Get wallet asset permission amount.
    public fun get_asset_permission(msafe_wallet_addr: address, fa_metadata: Object<Metadata>): u64 acquires FromMsafeState {
        let state = borrow_global_mut<FromMsafeState>(@owner);
        assert!(state.allowed_msigs.contains(msafe_wallet_addr), ERR_MSAFE_ADDR_NOT_ALLOWED);

        if (!state.allowed_assets.contains(msafe_wallet_addr)) return 0;

        let asset_permits = state.allowed_assets.borrow(msafe_wallet_addr);
        let metadata = object::object_address(&fa_metadata);

        if (!asset_permits.contains(metadata)) return 0;

        *asset_permits.borrow(metadata)
    }

    #[view]
    /// Get drain wallet withdrawal requests.
    public fun get_withdrawal_requests(msafe_wallet_addr: address): vector<WithdrawalRequest> acquires FromMsafeState {
        let state = borrow_global<FromMsafeState>(@owner);
        if (!state.wallets.contains(msafe_wallet_addr)) return vector[];

        state.wallets.borrow(msafe_wallet_addr).withdrawals
    }

    #[view]
    /// Check is msafe wallet address is allowed to use drain module.
    public fun is_msafe_allowed(msafe_wallet_addr: address): bool acquires FromMsafeState {
        let state = borrow_global<FromMsafeState>(@owner);
        state.allowed_msigs.contains(msafe_wallet_addr)
    }
}
