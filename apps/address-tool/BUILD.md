# Address Tool Build Guide

This document explains how to build standalone binaries for the PayIn Address Tool.

## Build Method: Bun Compiler

We use **Bun** instead of pkg/nexe because:

✅ **Native ESM Support**: Handles modern JavaScript modules
✅ **TypeScript Native**: No need for pre-compilation
✅ **Faster Builds**: ~100ms vs several seconds
✅ **Smaller Binaries**: 61-102 MB vs 101+ MB
✅ **Better Compatibility**: No CommonJS/ESM conflicts

## Prerequisites

### Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

## Building

### Build All Platforms

```bash
npm run bun:build
```

This creates:
- `build/payin-tool-macos-arm64` (61 MB)
- `build/payin-tool-macos-x64` (67 MB)
- `build/payin-tool-linux-x64` (102 MB)

### Build Single Platform

```bash
# macOS Apple Silicon
npm run bun:macos-arm64

# macOS Intel
npm run bun:macos-x64

# Linux x64
npm run bun:linux-x64
```

## Build Scripts

Defined in `package.json`:

```json
{
  "scripts": {
    "bun:build": "Build all platforms",
    "bun:macos-arm64": "Build macOS arm64 only",
    "bun:macos-x64": "Build macOS x64 only",
    "bun:linux-x64": "Build Linux x64 only"
  }
}
```

## Manual Build

```bash
# Example: macOS arm64
bun build src/index.ts \
  --compile \
  --outfile build/payin-tool-macos-arm64 \
  --target=bun-darwin-arm64
```

### Available Targets

- `bun-darwin-arm64` - macOS Apple Silicon
- `bun-darwin-x64` - macOS Intel
- `bun-linux-x64` - Linux x86_64
- `bun-linux-arm64` - Linux ARM64
- `bun-windows-x64` - Windows (experimental)

## Testing Binaries

```bash
# Test macOS arm64 (current platform)
./build/payin-tool-macos-arm64

# Test other platforms (requires target system)
# Transfer binary and run on target machine
```

### Quick Test Script

```bash
# Test that it launches and exits cleanly
echo "5" | ./build/payin-tool-macos-arm64 | grep "Thank you"
```

## Binary Details

### File Format

```bash
$ file build/payin-tool-*

payin-tool-linux-x64:   ELF 64-bit LSB executable, x86-64
payin-tool-macos-arm64: Mach-O 64-bit executable arm64
payin-tool-macos-x64:   Mach-O 64-bit executable x86_64
```

### Dependencies

**Zero runtime dependencies**. All dependencies are bundled:
- @solana/web3.js
- ethers
- tronweb
- inquirer
- chalk
- ora
- etc.

## Distribution

### GitHub Release

1. Build all platforms:
   ```bash
   npm run bun:build
   ```

2. Create release:
   ```bash
   gh release create v1.1.0 \
     build/payin-tool-macos-arm64 \
     build/payin-tool-macos-x64 \
     build/payin-tool-linux-x64 \
     build/README.md
   ```

### Direct Download

Users can download with:

```bash
# macOS arm64
curl -L https://github.com/payin/releases/download/v1.1.0/payin-tool-macos-arm64 -o payin-tool
chmod +x payin-tool
```

## Troubleshooting

### "Bun not found"

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

Add to PATH (add to ~/.zshrc or ~/.bashrc):
```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### Build Fails

```bash
# Clean and rebuild
rm -rf build node_modules
npm install
npm run bun:build
```

### Binary Won't Run on macOS

```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine build/payin-tool-macos-arm64
```

### Linux Binary Won't Run

Check glibc version:
```bash
ldd --version
# Requires glibc 2.17 or later
```

## Comparison: Bun vs pkg

| Feature | Bun | pkg |
|---------|-----|-----|
| ESM Support | ✅ Native | ❌ Poor |
| TypeScript | ✅ Native | ⚠️ Requires pre-compile |
| Build Speed | ✅ ~100ms | ⚠️ ~10s |
| Binary Size | ✅ 61-102 MB | ⚠️ 101+ MB |
| Compatibility | ✅ Excellent | ❌ ESM conflicts |
| Maturity | ⚠️ Newer | ✅ Mature |

## Advanced: Cross-Compilation

Bun supports cross-compilation from any platform:

```bash
# Build Linux binary from macOS
bun build src/index.ts --compile --target=bun-linux-x64 --outfile build/payin-tool-linux-x64

# Build macOS binary from Linux (downloads runtime automatically)
bun build src/index.ts --compile --target=bun-darwin-arm64 --outfile build/payin-tool-macos-arm64
```

First time building for a new target, Bun will download the required runtime (~24-38 MB).

## CI/CD Integration

### GitHub Actions

```yaml
name: Build Binaries

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - run: cd apps/address-tool && bun install

      - run: npm run bun:build

      - uses: softprops/action-gh-release@v1
        with:
          files: |
            apps/address-tool/build/payin-tool-*
            apps/address-tool/build/README.md
```

## Version Management

Update version in:
1. `package.json`: `"version": "1.1.0"`
2. `src/index.ts`: `const APP_VERSION = '1.1.0'`
3. Git tag: `git tag v1.1.0`

## Security Considerations

### Code Signing (Optional)

For production releases, consider code signing:

**macOS:**
```bash
codesign --sign "Developer ID" build/payin-tool-macos-arm64
```

**Windows:**
```bash
signtool sign /f certificate.pfx build/payin-tool-win-x64.exe
```

### Binary Verification

Users can verify binary integrity:

```bash
# Generate SHA256 checksums
sha256sum build/payin-tool-* > build/SHA256SUMS

# Users verify:
sha256sum -c SHA256SUMS
```

## Next Steps

- [ ] Add Windows support (when Bun stabilizes Windows builds)
- [ ] Set up automated builds with GitHub Actions
- [ ] Add code signing for macOS/Windows
- [ ] Create installation script (curl | sh)

---

**Last Updated**: 2025-10-16
**Bun Version**: 1.2.18
**Build Method**: Verified and tested
