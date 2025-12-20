# Docker Installation for Windows + WSL 2

## Overview

You need **Docker Desktop for Windows** with **WSL 2 integration** to run Docker Compose from inside WSL.

## Installation Steps

### 1. Install Docker Desktop

1. Download: https://www.docker.com/products/docker-desktop
2. Run installer
3. Choose "Use WSL 2 instead of Hyper-V" during setup
4. Complete installation and restart

### 2. Enable WSL 2 Integration

After installation:

1. Open **Docker Desktop**
2. Go to **Settings** → **Resources** → **WSL Integration**
3. Enable **WSL 2 distro integration**
4. Select your distro (likely `Ubuntu` or similar)
5. Click **Apply & Restart**

### 3. Verify Installation

From WSL terminal:

```bash
docker --version
docker-compose --version
```

Both should display version numbers.

## First Run

```bash
cd /path/to/grindstone
docker-compose up --build
```

This will:
1. Build backend image (~2 min)
2. Build frontend image (~3 min, includes npm install)
3. Start both services
4. Output logs

Access:
- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8000

## WSL 2 Path Mapping

Inside WSL, your project path should be:
```
/home/jvr/grindstone
```

Docker automatically mounts this. Volumes in `docker-compose.yml` work without modification.

## Troubleshooting

### "docker: command not found"

- Docker Desktop not installed
- WSL 2 integration not enabled
- Restart WSL: `wsl --shutdown` from PowerShell, then reopen terminal

### Slow Build Times

First build is slow (npm install, pip install). Subsequent builds cache layers and are faster.

### Port Conflicts on Windows

If `localhost:3000` doesn't respond:

1. Check Windows firewall allows inbound on ports 3000, 8000
2. Check no other process uses those ports:
   ```powershell
   netstat -ano | findstr :3000
   ```

### Can't Connect from Phone

See "Troubleshooting" section in DOCKER_SETUP.md

## Performance Tips

1. **Store project on WSL filesystem** (not `/mnt/c/...`) for better I/O
2. **Use `.dockerignore`** to exclude node_modules, venv from build context
3. **Leverage layer caching** by ordering Dockerfile commands efficiently

## Next Steps

Once Docker is running:

1. Test basic login/quest flow
2. Test NFC trigger from phone
3. Verify data persistence (restart container, check database still there)
4. Plan production deployment to home server
