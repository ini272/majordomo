# Remote Access & Firewall Security Plan

**Goal:** Expose home server services to the internet safely, minimizing attack surface while preserving reliable access.

## Desired Outcome
- Explicitly limited inbound exposure at modem/router and host firewall levels.
- Strong authentication and encryption for all remote access paths.
- Contained blast radius via app isolation and principle of least privilege.

## Plan

### 1) Access model selection
- Decide how users reach services:
  - Reverse proxy + HTTPS on 443.
  - VPN-first access (e.g., WireGuard/Tailscale) for admin endpoints.
  - Zero-trust tunnel approach if preferred.
- Separate public app endpoints from admin-only endpoints.

### 2) Router/modem (Telekom) configuration
- Assign fixed LAN IP to server (DHCP reservation).
- Forward only required ports (ideally 443, avoid broad ranges).
- Disable UPnP to prevent accidental exposure.
- Document every open port and owner service.

### 3) Host-level network controls
- Enable host firewall (nftables/ufw) with default deny inbound.
- Only allow required ports and source restrictions where possible.
- Add rate limiting and brute-force controls (fail2ban or equivalent).

### 4) Application isolation and sandboxing
- Run services with least privilege user accounts.
- Prefer container isolation + read-only filesystems where practical.
- Restrict secrets and mounted volumes by service.
- Separate reverse proxy from app and database networks.

### 5) TLS, identity, and monitoring
- Enforce HTTPS with trusted certs and automatic renewal.
- Require strong auth (MFA where available) for admin surfaces.
- Add security logging, alerting, and periodic exposure review.

### 6) Verification and audit
- Validate externally reachable ports from WAN.
- Perform baseline security scan and dependency updates.
- Create incident-response checklist (revoke keys, rotate secrets, restore service).

## Deliverables
- Router/firewall configuration checklist.
- Public endpoint matrix (URL, port, owner, auth method).
- Security operations checklist (patching, cert renewals, audits).

## Clarification Questions (tracked sequentially)
1. **Pending:** Do you want your app fully public on the internet, or would you accept VPN-only access for some/all features?
