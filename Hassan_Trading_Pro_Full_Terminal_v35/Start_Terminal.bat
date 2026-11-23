@echo off
echo Starting HASSAN WAHLA Trading Terminal on http://localhost:8000 ...
start "" "http://localhost:8000"
py -m http.server 8000
