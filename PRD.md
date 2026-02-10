# ETF 监测系统（Top100 异动监测）PRD

版本：v1.0

日期：2026-02-09

状态：已上线（本地可运行）

## 1. 背景与问题

ETF 的成交额在短期内的异常放大/缩小，常被用作市场情绪与资金关注度的“粗粒度信号”。日常盯盘/复盘时，用户希望：

- 快速找到“当日成交额异常”的 ETF（而不是逐只翻看）
- 明确该异常基于“完整交易日”而非盘中噪声
- 当数据缺失/失败时，不输出任何推测值

本项目提供一个 Top100 看板，将“最新完整交易日”的 ETF 以成交额降序筛选并计算异动指标，帮助用户进行初筛与进一步点击查看。

## 2. 目标与非目标

### 2.1 目标

- 提供 Top100 ETF 列表页，基于“最新完整交易日”按成交额降序展示
- 提供关键字筛选与表格排序，支持快速定位目标 ETF
- 提供异常解释入口（数据与方法页），明确口径、阈值与免责声明
- 提供手动“重新获取”能力，并用估算进度条缓解长耗时刷新等待
- 对缺失/失败数据明确标记，不展示推测值

### 2.2 非目标（当前版本不做）

- 不提供交易建议/信号推送/自动下单
- 不提供用户体系与权限控制（鉴权接口仅占位）
- 不做跨市场/跨品种（如美股 ETF、期权等）
- 不保证数据源长期稳定（依赖第三方数据源）

## 3. 用户与使用场景

### 3.1 目标用户

- 个人投资者：需要快速找到成交额“异常”的 ETF 做复盘/盯盘参考
- 研究/量化入门用户：希望拿到透明、可追溯的指标定义与数据口径

### 3.2 核心场景

- 场景 A：每日收盘后查看最新完整交易日 Top100 成交额与异动指标
- 场景 B：输入 ETF 代码/名称快速筛到目标，查看其异动与 Z 值分级
- 场景 C：数据源偶发失败/变慢时，手动刷新并看到“正在重新获取 + 进度估算”

## 4. 产品范围（页面与功能）

### 4.1 Top100 列表页（`/`）

**模块**

- 顶部导航：Top100 / 数据与方法；右侧展示“数据交易日/最近拉取时间”
- 操作：关键字搜索（代码/名称）、重置、重新获取
- 状态条：加载中/失败/成功（包含“数据不完整条数”提示）
- 表格：Top100 列表 + 排序 + 点击“查看”打开详情页

**交互与规则**

- 默认排序：按成交额降序
- 筛选：按“代码/名称”关键字对已拉取数据进行本地过滤
- 排序：对已拉取数据进行本地排序（空值置后）
- 列展示：
  - 成交量（份）、成交额（元）
  - 涨跌%（1 日成交额变化）、过去 7 日均%
  - 90 日 Z 值分级标签
- 数值颜色：涨跌% 与 过去 7 日均% 采用“上涨红色、下跌绿色、0 为灰色”
- 缺失/失败：字段为 null 时展示 `—`，并标记 `dataStatus` 为非 complete

**重新获取（强制刷新）**

- 用户点击“重新获取”后触发强制刷新（绕过缓存）
- 展示“估算进度条”：以 180s 作为参考时长按线性方式估算百分比
  - 进度在请求结束前最多到 99%
  - 请求完成后短暂显示 100% 并自动收起

### 4.2 ETF 详情页（`/etf/:code`）

**目标**：承接列表页点击，展示单只 ETF 的基础信息与后续扩展的占位模块。

- 展示：代码、最新完整交易日、90 日 Z 值
- 提供返回入口：回到 Top100，并保留列表页 query（如 `q/sort/dir`）

### 4.3 数据与方法页（`/methodology`）

**目标**：透明说明数据口径、指标定义与风险提示。

- 说明“仅展示完整交易日数据”
- 说明“缺失/失败不补全、不杜撰”
- 说明 Z 值含义与阈值分级（如 1.65/1.96/2.58）
- 免责声明

## 5. 数据口径与算法定义

### 5.1 数据源

- 运行形态：本系统通过 **AkShare（Python 库）** 发起数据请求，但**底层数据源为新浪（Sina）**。
- 具体链路（当前实现）：
  - Top100 列表：`ak.fund_etf_category_sina(symbol="ETF基金")`
  - 历史日线：`ak.fund_etf_hist_sina(symbol=...)`
  - 因此可以更准确地表述为：**“AkShare 获取的新浪数据（akshare:sina）”**，而不是 AkShare 自有数据源。
