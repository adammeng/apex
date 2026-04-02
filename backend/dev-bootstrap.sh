#!/usr/bin/env bash
# ==============================================================================
# Apex 后端本地一键启动脚本
# 执行顺序：
#   1. 创建/激活 Python venv
#   2. 安装依赖
#   3. 检查 .env 是否存在
#   4. 启动并检查 MySQL / Redis
#   5. alembic upgrade head（建表/迁移）
#   6. 启动 uvicorn
#      → uvicorn 启动时 lifespan 会自动检查 parquet：
#        有文件则跳过，无文件则从 OSS 拉取
# ==============================================================================

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BACKEND_DIR"

# ---------- 颜色输出 ----------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[apex]${NC} $*"; }
warn()  { echo -e "${YELLOW}[apex]${NC} $*"; }
error() { echo -e "${RED}[apex]${NC} $*" >&2; }

# ---------- 1. Python venv ----------
VENV="$BACKEND_DIR/.venv"
if [ ! -d "$VENV" ]; then
  info "创建 Python 虚拟环境..."
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
info "Python: $(python --version)"

# ---------- 2. 安装依赖 ----------
info "安装/更新依赖..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# ---------- 3. 检查 .env ----------
if [ ! -f "$BACKEND_DIR/.env" ]; then
  warn ".env 不存在，从 .env.example 复制..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  warn "请编辑 backend/.env，填入实际配置后重新运行本脚本"
  exit 1
fi
info ".env 就绪"

# ---------- 4. 启动并检查基础服务（MySQL / Redis） ----------
is_local_host() {
  local host=$1
  [ "$host" = "localhost" ] || [ "$host" = "127.0.0.1" ] || [ "$host" = "::1" ]
}

ensure_brew_service() {
  local host=$1 service=$2 label=$3
  if ! is_local_host "$host"; then
    info "${label} 使用远程地址 ${host}，跳过本机服务启动"
    return
  fi

  if ! command -v brew >/dev/null 2>&1; then
    warn "未找到 brew，跳过 ${label} 自动启动"
    return
  fi

  if ! brew list --versions "$service" >/dev/null 2>&1; then
    warn "未安装 Homebrew 服务 ${service}，跳过 ${label} 自动启动"
    return
  fi

  if brew services list 2>/dev/null | grep -q "^${service}.*started"; then
    info "${label} 已启动（Homebrew）"
    return
  fi

  info "启动 ${label}（brew services start ${service}）..."
  brew services start "$service" >/dev/null
}

check_port() {
  local host=$1 port=$2 name=$3
  if ! nc -z "$host" "$port" 2>/dev/null; then
    error "${name} 在 ${host}:${port} 不可达"
    error "请先启动基础服务，例如："
    error "  cd $(dirname "$BACKEND_DIR")/deploy && docker compose up -d mysql redis"
    exit 1
  fi
  info "${name} 连接正常（${host}:${port}）"
}

MYSQL_HOST=$(grep -E '^MYSQL_HOST=' .env | cut -d= -f2 | tr -d '[:space:]' || echo "localhost")
MYSQL_PORT=$(grep -E '^MYSQL_PORT=' .env | cut -d= -f2 | tr -d '[:space:]' || echo "3306")
REDIS_HOST=$(grep -E '^REDIS_URL=' .env | sed 's|.*://\([^:/]*\).*|\1|' || echo "localhost")
REDIS_PORT=$(grep -E '^REDIS_URL=' .env | sed 's|.*:\([0-9]*\)/.*|\1|' || echo "6379")

ensure_brew_service "${MYSQL_HOST:-localhost}" "mysql" "MySQL"
ensure_brew_service "${REDIS_HOST:-localhost}" "redis" "Redis"

check_port "${MYSQL_HOST:-localhost}" "${MYSQL_PORT:-3306}" "MySQL"
check_port "${REDIS_HOST:-localhost}" "${REDIS_PORT:-6379}" "Redis"

# ---------- 5. 数据库迁移 ----------
info "运行 alembic upgrade head..."
alembic upgrade head

# ---------- 6. 启动服务 ----------
# lifespan 启动时自动检查 parquet/：有文件跳过，无文件从 OSS 拉取
info "启动 Apex 后端（parquet 检查由 lifespan 自动处理）..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-dir app
