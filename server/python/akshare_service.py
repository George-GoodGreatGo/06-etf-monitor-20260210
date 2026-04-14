import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _cache_dir():
    return os.path.join(os.path.dirname(__file__), ".cache")


def _cache_path(filename: str):
    return os.path.join(_cache_dir(), filename)


def _read_json_file(p: str):
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _write_json_file(p: str, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)


def _write_json_file_atomic(p: str, obj):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = f"{p}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, p)


def _progress_update(progress_file: str | None, obj: dict):
    if not progress_file:
        return
    try:
        _write_json_file_atomic(progress_file, obj)
    except Exception:
        return


def _ua_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://quote.eastmoney.com/",
        "Accept": "application/json, text/plain, */*",
    }


def _clean_text(s: str) -> str:
    return "".join(ch for ch in (s or "") if ord(ch) >= 32)


def _is_money_or_bond_etf(code: str, name: str) -> bool:
    c = (code or "").strip()
    n = (name or "").strip()

    if "现金流" in n or "自由现金流" in n:
        return False

    if c.startswith(("511", "551")):
        return True

    money_keywords = [
        "货币",
        "理财",
        "短融",
        "日利",
        "添益",
        "现金管理",
        "现金宝",
        "现金增利",
        "现金收益",
    ]
    if any(k in n for k in money_keywords):
        return True

    bond_keywords = [
        "债券",
        "国债",
        "信用债",
        "利率债",
        "可转债",
        "转债",
        "短债",
        "中短债",
        "政金债",
        "地方债",
        "国开债",
        "城投债",
    ]
    return any(k in n for k in bond_keywords)


def _sina_symbol_from_code(code: str) -> str:
    c = str(code).strip()
    if c.startswith("sh") or c.startswith("sz"):
        return c
    if len(c) != 6 or not c.isdigit():
        return c
    if c.startswith(("5", "6", "9")):
        return f"sh{c}"
    return f"sz{c}"


def _hist_sina(symbol: str):
    import akshare as ak

    retries = int(os.environ.get("AKSHARE_RETRIES", "3") or "3")
    base_sleep = float(os.environ.get("AKSHARE_RETRY_SLEEP_SEC", "0.6") or "0.6")
    last_err = None

    for i in range(max(1, retries)):
        try:
            df = ak.fund_etf_hist_sina(symbol=symbol)
            if df is None or df.empty:
                return None
            return df
        except Exception as e:
            last_err = e
            time.sleep(base_sleep * (i + 1))

    raise last_err


def _latest_trade_date_sina(code_or_symbol: str) -> str | None:
    sym = _sina_symbol_from_code(code_or_symbol)
    df = _hist_sina(sym)
    if df is None or df.empty:
        return None
    if "date" not in df.columns:
        return None
    try:
        df2 = df.copy()
        df2["date"] = df2["date"].apply(_fmt_ymd)
        df2 = df2.sort_values(by="date")
        return str(df2.iloc[-1]["date"])
    except Exception:
        return None


def _extract_metrics_sina(df):
    if df is None or df.empty:
        return None

    if "date" not in df.columns:
        return None
    if "amount" not in df.columns:
        return None

    df2 = df.copy()
    df2["date"] = df2["date"].apply(_fmt_ymd)
    df2 = df2.sort_values(by="date")

    trade_date = str(df2.iloc[-1]["date"])
    turnover = _to_float(df2.iloc[-1]["amount"])
    volume = _to_int(df2.iloc[-1]["volume"]) if "volume" in df2.columns else None

    prev_turnover = None
    if len(df2) >= 2:
        prev_turnover = _to_float(df2.iloc[-2]["amount"])

    change_1d = None
    if turnover is not None and prev_turnover is not None and prev_turnover != 0:
        change_1d = (turnover / prev_turnover - 1.0) * 100.0

    change_7avg = None
    if len(df2) >= 8:
        window = df2.iloc[-8:-1]["amount"].apply(_to_float).tolist()
        window = [v for v in window if v is not None]
        if len(window) == 7:
            avg7 = sum(window) / 7.0
            if avg7 != 0 and turnover is not None:
                change_7avg = (turnover / avg7 - 1.0) * 100.0

    z90 = None
    if len(df2) >= 91:
        hist = df2.iloc[-91:-1]["amount"].apply(_to_float).tolist()
        hist = [v for v in hist if v is not None]
        if len(hist) == 90 and turnover is not None:
            mean = sum(hist) / 90.0
            var = sum((x - mean) ** 2 for x in hist) / 90.0
            std = math.sqrt(var)
            if std != 0:
                z90 = (turnover - mean) / std

    data_status = "complete" if (turnover is not None and z90 is not None) else "incomplete"

    return {
        "latestTradingDate": trade_date,
        "volume": volume,
        "turnover": turnover,
        "turnoverChangePct1d": change_1d,
        "turnoverChangePct7dAvg": change_7avg,
        "z90": z90,
        "dataStatus": data_status,
    }


