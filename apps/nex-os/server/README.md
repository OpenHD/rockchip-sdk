# NEX Music — DSP stream server (yt-dlp)

Required for real Sonido Potencia (EQ / compressor / 8D stereo).
Without this, the PWA falls back to YouTube iframe (loudness only).

## Why not Vercel?

Vercel = serverless (timeouts + no long media proxy).
This server must stay up: Socket.io rooms + yt-dlp + audio proxy with Range/CORS.

---

## Local

```bash
cd server
npm install
npm start
# → http://localhost:4000
```

Root `.env.local`:

```
VITE_MUSIC_SERVER_URL=http://localhost:4000

# If yt-dlp says "Sign in to confirm you're not a bot":
# Export cookies.txt from Chrome (extension: Get cookies.txt LOCALLY) while logged into YouTube,
# save as server/youtube-cookies.txt, then:
YT_DLP_COOKIES=server/youtube-cookies.txt

# Or (close Chrome completely first on Windows):
# YT_DLP_COOKIES_FROM_BROWSER=chrome
```

The music server reads root `.env.local` on start. Restart `npm run music:server` after changing cookies.

If yt-dlp still fails, the server tries Piped as a fallback automatically.

### Render — YouTube bot-wall (cookies)

Las IPs de Render suelen disparar el bot-wall. El archivo tiene que ser una **sesión YouTube válida** (no guest).

**Mejor forma de exportar** (en tu PC, Chrome cerrado después):

```bash
# Logueate en youtube.com en Chrome, cerrá Chrome, luego:
yt-dlp --cookies-from-browser chrome --cookies youtube-cookies.txt --skip-download "https://www.youtube.com"
```

Ese `youtube-cookies.txt` es el que yt-dlp acepta (mejor que muchas extensiones).

1. Pegá el contenido en Render → **Environment** → **Secret Files**:
   - Filename: `youtube-cookies.txt`
2. Env: `YT_DLP_COOKIES` = `/etc/secrets/youtube-cookies.txt`
3. `MUSIC_PUBLIC_URL` = `https://tu-servicio.onrender.com`
4. **Manual Deploy** / Redeploy.

Logs esperados: `[cookies] listo → /tmp/...` y `[cookies] sesión detectada: __Secure-1PSID, ...`.

Si sigue el bot-wall con cookies montadas: la sesión se invalidó al usarla desde datacenter — reexportá cookies frescas (o usá un VPS residencial / Railway con mejor IP). Caducan en horas/días.

---

## Production (Railway) — recommended

### 1. Deploy this repo’s `server/`

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub (`shadownrx/windows`).
2. Settings → Root Directory / Dockerfile path: use root `railway.toml` (builds `server/Dockerfile`).
3. Add a **public domain** (Settings → Networking → Generate Domain), e.g.  
   `https://nex-music-server-production-xxxx.up.railway.app`
4. Optional env on Railway:
   - `MUSIC_PUBLIC_URL=https://nex-music-server-production-xxxx.up.railway.app`  
     (auto-filled from `RAILWAY_PUBLIC_DOMAIN` if omitted)

### 2. Point the PWA (Vercel) at it

In Vercel → Project → Settings → Environment Variables:

| Name | Value |
|------|--------|
| `VITE_MUSIC_SERVER_URL` | `https://tu-dominio.up.railway.app` |

**Redeploy** the frontend (Vite bakes `VITE_*` at build time).

### 3. Verify

```bash
curl https://tu-dominio.up.railway.app/health
# → { "ok": true, "stream": true, "ytDlp": { "ok": true, ... } }

curl https://tu-dominio.up.railway.app/stream/kJQP7kiw5Fk
# → { "url": ".../audio", "source": "yt-dlp" }
```

Open https://anex-os.vercel.app/nex-music → play → Sonido Potencia → **DSP en vivo**.

---

## Alternatives

### Render

- New **Web Service**, root `server`, Dockerfile `server/Dockerfile`
- Env: `MUSIC_PUBLIC_URL=https://tu-servicio.onrender.com`
- Same `VITE_MUSIC_SERVER_URL` on Vercel + redeploy

### VPS (Docker)

```bash
cd server
docker build -t nex-music-server .
docker run -d -p 4000:4000 \
  -e MUSIC_PUBLIC_URL=https://music.tudominio.com \
  --name nex-music nex-music-server
```

Put HTTPS (Caddy/Nginx) in front, then set `VITE_MUSIC_SERVER_URL` on Vercel.

---

## Checklist

- [ ] Music server `/health` → `stream: true`
- [ ] Vercel has `VITE_MUSIC_SERVER_URL` (HTTPS, no trailing slash)
- [ ] Frontend redeployed after setting the env
- [ ] Browser can `fetch(VITE_MUSIC_SERVER_URL + '/health')` (CORS is open)
- [ ] Playing a track shows **DSP en vivo**
