// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

contract CircuitBreakerV2 is Initializable, OwnableUpgradeable {
    using ECDSAUpgradeable for bytes32;

    bool public circuitOpen;
    mapping(bytes32 => bytes32) public latestProof;

    address[] public signerList;
    mapping(address => bool) public isSigner;
    uint256 public threshold;

    event CircuitTripped(string reason);
    event CircuitReset();
    event ProofUpdated(bytes32 indexed assetId, bytes32 deedHash);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdUpdated(uint256 newThreshold);

    modifier whenOpen() {
        require(circuitOpen, "CircuitBreaker: circuit tripped");
        _;
    }

    function initialize(address[] memory _signers, uint256 _threshold) public initializer {
        __Ownable_init(msg.sender);
        require(_signers.length >= _threshold, "Not enough signers");
        require(_threshold > 0, "Threshold must be > 0");
        for (uint256 i = 0; i < _signers.length; i++) {
            require(_signers[i] != address(0), "Invalid signer");
            require(!isSigner[_signers[i]], "Duplicate signer");
            signerList.push(_signers[i]);
            isSigner[_signers[i]] = true;
            emit SignerAdded(_signers[i]);
        }
        threshold = _threshold;
        circuitOpen = true;
    }

    function verifyThresholdSignature(
        bytes32 digest,
        bytes calldata sigs
    ) public view returns (bool) {
        uint256 numSigs = sigs.length / 65;
        require(numSigs >= threshold, "Not enough signatures provided");
        uint256 validCount;
        address lastSigner;

        for (uint256 i = 0; i < numSigs; i++) {
            bytes memory sig = sigs[i * 65:(i + 1) * 65];
            address recovered = digest.recover(sig);
            require(recovered > lastSigner, "Signers must be in ascending order");
            lastSigner = recovered;
            if (isSigner[recovered]) validCount++;
        }
        return validCount >= threshold;
    }

    function actionDigest(bytes32 assetId, bytes32 deedHash) public view returns (bytes32) {
        return keccak256(abi.encodePacked(assetId, deedHash, block.chainid, address(this)));
    }

    function updateProof(bytes32 assetId, bytes32 deedHash, bytes calldata thresholdSigs) external {
        bytes32 digest = actionDigest(assetId, deedHash);
        require(verifyThresholdSignature(digest, thresholdSigs), "Invalid threshold signature");
        latestProof[assetId] = deedHash;
        emit ProofUpdated(assetId, deedHash);
    }

    function tripCircuit(string calldata reason, bytes calldata thresholdSigs) external {
        bytes32 digest = keccak256(abi.encodePacked(reason, block.chainid, address(this)));
        require(verifyThresholdSignature(digest, thresholdSigs), "Invalid threshold signature");
        circuitOpen = false;
        emit CircuitTripped(reason);
    }

    function validate(bytes32 assetId, bytes32 expectedHash) external view whenOpen returns (bool) {
        return latestProof[assetId] == expectedHash;
    }

    function reset() external onlyOwner {
        circuitOpen = true;
        emit CircuitReset();
    }

    function addSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        require(!isSigner[_signer], "Already a signer");
        signerList.push(_signer);
        isSigner[_signer] = true;
        emit SignerAdded(_signer);
    }

    function removeSigner(address _signer) external onlyOwner {
        require(isSigner[_signer], "Not a signer");
        require(signerList.length - 1 >= threshold, "Would fall below threshold");
        isSigner[_signer] = false;
        emit SignerRemoved(_signer);
    }

    function updateThreshold(uint256 _newThreshold) external onlyOwner {
        require(_newThreshold > 0, "Threshold must be > 0");
        require(_newThreshold <= signerList.length, "Threshold too high");
        threshold = _newThreshold;
        emit ThresholdUpdated(_newThreshold);
    }
}