"""
Exness / MetaTrader 5 Local Execution Bridge for HASSAN WAHLA Terminal
-----------------------------------------------------------------------
1. Install dependencies once:
   pip install flask flask-cors MetaTrader5
2. Make sure MetaTrader 5 (Exness) desktop terminal is open and logged into your account (e.g., 17000025416) with Algo Trading enabled.
3. Run:
   py exness_mt5_bridge.py
4. In Terminal -> Broker API Link:
   - Endpoint URL: http://127.0.0.1:5000/api/order
   - API Key / Token: (any secret token you set below, e.g. my-secret-token)
   - Account ID: 17000025416
"""
from flask import Flask, request, jsonify
from flask_cors import CORS

try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

app = Flask(__name__)
CORS(app)

API_TOKEN = ""  # Optional: set a token to require Authorization: Bearer <token>


@app.route("/api/order", methods=["GET", "POST", "OPTIONS"])
def handle_order():
    if request.method == "GET":
        mt5_ok = bool(mt5 and mt5.initialize())
        acc_info = mt5.account_info()._asdict() if (mt5_ok and mt5.account_info()) else None
        return jsonify({
            "status": "online",
            "mt5_connected": mt5_ok,
            "account": acc_info.get("login") if acc_info else None,
            "balance": acc_info.get("balance") if acc_info else None,
        })

    if API_TOKEN:
        auth = request.headers.get("Authorization", "")
        if API_TOKEN not in auth and request.headers.get("X-API-Key") != API_TOKEN:
            return jsonify({"error": "Unauthorized token"}), 401

    data = request.get_json(force=True, silent=True) or {}
    symbol = str(data.get("symbol", "XAUUSD")).replace("/", "").upper()
    side = str(data.get("side", "BUY")).upper()
    lots = float(data.get("lots", 0.01))
    tp = data.get("tp")
    sl = data.get("sl")

    if not mt5 or not mt5.initialize():
        return jsonify({"error": "MetaTrader 5 desktop terminal is not running or not logged in"}), 503

    mt5.symbol_select(symbol, True)
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        return jsonify({"error": f"Symbol {symbol} not found in MT5 Market Watch"}), 400

    order_type = mt5.ORDER_TYPE_BUY if side == "BUY" else mt5.ORDER_TYPE_SELL
    price = tick.ask if side == "BUY" else tick.bid

    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lots,
        "type": order_type,
        "price": price,
        "deviation": 20,
        "magic": 202611,
        "comment": "HassanWahlaTerminal",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    if tp is not None:
        req["tp"] = float(tp)
    if sl is not None:
        req["sl"] = float(sl)

    result = mt5.order_send(req)
    if result is None:
        return jsonify({"error": str(mt5.last_error())}), 500

    return jsonify({
        "retcode": result.retcode,
        "order": result.order,
        "comment": result.comment,
        "price": result.price,
    })


if __name__ == "__main__":
    print("Exness MT5 Bridge listening on http://127.0.0.1:5000/api/order ...")
    app.run(host="127.0.0.1", port=5000)
