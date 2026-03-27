# A股市场流动性指数 V5几何平均 - 技术实现文档

> 用于AI理解并复现本图表的完整技术文档

---

## 一、核心算法

### 1.1 计算公式

```
V5_几何平均 = (成交额分位数 × 换手率分位数 × 北向资金分位数)^(1/3)
```

等价于：
```python
v5_geom = exp((log(成交额分位数) + log(换手率分位数) + log(北向资金分位数)) / 3)
```

### 1.2 分位数计算

- **窗口期**：60日滚动计算
- **最小有效天数**：20日（少于20日则返回NaN）
- **计算方式**：当日值在近60日从小到大排序，计算百分位

```python
def calc_percentile(series, window=60, min_periods=20):
    return series.rolling(window, min_periods=min_periods).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, 
        raw=False
    )
```

### 1.3 状态区间

| V5分数 | 状态 | 颜色 |
|--------|------|------|
| < 30 | 🟢 机会区 | 绿色 |
| 30-70 | 🟡 中性区 | 灰色 |
| > 70 | 🔴 风险区 | 红色 |

---

## 二、数据获取

### 2.1 API接口

**基础URL**：`https://www.codebuddy.cn/v2/tool/financedata`

**请求格式**：
```python
import requests

headers = {'Content-Type': 'application/json'}

data = {
    'api_name': 'xxx',
    'params': {...},
    'fields': 'xxx,xxx'
}
resp = requests.post(API_URL, headers=headers, json=data, timeout=30)
result = resp.json()
df = pd.DataFrame(result['data']['items'], columns=result['data']['fields'])
```

### 2.2 四个数据源

| 数据 | api_name | params | fields | 说明 |
|------|----------|--------|--------|------|
| 沪深300 | index_daily | {'ts_code': '000300.SH', 'start_date': '20200101', 'end_date': '20260327'} | trade_date,close | 上证指数 |
| 上海市场 | daily_info | {'ts_code': 'SH_MARKET', 'start_date': '20200101', 'end_date': '20260327'} | trade_date,amount,tr | 成交额(亿)、换手率(%) |
| 深圳市场 | daily_info | {'ts_code': 'SZ_MARKET', 'start_date': '20200101', 'end_date': '20260327'} | trade_date,amount,tr | 成交额(亿)、换手率(%) |
| 北向资金 | moneyflow_hsgt | {'start_date': '20200101', 'end_date': '20260327'} | trade_date,north_money | 北向净流入(万) |

### 2.3 重要注意事项

- **北向资金数据从2024年12月16日才有**，之前都是0或空
- 2025年前因北向数据缺失，V5最高只能到~80分
- 2025年后完整，范围约2~100

---

## 三、数据加工步骤

### 3.1 完整Python代码

```python
import requests
import pandas as pd
import numpy as np

API_URL = 'https://www.codebuddy.cn/v2/tool/financedata'
HEADERS = {'Content-Type': 'application/json'}

def fetch_data(api_name, params, fields):
    data = {'api_name': api_name, 'params': params, 'fields': fields}
    resp = requests.post(API_URL, headers=HEADERS, json=data, timeout=30)
    result = resp.json()
    df = pd.DataFrame(result['data']['items'], columns=result['data']['fields'])
    return df

# ========== Step 1: 获取数据 ==========
# 沪深300
df_hs = fetch_data('index_daily', 
    {'ts_code': '000300.SH', 'start_date': '20200101', 'end_date': '20260327'}, 
    'trade_date,close')
df_hs.columns = ['date', 'close']
df_hs['date'] = pd.to_datetime(df_hs['date'], format='%Y%m%d')

# 上海
df_sh = fetch_data('daily_info', 
    {'ts_code': 'SH_MARKET', 'start_date': '20200101', 'end_date': '20260327'}, 
    'trade_date,amount,tr')
df_sh.columns = ['date', 'amount_sh', 'tr_sh']
df_sh['date'] = pd.to_datetime(df_sh['date'], format='%Y%m%d')

# 深圳
df_sz = fetch_data('daily_info', 
    {'ts_code': 'SZ_MARKET', 'start_date': '20200101', 'end_date': '20260327'}, 
    'trade_date,amount,tr')
df_sz.columns = ['date', 'amount_sz', 'tr_sz']
df_sz['date'] = pd.to_datetime(df_sz['date'], format='%Y%m%d')

# 北向资金
df_north = fetch_data('moneyflow_hsgt', 
    {'start_date': '20200101', 'end_date': '20260327'}, 
    'trade_date,north_money')
df_north.columns = ['date', 'north']
df_north['date'] = pd.to_datetime(df_north['date'], format='%Y%m%d')
df_north['north'] = pd.to_numeric(df_north['north'], errors='coerce')

# ========== Step 2: 合并数据 ==========
df = df_hs.merge(df_sh, on='date', how='outer')
df = df.merge(df_sz, on='date', how='outer')
df = df.merge(df_north, on='date', how='outer')
df = df.sort_values('date').reset_index(drop=True)

# 计算合并指标
df['total_amount'] = pd.to_numeric(df['amount_sh'], errors='coerce').fillna(0) + \
                     pd.to_numeric(df['amount_sz'], errors='coerce').fillna(0)
df['total_tr'] = (pd.to_numeric(df['tr_sh'], errors='coerce').fillna(0) + 
                  pd.to_numeric(df['tr_sz'], errors='coerce').fillna(0)) / 2
df['north'] = df['north'].fillna(0)

# 填充缺失值
df = df.ffill()
df = df.dropna(subset=['close'])

# 转换为数值类型
df['total_amount'] = pd.to_numeric(df['total_amount'], errors='coerce')
df['total_tr'] = pd.to_numeric(df['total_tr'], errors='coerce')
df['north'] = pd.to_numeric(df['north'], errors='coerce')

# ========== Step 3: 计算分位数 ==========
# 成交额分位数（60日）
df['amount_pct'] = df['total_amount'].ffill().rolling(60, min_periods=20).apply(
    lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
)

# 换手率分位数（60日）
df['tr_pct'] = df['total_tr'].ffill().rolling(60, min_periods=20).apply(
    lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
)

# 北向资金分位数（60日）
df['north_pct'] = df['north'].ffill().rolling(60, min_periods=20).apply(
    lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
)

# ========== Step 4: 计算V5几何平均 ==========
df['amount_pct_adj'] = df['amount_pct'].fillna(50).clip(1, 100)
df['tr_pct_adj'] = df['tr_pct'].fillna(50).clip(1, 100)
df['north_pct_adj'] = df['north_pct'].fillna(50).clip(1, 100)

df['v5_geom'] = np.exp(
    (np.log(df['amount_pct_adj']) + 
     np.log(df['tr_pct_adj']) + 
     np.log(df['north_pct_adj'])) / 3
)

# ========== 完成 ==========
print(df[['date', 'close', 'amount_pct', 'tr_pct', 'north_pct', 'v5_geom']].tail())
```

