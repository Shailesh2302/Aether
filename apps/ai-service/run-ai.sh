#!/bin/bash
cd "$(dirname "$0")"
fuser -k 3002/tcp 2>/dev/null
sleep 1
exec ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 3002
