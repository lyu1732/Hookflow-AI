#!/bin/zsh
cd "$(dirname "$0")"

RUNTIME_BIN="/Users/lvxinzhi/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin"
RUNTIME_NODE="/Users/lvxinzhi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"

if [ -d "$RUNTIME_NODE" ]; then
  export PATH="$RUNTIME_NODE:$RUNTIME_BIN:$PATH"
fi

echo "HookFlow AI 正在启动..."
echo "项目目录：$(pwd)"

if [ ! -f "node_modules/next/dist/bin/next" ]; then
  echo "正在安装依赖..."
  pnpm install
fi

if [ ! -f ".next/BUILD_ID" ]; then
  echo "正在构建项目..."
  pnpm build
fi

echo ""
echo "启动完成后，请打开：http://localhost:3000"
echo "如果要停止服务，请回到这个窗口按 Control + C"
echo ""

pnpm dev
