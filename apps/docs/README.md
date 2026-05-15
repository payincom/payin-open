# PayIn Open Documentation

Official public documentation for PayIn Open, the open-source stablecoin payment gateway for merchants.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Structure

```
apps/docs/
├── .vitepress/          # VitePress configuration
│   └── config.ts        # Main configuration file
├── en/                  # English documentation
│   ├── index.md         # English homepage
│   ├── guide/           # User guides
│   ├── api/             # API reference
│   └── examples/        # Code examples
└── zh/                  # Chinese documentation
    ├── index.md         # Chinese homepage
    ├── guide/           # 用户指南
    ├── api/             # API 参考
    └── examples/        # 代码示例
```

## Features

- **Multi-language Support**: Full English and Chinese translations
- **Dark Mode**: Automatic dark mode support
- **Search**: Built-in local search
- **Responsive**: Mobile-friendly design
- **Fast**: Powered by VitePress with instant page loads

## Deployment

### Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages
2. Configure build settings:
   - Build command: `npm run build`
   - Build output directory: `.vitepress/dist`
   - Root directory: `apps/docs`
3. Deploy!

### Manual Deployment

```bash
# Build the documentation
npm run build

# The output will be in .vitepress/dist
# Upload this directory to your hosting provider
```

## Contributing

Documentation improvements are welcome! Please submit pull requests or open issues for suggestions.

## License

MIT
