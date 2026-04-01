#!/usr/bin/env bash
# ==============================================================================
# Apex 后端本地一键启动脚本
# 执行顺序：
#   1. 创建/激活 Python venv
#   2. 安装依赖
#   3. 检查 .env 是否存在
#   4. 启动 MySQL / Redis（若本地没有，提示用 docker-compose 拉起基础服务）
#   5. 运行 init_data.py（alembic 建表 + parquet 就绪检查）
#   6. 启动 uvicorn
# ==============================================================================

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
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

# ---------- 4. 检查基础服务（MySQL / Redis）----------
check_port() {
  local host=$1 port=$2 name=$3
  if ! nc -z "$host" "$port" 2>/dev/null; then
    error "$name 在 $host:$port 不可达"
    error "请先启动基础服务，例如："
    error "  cd $(dirname "$BACKEND_DIR")/deploy && docker compose up -d mysql redis"
    exit 1
  fi
  info "$name 连接正常（$host:$port）"
}

# 从 .env 读取主机和端口，有默认值
MYSQL_HOST=$(grep -E '^MYSQL_HOST=' .env | cut -d= -f2 | tr -d '[:space:]' || echo "localhost")
MYSQL_PORT=$(grep -E '^MYSQL_PORT=' .env | cut -d= -f2 | tr -d '[:space:]' || echo "3306")
REDIS_HOST=$(grep -E '^REDIS_URL=' .env | sed 's|.*://\([^:/]*\).*|\1|' || echo "localhost")
REDIS_PORT=$(grep -E '^REDIS_URL=' .env | sed 's|.*:\([0-9]*\)/.*|\1|' || echo "6379")

check_port "${MYSQL_HOST:-localhost}" "${MYSQL_PORT:-3306}" "MySQL"
check_port "${REDIS_HOST:-localhost}" "${REDIS_PORT:-6379}" "Redis"

# ---------- 5. 初始化（alembic + parquet）----------
info "运行数据初始化..."
python -m scripts.init_data

# ---------- 6. 启动服务 ----------
info "启动 Apex 后端..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-dir app
