#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

sudo install -m 0644 "$ROOT_DIR/deployment/systemd/majordomo.service" /etc/systemd/system/majordomo.service
sudo systemctl daemon-reload
sudo systemctl enable majordomo.service
sudo systemctl restart majordomo.service
