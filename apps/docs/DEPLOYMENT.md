# Deployment Guide

This guide explains how to deploy PayIn documentation to Cloudflare Pages.

## Prerequisites

- GitHub repository with PayIn code
- Cloudflare account
- Git installed locally

## Cloudflare Pages Deployment

### Option 1: Automatic GitHub Integration (Recommended)

1. **Login to Cloudflare Dashboard**
   - Go to [Cloudflare Pages](https://pages.cloudflare.com/)
   - Click "Create a project"

2. **Connect to GitHub**
   - Select "Connect to Git"
   - Authorize Cloudflare to access your GitHub repository
   - Select your PayIn repository

3. **Configure Build Settings**
   ```
   Project name: payin-docs
   Production branch: main
   Framework preset: VitePress
   Build command: npm run build
   Build output directory: .vitepress/dist
   Root directory: apps/docs
   ```

4. **Environment Variables** (if needed)
   - No environment variables required for basic setup

5. **Deploy**
   - Click "Save and Deploy"
   - Cloudflare will automatically build and deploy
   - You'll get a URL like: `https://payin-docs.pages.dev`

6. **Custom Domain** (Optional)
   - Go to "Custom domains" tab
   - Add your custom domain (e.g., `docs.payin.com`)
   - Follow DNS configuration instructions
   - Cloudflare will automatically provision SSL certificate

### Option 2: Wrangler CLI Deployment

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

3. **Build the Documentation**
   ```bash
   cd apps/docs
   npm install
   npm run build
   ```

4. **Deploy to Pages**
   ```bash
   wrangler pages deploy .vitepress/dist --project-name=payin-docs
   ```

5. **Access Your Site**
   - Wrangler will output the deployment URL
   - Example: `https://payin-docs.pages.dev`

## Automatic Deployment

Once connected to GitHub, Cloudflare Pages will automatically:
- Deploy on every push to `main` branch
- Create preview deployments for pull requests
- Invalidate cache and rebuild when needed

## Build Configuration

The build process:
1. Installs dependencies: `npm install`
2. Runs build command: `npm run build`
3. Outputs static files to `.vitepress/dist`
4. Cloudflare serves these files globally via CDN

## Deployment Checklist

- [ ] Repository connected to Cloudflare Pages
- [ ] Build settings configured correctly
- [ ] First deployment successful
- [ ] Documentation loads properly
- [ ] Navigation works (EN/ZH switching)
- [ ] Search functionality works
- [ ] Dark mode toggle works
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active

## Troubleshooting

### Build Fails

1. Check build logs in Cloudflare Dashboard
2. Verify `package.json` has correct dependencies
3. Test build locally: `npm run build`
4. Check Node.js version (Cloudflare uses Node 18+)

### 404 Errors

1. Verify build output directory is `.vitepress/dist`
2. Check that root directory is `apps/docs`
3. Ensure `index.html` exists in build output

### Styles Not Loading

1. Check that `public/` directory assets are included
2. Verify asset paths in VitePress config
3. Clear Cloudflare cache and redeploy

## Performance Optimization

Cloudflare Pages automatically provides:
- **Global CDN**: Content served from 200+ data centers
- **HTTP/3**: Latest protocol for faster loading
- **Brotli Compression**: Smaller file sizes
- **Smart Caching**: Intelligent cache invalidation
- **DDoS Protection**: Enterprise-grade security

## Monitoring

Monitor your documentation site:
- **Analytics**: Cloudflare Web Analytics (privacy-friendly)
- **Performance**: Core Web Vitals tracking
- **Errors**: Real User Monitoring (RUM)

Access analytics in Cloudflare Dashboard → Pages → Your Project → Analytics

## Cost

Cloudflare Pages is **free** for:
- Unlimited requests
- Unlimited bandwidth
- 500 builds per month
- 1 concurrent build

Perfect for documentation hosting!

## Updates

To update documentation:
1. Make changes to Markdown files
2. Commit and push to GitHub
3. Cloudflare automatically rebuilds and deploys
4. Changes live in ~1 minute

## Rollback

To rollback to a previous version:
1. Go to Cloudflare Dashboard → Pages → Your Project
2. Click "View build history"
3. Find the version you want to rollback to
4. Click "Rollback to this deployment"

## Support

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [VitePress Documentation](https://vitepress.dev/)
- [PayIn GitHub Issues](https://github.com/payin/payin/issues)
