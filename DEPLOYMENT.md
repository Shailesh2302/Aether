# Aether — Free Cloud Deployment

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
   - `NEXT_PUBLIC_API_URL` = `https://aether-api.onrender.com` (use the Render URL from step below)
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
   - `POSTGRES_URL` — your Neon connection string
   - `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` — Redis Cloud
   - `QDRANT_HOST`, `QDRANT_API_KEY` — Qdrant Cloud
   - `NVIDIA_API_KEY` — from [build.nvidia.com](https://build.nvidia.com)
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
2. **AI service memory**: 512 MB is tight. We pin `WHISPER_MODEL=tiny` and disable any heavy local embeddings. If you need transcription quality, upgrade the AI service to Render's Starter plan ($7/mo).
3. **Worker stops on free tier**: The Rust worker may stop when idle. Re-deploy manually or upgrade.
4. **No persistent disk on free Render web services**: Files in `./storage/` are lost on redeploy. Use Cloudinary (`STORAGE_TYPE=cloudinary`) for uploads.
5. **API URL in web app**: Vercel needs the Render URL at build time. Update `NEXT_PUBLIC_API_URL` and redeploy Vercel after the API is up.

## Production hardening (later)

- [ ] Custom domain on Vercel + Render
- [ ] Render Starter plan for AI service (more RAM)
- [ ] Cloudflare in front of Vercel + Render
- [ ] Backups for Neon Postgres
- [ ] Sentry / Logtail for error tracking
- [ ] GitHub Actions for CI before deploy
