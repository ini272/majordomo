# Home Server Bring-Up Plan

**Goal:** Bring a home server online with a clean Linux install and a low-friction deployment workflow from the development PC.

## Current Assumptions (from your input)
- Hardware: Intel i5 CPU, 8–16 GB RAM, 500 GB SSD.
- Expected usage: only a handful of users for now.
- OS familiarity: strongest with Red Hat style systems, also comfortable with Debian-based systems.
- Deployment preference: simple main-branch-driven auto-update workflow.

## Recommended Baseline
- **Distro recommendation:** Rocky Linux 9 (minimal install).
  - Why: close to Red Hat admin experience, long support window, stable for low-maintenance home hosting.
- **Runtime recommendation:** Podman + systemd units (or Docker Compose if you prefer familiarity over RHEL-native tooling).
- **Sizing expectation for MVP:** this hardware is sufficient for a small user group if services are containerized and logs/assets are rotated.

## Desired Outcome
- Stable Linux host with hardened baseline configuration.
- Reproducible app runtime (containerized where possible).
- Fast update path from dev PC to server with rollback capability.

## Plan

### 1) Platform and install decisions
- Install Rocky Linux 9 Minimal.
- Partition SSD to keep OS and app data logically separate (e.g., root + dedicated data path for volumes/backups).
- Configure static LAN presence using DHCP reservation + fixed hostname.

### 2) Base system hardening
- Create non-root admin user and disable password SSH login.
- Configure automatic security updates.
- Set timezone, NTP sync, and log retention.
- Install observability basics (disk, memory, service health checks).

### 3) Runtime setup for Majordomo
- Install container/runtime dependencies (Podman preferred; Docker acceptable fallback).
- Set up environment variables and secret management.
- Configure service startup (systemd / compose).

### 4) Deployment workflow from dev PC
- **Chosen for MVP:** simple flow with `main` as deploy branch.
  - **Selected:** GitHub webhook (or equivalent push trigger) invokes a small deploy script on the server immediately after `main` updates.
  - Fallback: systemd timer polling can be retained as backup if webhook delivery is unreliable.
- Deploy script should:
  - `git fetch && git checkout main && git pull --ff-only`
  - install/update dependencies (`uv sync` for backend as needed)
  - restart services with systemd (or recreate container)
  - run a basic health check and stop/rollback on failure.
- **MVP release strategy recommendation:** deploy backend + frontend atomically to avoid short-lived version mismatch issues.
- **Webhook routing options (expanded):**
  - **Option A — Direct GitHub webhook → home server**
    - **Pros:** simplest setup, fewer moving parts, lowest latency.
    - **Cons:** requires exposing a webhook endpoint on your home IP, larger direct attack surface, harder to absorb scans/noise.
    - **Good fit when:** you want fastest MVP setup and accept tighter hardening requirements on the exposed endpoint.
  - **Option B — GitHub webhook → relay (e.g., Cloudflare Worker) → home server**
    - **Pros:** hides home IP behind relay, lets you centralize signature validation/rate limits, easier to rotate auth and add filters.
    - **Cons:** one extra component to operate, slightly more setup complexity, dependence on relay provider uptime.
    - **Good fit when:** security posture is prioritized over absolute simplicity (recommended for internet-exposed home hosts).
  - **Recommendation for this project:** start with **relay-based forwarding** unless you need day-one minimal setup above all else.
- **Important:** use hot reload (frontend HMR / `uvicorn --reload`) only in development, not on the public server.

### 5) Backup and recovery
- Define backup scope (configs, DB, volumes, media assets).
- Schedule periodic backups and test restore.
- Keep “server recovery runbook” in repo docs.

## Deliverables
- A tested, documented setup runbook.
- A tested deployment command sequence.
- A rollback checklist.

## Clarification Questions (tracked sequentially)
1. **Answered:** Hardware is Intel i5, 8–16 GB RAM, 500 GB SSD; distro preference is Red Hat-like if sensible.
2. **Answered:** Start with simple main-branch-driven auto-update deployment.
3. **Answered:** Deploy immediately after each `main` push (webhook-style trigger).
4. **Answered:** Use atomic deploys (single coordinated release/restart for backend + frontend) for MVP simplicity and consistency.
5. **Pending:** Given the trade-offs above, do you prefer **Option A (direct webhook)** for simplicity, or **Option B (relay)** for better internet-exposure security?