def _top100_worker(item):
    symbol, code, name = item
    df = _hist_sina(symbol)
    m = _extract_metrics_sina(df)
    if not m:
        return None
    return {
        "code": code,
        "name": name or code,
        "latestTradingDate": m["latestTradingDate"],
        "volume": m["volume"],
        "turnover": m["turnover"],
        "turnoverChangePct1d": m["turnoverChangePct1d"],
        "turnoverChangePct7dAvg": m["turnoverChangePct7dAvg"],
        "z90": m["z90"],
        "dataStatus": m["dataStatus"],
    }


def _hist_daily_custom(symbol: str, start_date: str, end_date: str, fqt: int = 0):
    import requests

    url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    params = {
        "fields1": "f1,f2,f3,f4,f5,f6",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116",
        "ut": "7eea3edcaed734bea9cbfc24409ed989",
        "klt": "101",
        "fqt": str(int(fqt)),
        "beg": start_date,
        "end": end_date,
    }

    session = requests.Session()
    session.trust_env = False

    def fetch(secid: str):
        r = session.get(
            url,
            params={**params, "secid": secid},
            headers=_ua_headers(),
            timeout=20,
        )
        r.raise_for_status()
        return r.json()

    data_json = None
    for market_id in (1, 0):
        try:
            data_json = fetch(f"{market_id}.{symbol}")
            if data_json.get("data") and data_json["data"].get("klines"):
                break
        except Exception:
            continue

    if not (data_json and data_json.get("data") and data_json["data"].get("klines")):
        return None

    import pandas as pd

    temp_df = pd.DataFrame([item.split(",") for item in data_json["data"]["klines"]])
    temp_df.columns = [
        "日期",
        "开盘",
        "收盘",
        "最高",
        "最低",
        "成交量",
        "成交额",
        "振幅",
        "涨跌幅",
        "涨跌额",
        "换手率",
    ]
    temp_df["开盘"] = pd.to_numeric(temp_df["开盘"], errors="coerce")
    temp_df["收盘"] = pd.to_numeric(temp_df["收盘"], errors="coerce")
    temp_df["最高"] = pd.to_numeric(temp_df["最高"], errors="coerce")
    temp_df["最低"] = pd.to_numeric(temp_df["最低"], errors="coerce")
    temp_df["成交量"] = pd.to_numeric(temp_df["成交量"], errors="coerce")
    temp_df["成交额"] = pd.to_numeric(temp_df["成交额"], errors="coerce")
    return temp_df


def _ok(meta, data):
    return {"success": True, "meta": meta, "data": data}


def _err(error: str, message: str):
    return {"success": False, "error": error, "message": message}


def _to_float(v):
    try:
        if v is None:
            return None
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return float(v)
    except Exception:
        return None


def _to_int(v):
    try:
        if v is None:
            return None
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return int(v)
    except Exception:
        return None


def _fmt_ymd(dt) -> str:
    if hasattr(dt, "strftime"):
        return dt.strftime("%Y-%m-%d")
    s = str(dt)
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    if len(s) == 8 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    return s


def _cn_now():
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("Asia/Shanghai"))
    except Exception:
        return datetime.now()


def _last_complete_trade_date() -> str:
    import akshare as ak

    df = ak.tool_trade_date_hist_sina()
    if df is None or df.empty:
        raise RuntimeError("无法获取交易日历")
    if "trade_date" in df.columns:
        dates = df["trade_date"].tolist()
    else:
        dates = df.iloc[:, 0].tolist()
    dates = [d for d in dates if d is not None]
    if not dates:
        raise RuntimeError("交易日历为空")

    now = _cn_now()
    today = now.strftime("%Y-%m-%d")
    after_close = (now.hour > 15) or (now.hour == 15 and now.minute >= 20)

    ymd = [_fmt_ymd(d) for d in dates]
    ymd.sort()
    if after_close and ymd[-1] == today:
        return ymd[-1]
    candidates = [d for d in ymd if d < today]
    if not candidates:
        return ymd[-1]
    return candidates[-1]


