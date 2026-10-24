# Aether — Deployment

## Recommended: AWS (all backend services) + Vercel (frontend)

One `t3.micro` EC2 (free tier) in `ap-south-1` runs everything with
`infrastructure/aws/docker-compose.aws.yml`: Postgres, Redis, Qdrant,
API (+queue worker), AI service, and Caddy (auto-HTTPS via sslip.io —
no domain needed, and no browser mixed-content issues).

Live: API at `https://15-252-129-68.sslip.io` (Caddy → api:2401).

```bash
# provisioned with: key pair aether-ec2, SG aether-stack (22/80/443),
# Elastic IP 15.252.129.68, instance i-0eb1c367d0e411805, 30GB gp3
scp code.tgz ubuntu@<EIP>:/tmp/
ssh ubuntu@<EIP>  # sudo bash /opt/aether/deploy/setup.sh
```

Secrets live in `/opt/aether/deploy/.env` on the server (never in git):
`POSTGRES_PASSWORD`, `JWT_SECRET`, `SERVICE_API_KEY`, `NVIDIA_API_KEY`,
`DOMAIN`, `CORS_ORIGIN`, `APP_URL`. Storage is local on the EBS volume
(`appstorage`), so files survive restarts.

## Alternative: free cloud (Vercel + Render)

This project is configured to deploy to **Vercel** (frontend) and **Render** (backend) on free tiers, with **Neon Postgres**, **Redis Cloud**, and **Qdrant Cloud** as managed data services.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Vercel         │     │  Render          │     │  Render         │
│  aether-web     │────▶│  aether-api      │────▶│  aether-ai      │
│  (Next.js)      │     │  (Express)       │     │  (FastAPI)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                         │
                                ▼                         ▼
                        ┌──────────────────────────────────────┐
                        │  Neon Postgres · Redis Cloud · Qdrant │
                        └──────────────────────────────────────┘
                                          ▲
                                          │
                                  ┌──────────────────┐
                                  │  Render Worker   │
                                  │  aether-worker   │
                                  │  (Rust)          │
                                  └──────────────────┘
```

## Free tier limits (be aware)

| Service | Limit | Impact |
|---------|-------|--------|
| Vercel | 100 GB bandwidth/mo, serverless functions | Plenty for dev/hobby |
| Render web | 512 MB RAM, spins down after 15 min idle | First request ~30 s cold start |
| Render worker | 512 MB RAM, no always-on | Worker stops when idle |
| AI service memory | 512 MB | `faster-whisper` set to `tiny` model in `render.yaml` |
| Neon | 0.5 GB storage, 191 compute hrs/mo | Plenty |
| Redis Cloud | 30 MB | Tight — limit Redis usage |
| Qdrant Cloud | 1 GB free | Fine for dev |

## One-time setup

### 1. Push to GitHub

```bash
cd /home/shailesh/Desktop/aether
git add -A
git commit -m "chore: add free-tier deployment configs"
git push origin main
```

(If the GitHub repo is private, Render and Vercel can still access it.)

### 2. Create accounts

- [vercel.com](https://vercel.com) — sign up with GitHub
- [render.com](https://render.com) — sign up with GitHub

## Deploy the frontend to Vercel

### Option A: Vercel Dashboard (recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your `aether` GitHub repo
3. **Root Directory**: set to `apps/web`
4. **Framework Preset**: Next.js (auto-detected)
5. **Environment Variables** — add:
    - `NEXT_PUBLIC_API_URL` = `https://aether-api.onrender.com/api` (use the Render URL from step below **with the `/api` suffix** — without it every API call 404s)
6. Click **Deploy**

### Option B: Vercel CLI

```bash
npm i -g vercel
cd /home/shailesh/Desktop/aether
vercel login
vercel --prod
```

Follow the prompts. The `vercel.json` in the root is auto-detected.

## Deploy the backend to Render

### Option A: Blueprint (one-click)

1. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
2. Click **New Blueprint Instance**
3. Connect your `aether` GitHub repo
4. Render detects `render.yaml` and shows 3 services:
   - `aether-api` (web, Node)
   - `aether-ai` (web, Python)
   - `aether-worker` (worker, Rust)
