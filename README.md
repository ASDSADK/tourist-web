# 张家界智慧游览 · UE 数字孪生演示

面向游客的 Vue 3 + TypeScript + ECharts 网页，配套 Node.js/Fastify 数据服务及 UE 5.8 C++ 接入示例。

## 网页地址

https://asdsadk.github.io/tourist-web/

仓库根目录 index.html 和 assets/ 是新版静态构建，替换旧网页。GitHub Pages 版明确标注“网页模拟演示 · 未连接 UE”：客流由浏览器生成，天气、预约余量和资讯为演示样例；不依赖服务器，不宣称已接入景区设备。

## 本地 UE 数据互通模式

源码和服务在 tourism-app/，需要 Node.js 22.12 或更新版本。

```powershell
cd tourism-app
npm ci
```

复制 .env.example 为 .env，填写至少 16 字符的私有 INGEST_TOKEN，然后分别在两个终端运行：

```powershell
npm run server
npm run dev
```

打开 http://127.0.0.1:5173/ 。本地模式等待 UE 上报，不会在断线时自动切换为浏览器模拟。可手动运行 npm run simulate 检查链路，停止后网页标记数据过期。

UE C++ 示例在 tourism-app/ue/；具体配置、预约小程序入口及存储选项见[接入说明](tourism-app/README.md)。未配置小程序地址时入口显示待配置。

## 更新 GitHub Pages 版

修改 Vue 源码后运行：

```powershell
cd tourism-app
npm run build:pages
```

该命令进行类型检查，以 .env.pages 的显式静态演示模式构建，再更新根目录 index.html、assets/ 和 .nojekyll；然后提交并推送这些文件。已有 Pages 若使用 master 分支根目录发布，可继续使用同一设置。普通 npm run build 保持本地后端接入模式。

## 验证与边界

npm test 验证客流统计核心；npm run build 验证前端类型与构建。[本地验证记录](tourism-app/VALIDATION.md)列出已验证项和限制。

UE 示例尚需在实际工程编译联调。GitHub Pages 不运行后端；远程游客要查看景区端持续上报的数据，需要部署可访问的数据服务。目前不包含在线下单、支付、真实天气或资讯管理后台。

.env、运行数据和 node_modules 不提交。旧页面可从 Git 历史恢复。
