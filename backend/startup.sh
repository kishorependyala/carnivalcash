#!/bin/bash
export PYTHONPATH=/home/site/wwwroot/antenv/lib/python3.11/site-packages:$PYTHONPATH
cd /home/site/wwwroot
exec gunicorn --bind=0.0.0.0:8000 --timeout 120 --workers 2 run:app