5. Render will pre-fill env vars marked `sync: false` — you must fill them manually:
   - `POSTGRES_URL` — your Neon **pooled** connection string (hostname contains `-pooler`)
   - `POSTGRES_DIRECT_URL` — your Neon **direct** connection string (strip `-pooler` from the hostname). Required for `prisma migrate deploy` to work; the migration engine needs session features that the transaction-mode pooler doesn't support.
   - `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — Redis Cloud
   - `QDRANT_HOST`, `QDRANT_API_KEY` — Qdrant Cloud
    - `NVIDIA_API_KEY` — from [build.nvidia.com](https://build.nvidia.com)
    - `STRIPE_SECRET_KEY` — from [dashboard.stripe.com](https://dashboard.stripe.com) (test mode key `sk_test_...` is fine to start). Without it, trials still work but checkout returns 503.
    - `STRIPE_WEBHOOK_SECRET` — create a webhook endpoint in Stripe pointing at `https://<your-api>.onrender.com/api/subscription/webhook`, listening to `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`. No pre-created Prices needed — the API creates inline prices ($10/3mo, $15/6mo, $20/12mo).
    - `APP_URL` — your Vercel URL (used for Stripe success/cancel redirects)
   - `CLOUDINARY_*` — from [cloudinary.com](https://cloudinary.com) (or set `STORAGE_TYPE=local` and accept ephemeral storage)
6. Click **Apply** — Render builds and deploys all 3 services.

### Option B: Manual

For each service in `render.yaml`, create a new **Web Service** (or **Background Worker** for the Rust one) on Render pointing at the same repo, with the env vars above.

## Update CORS after Vercel deploys

1. Copy the Vercel URL (e.g. `https://aether-web-xyz.vercel.app`)
2. In Render dashboard → `aether-api` → **Environment**, set:
   - `CORS_ORIGIN` = your Vercel URL
3. Service auto-redeploys.

## Update AI service URL in API

After `aether-ai` deploys, copy its URL (e.g. `https://aether-ai-abc.onrender.com`) and:

1. In Render dashboard → `aether-api` → **Environment**:
   - `AI_SERVICE_URL` = the AI service URL
2. Auto-redeploy.

## Enable YouTube imports (cookies)

YouTube blocks downloads from cloud/datacenter IPs with a "Sign in to confirm
you're not a bot" check. Direct media URLs (MP4/PDF/etc.) import without any
setup; YouTube/Vimeo links need a cookies export.

1. In a private/incognito window, sign in to YouTube (a throwaway account is
   safest — yt-dlp documents a small risk of account bans).
2. Export cookies for `youtube.com` as a Netscape `cookies.txt` file using a
   browser extension such as "Get cookies.txt LOCALLY".
3. Provide them to the AI service in one of two ways:
   - `YTDLP_COOKIES_FILE=/path/to/cookies.txt` — mount the file read-only into
     the `ai-service` container, or
   - `YTDLP_COOKIES_B64=$(base64 -w0 cookies.txt)` — set it in the deploy
     `.env` (recommended on EC2; no bind mount needed).
4. Restart the AI service: `docker compose -f docker-compose.aws.yml up -d ai-service`.

If YouTube changes its bot rules the error surfaced by the import UI will say
so; refresh the cookies and restart. Never commit the cookies file.

## Test the deployment

```bash
# Health
curl https://aether-api.onrender.com/api/health
curl https://aether-ai.onrender.com/api/v1/health

# Login
curl -X POST https://aether-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rushikeshkanfade2002@gmail.com","password":"Pass@1234"}'
```

Open the Vercel URL in a browser — you should be able to log in, upload files, and use the AI features.

## Known issues on free tier

1. **Cold starts**: First request to `aether-api` or `aether-ai` after 15 min of inactivity takes 30–60 s. Render spins the service back up.
2. **Prisma migrations need the direct Neon URL**: If `npx prisma migrate deploy` fails with `Could not parse schema engine response: SyntaxError: Unexpected token 'E', "Error load"...`, the migration engine is hitting Neon's PgBouncer pooler. The pooler is transaction-mode and doesn't support the session features (advisory locks, prepared statements) the migration engine needs. Fix: set `POSTGRES_DIRECT_URL` to Neon's direct (non-pooler) connection string and redeploy.
2. **AI service memory**: 512 MB is tight. We pin `WHISPER_MODEL=tiny` and disable any heavy local embeddings. If you need transcription quality, upgrade the AI service to Render's Starter plan ($7/mo).
3. **Worker stops on free tier**: The Rust worker may stop when idle. Re-deploy manually or upgrade.
4. **No persistent disk on free Render web services**: Files in `./storage/` are lost on redeploy. Use Cloudinary (`STORAGE_TYPE=cloudinary`) for uploads.
5. **API URL in web app**: Vercel needs the Render URL at build time **including the `/api` suffix** (e.g. `https://aether-api.onrender.com/api`). Update `NEXT_PUBLIC_API_URL` and redeploy Vercel after the API is up.

## Production hardening (later)

- [ ] Custom domain on Vercel + Render
- [ ] Render Starter plan for AI service (more RAM)
- [ ] Cloudflare in front of Vercel + Render
- [ ] Backups for Neon Postgres
- [ ] Sentry / Logtail for error tracking
- [ ] GitHub Actions for CI before deploy
