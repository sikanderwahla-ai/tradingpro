# HASSAN WAHLA — Pro SMC & TradingView-Style Chart Terminal (v35)

## How to Connect Exness Account (`17000025416`) Without `Failed to fetch` Error
Browsers block direct cross-origin (`CORS`) requests to `api.exness.com`, and Exness MT5 accounts execute orders via MetaTrader 5.
1. Open your **Exness MetaTrader 5** terminal on Windows, log into account `17000025416`, and enable **Algo Trading**.
2. Install Python bridge packages once: `pip install flask flask-cors MetaTrader5`
3. Double-click **`Start_Exness_MT5_Bridge.bat`** (runs `http://127.0.0.1:5000/api/order`).
4. Double-click **`Start_Terminal.bat`**, click **`🔗 Broker API`**, enter `http://127.0.0.1:5000/api/order`, and click **Save & Connect**.
