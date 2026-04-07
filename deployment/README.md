# Ubuntu Server Deployment

This deployment path is for a single Ubuntu host running Majordomo behind Docker Compose and `systemd`.

## Result

- Frontend served on port `80`
- Backend exposed only on `127.0.0.1:8000`
- Frontend reverse-proxies `/api` to the backend
- SQLite persisted in `/srv/majordomo/data/majordomo.db`
- Timestamped SQLite backups stored in `/srv/majordomo/backups/`
- Stack managed by `systemd` via `majordomo.service`
- Normal updates use `git pull --ff-only` plus a backup-first deploy script

## Server layout

```text
/srv/majordomo/
  .env
  backups/
  data/
  deployment/
  backend/
  frontend/
```

## First deploy

1. Install Docker and the Compose plugin on the server.
2. Sync or clone the repo to `/srv/majordomo`.
3. Copy `deployment/.env.server.example` to `/srv/majordomo/.env` and set `SECRET_KEY`.
4. If you already have a SQLite file from the temporary LAN deploy, copy it into `/srv/majordomo/data/majordomo.db`.
5. Build and start:

```bash
cd /srv/majordomo
docker compose --env-file .env -f deployment/docker-compose.yml up -d --build
```

6. Install the `systemd` unit:

```bash
cd /srv/majordomo
./deployment/install-service.sh
```

## Convert an existing rsync deployment into a git checkout

If `/srv/majordomo` already exists from the bootstrap rsync deploy, preserve only the runtime state and re-clone the code:

```bash
sudo systemctl stop majordomo.service
mkdir -p ~/majordomo-migration
cp /srv/majordomo/.env ~/majordomo-migration/.env
cp /srv/majordomo/data/majordomo.db ~/majordomo-migration/majordomo.db
mv /srv/majordomo /srv/majordomo.pre-git
git clone https://github.com/ini272/majordomo.git /srv/majordomo
cp ~/majordomo-migration/.env /srv/majordomo/.env
mkdir -p /srv/majordomo/data
cp ~/majordomo-migration/majordomo.db /srv/majordomo/data/majordomo.db
cd /srv/majordomo
./deployment/install-service.sh
```

After the new checkout is working, remove `/srv/majordomo.pre-git`.

## Routine operations

Create a manual database backup:

```bash
cd /srv/majordomo
./deployment/backup-db.sh
```

Deploy updated code from the checked-out branch:

```bash
cd /srv/majordomo
git pull --ff-only
./deployment/deploy-safe.sh
```

Or let the wrapper handle backup plus fast-forward pull:

```bash
cd /srv/majordomo
./deployment/deploy-safe.sh
```

View logs:

```bash
cd /srv/majordomo
docker compose --env-file .env -f deployment/docker-compose.yml logs -f
```

Restart via `systemd`:

```bash
sudo systemctl restart majordomo.service
```

Check the deployed commit:

```bash
git rev-parse --short HEAD
```
