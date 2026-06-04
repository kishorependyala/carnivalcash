#!/bin/bash
set -euo pipefail

cd /home/site/wwwroot

# Keep compatibility with vendored dependencies in backend/antenv.
if [ -d "/home/site/wwwroot/antenv/lib/python3.11/site-packages" ]; then
	export PYTHONPATH="/home/site/wwwroot/antenv/lib/python3.11/site-packages:${PYTHONPATH:-}"
fi

exec gunicorn --bind "0.0.0.0:${PORT:-8000}" --timeout 120 --workers 2 run:app
