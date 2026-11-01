#!/usr/bin/env bash
# MyKnowledge Launcher
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Nếu server chưa chạy, khởi động ngầm
if ! curl -s http://localhost:3030/api/git-status > /dev/null 2>&1; then
  nohup node scripts/admin.mjs > "$DIR/.admin.log" 2>&1 &
  # Đợi tối đa 3 giây cho server sẵn sàng
  for i in {1..15}; do
    if curl -s http://localhost:3030/api/git-status > /dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
fi

# Tự động mở trình duyệt vào giao diện Admin
if command -v xdg-open > /dev/null 2>&1; then
  xdg-open "http://localhost:3030" > /dev/null 2>&1 &
elif command -v sensible-browser > /dev/null 2>&1; then
  sensible-browser "http://localhost:3030" > /dev/null 2>&1 &
fi
