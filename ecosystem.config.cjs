module.exports = {
  apps: [
    {
      name: 'luosheji-v1',
      script: 'server.ts',
      instances: 'max', // 充分利用阿里云 ECS 的多核 CPU
      exec_mode: 'cluster', // 集群模式
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 自动重启配置
      watch: false,
      max_memory_restart: '1G',
      // 日志配置 (建议对接阿里云 SLS)
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
