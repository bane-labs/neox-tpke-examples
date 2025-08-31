# NeoX TPKE Examples

This repository contains examples for using the NeoX TPKE (Threshold Public Key Encryption) library.

## Features

- Transfer example demonstrating threshold public key encryption
- Modern React/Next.js application with TypeScript
- Integration with Rainbow Kit for wallet connections
- Cloudflare Pages deployment ready

## Getting Started

### Prerequisites

- Node.js 22.x
- pnpm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm run dev
```

### Building

```bash
pnpm run build
```

### Deployment

This project is configured for deployment on Cloudflare Pages. The deployment workflow is triggered via GitHub Actions.

## Dependencies

This project uses the `neox-tpke` NPM package for threshold public key encryption functionality.

## Project Structure

- `src/app/` - Next.js app router pages
- `src/lib/` - Utilities, hooks, and configurations
- `src/ui/` - React components
- `src/styles/` - CSS and styling

## Releases

Application releases are managed through:
- **Git tags** for version tracking (`git tag v1.0.0`)
- **GitHub Releases** for changelogs and release notes
- **Automated deployment** via GitHub Actions to Cloudflare Pages

## License

Licensed under the Apache License, Version 2.0. See the [LICENSE](./LICENSE) file for details.

Copyright (c) 2025 Bane Labs
