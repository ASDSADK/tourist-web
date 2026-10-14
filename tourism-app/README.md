# 张家界智慧游览：本地演示版

Vue 3 + TypeScript + ECharts 前端，Fastify 后端，UE 5.8 C++ 模拟上报。所有数据均标注为演示。

后续已按用户要求将仓库根目录网页替换为新版静态演示构建。旧网页保存在 Git 历史中。GitHub Pages 构建使用 npm run build:pages 和 .env.pages，明确显示“网页模拟演示 · 未连接 UE”，不请求本地后端。普通 dev/build 仍为 UE 数据接入模式。

## 运行准备

需要 Node.js 22.12 或更新版本。首次安装仅在本目录执行 `npm install`，不需要全局安装，不需要云服务器。安装会创建本地 node_modules 和 package-lock.json。

复制 `.env.example` 为 `.env`，将 `INGEST_TOKEN` 换成至少 16 字符的私有演示口令。UE 配置同一口令。不要提交 `.env` 或 UE 私有配置。

分别在两个终端切换到本目录运行：

```powershell
npm run server
```

```powershell
npm run dev
```

访问 Vite 输出的本地 URL，默认 http://127.0.0.1:5173 。前端代理 `/api` 到 http://127.0.0.1:3001 。修改 PORT 后也需同步修改 vite.config.ts 中的代理。

未启动 UE 时，页面等待上报，不会自动生成客流。如需先检查网页，可在第三个终端运行 `npm run simulate`。本地模拟器和 UE 不能同时作为同一景区的生产者，同日数据源冲突会被拒绝。切换来源时，先停后端与生产者，将 data/state.json 另存为备份，再重启后端。不要直接删除记录。

默认只监听本机，不支持互联网上的网友访问。两台电脑或外网演示需另行配置监听地址、网络访问和部署；当前未开放端口或发布网站。

可用环境变量 DATA_DIRECTORY 指定独立的本地数据目录，以隔离网页预览、接口验证和 UE 数据。验证脚本 server/verify-http.mjs 固定连接 127.0.0.1:3002；执行前需单独启动使用专用数据目录的演示后端，不能对正常服务直接运行。

## 无服务器的存储选择

本地演示默认把最近七天的采集点保存到被 Git 忽略的 data/state.json，避免为演示安装数据库服务。它是单进程存储，不能多个后端共用文件。

方案 B 的 PostgreSQL 接口已经预留：如已有专用演示数据库，手动执行 server/schema.sql，并设置 DATABASE_URL 后重启。数据库模式保存同样的快照和有限历史，当前不自动迁移数据库，也不支持多个后端并发写同一景区。PostgreSQL 连接尚需实际环境验证。资讯、天气、预约余量目前均来自明确标注的固定演示样例，不是持久化业务管理系统。

## UE 5.8 C++ 接入

1. 将 ue/ 下两个文件加入自己的游戏模块 Source/<Module>/。本仓库没有 UE 工程，未修改你的游戏项目。
2. 在模块的 Build.cs 中给 PrivateDependencyModuleNames 增加 `HTTP`、`Json`；Core、CoreUObject、Engine 应已在游戏模块中。不要重复添加。
3. 在私有配置中设置以下节，模块名替换为实际模块名，并填写本地口令。不要把口令提交到仓库。

```ini
[/Script/YourGameModule.TourismTelemetrySubsystem]
bEnabled=True
ServiceUrl=http://127.0.0.1:3001
IngestToken=your-private-demo-token-at-least-16-characters
```

4. 先启动后端和网页，再启动 UE PIE。GameInstanceSubsystem 自动恢复当天累计值，之后每五秒模拟并上报一次。网页应显示“UE 5.8 模拟”。
5. 停止 PIE 后超过 30 秒，网页应显示数据已过期，保留最后采集时间和数值；曲线在未采集区间不补造历史。

示例仅用于单个 UE 实例。初次同步失败需要启动服务后重启 PIE；持续断网超过两分钟可能使待重试载荷过期，恢复网络后检查日志并重启 PIE。跨日按北京时间处理，演示假设每天零点在园人数归零，不适用于夜间开放景区。UE 设备时间须与后端相差不超过两分钟。

当前 UE 文件属于接入示例，尚未在实际 UE 工程编译或联调。也未使用蓝图插件、Remote Control、MCP 或 Pixel Streaming。

## 预约入口

在 `.env` 设置实际小程序提供的 HTTPS URL Link：`BOOKING_URL=https://...`，然后重启后端并刷新页面。未配置时按钮显示“待配置”。不要填普通网页地址冒充小程序链接；真实链接有效期和跳转效果需要在目标手机验证。当前只提供统一预约通道，不承诺按景点直接跳转。

预约余量在 server/index.mjs 的演示样例中配置，当前只展示“今日”，不提交订单。天气与资讯同样是演示样例，资讯支持展开详情，不虚构实时发布时间。

## 数据接口与统计口径

- `GET /api/dashboard`：最近快照、今日五分钟曲线、数据过期状态。
- `GET /api/content`：演示天气、景点余量、资讯、小程序入口。
- `GET /api/events`：SSE 初始完整快照和后续更新，每十秒同步过期状态，重连后再次发送完整快照。
- `POST /api/ingest`：仅持有 Bearer 口令的景区端可上报。

```json
{
  "parkId": "zhangjiajie-demo",
  "sessionId": "unique-producer-session",
  "sequence": 1,
  "sampledAt": "2026-10-14T08:00:00Z",
  "source": "ue-simulation",
  "enteredToday": 120,
  "exitedToday": 20,
  "occupancy": 100
}
```

source 只允许 ue-simulation 或 local-simulation，sampledAt 必须使用当前实际时间并包含时区。日累计进出为人次，在园估计为进出净额。非去重人数。后端检查整数、非负、平衡关系、时间偏差、同日累计不倒退、同会话序号和采集时间不倒退。全量累计快照重复提交不会重复计数。

图表首个区间无基准，不显示入出差值；缺失五分钟区间不插值，连续采集点才计算累计差值。在园估计按最新采集值显示。容量 30000 是演示参数，不是官方核定值，舒适度阈值也只是示例。

## 验证

```powershell
npm test
npm run build
```

核心单元测试无需安装依赖，也可直接执行 `node --test server/core.test.mjs`。前端类型检查、构建、后端 HTTP/SSE 联调与浏览器检查需要先安装依赖。UE 编译需另在 UE 工程中完成。
