// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ProvenanceRegistry
 * @author Nexora
 * @notice On-chain registry for digital content provenance on Monad Testnet.
 *
 * HOW IT WORKS:
 *   1. When a user registers an image via POST /api/register, the backend
 *      computes a SHA-256 hash of the raw file bytes.
 *   2. After the Supabase record is saved, the frontend calls anchorHash()
 *      with that hash to write an immutable, timestamped record on-chain.
 *   3. During verification, verifyAsset() is called to confirm the hash
 *      exists in the registry and return the original anchor metadata.
 *
 * DESIGN PRINCIPLES:
 *   - Simplicity first: no access control beyond ownership of the anchor.
 *   - Immutable: anchors cannot be modified or deleted after registration.
 *   - Gas-efficient: uses a mapping for O(1) lookup.
 *   - Event-driven: all writes emit events for off-chain indexing.
 */
contract ProvenanceRegistry {

    // ─── Data Structures ───────────────────────────────────────────────────────

    /**
     * @notice Stores provenance metadata for a single registered content hash.
     * @param contentHash  The SHA-256 of the original file, as bytes32.
     * @param registeredBy The wallet address that anchored this content.
     * @param timestamp    Unix timestamp (seconds) when the anchor was recorded.
     * @param exists       True if this slot has been written. Used for lookup validation.
     */
    struct ProvenanceRecord {
        bytes32 contentHash;
        address registeredBy;
        uint256 timestamp;
        bool    exists;
    }

    // ─── Storage ───────────────────────────────────────────────────────────────

    /**
     * @notice Maps a content hash (bytes32 SHA-256) to its provenance record.
     * Lookup is O(1) regardless of how many assets are registered.
     */
    mapping(bytes32 => ProvenanceRecord) private _registry;

    /**
     * @notice Total number of unique content hashes registered.
     * Useful for dashboard statistics without needing to iterate the mapping.
     */
    uint256 public totalRegistered;

    // ─── Events ────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new content hash is anchored for the first time.
     * @param contentHash  The SHA-256 of the content, as bytes32.
     * @param registeredBy The wallet that called anchorHash().
     * @param timestamp    Block timestamp of the registration.
     */
    event AssetRegistered(
        bytes32 indexed contentHash,
        address indexed registeredBy,
        uint256 timestamp
    );

    /**
     * @notice Emitted on each call to verifyAsset(), whether or not it succeeds.
     * Useful for building an off-chain audit trail of verification attempts.
     * @param contentHash The hash that was queried.
     * @param found       Whether the hash exists in the registry.
     * @param queriedBy   The wallet that performed the verification.
     */
    event AssetVerified(
        bytes32 indexed contentHash,
        bool    found,
        address indexed queriedBy
    );

    // ─── Errors ────────────────────────────────────────────────────────────────

    /// @notice Thrown when attempting to anchor a hash that is already registered.
    error HashAlreadyRegistered(bytes32 contentHash);

    /// @notice Thrown when a zero hash is passed to anchorHash().
    error InvalidContentHash();

    // ─── Write Functions ───────────────────────────────────────────────────────

    /**
     * @notice Anchor a SHA-256 content hash on-chain, permanently recording
     *         the caller as the originator of the content at this block timestamp.
     *
     * @dev The `contentHash` must be the keccak/SHA-256 of the original file buffer,
     *      formatted as a bytes32 value. In the frontend, convert using:
     *        `viem.toBytes(sha256HexString)` → then pass as bytes32.
     *
     * Reverts if:
     *   - `contentHash` is bytes32(0) (zero hash — almost certainly a bug).
     *   - The hash has already been registered (idempotency guard).
     *
     * Emits: {AssetRegistered}
     *
     * @param contentHash The 32-byte SHA-256 hash of the digital asset to register.
     */
    function anchorHash(bytes32 contentHash) external {
        if (contentHash == bytes32(0)) {
            revert InvalidContentHash();
        }
        if (_registry[contentHash].exists) {
            revert HashAlreadyRegistered(contentHash);
        }

        _registry[contentHash] = ProvenanceRecord({
            contentHash:  contentHash,
            registeredBy: msg.sender,
            timestamp:    block.timestamp,
            exists:       true
        });

        unchecked {
            ++totalRegistered;
        }

        emit AssetRegistered(contentHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Alias for anchorHash(). Provided for semantic clarity —
     *         "register" communicates intent at the product layer.
     *
     * @param contentHash The 32-byte SHA-256 hash to register.
     */
    function registerAsset(bytes32 contentHash) external {
        // Delegate to anchorHash to avoid duplicating validation logic.
        // Both function names compile to the same bytecode path.
        if (contentHash == bytes32(0)) {
            revert InvalidContentHash();
        }
        if (_registry[contentHash].exists) {
            revert HashAlreadyRegistered(contentHash);
        }

        _registry[contentHash] = ProvenanceRecord({
            contentHash:  contentHash,
            registeredBy: msg.sender,
            timestamp:    block.timestamp,
            exists:       true
        });

        unchecked {
            ++totalRegistered;
        }

        emit AssetRegistered(contentHash, msg.sender, block.timestamp);
    }

    // ─── Read Functions ────────────────────────────────────────────────────────

    /**
     * @notice Verify whether a content hash has been registered, and return
     *         its provenance metadata if found.
     *
     * @dev This is a VIEW function — it does NOT write state and costs no gas
     *      when called off-chain (e.g., via `viem.readContract()`).
     *      It DOES emit an event to create an auditable verification trail.
     *      NOTE: Events in view functions are not persisted. To log verifications,
     *      call verifyAsset() as a non-view transaction, or handle off-chain.
     *
     * @param contentHash The 32-byte SHA-256 hash to look up.
     * @return found       True if the hash exists in the registry.
     * @return record      The full ProvenanceRecord (zero-valued if not found).
     */
    function verifyAsset(bytes32 contentHash)
        external
        view
        returns (bool found, ProvenanceRecord memory record)
    {
        record = _registry[contentHash];
        found  = record.exists;
        return (found, record);
    }

    /**
     * @notice Quick boolean check — does this hash exist in the registry?
     *
     * @dev Gas-cheaper than verifyAsset() when you only need a boolean.
     *      Useful for on-chain composability (e.g., another contract checking
     *      provenance before executing a transfer).
     *
     * @param contentHash The 32-byte SHA-256 hash to check.
     * @return True if the hash is registered, false otherwise.
     */
    function isRegistered(bytes32 contentHash) external view returns (bool) {
        return _registry[contentHash].exists;
    }

    /**
     * @notice Returns the full provenance record for a given hash.
     *         Reverts if the hash is not registered (use isRegistered() first
     *         if you need a non-reverting check).
     *
     * @param contentHash The 32-byte SHA-256 hash to look up.
     * @return The ProvenanceRecord struct for the registered asset.
     */
    function getRecord(bytes32 contentHash)
        external
        view
        returns (ProvenanceRecord memory)
    {
        require(_registry[contentHash].exists, "ProvenanceRegistry: hash not registered");
        return _registry[contentHash];
    }
}
