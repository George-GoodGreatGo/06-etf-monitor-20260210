# Tasks
- [x] Task 1: 梳理当前 build 中的 chunk size warning 来源
  - [x] SubTask 1.1: 记录当前 `npm run build` 产生 warning 的 chunk 与体积
  - [x] SubTask 1.2: 识别哪些页面路由和依赖被同步打入主包
  - [x] SubTask 1.3: 确认适合优先拆分的页面模块与公共依赖

- [x] Task 2: 为页面路由引入按需加载
  - [x] SubTask 2.1: 将页面组件改为懒加载引入
  - [x] SubTask 2.2: 为路由懒加载补充必要的加载兜底
  - [x] SubTask 2.3: 保证登录守卫、开发页入口和现有路径不回退

- [x] Task 3: 在 Vite 中增加稳定的手动分包策略
  - [x] SubTask 3.1: 为体积较大的公共依赖或高成本模块配置 `manualChunks`
  - [x] SubTask 3.2: 保持分包配置可读且避免过度碎片化
  - [x] SubTask 3.3: 不以单纯提高 warning 阈值代替真实优化

- [x] Task 4: 验证构建告警消失且运行行为正常
  - [x] SubTask 4.1: 运行 `npm run build` 并确认 chunk size warning 消失
  - [x] SubTask 4.2: 运行类型检查或等价验证，确认未引入新的明显错误
  - [x] SubTask 4.3: 验证路由加载和主要页面访问未发生明显回退

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
