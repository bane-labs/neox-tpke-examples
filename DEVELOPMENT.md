# Development Guide

This guide covers local development workflows for the NeoX TPKE Examples project.

## 🔗 Working with Local `neox-tpke` Library

When developing features that require changes to the `neox-tpke` library, you can avoid publishing to npm on every change by using a local version.

**Step 1:** Clone or locate your local `neox-tpke-lib` repository
```bash
# Clone the neox-tpke repository (if not already local)
git clone https://github.com/your-org/neox-tpke-lib.git ../neox-tpke-lib

# Or ensure it's built and ready
cd ../neox-tpke-lib
pnpm install
pnpm build
```

**Step 2:** Update `package.json` to use local path
```json
{
  "dependencies": {
    "neox-tpke": "file:../neox-tpke-lib"
  }
}
```

**Step 3:** Install dependencies
```bash
pnpm install
```

## 🔄 Switching Between Local and Published Versions

### Switch to Local Version

```bash
# Using file protocol
pnpm add neox-tpke@file:../neox-tpke
```

### Switch Back to Published Version
```bash
# Remove local version and install from npm
pnpm remove neox-tpke
pnpm add neox-tpke@^1.0.4
```

## 🛠️ Development Workflow

### 1. Local Development Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Or start with Cloudflare Pages environment
pnpm start
```

### 2. Making Changes to neox-tpke

When using local `neox-tpke`:

**Step 1:** Make changes in `../neox-tpke`
```bash
cd ../neox-tpke
# Make your changes...
```

**Step 2:** Build the library
```bash
cd ../neox-tpke
pnpm build
```

**Step 3:** The changes are automatically available in your project
- If using `file:` protocol: Changes are immediately available
- If using `pnpm link`: You may need to restart your dev server

### 3. Testing Changes
```bash
# Run type checking
pnpm check-types

# Run linting
pnpm lint

# Run tests
pnpm test

# Format code
pnpm format
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Next.js development server |
| `pnpm start` | Cloudflare Pages development server |
| `pnpm build` | Build for Cloudflare Pages |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm check-types` | TypeScript type checking |
| `pnpm test` | Run Vitest tests |

## 🐛 Debugging

### Console Logging
The project includes comprehensive console logging for debugging transfers:

- 🔄 Chain switching process
- 💸 Transfer initiation
- 🛡️ AntiMEV flow steps
- ❌ Error analysis

Open browser DevTools → Console to view detailed logs.

## 💡 Tips

1. **Always build neox-tpke** after making changes when using local version
2. **Use TypeScript** to catch integration issues early
3. **Test both regular and AntiMEV flows** when making library changes
4. **Clear browser cache** when switching between versions
5. **Document breaking changes** in both repositories

---

Happy coding! 🎉 