- 返回 meta：
  - `meta.dataDate`：本次 Top100 对齐的“最新完整交易日”
  - `meta.fetchedAt`：本次接口响应生成时间

### 5.2 Top100 的选取标准（核心口径）

1. 从“全市场 ETF 列表”获取 ETF 标的集合
2. 按规则排除不在范围内的 ETF（见 5.3）
3. 对剩余每只 ETF 拉取历史日线并计算当日指标
4. 取所有返回中最大的 `latestTradingDate` 作为“最新完整交易日”（对齐口径）
5. 仅保留该交易日的数据，按当日成交额 `turnover` 降序，取前 N（默认 100）

### 5.3 排除规则（过滤范围）

- 代码前缀排除：`16*`、`50*`
- 名称包含 `LOF` 排除
- 货币/债券类排除：
  - 代码前缀 `511*` / `551*`
  - 或名称包含关键词：`货币/现金/理财/短融/日利/添益/债`

说明：宽基指数 ETF（如沪深300ETF）属于保留范围。

### 5.4 字段与计算公式

- `turnover`：当日成交额（元）
- `volume`：当日成交量（份，若数据源提供）
- `turnoverChangePct1d`：`(turnover / prev_turnover - 1) * 100`
- `turnoverChangePct7dAvg`：`(turnover / avg(turnover[t-7..t-1]) - 1) * 100`
- `z90`：对过去 90 个交易日成交额（不含当日）求均值与标准差：
  - `z90 = (turnover - mean90) / std90`
- `dataStatus`：当 `turnover` 与 `z90` 均可计算时为 `complete`，否则为 `incomplete`

## 6. 接口定义（对外契约）

### 6.1 健康检查

- `GET /api/health`
- 响应：`{ success: true, message: "ok", serverBootId, serverStartedAt }`

说明：

- `serverBootId`：服务进程启动时生成的唯一标识（用于前端判断“后端是否重启”）
- `serverStartedAt`：服务进程启动时间（ISO 字符串）

### 6.2 Top100

- `GET /api/etf/top100`
- Query：
  - `limit`：1~200，默认 100
  - `refresh=1&_t=<timestamp>`：强制刷新，绕过缓存
  - `ensureLatest=1`：校验“是否已有最新完整交易日数据”，若缓存已是最新则秒级返回，否则触发全量重算
- 成功响应：
  - `success: true`
  - `meta: { fetchedAt, dataDate, source?, notes? }`
  - `data: EtfTopRow[]`
- 失败响应：`{ success:false, error, message }`

**HTTP 状态码约定（当前实现）**

- 成功：`200`
- AkShare 返回“未检测到”类消息：`501`
- 其余 AkShare / Python / 网络错误：`502`

### 6.3 详情

- `GET /api/etf/detail/:code`
- 响应：`{ success:true, meta:{...}, data:{ code, name?, latestTradingDate?, z90? } }`

## 7. 缓存与刷新策略

### 7.1 默认缓存

- Node 内存缓存（Top100 默认 10 分钟）用于降低频繁请求成本
- Python 磁盘缓存：缓存最近一次计算后的“最新交易日 Top 排序列表”，用于提升二次访问速度

### 7.1.1 用户心智（仅两种模式）

对用户而言只有两种行为：

- **用缓存（快）**：直接返回上一次计算结果
- **重新获取（准）**：确保结果对应“最新完整交易日”，必要时触发全量重算

系统会在不同场景下选择其中一种模式。

### 7.1.2 触发规则（页面行为 → 请求模式）

- **用户刷新页面/重复进入页面（后端未重启）**：走“用缓存（快）”
  - 请求不带 `ensureLatest=1` / `refresh=1`
  - 目标：秒级响应、降低数据源压力
- **服务重启后的首次进入页面**：走“重新获取（准）”
  - 请求带 `ensureLatest=1`
  - 行为：先校验缓存是否为最新完整交易日；若不是，则触发全量重算并阻塞等待完成
- **用户点击右上角“重新获取”按钮**：走“重新获取（准）”
  - 请求带 `refresh=1&_t=<timestamp>`
  - 行为：无条件绕过缓存并全量重算

### 7.2 强制刷新

- 前端携带 `refresh=1&_t=`
- 后端绕过 Node 内存缓存
- Python 绕过磁盘缓存并重新全量计算