---

## 四、图表制作

### 4.1 分离图表（推荐）

```python
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei']
plt.rcParams['axes.unicode_minus'] = False

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), sharex=True,
                                 gridspec_kw={'height_ratios': [1.2, 1]})

# 上图：沪深300
ax1.plot(df['date'], df['close'], color='#1f77b4', linewidth=1.5, label='沪深300')
ax1.set_ylabel('沪深300指数', fontsize=12)
ax1.set_title('A股市场流动性指数 V5几何平均\n（成交额分位数 × 换手率分位数 × 北向资金分位数）^(1/3）', 
              fontsize=14, fontweight='bold')
ax1.legend(loc='upper left')
ax1.grid(True, alpha=0.3)
ax1.set_xlim(df['date'].min(), df['date'].max())

# 下图：V5几何平均
ax2.plot(df['date'], df['v5_geom'], color='#d62728', linewidth=1.8, label='V5几何平均')
ax2.axhline(70, color='red', linestyle='--', alpha=0.5, linewidth=1, label='风险区70')
ax2.axhline(50, color='gray', linestyle=':', alpha=0.5, linewidth=1, label='中性50')
ax2.axhline(30, color='green', linestyle='--', alpha=0.5, linewidth=1, label='机会区30')
ax2.fill_between(df['date'], 0, 30, alpha=0.15, color='green')
ax2.fill_between(df['date'], 70, 100, alpha=0.15, color='red')
ax2.set_ylabel('V5指数 (1-100分)', fontsize=12)
ax2.set_xlabel('时间', fontsize=12)
ax2.set_title('V5流动性指数（几何平均，三因子等权）\n注：北向资金数据2024-12-16后才有，2025年前最高仅~80', 
              fontsize=11, fontweight='bold')
ax2.legend(loc='upper left', fontsize=9)
ax2.grid(True, alpha=0.3)
ax2.set_ylim(0, 100)
ax2.set_xlim(df['date'].min(), df['date'].max())

# 格式化x轴
ax2.xaxis.set_major_locator(mdates.YearLocator())
ax2.xaxis.set_major_formatter(mdates.DateFormatter('%Y'))

plt.tight_layout()
plt.savefig('liquidity_index_separate.png', dpi=150, bbox_inches='tight')
plt.close()
```

---

## 五、当前数据（2026-03-27）

| 指标 | 数值 |
|------|------|
| 沪深300 | 4502.57 |
| 成交额分位数 | 1.7 |
| 换手率分位数 | 1.7 |
| 北向资金分位数 | 3.3 |
| **V5几何平均** | **2.1** |
| 状态 | 🟢 机会区 |

---

## 六、完整文件位置

如需直接使用，可参考：
- 脚本：`C:\Users\GEORGELI\.workbuddy\skills\a_stock_liquidity_index\scripts\liquidity_index_chart.py`
- 输出图表：`C:\Users\GEORGELI\.workbuddy\skills\a_stock_liquidity_index\liquidity_index_separate.png`
