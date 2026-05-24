# 部署到 `www.shiqianyan.cn`

以下步骤按 Ubuntu 服务器示例，日期基准为 2026-03-16。

## 1. DNS 解析

在域名服务商后台添加：

- 主机记录：`www`
- 记录类型：`A`
- 记录值：你的服务器公网 IP

## 2. 上传代码并启动 Node 服务

```bash
cd /var/www
mkdir -p shiqianyan-blog
# 上传本项目文件到 /var/www/shiqianyan-blog
cd shiqianyan-blog
npm run start -- --port=3000
```

建议用 PM2 托管：

```bash
npm i -g pm2
cd /var/www/shiqianyan-blog
pm2 start npm --name shiqianyan-blog -- run start -- --port=3000
pm2 save
pm2 startup
```

## 3. 配置 Nginx 反向代理

安装 Nginx 后，新建站点配置：

```nginx
server {
    listen 80;
    server_name www.shiqianyan.cn;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

启用并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 配置 HTTPS（Let's Encrypt）

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d www.shiqianyan.cn
```

证书续期测试：

```bash
sudo certbot renew --dry-run
```

## 5. 更新发布

```bash
cd /var/www/shiqianyan-blog
# 上传新文件后
pm2 restart shiqianyan-blog
```
