#!/bin/bash
export PYTHONPATH=/home/site/wwwroot/.python_packages/lib/site-packages:$PYTHONPATH
cd /home/site/wwwroot
gunicorn --bind=0.0.0.0:8000 --timeout 120 --workers 2 run:app
