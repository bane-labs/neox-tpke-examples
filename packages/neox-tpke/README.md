# NeoX TPKE

[![npm version](https://img.shields.io/npm/v/neox-tpke.svg)](https://www.npmjs.com/package/neox-tpke)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A TypeScript library for Threshold Public Key Encryption (TPKE) utilities in the NeoX ecosystem.

## Overview

NeoX TPKE provides cryptographic utilities for threshold encryption, allowing messages to be encrypted with a public key that can only be decrypted when a threshold number of private key holders collaborate. This is particularly useful for secure consensus mechanisms and distributed systems.

## Installation

```bash
npm install neox-tpke
# or
yarn add neox-tpke
# or
pnpm add neox-tpke
```

## Features

- BLS-based threshold encryption
- Public key generation from aggregated commitments
- AES encryption for message content
- Utilities for consensus threshold calculation
- Serialization and deserialization of cryptographic objects

## Usage

### Creating a Public Key

```typescript
import { PublicKey } from 'neox-tpke';
import { toBytes } from 'viem';

// From raw bytes
const publicKey = PublicKey.fromBytes(
  toBytes('0xa5aa188d1c60a7173e59fe49b68b969999e70aa4c1acb76c5a3dd2ad0d19a859b1a2759e3995ce1ceccdea5a57fbf637')
);

// From aggregated commitment
import { getConsensusThreshold, getScaler } from 'neox-tpke';

const consensusSize = 7n;
const threshold = getConsensusThreshold(consensusSize);
const scaler = getScaler(consensusSize, threshold);

const publicKey = PublicKey.fromAggregatedCommitment(
  aggregatedCommitmentBytes,
  scaler
);
```

### Encrypting Messages

```typescript
import { PublicKey } from 'neox-tpke';
import { toBytes, concat, pad } from 'viem';

// Create a public key
const publicKey = PublicKey.fromBytes(publicKeyBytes);

// Encrypt a message (e.g., a transaction)
const { encryptedKey, encryptedMsg } = publicKey.encrypt(messageBytes);

// Format as envelope data (example)
const roundNumber = 1;
const envelopeData = concat([
  new Uint8Array([0xff, 0xff, 0xff, 0xff]),
  pad(toBytes(roundNumber), { size: 4 }).reverse(),
  encryptedKey,
  encryptedMsg,
]);
```

### Consensus Utilities

```typescript
import { getConsensusThreshold, getScaler } from 'neox-tpke';

// Calculate consensus threshold for a given size
const consensusSize = 7n;
const threshold = getConsensusThreshold(consensusSize);

// Calculate scaler for a given size and threshold
const scaler = getScaler(consensusSize, threshold);
```

## API Reference

### PublicKey

- `PublicKey.fromBytes(bytes: ByteArray): PublicKey` - Create a public key from raw bytes
- `PublicKey.fromAggregatedCommitment(aggregatedCommitment: ByteArray, scaler: bigint): PublicKey` - Create a public key from an aggregated commitment
- `publicKey.toBytes(): ByteArray` - Convert public key to raw bytes
- `publicKey.encrypt(msg: ByteArray): { encryptedKey: ByteArray; encryptedMsg: ByteArray }` - Encrypt a message using the public key

### Utilities

- `getConsensusThreshold(consensusSize: bigint): bigint` - Calculate the consensus threshold for a given size
- `getScaler(size: bigint, threshold: bigint): bigint` - Calculate the scaler for a given size and threshold

## Dependencies

- [@noble/curves](https://github.com/paulmillr/noble-curves) - For elliptic curve operations
- [aes-js](https://github.com/ricmoo/aes-js) - Advanced Encryption Standard (AES) implementation
- [bigint-crypto-utils](https://github.com/juanelas/bigint-crypto-utils) - For bigint cryptographic utilities
- [hash.js](https://github.com/indutny/hash.js) - Hash functions implemented in JavaScript
- [viem](https://github.com/wagmi-dev/viem) - For Ethereum-related utilities

## License

MIT