### 7.3 ensureLatest（校验最新而非无条件重算）

- 前端携带 `ensureLatest=1`
- 后端绕过 Node 内存缓存
- Python 命中磁盘缓存时，会先用“哨兵 ETF”校验缓存 `dataDate` 是否为最新完整交易日：
  - 若缓存已是最新：直接返回缓存（秒级）
  - 若缓存不是最新：触发全量重算并覆盖缓存（可能耗时较久）

## 8. 可用性与异常处理

- 不杜撰规则：
  - 当接口失败：页面显示“数据获取失败”，不展示任何推测值
  - 当字段缺失：展示 `—`，并将条目标记为数据不完整
- 提示策略：
  - 加载中：显示状态条与骨架屏
  - 强制刷新：显示“180s 参考进度条”
  - 错误态：提供“重试”

## 9. 非功能需求（NFR）

### 9.1 性能

- Top100 强制全量刷新可能耗时 1~3 分钟（取决于数据源与机器性能）
- 常规访问应通过缓存达到秒级响应

### 9.2 可靠性

- 数据源失败/超时必须可观测并可重试
- 后端对失败做短暂负缓存，避免请求风暴

### 9.3 安全与合规

- 当前版本为只读公开接口（无鉴权/无用户态）
- 需在页面与方法说明中明确免责声明：数据仅供学习研究，不构成投资建议

## 10. 里程碑与演进方向（可选）

- 详情页扩展：加入分时/日线图、持仓结构、相关标的对比
- 数据持久化：将每日 Top100 落库以便历史回看与对比
- 任务调度：收盘后定时刷新、支持订阅通知
- 安全增强：限流、鉴权、审计日志

## 11. 关键配置（运行约束）

- 依赖本机 Python 3，并安装 `api/python/requirements.txt`
- 可通过 `AKSHARE_PYTHON_BIN` 指定 Python 路径
- 可通过 `AKSHARE_PROC_WORKERS` 调整历史抓取并发（默认 6，上限 12）

## 12. 复现指南（确保可 100% 复现）

本章用于让“拿到此文档的任意工程团队/AI 工具”在不依赖额外口头信息的情况下，完整复现当前项目（功能、接口、数据口径、刷新与缓存策略）。

### 12.1 运行环境

- 操作系统：Windows / macOS / Linux 均可（本文档示例命令以 Windows PowerShell + 通用命令为主）
- Node.js：建议 `>=18`（Vite 6 推荐）
- Python：必须 `>=3.10`（建议 3.12）

### 12.1.1 技术栈与版本（以本仓库为准）

- 前端：React `18.3.1` + React Router `7.3.0` + Vite `6.3.5` + TailwindCSS `3.4.17`
- 后端：Express `4.21.2` + tsx `4.20.3` + nodemon `3.1.10`
- 数据：Python + AkShare（`akshare>=1.12.0`）调用新浪（Sina）接口

说明：精确依赖以 `package.json` 与 `api/python/requirements.txt` 为最终事实来源。

### 12.2 依赖安装

在项目根目录执行：

```bash
npm install
```

安装 Python 依赖：

```bash
python -m pip install -r api/python/requirements.txt
```

### 12.3 环境变量（必须/可选）

**必须**

- `AKSHARE_PYTHON_BIN`：指定 Python 可执行文件路径（当系统 `python` 命令不可用时必须设置）
  - 示例（Windows）：`C:/Users/xxx/AppData/Local/Programs/Python/Python312/python.exe`

**可选（建议写入 .env 或系统环境变量）**

- `PORT`：后端端口（默认 `3001`）
- `AKSHARE_PROC_WORKERS`：Top100 全量历史抓取进程数（默认 `6`，强制约束范围 `1~12`）
- `AKSHARE_RETRIES`：单个 ETF 历史拉取重试次数（默认 `3`）
- `AKSHARE_RETRY_SLEEP_SEC`：重试退避基准秒数（默认 `0.6`，实际 sleep 为 `base*(i+1)`）
- `AKSHARE_DISK_CACHE_MAX`：Python 磁盘缓存保存的排序行数上限（默认 `200`，范围 `1~500`）
- `AKSHARE_CLEAR_PROXY=1`：后端执行 Python 时清空代理环境变量（HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY）

说明：后端也支持 `PYTHON_BIN` 作为 `AKSHARE_PYTHON_BIN` 的备选。

### 12.4 本地启动