def _spot_top_codes(limit: int):
    import akshare as ak

    try:
        df = ak.fund_etf_spot_em()
    except Exception:
        df = None
    if df is None or df.empty:
        return None

    def pick(col_names):
        for c in col_names:
            if c in df.columns:
                return c
        return None

    code_col = pick(["代码", "基金代码", "symbol", "code"])
    name_col = pick(["名称", "基金简称", "name"])
    amt_col = pick(["成交额", "amount", "成交额(元)"])
    vol_col = pick(["成交量", "volume"])
    if code_col is None:
        raise RuntimeError("ETF 实时列表缺少代码字段")
    if name_col is None:
        name_col = code_col
    if amt_col is None:
        amt_col = None
    if vol_col is None:
        vol_col = None

    if amt_col is not None:
        df2 = df.copy()
        df2[amt_col] = df2[amt_col].apply(_to_float)
        df2 = df2.sort_values(by=amt_col, ascending=False, na_position="last")
    else:
        df2 = df

    out = []
    for _, r in df2.head(limit).iterrows():
        out.append(
            {
                "code": str(r[code_col]).strip(),
                "name": str(r[name_col]).strip(),
                "spot_turnover": _to_float(r[amt_col]) if amt_col else None,
                "spot_volume": _to_int(r[vol_col]) if vol_col else None,
            }
        )
    return out


def _universe_ths():
    import akshare as ak

    df = ak.fund_etf_spot_ths()
    if df is None or df.empty:
        raise RuntimeError("无法获取 ETF 列表（THS）")

    code_col = "基金代码" if "基金代码" in df.columns else df.columns[1]
    name_col = "基金名称" if "基金名称" in df.columns else df.columns[2]

    out = []
    for _, r in df.iterrows():
        code = str(r[code_col]).strip()
        if not code.isdigit():
            continue
        if len(code) != 6:
            continue
        out.append({"code": code, "name": str(r[name_col]).strip()})
    if not out:
        raise RuntimeError("ETF 列表（THS）为空")
    return out


def _hist_daily(code: str, start_date: str, end_date: str):
    retries = int(os.environ.get("AKSHARE_RETRIES", "3") or "3")
    base_sleep = float(os.environ.get("AKSHARE_RETRY_SLEEP_SEC", "0.6") or "0.6")
    last_err = None

    for i in range(max(1, retries)):
        try:
            df = _hist_daily_custom(code, start_date, end_date)
            if df is None or df.empty:
                return None
            return df
        except Exception as e:
            last_err = e
            time.sleep(base_sleep * (i + 1))

    raise last_err


def _trade_date_compact(trade_date: str) -> str:
    return trade_date.replace("-", "")


def _compact_days_before(trade_date: str, days: int) -> str:
    from datetime import timedelta

    base = datetime.strptime(trade_date, "%Y-%m-%d")
    return (base - timedelta(days=days)).strftime("%Y%m%d")


def _turnover_on_date(code: str, trade_date_ymd: str):
    try:
        df = _hist_daily(code, trade_date_ymd, trade_date_ymd)
    except Exception:
        return None
    if df is None or df.empty:
        return None
    if "成交额" not in df.columns:
        return None
    row = df.iloc[-1]
    return {
        "turnover": _to_float(row.get("成交额")),
        "volume": _to_int(row.get("成交量")) if "成交量" in df.columns else None,
    }


def _extract_metrics(df, trade_date: str):
    if df is None or df.empty:
        return None
    if "日期" not in df.columns:
        return None
    df2 = df.copy()
    df2["日期"] = df2["日期"].apply(_fmt_ymd)
    df2 = df2.sort_values(by="日期")
    rows = df2[df2["日期"] == trade_date]
    if rows.empty:
        return None

    idx = rows.index[-1]
    pos = list(df2.index).index(idx)

    def get_col(cn):
        return cn if cn in df2.columns else None

    vol_col = get_col("成交量")
    amt_col = get_col("成交额")
    if amt_col is None:
        return None

    turnover = _to_float(df2.iloc[pos][amt_col])
    volume = _to_int(df2.iloc[pos][vol_col]) if vol_col else None

    prev_turnover = None
    if pos - 1 >= 0:
        prev_turnover = _to_float(df2.iloc[pos - 1][amt_col])

    change_1d = None
    if turnover is not None and prev_turnover is not None and prev_turnover != 0:
        change_1d = (turnover / prev_turnover - 1.0) * 100.0

    change_7avg = None
    if pos - 7 >= 0:
        window = df2.iloc[pos - 7 : pos][amt_col].apply(_to_float).tolist()
        window = [v for v in window if v is not None]
        if len(window) == 7:
            avg7 = sum(window) / 7.0
            if avg7 != 0 and turnover is not None:
                change_7avg = (turnover / avg7 - 1.0) * 100.0

    z90 = None
    if pos - 90 >= 0:
        hist = df2.iloc[pos - 90 : pos][amt_col].apply(_to_float).tolist()
        hist = [v for v in hist if v is not None]
        if len(hist) == 90 and turnover is not None:
            mean = sum(hist) / 90.0
            var = sum((x - mean) ** 2 for x in hist) / 90.0
            std = math.sqrt(var)
            if std != 0:
                z90 = (turnover - mean) / std

    data_status = "complete" if (turnover is not None and z90 is not None) else "incomplete"

    return {
        "latestTradingDate": trade_date,
        "volume": volume,
        "turnover": turnover,
        "turnoverChangePct1d": change_1d,
        "turnoverChangePct7dAvg": change_7avg,
        "z90": z90,
        "dataStatus": data_status,
    }


