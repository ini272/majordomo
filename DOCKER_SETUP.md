# Docker Setup Guide

## Overview

majordomo uses Docker Compose to orchestrate the backend (FastAPI) and frontend (React/Vite) services. This setup works seamlessly on WSL, local development, and production servers.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)
- No need to install Python or Node.js separately

## Quick Start

### 1. Start Services

```bash
docker-compose up --build
```

This will:
- Build backend image (Python 3.9)
- Build frontend image (Node.js)
- Start both services
- Output logs to console

Services available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000

### 2. Access from Phone/Other Device

Once running, access from your phone on the same network:
```
http://<your-windows-ip>:3000
```

The frontend automatically detects your IP and constructs API URLs correctly.

### 3. Stop Services

```bash
docker-compose down
```

## Environment Variables

### Frontend (VITE_API_URL)

Default: Empty (auto-detect hostname)

Set manually in `docker-compose.yml` if needed:
```yaml
environment:
  - VITE_API_URL=http://backend:8000/api
```

### Backend (NODE_ENV, DATABASE_URL)

Defined in `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=development
  - DATABASE_URL=sqlite:///./majordomo.db
```

## Volume Mounts

Backend and frontend code are mounted as volumes for hot-reload during development:

```yaml
volumes:
  - ./backend:/app
  - ./frontend:/app
```

Changes to source files reflect immediately in running containers (for Python, Node.js requires rebuild).

## Database Persistence

SQLite database is stored at `./majordomo.db` in the project root. It persists across container restarts.

## Networking

Services communicate via Docker bridge network named `majordomo`:
- Frontend can call `http://backend:8000/api` (internal)
- External clients call `http://<host-ip>:8000/api`

## Development Workflow

### 1. Make Code Changes

Edit files normally in your editor.

### 2. Rebuild (if needed)

Frontend changes auto-reflect (Vite HMR inside container).  
Backend changes require container restart:

```bash
docker-compose restart backend
```

Or rebuild:
```bash
docker-compose up --build backend
```

### 3. View Logs

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Troubleshooting

### Port Already in Use

If ports 3000 or 8000 are occupied:
```yaml
ports:
  - "3001:3000"  # Map to different port
  - "8001:8000"
```

### API Connection Failed from Phone

1. **Check backend is running:**
   ```bash
   docker-compose ps
   ```

2. **Verify firewall allows ports 3000, 8000**

3. **Check Windows IP:**
   ```powershell
   ipconfig
   ```

4. **Test connectivity:**
   ```
   http://<windows-ip>:8000/health
   ```

### Frontend Shows Blank Page

Check browser console (F12) for errors. Usually a CORS or API connection issue.

## Production Deployment

For deploying to a home server or NAS:

1. **Update `docker-compose.yml` with persistent paths**
2. **Set environment variables for your domain**
3. **Use reverse proxy (nginx) for HTTPS**
4. **Pin image versions** instead of `latest`

Example for production:
```yaml
backend:
  image: majordomo-backend:1.0.0
  restart: always
  environment:
    - NODE_ENV=production
    - DATABASE_URL=/data/majordomo.db
  volumes:
    - /mnt/storage/majordomo:/data
```

## NFC Setup

NFC tags can point to:
```
https://<your-hostname>:3000/trigger/quest/6
```

Examples:
- `https://majordomo.local:3000/trigger/quest/6` (mDNS)
- `https://192.168.178.33:3000/trigger/quest/6` (IP)
- `https://your-domain.com:3000/trigger/quest/6` (domain)

## Useful Commands

```bash
# View all running containers
docker-compose ps

# Rebuild everything
docker-compose build

# Restart specific service
docker-compose restart backend

# Execute command in container
docker-compose exec backend python -m pytest tests/

# Remove all containers and volumes
docker-compose down -v

# Follow logs for both services
docker-compose logs -f
```