```bash
npm run dev
```

该命令等价于并行启动：

- `npm run client:dev`（Vite dev server）
- `npm run server:dev`（nodemon + tsx 启动 `api/server.ts`）

启动后地址：

- 前端：`http://localhost:5173/`
- 后端：`http://localhost:3001/api/health`

### 12.5 自检清单（按顺序）

1. 健康检查

```bash
curl http://localhost:3001/api/health
```

2. 拉取 Top100（默认缓存命中时秒级返回）

```bash
curl "http://localhost:3001/api/etf/top100?limit=30"
```

3. 强制刷新 Top100（全量重算，可能耗时 1~3 分钟）

```bash
curl "http://localhost:3001/api/etf/top100?limit=30&refresh=1&_t=$(date +%s)"
```

4. 详情页接口

```bash
curl "http://localhost:3001/api/etf/detail/510300"
```

### 12.6 常见问题排查

- 浏览器一直显示“正在通过 API 获取数据…”
  - 确认后端 `http://localhost:3001/api/health` 可访问
  - 确认前端代理正常：`http://localhost:5173/api/health`
- Top100 返回 `akshare_error`
  - 检查 Python 是否可执行（Windows 注意“应用执行别名”导致 `python` 指向商店）
  - 检查是否安装 `api/python/requirements.txt`
- 强制刷新非常慢
  - 属于预期：全市场逐只拉取历史日线；可降低 `AKSHARE_PROC_WORKERS` 或等待数据源恢复

## 13. 仓库结构（关键文件与职责）

### 13.1 前端（`src/`）

- 路由入口：`src/App.tsx`
- Top100 页面：`src/pages/Home.tsx`
  - 拉取 `GET /api/etf/top100`
  - “重新获取”强制刷新：追加 `refresh=1&_t=`
  - 180s 估算进度条（仅 UX，不代表后端真实进度）
- 详情页：`src/pages/EtfDetail.tsx`
- 方法说明页：`src/pages/Methodology.tsx`
- 顶部导航与刷新按钮：`src/components/NavBar.tsx`
- 状态条/进度条/错误态：`src/components/DataStatusBanner.tsx`
- 表格与排序：`src/components/Top100Table.tsx`、`src/components/SortableTh.tsx`
- Z 值标签：`src/components/ZBadge.tsx`
- API 类型与 fetch：`src/utils/etfApi.ts`
- 格式化工具：`src/utils/format.ts`

### 13.2 后端（`api/`）

- Express 应用：`api/app.ts`
- 本地开发启动：`api/server.ts`（`PORT` 默认 3001）
- Vercel 入口：`api/index.ts`
- ETF 路由：`api/routes/etf.ts`
  - `GET /api/etf/top100`
  - `GET /api/etf/detail/:code`
  - `refresh=1` 时透传 `--refresh` 给 Python 并绕过 Node 缓存
- AkShare 执行器：`api/lib/akshare.ts`
  - Node 内存缓存：默认 `ttl=120s`，Top100 路由设置为 10 分钟
  - 失败短缓存 5 秒
  - `execFile` 调用 Python 脚本并解析 JSON

### 13.3 Python 数据服务（`api/python/`）

- 主脚本：`api/python/akshare_service.py`
  - 子命令：`top100`、`detail`
  - 数据源：AkShare 调用新浪接口（Sina）
  - Top100 全市场算法、过滤规则、指标计算
  - 磁盘缓存：`api/python/.cache/top100_latest.json`
- 依赖：`api/python/requirements.txt`

## 14. 关键实现规格（用于复刻一致行为）

### 14.1 前端到后端代理

- Vite dev server 将 `/api` 代理到 `http://localhost:3001`
- 因此前端代码一律请求相对路径（如 `/api/etf/top100`），无需区分环境

### 14.2 Top100 强制刷新与缓存一致性

为确保“重新获取”一定会重新跑数据链路，系统做了两层绕过：

1. 前端：点击“重新获取”时追加 `refresh=1&_t=<timestamp>`
2. Node：当检测到 `refresh=1` 或 `_t` 非空
   - `runAkshare` 的 `cacheTtlMs` 设为 0
   - `cacheKey` 强制包含 refresh token，避免命中旧值
   - 调用 Python 时追加 `--refresh`
3. Python：当 `--refresh` 为 true
   - 不读取 `api/python/.cache/top100_latest.json`
   - 全量重算后覆盖写入磁盘缓存

