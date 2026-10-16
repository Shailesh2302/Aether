#!/bin/bash
set -e
# EC2 first-boot setup: swap (1GB RAM box), docker, app stack.
if ! swapon --show | grep -q swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
if ! command -v docker >/dev/null; then
  apt-get update -y
  apt-get install -y docker.io docker-compose-plugin
  systemctl enable --now docker
  usermod -aG docker ubuntu || true
fi
cd /opt/aether/deploy
docker compose -f docker-compose.aws.yml up -d --build
docker compose -f docker-compose.aws.yml ps
