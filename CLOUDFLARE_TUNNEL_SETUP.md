# Cloudflare Tunnel Setup for Mobile Testing

This guide will help you set up Cloudflare Tunnel to access your Majordomo app from your phone without deploying to the cloud.

## What is Cloudflare Tunnel?

Cloudflare Tunnel creates a secure connection from your local machine to the internet through Cloudflare's network. This lets you access your locally-running app from anywhere with permanent, HTTPS URLs - all completely free!

## Prerequisites

- WSL2 running on Windows (or Linux/Mac)
- Docker and Docker Compose installed
- Your Majordomo app working locally

## One-Time Setup

### Step 1: Install Cloudflared

```bash
# Download and install cloudflared in WSL
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Verify installation
cloudflared --version
```

### Step 2: Login to Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window asking you to log in to Cloudflare (create a free account if needed). After authorizing, you'll see a success message in the terminal.

### Step 3: Create a Named Tunnel

```bash
cloudflared tunnel create majordomo
```

**Important:** This command will output a **Tunnel ID** (UUID format like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

**Copy this ID!** You'll need it in the next step.

You'll also see it creates a credentials file at:
```
/home/user/.cloudflared/<TUNNEL_ID>.json
```

### Step 4: Update the Tunnel Configuration

Edit the config file in this repo:

```bash
nano cloudflared-config.yml
```

Replace `<TUNNEL_ID>` (appears twice) with your actual tunnel ID from Step 3:

```yaml
tunnel: a1b2c3d4-e5f6-7890-abcd-ef1234567890  # Your actual ID here
credentials-file: /home/user/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json
```

Save and exit (Ctrl+X, then Y, then Enter).

### Step 5: Route DNS to Your Tunnel

Register the hostnames with Cloudflare:

```bash
cloudflared tunnel route dns majordomo majordomo-frontend.trycloudflare.com
cloudflared tunnel route dns majordomo majordomo-backend.trycloudflare.com
```

This creates two permanent URLs for your app!

### Step 6: Configure Your App for Tunnel URLs

Create a `.env` file if you don't have one:

```bash
cp .env.example .env
```

Edit the `.env` file:

```bash
nano .env
```

Update the `VITE_API_URL` line to use your tunnel URL:

```env
# Change from:
VITE_API_URL=http://localhost:8000/api

# To:
VITE_API_URL=https://majordomo-backend.trycloudflare.com/api
```

Save and exit.

### Step 7: Rebuild Frontend with Tunnel URL

The frontend needs to be rebuilt with the new backend URL:

```bash
docker-compose build frontend
```

## Daily Usage

Once setup is complete, using the tunnel is simple:

### Terminal 1: Run Your App

```bash
cd ~/majordomo
docker-compose up
```

Wait for both services to start (you'll see logs from backend and frontend).

### Terminal 2: Run the Tunnel

```bash
cd ~/majordomo
cloudflared tunnel --config cloudflared-config.yml run majordomo
```

You'll see output showing the tunnel is connected:

```
2026-01-15 INFO  Connection established
2026-01-15 INFO  Route propagated to https://majordomo-frontend.trycloudflare.com
2026-01-15 INFO  Route propagated to https://majordomo-backend.trycloudflare.com
```

### Access from Your Phone

Open your mobile browser and navigate to:

```
https://majordomo-frontend.trycloudflare.com
```

🎉 Your app is now accessible from anywhere!

## Workflow for Testing New Features

1. **Merge PR on GitHub**
   ```bash
   # (Do this from GitHub web interface)
   ```

2. **Pull changes to your PC**
   ```bash
   cd ~/majordomo
   git pull origin main
   ```

3. **Restart containers** (if needed - usually auto-reloads)
   ```bash
   docker-compose restart
   ```

4. **Test on phone**
   - Open `https://majordomo-frontend.trycloudflare.com`
   - Vite/Uvicorn auto-reload picks up changes automatically!

## Switching Between Local and Tunnel Mode

### For Local Development (PC only):

```env
# .env file
VITE_API_URL=http://localhost:8000/api
```

```bash
docker-compose build frontend
docker-compose up
# Access at http://localhost:3000 (no tunnel needed)
```

### For Mobile Testing (Tunnel):

```env
# .env file
VITE_API_URL=https://majordomo-backend.trycloudflare.com/api
```

```bash
docker-compose build frontend
docker-compose up
cloudflared tunnel --config cloudflared-config.yml run majordomo
# Access at https://majordomo-frontend.trycloudflare.com
```

## Troubleshooting

### "tunnel credentials file not found"

Make sure the path in `cloudflared-config.yml` matches where the credentials were saved:

```bash
ls ~/.cloudflared/
# You should see <TUNNEL_ID>.json
```

### Frontend can't connect to backend

1. Check that tunnel is running and shows both routes
2. Verify `VITE_API_URL` in `.env` matches backend tunnel URL
3. Rebuild frontend: `docker-compose build frontend`

### "connection refused" errors

Make sure both Docker containers are running:

```bash
docker ps
# You should see majordomo-frontend and majordomo-backend
```

### Tunnel URLs not working

Verify DNS routes are registered:

```bash
cloudflared tunnel route dns list
```

If missing, re-run the route commands from Step 5.

### WSL connectivity issues

Ensure WSL can access localhost services:

```bash
curl http://localhost:3000
curl http://localhost:8000/api/health
```

Both should respond. If not, restart Docker Desktop.

## Advanced: Custom Domain (Optional)

If you own a domain and want to use it instead of `.trycloudflare.com`:

1. Add domain to Cloudflare (free)
2. Update `cloudflared-config.yml` hostname entries
3. Route DNS:
   ```bash
   cloudflared tunnel route dns majordomo app.yourdomain.com
   cloudflared tunnel route dns majordomo api.yourdomain.com
   ```

## Stopping the Tunnel

Press `Ctrl+C` in the terminal running cloudflared.

The tunnel stops, but your URLs remain registered and will work again next time you run it!

## Security Notes

- ✅ All traffic is encrypted with HTTPS automatically
- ✅ Tunnel only exposes the ports you specify (3000 and 8000)
- ✅ No firewall rules or port forwarding needed
- ⚠️ Anyone with the URL can access your app (use authentication!)
- ⚠️ Don't share your credentials file (in `.cloudflared/`)

## Costs

**Cloudflare Tunnel is 100% free!**

- No bandwidth limits
- No time limits
- No request limits
- Permanent URLs included

---

## Quick Reference

**Start everything:**
```bash
# Terminal 1
docker-compose up

# Terminal 2
cloudflared tunnel --config cloudflared-config.yml run majordomo
```

**Your URLs:**
- Frontend: https://majordomo-frontend.trycloudflare.com
- Backend API: https://majordomo-backend.trycloudflare.com/api

**After merging PRs:**
```bash
git pull origin main
# Containers auto-reload, refresh browser on phone
```

Happy testing! 🎉