def top100(
    limit: int,
    refresh: bool = False,
    ensure_latest: bool = False,
    progress_file: str | None = None,
):
    fetched_at = _iso_now()
    import akshare as ak

    _progress_update(
        progress_file,
        {
            "ts": fetched_at,
            "stage": "start",
            "message": "准备中",
        },
    )

    cache_file = _cache_path("top100_latest.json")

    if not refresh:
        cached = _read_json_file(cache_file)
        if isinstance(cached, dict):
            cached_date = cached.get("dataDate")
            cached_rows = cached.get("rows")
            if isinstance(cached_date, str) and isinstance(cached_rows, list) and cached_rows:
                if ensure_latest:
                    sentinel = os.environ.get("AKSHARE_LATEST_DATE_SYMBOL", "510300") or "510300"
                    _progress_update(
                        progress_file,
                        {
                            "ts": _iso_now(),
                            "stage": "ensure_latest",
                            "message": f"校验最新交易日（哨兵：{sentinel}）",
                        },
                    )
                    latest = _latest_trade_date_sina(sentinel)
                    if latest and latest != cached_date:
                        _progress_update(
                            progress_file,
                            {
                                "ts": _iso_now(),
                                "stage": "recompute_needed",
                                "message": f"缓存交易日 {cached_date} 非最新（最新 {latest}），开始全量重算",
                            },
                        )
                    else:
                        meta = {
                            "fetchedAt": fetched_at,
                            "dataDate": cached_date,
                            "source": "akshare:sina",
                            "notes": [
                                "Top100 先取新浪 ETF 全市场列表（排除 LOF/货币/债券等），再基于 Sina 历史日线计算最新完整交易日的成交额并降序取前 N。",
                                "成交额与 Z 值基于 Sina 历史日线（天然为完整交易日）；宽基指数 ETF（如沪深300ETF）包含在内。",
                            ],
                        }
                        return _ok(meta, cached_rows[:limit])
                else:
                    meta = {
                        "fetchedAt": fetched_at,
                        "dataDate": cached_date,
                        "source": "akshare:sina",
                        "notes": [
                            "Top100 先取新浪 ETF 全市场列表（排除 LOF/货币/债券等），再基于 Sina 历史日线计算最新完整交易日的成交额并降序取前 N。",
                            "成交额与 Z 值基于 Sina 历史日线（天然为完整交易日）；宽基指数 ETF（如沪深300ETF）包含在内。",
                        ],
                    }
                    return _ok(meta, cached_rows[:limit])

        if not ensure_latest:
            _progress_update(
                progress_file,
                {
                    "ts": _iso_now(),
                    "stage": "cache_miss",
                    "message": "未命中本地缓存",
                },
            )
            return _err("cache_miss", "未命中本地缓存，请点击“重新获取”")

    spot_df = ak.fund_etf_category_sina(symbol="ETF基金")
    if spot_df is None or spot_df.empty:
        raise RuntimeError("无法获取 ETF 实时列表（Sina）")

    _progress_update(
        progress_file,
        {
            "ts": _iso_now(),
            "stage": "spot_loaded",
            "message": "已获取 ETF 列表",
            "total": int(len(spot_df.index)),
        },
    )

    code_col = "代码" if "代码" in spot_df.columns else spot_df.columns[0]
    name_col = "名称" if "名称" in spot_df.columns else spot_df.columns[1]
    amt_col = "成交额" if "成交额" in spot_df.columns else None

    df2 = spot_df.copy()

    candidates = []
    for _, r in df2.iterrows():
        sym = str(r[code_col]).strip()
        if not sym:
            continue
        name = _clean_text(str(r[name_col]).strip())
        code = sym[-6:]
        if code.startswith(("16", "50")):
            continue
        if "LOF" in name.upper():
            continue
        if _is_money_or_bond_etf(code, name):
            continue
        candidates.append({"symbol": sym, "code": code, "name": name})

    _progress_update(
        progress_file,
        {
            "ts": _iso_now(),
            "stage": "filtered",
            "message": "已完成过滤，准备并发拉取历史数据",
            "total": int(len(candidates)),
        },
    )

    proc_workers = int(os.environ.get("AKSHARE_PROC_WORKERS", "6") or "6")
    proc_workers = max(1, min(12, proc_workers))

    jobs = [(c["symbol"], c["code"], c["name"]) for c in candidates]
    rows = []
    with ProcessPoolExecutor(max_workers=proc_workers) as ex:
        futures = [ex.submit(_top100_worker, item) for item in jobs]
        total_jobs = len(futures)
        done_cnt = 0
        last_emit = time.time()
        _progress_update(
            progress_file,
            {
                "ts": _iso_now(),
                "stage": "hist_fetch",
                "message": f"并发拉取历史数据（进程数：{proc_workers}）",
                "done": 0,
                "total": int(total_jobs),
            },
        )
        for f in as_completed(futures):
            try:
                row = f.result()
                if row:
                    rows.append(row)
            except Exception:
                continue

            done_cnt += 1
            now_ts = time.time()
            if done_cnt == total_jobs or (done_cnt % 30 == 0) or (now_ts - last_emit >= 1.0):
                last_emit = now_ts
                _progress_update(
                    progress_file,
                    {
                        "ts": _iso_now(),
                        "stage": "hist_fetch",
                        "message": "正在拉取历史数据",
                        "done": int(done_cnt),
                        "total": int(total_jobs),
                    },
                )

    if not rows:
        raise RuntimeError("无法从 Sina 获取任何 ETF 历史成交额数据")

    trade_date = max(r["latestTradingDate"] for r in rows if r.get("latestTradingDate"))

    _progress_update(
        progress_file,
        {
            "ts": _iso_now(),
            "stage": "ranking",
            "message": "正在筛选同一交易日并排序",
        },
    )
    rows = [r for r in rows if r.get("latestTradingDate") == trade_date]
    rows.sort(key=lambda r: (r["turnover"] is None, -(r["turnover"] or 0.0)))
    ranked = rows
    rows = ranked[:limit]

    cache_max = int(os.environ.get("AKSHARE_DISK_CACHE_MAX", "200") or "200")
    cache_max = max(1, min(500, cache_max))
    _write_json_file_atomic(
        cache_file,
        {
            "cachedAt": fetched_at,
            "dataDate": trade_date,
            "rows": ranked[:cache_max],
        },
    )

    _progress_update(
        progress_file,
        {
            "ts": _iso_now(),
            "stage": "done",
            "message": "完成",
            "dataDate": trade_date,
        },
    )
    meta = {
        "fetchedAt": fetched_at,
        "dataDate": trade_date,
        "source": "akshare:sina",
        "notes": [
            "Top100 先取新浪 ETF 全市场列表（排除 LOF/货币/债券等），再基于 Sina 历史日线计算最新完整交易日的成交额并降序取前 N。",
            "成交额与 Z 值基于 Sina 历史日线（天然为完整交易日）；宽基指数 ETF（如沪深300ETF）包含在内。",
        ],
    }
    return _ok(meta, rows)


