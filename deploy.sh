#!/usr/bin/env bash
# ============================================================
# RackNerd / 任意 Ubuntu 服务器 一键部署脚本
# 用法：在服务器上第一次部署时运行一次即可
#   bash deploy.sh
# ============================================================
set -e

echo "==> 1/5 更新系统并安装基础工具..."
sudo apt-get update -y
sudo apt-get install -y git curl ffmpeg

echo "==> 2/5 安装 Node.js 20 (LTS)..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node 版本: $(node -v)"

echo "==> 3/5 安装 PM2（进程守护，让机器人常驻后台）..."
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "==> 4/5 安装项目依赖..."
npm install

echo "==> 5/5 启动机器人..."
if [ ! -f .env ]; then
  echo "!! 没有找到 .env 文件，请先创建 .env 并填入 DISCORD_TOKEN 再运行本脚本。"
  echo "   可执行：cp env.example .env  然后编辑 .env"
  exit 1
fi

pm2 start ecosystem.config.js
pm2 save
# 配置开机自启（会打印一条 sudo 命令，按提示复制执行一次）
pm2 startup

echo ""
echo "✅ 部署完成！常用命令："
echo "   pm2 logs musicbot     # 查看日志"
echo "   pm2 restart musicbot  # 重启"
echo "   pm2 stop musicbot     # 停止"