### 14.2.2 ensureLatest（校验最新而非强制重算）

为解决“全量重算太慢导致首屏长时间加载”的问题，系统提供 `ensureLatest=1`：

- 前端首屏/服务重启后的首次进入，会优先调用 `GET /api/etf/top100?ensureLatest=1`
- 后端会透传给 Python：`--ensure-latest`
- Python 命中磁盘缓存时会做一次“哨兵 ETF 交易日校验”（默认使用 510300，可用环境变量 `AKSHARE_LATEST_DATE_SYMBOL` 调整）
  - 若哨兵的最新交易日与缓存 `dataDate` 一致：直接返回缓存（秒级）
  - 若不一致：触发全量重算并覆盖缓存

对比：

- `refresh=1`：无条件全量重算（最慢但最“强制”）
- `ensureLatest=1`：通常秒级返回，仅在确实跨交易日后才重算（推荐作为首屏策略）

### 14.2.1 服务重启后的自动强制刷新

为确保“服务重启后用户首次打开页面”能拿到最新数据，前端在首次进入 Top100 页时会：

1. 调用 `GET /api/health` 读取 `serverBootId`
2. 将 `serverBootId` 与浏览器 `localStorage` 中记录的上一次 `serverBootId` 对比
3. 若检测到变化（后端已重启），则自动执行一次“强制刷新 Top100”（等价于用户点击“重新获取”）

同时为了避免同一浏览器在短时间内多标签页并发触发重算，采用 `localStorage` 追加 240s 的锁（按 bootId 维度）。

### 14.3 “最新完整交易日”对齐

Top100 的交易日口径不是“现在时间”，而是：

- 对每只 ETF 拉取新浪历史日线，取最后一条日线的 `date` 为 `latestTradingDate`
- 在全市场结果中取 `latestTradingDate` 的最大值作为 `meta.dataDate`
- 仅保留 `latestTradingDate == meta.dataDate` 的 ETF 进入排序

这样可以避免不同 ETF 停牌/缺失导致混入非同一交易日的数据。

### 14.4 排除规则（必须保持一致）

候选 ETF 过滤为：

- 排除代码前缀：`16*`、`50*`
- 排除名称包含：`LOF`（不区分大小写）
- 排除货币/债券类：
  - 代码前缀 `511*` / `551*`
  - 或名称包含任一关键词：`货币/现金/理财/短融/日利/添益/债`

### 14.5 指标计算精确定义

所有计算均基于“新浪历史日线”序列（按日期升序），用最后一条日线作为“当日”。

- 当日成交额：`turnover = amount[-1]`
- 上一交易日成交额：`prev_turnover = amount[-2]`（若不存在则为 null）
- 1 日变化：当 `turnover` 与 `prev_turnover` 均存在且 `prev_turnover!=0`：
  - `turnoverChangePct1d = (turnover / prev_turnover - 1) * 100`
- 7 日均变化：当至少有 8 条数据：
  - 取窗口 `amount[-8:-1]`（恰好 7 条）求均值 `avg7`
  - `turnoverChangePct7dAvg = (turnover / avg7 - 1) * 100`
- 90 日 Z 值：当至少有 91 条数据：
  - 取窗口 `amount[-91:-1]`（恰好 90 条）
  - `mean = sum(hist)/90`
  - `var = sum((x-mean)^2)/90`（总体方差）
  - `std = sqrt(var)`
  - `z90 = (turnover - mean)/std`（std 为 0 则为 null）
- 数据完整性：`dataStatus = "complete"` 当且仅当 `turnover != null` 且 `z90 != null`

### 14.6 UI 关键表现（需要一致）

- 加载态：顶部状态条显示“正在通过 API 获取数据…”；表格骨架屏
- 强制刷新态：顶部状态条显示“正在重新获取数据… XX%（参考 180s）”并渲染进度条
- 错误态：显示“数据获取失败”与“重试”按钮，并提示“不展示任何推测值”
- 涨跌颜色：
  - `>0`：红色
  - `<0`：绿色
  - `=0`：灰色
- “最近拉取”显示到秒（避免分钟级误判未刷新）

## 15. 部署说明（重要约束）

仓库提供 Vercel serverless 入口（`api/index.ts` + `vercel.json`），但当前后端强依赖：

- 可执行的本地 Python
- 多进程历史拉取

因此如需云部署，必须保证目标平台支持上述能力（或改造成远程数据服务/任务队列），否则无法 100% 复现本地行为。

