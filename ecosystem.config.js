// PM2 配置文件：让机器人在服务器后台常驻运行、崩溃自动重启、开机自启
module.exports = {
  apps: [
    {
      name: 'musicbot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M', // 内存超过 400M 自动重启，防止小内存 VPS 被拖死
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
