#!/bin/bash
cd "$(dirname "$0")"
fuser -k 2402/tcp 2>/dev/null
sleep 1
exec ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 2402
