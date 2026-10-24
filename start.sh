#!/usr/bin/env bash
# 本地起一个静态服务器（ES module 不能直接用 file:// 打开）
cd "$(dirname "$0")"
PORT="${1:-8123}"
echo "海上列车已发车： http://localhost:${PORT}/"
python3 -m http.server "$PORT" --bind 127.0.0.1
