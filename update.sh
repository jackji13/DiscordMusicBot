#!/usr/bin/env bash
# ============================================================
# 更新脚本：每次在本地 push 代码到 GitHub 后，
# 在服务器上运行此脚本即可拉取最新代码并重启机器人。
#   bash update.sh
# ============================================================
set -e

echo "==> 拉取最新代码..."
git pull

echo "==> 安装/更新依赖..."
npm install

echo "==> 重启机器人..."
pm2 restart musicbot

echo "✅ 更新完成！用 pm2 logs musicbot 查看运行状态。"
