import json
import sys
from datetime import datetime, timezone


def _ymd8_to_ymd10(s: str) -> str:
    s = (s or "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        return s
    return ""


def _emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False))


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _err(msg: str):
    _emit({"success": False, "error": "baostock_error", "message": msg})


def _fetch_hs300_pe(bs, start_date: str, end_date: str):
    rs = bs.query_history_k_data_plus(
        "sh.000300",
        "date,peTTM",
        start_date=start_date,
        end_date=end_date,
        frequency="d",
        adjustflag="3",
    )
    if getattr(rs, "error_code", "") != "0":
        return [], f"query_history_k_data_plus(peTTM) failed: {rs.error_code} {rs.error_msg}"

    out = []
    while rs.next():
        row = rs.get_row_data()
        if not row or len(row) < 2:
            continue
        d = _ymd8_to_ymd10(row[0])
        try:
            pe = float(row[1])
        except Exception:
            pe = None
        if d and pe is not None:
            out.append({"date": d, "pe": pe})
    return out, None


def _fetch_hs300_close(bs, start_date: str, end_date: str):
    rs = bs.query_history_k_data_plus(
        "sh.000300",
        "date,close",
        start_date=start_date,
        end_date=end_date,
        frequency="d",
        adjustflag="3",
    )
    if getattr(rs, "error_code", "") != "0":
        return [], f"query_history_k_data_plus(close) failed: {rs.error_code} {rs.error_msg}"

    out = []
    while rs.next():
        row = rs.get_row_data()
        if not row or len(row) < 2:
            continue
        d = _ymd8_to_ymd10(row[0])
        try:
            close = float(row[1])
        except Exception:
            close = None
        if d and close is not None:
            out.append({"trade_date": d.replace("-", ""), "close": close})
    return out, None


def _fetch_cn10y_yield(bs, start_date: str, end_date: str):
    fn = getattr(bs, "query_bond_yield_data", None)
    if fn is None:
        return [], None
    rs = fn(start_date=start_date, end_date=end_date)
    if getattr(rs, "error_code", "") != "0":
        return [], f"query_bond_yield_data failed: {rs.error_code} {rs.error_msg}"

    fields = getattr(rs, "fields", []) or []
    date_idx = fields.index("date") if "date" in fields else -1
    year_idx = fields.index("year") if "year" in fields else -1
    yield_idx = fields.index("yield") if "yield" in fields else -1
    if date_idx < 0 or year_idx < 0 or yield_idx < 0:
        return [], None

    out = []
    while rs.next():
        row = rs.get_row_data()
        if not row or len(row) <= max(date_idx, year_idx, yield_idx):
            continue
        d = _ymd8_to_ymd10(row[date_idx])
        try:
            year = float(row[year_idx])
        except Exception:
            year = None
        try:
            y = float(row[yield_idx])
        except Exception:
            y = None
        if d and year == 10 and y is not None:
            out.append({"date": d, "yieldPct": y})
    return out, None


def main():
    if len(sys.argv) < 2:
        _err("missing command")
        return

    cmd = (sys.argv[1] or "").strip()
    start_ymd8 = sys.argv[2] if len(sys.argv) >= 3 else "20200101"
    end_ymd8 = sys.argv[3] if len(sys.argv) >= 4 else datetime.now().strftime("%Y%m%d")
    start_date = _ymd8_to_ymd10(start_ymd8) or "2020-01-01"
    end_date = _ymd8_to_ymd10(end_ymd8) or datetime.now().strftime("%Y-%m-%d")

    if cmd not in {"equity-bond", "hs300-close"}:
        _err("unknown command")
        return

    try:
        import baostock as bs
    except Exception as e:
        _err(f"baostock not available: {str(e)}")
        return

    try:
        lg = bs.login()
        if getattr(lg, "error_code", "") != "0":
            _err(f"baostock login failed: {lg.error_code} {lg.error_msg}")
            return

        if cmd == "hs300-close":
            close_rows, close_err = _fetch_hs300_close(bs, start_date, end_date)
            if close_err and not close_rows:
                _err(close_err)
                return
            _emit(
                {
                    "success": True,
                    "meta": {
                        "fetchedAt": _utc_now_iso(),
                        "dataDate": (close_rows[-1]["trade_date"] if close_rows else None),
                        "source": "baostock:query_history_k_data_plus",
                        "notes": [n for n in [close_err] if n],
                    },
                    "data": {"hs300": close_rows},
                }
            )
            return

        pe, pe_err = _fetch_hs300_pe(bs, start_date, end_date)
        y10, y_err = _fetch_cn10y_yield(bs, start_date, end_date)
        if pe_err and not pe:
            _err(pe_err)
            return

        _emit(
            {
                "success": True,
                "meta": {
                    "fetchedAt": _utc_now_iso(),
                    "dataDate": (pe[-1]["date"] if pe else None),
                    "source": "baostock",
                    "notes": [n for n in [pe_err, y_err] if n],
                },
                "data": {"pe": pe, "yield10y": y10},
            }
        )
    finally:
        try:
            bs.logout()
        except Exception:
            pass


if __name__ == "__main__":
    main()
