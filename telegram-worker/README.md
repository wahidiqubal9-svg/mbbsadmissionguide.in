# MBBS Admission Telegram Worker

Dedicated Cloudflare Worker for the MBBS Admission Guide lead form.

## Cloudflare Workers Builds

Configure the Cloudflare Worker project to use this repository with:

- **Root directory / Path:** `telegram-worker`
- **Build command:** leave empty
- **Deploy command:** `npx wrangler deploy`
- **Non-production branch deploy command:** `npx wrangler versions upload`

The Worker expects these two Cloudflare **Secrets** (never commit their values to GitHub):

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

The Worker exposes `POST /api/lead` and sends validated leads to Telegram.

After the first deployment, use the generated `workers.dev` URL or a custom Worker route/domain as the API endpoint for the website form.
