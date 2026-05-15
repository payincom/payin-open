# Deployment Guide - PayIn Wallet Tools

## 📋 Prerequisites

Before deploying to Cloudflare Pages, ensure you have:

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install globally
   ```bash
   npm install -g wrangler
   ```
3. **Cloudflare Login**: Authenticate wrangler
   ```bash
   wrangler login
   ```

## 🚀 Quick Deploy

Deploy with a single command:

```bash
npm run deploy
```

This will:
1. Build the production bundle (`npm run build`)
2. Deploy to Cloudflare Pages (`wrangler pages deploy dist`)

## 📦 Manual Deployment Steps

### 1. Build Production Bundle

```bash
npm run build
```

Output will be in the `dist/` directory:
- `dist/index.html` - Main HTML file
- `dist/assets/` - CSS and JavaScript bundles

### 2. Deploy to Cloudflare Pages

```bash
cd dist
wrangler pages deploy . --project-name=payin-wallet-tools
```

Or from the project root:
```bash
wrangler pages deploy dist --project-name=payin-wallet-tools
```

### 3. Access Your Deployment

After successful deployment, you'll receive a URL:
```
✨ Deployment complete! Take a peek over at https://payin-wallet-tools.pages.dev
```

## 🌍 Production URL

Your application will be available at:
- **Production**: `https://payin-wallet-tools.pages.dev`
- **Custom Domain**: Can be configured in Cloudflare Dashboard

## 🔧 Configuration

### Project Settings

The `wrangler.toml` file contains deployment configuration:

```toml
name = "payin-wallet-tools"
compatibility_date = "2025-01-01"
pages_build_output_dir = "dist"
```

### Build Settings

Vite configuration in `vite.config.ts`:
- Build output: `dist/`
- Asset inlining: Disabled for CSS/images
- Code splitting: Automatic
- Minification: Enabled in production

## 🔄 Update Deployment

To update the live application:

```bash
# Make your changes
# Then rebuild and redeploy
npm run deploy
```

Cloudflare Pages will:
- Create a new deployment
- Test the deployment
- Switch traffic to the new version
- Keep previous versions for rollback

## 📊 Monitoring

### View Deployments

```bash
wrangler pages deployments list --project-name=payin-wallet-tools
```

### View Logs

Access logs through Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select `payin-wallet-tools`
3. Click on "Logs" tab

## 🌐 Custom Domain Setup

To use a custom domain:

1. Go to Cloudflare Dashboard
2. Navigate to Pages → payin-wallet-tools
3. Go to "Custom domains"
4. Click "Set up a custom domain"
5. Enter your domain (e.g., `wallet.payin.com`)
6. Follow DNS configuration instructions

## 🔒 Environment Variables

If you need environment variables:

1. Go to Cloudflare Dashboard
2. Navigate to Pages → payin-wallet-tools → Settings
3. Go to "Environment variables"
4. Add variables for Production/Preview

Example variables:
```
# Not needed for this app as it's fully client-side
# But here for reference
VITE_API_URL=https://api.example.com
```

## 🚨 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules/.vite dist
npm run build
```

### Deployment Fails

```bash
# Check wrangler authentication
wrangler whoami

# Re-login if needed
wrangler login
```

### Large Bundle Warning

The build may show a warning about large chunks:
```
⚠ Some chunks are larger than 500 kB after minification
```

This is expected due to blockchain libraries (ethers.js, etc.). The app will still work fine.

## 📝 Best Practices

1. **Test Locally First**: Always run `npm run build && npm run preview` before deploying
2. **Check Build Output**: Verify the `dist/` folder contains all necessary files
3. **Monitor Deployments**: Check Cloudflare Dashboard after deployment
4. **Version Control**: Tag releases in git for easier rollback

## 🎯 Next Steps

After deployment:

1. Test the live URL in different browsers
2. Test in private/incognito mode
3. Verify privacy detection works correctly
4. Test wallet generation and CSV export
5. Check responsive design on mobile devices

## 📚 Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Vite Production Build](https://vitejs.dev/guide/build.html)
