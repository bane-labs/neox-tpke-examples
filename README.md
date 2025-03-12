# NeoX TPKE Monorepo

This monorepo contains the implementation of Threshold Public Key Encryption (TPKE) utilities for NeoX blockchain, along with example applications demonstrating its usage.

## Overview

NeoX TPKE provides cryptographic utilities for threshold encryption, allowing data to be encrypted in a way that requires a threshold number of participants to decrypt it. This is particularly useful for blockchain applications that require privacy and security features.

The repository is organized as a monorepo using pnpm workspaces and Turborepo for efficient management of multiple packages and applications.

## Repository Structure

- `packages/neox-tpke`: Core TPKE implementation library
- `apps/examples`: Example Next.js application demonstrating the usage of the TPKE library

## Key Features

- BLS-based threshold encryption
- Public key generation from aggregated commitments
- Secure message encryption with AES
- Anti-MEV transaction protection examples

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm >= 10.5.2

### Installation

```bash
# Clone the repository
git clone https://github.com/liuqiang1357/neox-tpke-monorepo.git
cd neox-tpke-monorepo

# Install dependencies
pnpm install
```

### Development

```bash
# Build all packages
pnpm build

# Run development servers
pnpm dev

# Run tests
pnpm test
```

## Packages

### neox-tpke

The core library implementing TPKE functionality. It provides:

- Cryptographic primitives for threshold encryption
- Public key management
- Message encryption and decryption

### examples

A Next.js application demonstrating the usage of the TPKE library, including:

- Token transfer with anti-MEV protection
- Integration with blockchain wallets
- UI components for encryption operations

## License

[MIT](LICENSE)
