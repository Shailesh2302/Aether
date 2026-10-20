#!/bin/bash
cd "$(dirname "$0")"
fuser -k 2401/tcp 2>/dev/null
sleep 1
exec env PORT=2401 npx tsx src/server.ts
