#!/usr/bin/env bash
# ==============================================================================
# Apex 后端本地一键停止脚本
# 停止内容：
#   - uvicorn（端口 8000 上的 Python 进程）
#   - MySQL（Homebrew 服务）
#   - Redis（Homebrew 服务）
# ==============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[apex]${NC} $*"; }
warn()  { echo -e "${YELLOW}[apex]${NC} $*"; }

# ---------- 停止 uvicorn ----------
UVICORN_PIDS=$(lsof -ti :8000 2>/dev/null || true)
if [ -n "$UVICORN_PIDS" ]; then
  echo "$UVICORN_PIDS" | xargs kill 2>/dev/null && info "uvicorn 已停止" || warn "uvicorn 停止失败"
else
  warn "uvicorn 未运行（端口 8000 空闲）"
fi

# ---------- 停止 MySQL ----------
if brew services list 2>/dev/null | grep -q "^mysql.*started"; then
  brew services stop mysql && info "MySQL 已停止"
else
  warn "MySQL 未运行（Homebrew 服务）"
fi

# ---------- 停止 Redis ----------
if brew services list 2>/dev/null | grep -q "^redis.*started"; then
  brew services stop redis && info "Redis 已停止"
else
  warn "Redis 未运行（Homebrew 服务）"
fi

info "所有服务已停止"
