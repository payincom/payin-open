# PayIn Open Documentation

Public documentation for PayIn Open, the self-hosted open-source stablecoin payment gateway for online merchants.

## Development

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Structure

```text
apps/docs/
├── .vitepress/          # VitePress configuration
├── en/                  # English documentation
├── zh/                  # Chinese documentation
└── public/              # Static assets
```

## Writing Rules

- Keep this documentation focused on PayIn Open self-hosting.
- Use placeholder domains such as `https://your-payin.example.com` instead of PayIn Cloud hosted domains.
- Do not include private production runbooks, temporary planning notes, or internal deployment experiments.
- Move reusable long-form operational material to `docs/self-hosting/` and link to it from VitePress only when it is ready for public users.
