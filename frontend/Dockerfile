FROM node:20-alpine AS build

WORKDIR /app

# 使用淘宝 npm 镜像源加速依赖安装
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# 限制 Node 堆内存，防止低配服务器构建时 OOM 假死
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm run build:docker

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

