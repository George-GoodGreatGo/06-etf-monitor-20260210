import os


class _Resp:
    def __init__(self, fields, rows, error_code="0", error_msg=""):
        self.fields = fields
        self._rows = rows
        self._idx = -1
        self.error_code = error_code
        self.error_msg = error_msg

    def next(self):
        self._idx += 1
        return 0 <= self._idx < len(self._rows)

    def get_row_data(self):
        if 0 <= self._idx < len(self._rows):
            return self._rows[self._idx]
        return []


class _Login:
    def __init__(self):
        self.error_code = "0"
        self.error_msg = ""


def login():
    return _Login()


def logout():
    return None


def query_history_k_data_plus(code, fields, start_date="", end_date="", frequency="d", adjustflag="3"):
    # Ensure baostock_service can always build a non-empty pe list.
    return _Resp(["date", "peTTM"], [["2024-01-02", "10.0"]], "0", "")


def query_bond_yield_data(start_date="", end_date=""):
    mode = os.getenv("BAO_MOCK_MODE", "success").strip().lower()
    if mode in ("fail", "error"):
        return _Resp(["date", "year", "yield"], [], "1", "mock_yield_failed")
    if mode in ("empty",):
        return _Resp(["date", "year", "yield"], [], "0", "")
    return _Resp(["date", "year", "yield"], [["2024-01-02", "10", "2.35"]], "0", "")
