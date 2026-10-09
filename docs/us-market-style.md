# 美股市场风格

## 模块入口

左侧导航「美股市场风格」，路径 `/market/us-style`。前后端均沿用现有登录权限。
VOO（标普500）为唯一基准，VYM、VIG、VGT、SCHD（股息权益）、QQQM、SMH（半导体）为比较标的。

## 计算口径

- RPS = 标的复权收盘价 / VOO 复权收盘价。
- MA50 = RPS 的 50 个共同交易日简单均线。
- Score = (RPS / MA50 - 1) * 100%，不是百分位排名。
- 5 日变化 = 今日 Score - 5 个共同交易日前 Score，单位为百分点。
- 变化 > 0.10 pp 为走强，< -0.10 pp 为走弱，其余平稳；仅为展示阈值。
- 20 日相对收益 = (今日 RPS / 20 个共同交易日前 RPS - 1) * 100%。

使用 Yahoo Finance 最近五年的含分红、拆股调整美元收盘价，统一纽约交易日，
排除当天可能未完成的行情，不填补缺失价格，不使用 QQQ 拼接 QQQM。
七只 ETF（基准加六只比较标的）最新日期必须一致，最近 252 个交易日不得存在相互缺失，
快照超过 7 个自然日拒绝发布。数据源失败时任务失败，不覆盖旧快照。

## 历史动量百分位与冷热区域

默认进入「历史动量百分位（多标的比较）」视图，比较每只 ETF 相对自身历史的极端程度，
不是 ETF 之间排名。每个交易日只使用该 ETF 此前五个日历年内的有效 Score，
排除当天及未来数据；至少有 252 个此前有效 Score 才画线，未达条件的日期不填值。
百分位 = 100 ×（小于当前 Score 的样本数 + 0.5 × 等于当前 Score 的样本数）/ 样本数。
相同值取中间排名；全部相同为 50，超过所有历史值为 100，低于所有历史值为 0。
纵轴统一 0–100，橙色过热区 >=90，蓝色过冷区 <=10，中间不染色。
计算先使用完整历史，再裁剪显示范围；开关其他标的不影响任何标的的百分位。
现有快照最多包含五年价格，因此初期预热后线较短，界面明确注明「可用历史」。

原始 Score 多标的视图取消统一冷热背景。仅选一只标的时，
使用其最新交易日前五年可用 Score 的线性插值 P10/P90 作为背景边界，
同样至少需要 252 个有效样本；不要求边界跨越零轴。
单标的底色使用当前时点阈值，不能解释成历史时点可得的交易信号或用于回测。
百分位高不意味着 Score 为正，百分位上升不意味着价格上涨；
进入冷热区不意味着趋势必然反转。本次视图调整不需要新增 SQL。
切换 VOO 基准需要执行 `0022_us_market_style_voo.sql` 并重新发布完整六标的快照。
历史 RPS、MA50、Score、5日变化、20日相对收益及百分位全部按 VOO 重算，
不拼接旧 SCHD 基准曲线。读接口与页面拒绝旧口径快照；发布保留 previous_payload。

## 线上启用步骤

1. 在现有 Supabase 项目的 SQL Editor 中执行 `supabase/migrations/0020_us_market_style.sql`。
   仅新增 `us_market_style_snapshot` 表和 `publish_us_market_style` 函数，不修改现有模块。
   文件可重复执行。Trae 授权按钮不可用时无需反复点击，可直接在控制台执行。
   接着执行 `supabase/migrations/0022_us_market_style_voo.sql`，将发布函数改为 VOO 基准及六只标的校验。
   已执行过 0020（无论是否执行 0021）的项目仅需执行 0022。
   0022 完整替换发布函数，不必再执行 0021；不要在 0022 后运行旧版 0020/0021。
2. 将本次代码发布到 GitHub 默认分支及现有前后端部署环境。
3. GitHub Actions Secrets 复用 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
   后端读取需要 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 或 service role key。
   service role key 只用于服务器和 Actions，不写入前端或仓库。
4. 在 Actions 手动运行 `Refresh US Market Style`，检查任务摘要的发布交易日。
5. 打开 `/market/us-style` 核对数据日期与动量表。

计划任务 UTC 周二至周六 06:35，覆盖前一纽约交易日收盘后时段。
该任务独立运行，不依赖 A 股 LowVol/RPS 的更新。GitHub 定时任务可能延迟，
且须在默认分支启用；长期无提交的公共仓库可能被 GitHub 自动暂停定时任务。
Yahoo 属于非保证可用的数据源，403/429 时应查看失败日志，而不是用未复权价格替代。

## 本地验证

```powershell
npm run test:us-market-style
npm run check
npm run refresh:supabase:us-market-style -- --dry-run
```

Windows 本地 Node 请求被拒绝时，可以用系统网络取得相同数据源的响应：

```powershell
.\server\scripts\fetchUsYahoo.ps1 -OutputDirectory tmp
npm run refresh:supabase:us-market-style -- --input-dir tmp --dry-run
```

确认数据库迁移成功且后端凭据已配置后，去掉 `--dry-run` 发布到 Supabase。
导入响应仍经过标的、复权字段、日期和覆盖率检查，不接受未复权替代数据。
`*.local.json` 是本地缓存，不提交。

## 数据发布与核实

快照使用单行 JSON 原子更新，保留上一版 `previous_payload`。
发布函数只允许 service role 调用，并拒绝旧日期或同日更早的获取版本覆盖新版本。
读接口为 `/api/us-market-style/panel`，无实时行情请求；读取失败和过期状态在页面明确提示。

```sql
select data_date, fetched_at,
       jsonb_array_length(payload->'items') as target_count
from public.us_market_style_snapshot
where id = 'default';
```
