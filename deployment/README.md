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

## Production update workflow

Normal feature work should happen in a dedicated git worktree and feature branch.

1. Create or switch to a feature worktree.
2. Implement and test locally from that worktree.
3. Open a pull request against `main`.
4. Wait for GitHub Actions checks to pass.
5. Merge the pull request into `main`.
6. On the production server, deploy only from the `/srv/majordomo` checkout of `main`:

```bash
cd /srv/majordomo
./deployment/deploy-safe.sh main
```

Production deploys should not be run directly from unmerged feature branches unless this is an intentional emergency/manual override.

### Local verification first

For most frontend and product work, the default verification loop should stay local:

- run the feature from the worktree you are editing
- verify browser behavior locally with `playwright-cli`
- run repo quality checks before opening or updating the PR

This is usually the fastest path for:

- layout and spacing changes
- sort/filter/search behavior
- quest board and modal interactions
- copy and visual state changes
- other UI behavior that does not depend on server-only infrastructure

Prefer local verification first because it keeps iteration tight and avoids syncing code or
rebuilding server containers for every small change.

## Staging stack

Use staging when you need a production-shaped test on the server before merging, such as NFC scans from a phone, without mutating production data.

Use staging selectively as a second pass, not as the default inner loop.

Good staging cases:

- NFC flows or phone-only interactions
- Tailscale/LAN access checks
- reverse-proxy behavior and `/api` routing
- auth/session behavior behind the real stack
- changes where production-like data or server config could affect the result

Poor staging cases:

- routine layout adjustments
- simple sort/filter UI changes
- quick feedback during active implementation

Staging is valuable, but it adds sync and rebuild overhead. Use it when the production-shaped
environment is the thing you need to validate, not just because the server is already running.

Staging result:

- Frontend served on port `8080`: `http://majordomo:8080`
- Backend exposed only on `127.0.0.1:18000`
- Frontend reverse-proxies `/api` to the staging backend
- SQLite copied to `/srv/majordomo-staging/data/majordomo.db`
- Containers use separate names and Compose project: `majordomo-staging`

Expected staging layout on the server:

```text
/srv/majordomo-staging/
  .env
  data/
  app/
```

Prepare an isolated staging database on the server:

```bash
sudo mkdir -p /srv/majordomo-staging/data
sudo cp /srv/majordomo/data/majordomo.db /srv/majordomo-staging/data/majordomo.db
sudo chown -R "$USER":"$USER" /srv/majordomo-staging
cp deployment/.env.staging.example /srv/majordomo-staging/.env
```

Edit `/srv/majordomo-staging/.env` and set a staging-only `SECRET_KEY`.

Sync a full local worktree to the staging app checkout:

```bash
rsync -az --delete \
  --exclude='.git' \
  --exclude='backend/.venv' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='data' \
  -e 'ssh -F /home/jvr/.ssh/config' \
  /home/jvr/majordomo/.worktrees/<worktree-name>/ \
  192.168.178.51:/srv/majordomo-staging/app/
```

If you only need to sync a few changed files, run `rsync` from the worktree root and keep `--relative` so the repo paths are preserved on the server:

```bash
cd /home/jvr/majordomo/.worktrees/<worktree-name>
rsync -az --relative \
  -e 'ssh -F /home/jvr/.ssh/config' \
  backend/app/routes/triggers.py \
  backend/tests/test_triggers.py \
  frontend/src/pages/NFCTrigger.tsx \
  192.168.178.51:/srv/majordomo-staging/app/
```

Without `--relative`, the files land directly in `/srv/majordomo-staging/app/` instead of their repo directories.

Start or rebuild staging from the checkout or worktree you want to test:

```bash
docker compose \
  -p majordomo-staging \
  --env-file /srv/majordomo-staging/.env \
  -f deployment/docker-compose.yml \
  -f deployment/docker-compose.staging.yml \
  up -d --build backend frontend
```

Check logs:

```bash
docker compose \
  -p majordomo-staging \
  --env-file /srv/majordomo-staging/.env \
  -f deployment/docker-compose.yml \
  -f deployment/docker-compose.staging.yml \
  logs -f
```

Stop staging:

```bash
docker compose \
  -p majordomo-staging \
  --env-file /srv/majordomo-staging/.env \
  -f deployment/docker-compose.yml \
  -f deployment/docker-compose.staging.yml \
  down
```

For NFC testing, enable a copied staging template manually:

```sql
UPDATE quest_template
SET nfc_enabled = 1,
    nfc_code = 'trash-bin'
WHERE id = 42;
```

Write the temporary staging URL to the NFC tag:

```text
http://majordomo:8080/t/trash-bin
```

After production rollout, rewrite the tag without the staging port:

```text
http://majordomo/t/trash-bin
```

## Routine operations

Create a manual database backup:

```bash
cd /srv/majordomo
./deployment/backup-db.sh
```

Deploy updated production code from `main`:

```bash
cd /srv/majordomo
./deployment/deploy-safe.sh main
```

`deploy-safe.sh` creates a backup, fetches/pulls with fast-forward only, then rebuilds and restarts the Docker Compose stack.

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
