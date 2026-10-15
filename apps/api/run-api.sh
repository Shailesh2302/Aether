#!/bin/bash
cd "$(dirname "$0")"
fuser -k 3001/tcp 2>/dev/null
sleep 1
exec env PORT=3001 npx tsx src/server.ts
