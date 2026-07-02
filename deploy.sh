#!/bin/bash

# ==========================================
# 阿里云部署脚本 (示例)
# 用于构建 Docker 镜像并推送到阿里云 ACR
# ==========================================

# --- 配置变量 ---
# 阿里云 ACR 实例地址 (如: registry.cn-hangzhou.aliyuncs.com)
ACR_REGISTRY="registry.cn-hangzhou.aliyuncs.com"
# 阿里云 ACR 命名空间 (Namespace)
ACR_NAMESPACE="your_namespace"
# 阿里云 ACR 仓库名称 (Repo)
ACR_REPO="luosheji-v1"
# 镜像标签 (Tag)
IMAGE_TAG=$(date +%Y%m%d%H%M%S)

# --- 1. 构建前端和后端 ---
echo ">>> [1/3] 构建应用产物..."
npm install
npm run build

# --- 2. 构建 Docker 镜像 ---
echo ">>> [2/3] 构建 Docker 镜像..."
docker build -t ${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}:${IMAGE_TAG} .
docker tag ${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}:${IMAGE_TAG} ${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}:latest

# --- 3. 推送到阿里云 ACR ---
# 注意: 运行此脚本前需先执行 docker login ${ACR_REGISTRY}
echo ">>> [3/3] 推送镜像到阿里云 ACR..."
docker push ${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}:${IMAGE_TAG}
docker push ${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}:latest

echo ">>> 部署准备就绪！镜像地址:"
echo "${ACR_REGISTRY}/${ACR_NAMESPACE}/${ACR_REPO}:${IMAGE_TAG}"
