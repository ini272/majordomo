# Ubuntu Server Deployment

This deployment path is for a single Ubuntu host running Majordomo behind Docker Compose and `systemd`.

## Result

- Frontend served on port `80`
- Backend exposed only on `127.0.0.1:8000`
- Frontend reverse-proxies `/api` to the backend
- SQLite persisted in `/srv/majordomo/data/majordomo.db`
- Stack managed by `systemd` via `majordomo.service`

## Server layout

```text
/srv/majordomo/
  .env
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

## Routine operations

Deploy updated code:

```bash
cd /srv/majordomo
./deployment/deploy.sh
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