def detail(code: str):
    fetched_at = _iso_now()
    sym = _sina_symbol_from_code(code)
    df = _hist_sina(sym)
    m = _extract_metrics_sina(df)
    if not m:
        meta = {"fetchedAt": fetched_at, "dataDate": None, "source": "akshare:sina"}
        return _ok(meta, {"code": code, "name": None, "latestTradingDate": None, "z90": None})

    meta = {"fetchedAt": fetched_at, "dataDate": m["latestTradingDate"], "source": "akshare:sina"}
    return _ok(
        meta,
        {
            "code": code,
            "name": None,
            "latestTradingDate": m["latestTradingDate"],
            "z90": m["z90"],
        },
    )


def _epoch_ms_utc(ymd: str) -> int:
    dt = datetime.strptime(ymd, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def _fqt_from_adjust(adjust: str) -> int:
    a = str(adjust or "").strip().lower()
    if a == "qfq":
        return 1
    if a == "hfq":
        return 2
    return 0


def weekly_chart(code: str, adjust: str):
    fetched_at = _iso_now()
    c = str(code or "").strip()
    a = str(adjust or "").strip().lower() or "qfq"

    if not c:
        return _err("bad_request", "缺少 code")
    if a not in ("qfq", "hfq", "none"):
        return _err("bad_request", "adjust 仅支持 qfq/hfq/none")

    cache_key = "".join(ch for ch in c if ch.isdigit())
    if not cache_key:
        cache_key = c.replace("/", "_").replace("\\", "_").replace("..", "_")
    cache_file = _cache_path(f"weekly_chart_{cache_key}_{a}.json")

    cached = _read_json_file(cache_file)
    if isinstance(cached, dict):
        cached_date = cached.get("dataDate")
        cached_series = cached.get("series")
        cached_at = cached.get("cachedAt")
        cached_partial = cached.get("isPartialWeek")
        if (
            isinstance(cached_date, str)
            and isinstance(cached_at, str)
            and isinstance(cached_series, dict)
            and isinstance(cached_partial, bool)
        ):
            latest = _latest_trade_date_sina(c)
            if latest and latest == cached_date:
                meta = {
                    "fetchedAt": fetched_at,
                    "snapshotAt": fetched_at,
                    "cachedAt": cached_at,
                    "dataDate": cached_date,
                    "code": c,
                    "adjust": a,
                    "freq": "W",
                    "isPartialWeek": cached_partial,
                    "source": "eastmoney:kline",
                }
                return _ok(meta, {"series": cached_series})

    import pandas as pd
    import numpy as np

    end = _cn_now().strftime("%Y%m%d")
    df = _hist_daily_custom(c, "20100101", end, _fqt_from_adjust(a))
    if df is None or df.empty:
        return _err("akshare_error", "无法获取历史日线数据")

    if "日期" not in df.columns:
        return _err("akshare_error", "历史日线缺少 日期 字段")

    df2 = df.copy()
    df2["日期"] = df2["日期"].apply(_fmt_ymd)
    df2["dt"] = pd.to_datetime(df2["日期"], errors="coerce")
    df2 = df2.dropna(subset=["dt"])
    df2 = df2.sort_values(by="dt")

    close_col = "收盘" if "收盘" in df2.columns else None
    vol_col = "成交量" if "成交量" in df2.columns else None
    if close_col is None or vol_col is None:
        return _err("akshare_error", "历史日线缺少 收盘/成交量 字段")

    df2[close_col] = pd.to_numeric(df2[close_col], errors="coerce")
    df2[vol_col] = pd.to_numeric(df2[vol_col], errors="coerce")

    df2["period"] = df2["dt"].dt.to_period("W-FRI")

    def agg_week(x):
        x2 = x.sort_values(by="dt")
        last = x2.iloc[-1]
        d = last["dt"]
        close_v = float(last[close_col]) if pd.notna(last[close_col]) else np.nan
        vol_v = float(x2[vol_col].sum()) if vol_col in x2.columns else np.nan
        return pd.Series({"date": d.strftime("%Y-%m-%d"), "close": close_v, "volume": vol_v})

    wk = df2.groupby("period", sort=True).apply(agg_week).reset_index(drop=True)
    wk = wk.dropna(subset=["date"])
    if wk.empty:
        return _err("akshare_error", "周线聚合结果为空")

    data_date = str(df2.iloc[-1]["日期"])
    last_dt = df2.iloc[-1]["dt"]
    is_partial = int(last_dt.weekday()) != 4

    close = pd.to_numeric(wk["close"], errors="coerce")
    ema20 = close.ewm(span=20, adjust=False).mean()
    sma60 = close.rolling(window=60, min_periods=60).mean()

    diff = close.diff()
    gain = diff.clip(lower=0)
    loss = (-diff).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / 14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi_raw = 100.0 - (100.0 / (1.0 + rs))
    rsi = np.where(
        (avg_gain == 0) & (avg_loss == 0),
        50.0,
        np.where(avg_loss == 0, 100.0, np.where(avg_gain == 0, 0.0, rsi_raw)),
    )
    rsi = pd.Series(rsi, index=wk.index)

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal_line

    price_series = []
    ema20_series = []
    sma60_series = []
    volume_series = []
    rsi14_series = []
    macd_series = []
    signal_series = []
    hist_series = []

    prev_close = None
    for i, row in wk.iterrows():
        d = str(row["date"])
        t = _epoch_ms_utc(d)

        c_val = float(close.iloc[i]) if pd.notna(close.iloc[i]) else None
        if c_val is not None:
            price_series.append({"time": t, "value": c_val})

        e20 = float(ema20.iloc[i]) if pd.notna(ema20.iloc[i]) else None
        if e20 is not None:
            ema20_series.append({"time": t, "value": e20})

        s60 = float(sma60.iloc[i]) if pd.notna(sma60.iloc[i]) else None
        if s60 is not None:
            sma60_series.append({"time": t, "value": s60})

        vol_v = float(row["volume"]) if pd.notna(row["volume"]) else None
        if vol_v is not None:
            color = "#A9B6CC"
            if prev_close is not None and c_val is not None:
                if c_val > prev_close:
                    color = "#EF4444"
                elif c_val < prev_close:
                    color = "#10B981"
            volume_series.append({"time": t, "value": int(vol_v), "color": color})

        r14 = float(rsi.iloc[i]) if pd.notna(rsi.iloc[i]) else None
        if r14 is not None:
            rsi14_series.append({"time": t, "value": r14})

        m_val = float(macd_line.iloc[i]) if pd.notna(macd_line.iloc[i]) else None
        if m_val is not None:
            macd_series.append({"time": t, "value": m_val})

        s_val = float(signal_line.iloc[i]) if pd.notna(signal_line.iloc[i]) else None
        if s_val is not None:
            signal_series.append({"time": t, "value": s_val})

        h_val = float(hist.iloc[i]) if pd.notna(hist.iloc[i]) else None
        if h_val is not None:
            h_color = "#A9B6CC"
            if h_val > 0:
                h_color = "#EF4444"
            elif h_val < 0:
                h_color = "#10B981"
            hist_series.append({"time": t, "value": h_val, "color": h_color})

        if c_val is not None:
            prev_close = c_val

    series = {
        "price": price_series,
        "ema20": ema20_series,
        "sma60": sma60_series,
        "volume": volume_series,
        "rsi14": rsi14_series,
        "macd": {"macd": macd_series, "signal": signal_series, "hist": hist_series},
    }

    _write_json_file_atomic(
        cache_file,
        {
            "cachedAt": fetched_at,
            "dataDate": data_date,
            "code": c,
            "adjust": a,
            "freq": "W",
            "isPartialWeek": bool(is_partial),
            "series": series,
        },
    )

    meta = {
        "fetchedAt": fetched_at,
        "snapshotAt": fetched_at,
        "dataDate": data_date,
        "code": c,
        "adjust": a,
        "freq": "W",
        "isPartialWeek": bool(is_partial),
        "source": "eastmoney:kline",
    }
    return _ok(meta, {"series": series})


def _pick_col(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    return None


def _to_records_trade_date(df, date_candidates, field_map):
    if df is None or df.empty:
        return []
    date_col = _pick_col(df, date_candidates)
    if not date_col:
        return []
    d2 = df.copy()
    d2[date_col] = d2[date_col].apply(_fmt_ymd)
    out = []
    for _, r in d2.iterrows():
        d = str(r.get(date_col) or "").strip()
        if not d:
            continue
        item = {"trade_date": d}
        for k, cand in field_map.items():
            col = _pick_col(d2, cand)
            if not col:
                item[k] = None
                continue
            item[k] = _to_float(r.get(col))
        out.append(item)
    return out


def market_board_daily(start_date: str, end_date: str):
    fetched_at = _iso_now()
    import akshare as ak

    hs300 = []
    for getter in [
        lambda: ak.index_zh_a_hist(symbol="000300", period="daily", start_date=start_date, end_date=end_date),
        lambda: ak.stock_zh_index_daily_em(symbol="sh000300"),
    ]:
        try:
            df = getter()
            hs300 = _to_records_trade_date(
                df,
                ["日期", "date", "交易日期"],
                {"close": ["收盘", "close"]},
            )
            if hs300:
                break
        except Exception:
            continue

    sh = []
    for getter in [
        lambda: ak.index_zh_a_hist(symbol="000001", period="daily", start_date=start_date, end_date=end_date),
        lambda: ak.stock_zh_index_daily_em(symbol="sh000001"),
    ]:
        try:
            df = getter()
            sh = _to_records_trade_date(
                df,
                ["日期", "date", "交易日期"],
                {"amount": ["成交额", "amount"], "tr": ["换手率", "turnover_rate"]},
            )
            if sh:
                break
        except Exception:
            continue

    sz = []
    for getter in [
        lambda: ak.index_zh_a_hist(symbol="399001", period="daily", start_date=start_date, end_date=end_date),
        lambda: ak.stock_zh_index_daily_em(symbol="sz399001"),
    ]:
        try:
            df = getter()
            sz = _to_records_trade_date(
                df,
                ["日期", "date", "交易日期"],
                {"amount": ["成交额", "amount"], "tr": ["换手率", "turnover_rate"]},
            )
            if sz:
                break
        except Exception:
            continue

    north = []
    for getter in [
        lambda: ak.stock_hsgt_hist_em(),
        lambda: ak.stock_hsgt_north_net_flow_in_em(symbol="沪股通"),
    ]:
        try:
            df = getter()
            if df is None or df.empty:
                continue
            date_col = _pick_col(df, ["日期", "date", "交易日期"])
            val_col = _pick_col(df, ["当日成交净买额", "北向资金", "净流入", "value"])
            if not date_col or not val_col:
                continue
            d2 = df.copy()
            d2[date_col] = d2[date_col].apply(_fmt_ymd)
            rec = []
            for _, r in d2.iterrows():
                d = str(r.get(date_col) or "").strip()
                if not d:
                    continue
                rec.append({"trade_date": d, "north_money": _to_float(r.get(val_col))})
            if rec:
                north = rec
                break
        except Exception:
            continue

    pe = []
    for getter in [
        lambda: ak.stock_index_pe_lg(symbol="沪深300"),
        lambda: ak.stock_a_ttm_lyr(),
    ]:
        try:
            df = getter()
            if df is None or df.empty:
                continue
            date_col = _pick_col(df, ["日期", "date", "交易日期"])
            pe_col = _pick_col(df, ["市盈率", "pe", "PE"])
            if not date_col or not pe_col:
                continue
            d2 = df.copy()
            d2[date_col] = d2[date_col].apply(_fmt_ymd)
            rec = []
            for _, r in d2.iterrows():
                d = str(r.get(date_col) or "").strip()
                if not d:
                    continue
                rec.append({"trade_date": d, "pe": _to_float(r.get(pe_col))})
            if rec:
                pe = rec
                break
        except Exception:
            continue

    if not hs300:
        return _err("akshare_error", "替代数据源未能获取沪深300日线")

    data_date = max((r.get("trade_date") for r in hs300 if r.get("trade_date")), default=None)
    meta = {
        "fetchedAt": fetched_at,
        "dataDate": data_date,
        "source": "akshare:eastmoney",
        "notes": [
            "本次使用 AkShare 作为替代数据源；部分字段可能缺失，缺失字段保持 null，不做推测补值。",
        ],
    }
    return _ok(meta, {"hs300": hs300, "sh": sh, "sz": sz, "north": north, "hs300Pe": pe})


def index_valuation(index_code: str, start_date: str | None, end_date: str | None):
    fetched_at = _iso_now()
    import akshare as ak

    code = str(index_code or "").strip()
    if not code:
        return _err("bad_request", "缺少 index_code")

    alias_map = {
        "980081": ["国证价值100", "价值100", "980081"],
        "932365": ["中证全指自由现金流", "自由现金流", "932365"],
        "932315": ["中证全指红利质量", "红利质量", "932315"],
    }
    aliases = alias_map.get(code, [code])
    start_ymd = _fmt_ymd(start_date) if start_date else None
    end_ymd = _fmt_ymd(end_date) if end_date else None

    for alias in aliases:
        try:
            df = ak.stock_index_pe_lg(symbol=alias)
        except Exception:
            continue
        if df is None or df.empty:
            continue
        date_col = _pick_col(df, ["日期", "date", "trade_date", "交易日期"])
        pe_col = _pick_col(df, ["市盈率", "pe", "PE"])
        if not date_col or not pe_col:
            continue
        d2 = df.copy()
        d2[date_col] = d2[date_col].apply(_fmt_ymd)
        out = []
        for _, r in d2.iterrows():
            d = str(r.get(date_col) or "").strip()
            if not d:
                continue
            if start_ymd and d < start_ymd:
                continue
            if end_ymd and d > end_ymd:
                continue
            pe = _to_float(r.get(pe_col))
            if pe is None or pe <= 0:
                continue
            out.append({"date": d, "pe": pe})
        if not out:
            continue
        out.sort(key=lambda x: x["date"])
        return _ok(
            {
                "fetchedAt": fetched_at,
                "dataDate": out[-1]["date"],
                "source": f"akshare:stock_index_pe_lg:{alias}",
                "notes": [f"index_code={code}", f"alias={alias}"],
            },
            {"series": out},
        )

    return _err("akshare_error", f"无法获取指数估值：{code}")


def main(argv):
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_top = sub.add_parser("top100")
    p_top.add_argument("--limit", type=int, default=100)
    p_top.add_argument("--refresh", action="store_true")
    p_top.add_argument("--ensure-latest", action="store_true")
    p_top.add_argument("--progress-file", type=str, default="")

    p_detail = sub.add_parser("detail")
    p_detail.add_argument("--code", type=str, required=True)

    p_weekly = sub.add_parser("weekly-chart")
    p_weekly.add_argument("--code", type=str, required=True)
    p_weekly.add_argument("--adjust", type=str, default="qfq")

    p_mbd = sub.add_parser("market-board-daily")
    p_mbd.add_argument("--start-date", type=str, required=True)
    p_mbd.add_argument("--end-date", type=str, required=True)

    p_val = sub.add_parser("index-valuation")
    p_val.add_argument("--index-code", type=str, required=True)
    p_val.add_argument("--start-date", type=str, default="")
    p_val.add_argument("--end-date", type=str, default="")

    args = parser.parse_args(argv)
    try:
        if args.cmd == "top100":
            pf = str(args.progress_file or "").strip() or None
            result = top100(args.limit, args.refresh, args.ensure_latest, pf)
        elif args.cmd == "detail":
            result = detail(args.code)
        elif args.cmd == "weekly-chart":
            result = weekly_chart(args.code, args.adjust)
        elif args.cmd == "market-board-daily":
            result = market_board_daily(args.start_date, args.end_date)
        elif args.cmd == "index-valuation":
            result = index_valuation(args.index_code, args.start_date or None, args.end_date or None)
        else:
            result = _err("bad_request", "未知命令")
    except Exception as e:
        result = _err("akshare_error", str(e) or "AkShare 调用失败")

    sys.stdout.write(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
