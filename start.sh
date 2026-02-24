#!/bin/bash

cd /opt/app-root/src/server
. venv/bin/activate

exec python main.py
