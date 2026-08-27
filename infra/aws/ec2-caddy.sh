#!/bin/bash
set -euo pipefail
# Official Caddy static binary. Do not use Cloudsmith dnf on AL2023.
install -d -m 0755 /usr/local/bin /etc/caddy /opt/linkmate /var/lib/caddy
if ! command -v caddy >/dev/null 2>&1; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) CADDY_ARCH=amd64 ;;
    aarch64) CADDY_ARCH=arm64 ;;
    *) echo "unsupported arch $ARCH"; exit 1 ;;
  esac
  TMP=$(mktemp -d)
  curl -fsSL -o "$TMP/caddy.tgz" "https://github.com/caddyserver/caddy/releases/download/v2.9.1/caddy_2.9.1_linux_${CADDY_ARCH}.tar.gz"
  tar -xzf "$TMP/caddy.tgz" -C "$TMP" caddy
  install -m 0755 "$TMP/caddy" /usr/local/bin/caddy
  rm -rf "$TMP"
  id caddy >/dev/null 2>&1 || useradd --system --home /var/lib/caddy --shell /sbin/nologin caddy
  chown -R caddy:caddy /var/lib/caddy
fi
curl -fsSL -o /etc/caddy/Caddyfile https://raw.githubusercontent.com/habibwahid101/linkmate/main/infra/aws/Caddyfile
cat >/etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy HTTPS reverse proxy
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now caddy
systemctl reload caddy || systemctl restart caddy
systemctl is-active caddy
