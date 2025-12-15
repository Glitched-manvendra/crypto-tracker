# Crypto Realtime

Simple demo app that shows realtime cryptocurrency prices using Socket.IO and CoinGecko.

Quick start

1. Install dependencies

```bash
npm install
```

2. Start server

```bash
npm start
```

3. Open http://localhost:3000

Notes

 - If you have a CoinGecko PRO API key, set it in an environment variable named
	 `COINGECKO_API_KEY` (or create a `.env` file with that variable) — the
	 server will automatically send it using the `x-cg-pro-api-key` header.-   To set it easily on your machine without editing files, run:
 Prices are polled every 10 seconds from the free CoinGecko API.
 Modify `server/index.js` to change coin list or interval.
  If you have a CoinGecko PRO API key, set it in an environment variable named
	 `COINGECKO_API_KEY` (or create a `.env` file with that variable) — the
	 server will automatically send it using the `x-cg-pro-api-key` header.
 - To set it easily on your machine without editing files, run:

  ```bash
  npm run set-key -- YOUR_API_KEY_HERE
  ```

  This will write a local `.env` (ignored by git). Do NOT paste your API key
  into source files or commit it to version control.

 - Polling/backoff: the server polls CoinGecko and will automatically back off
  if it receives HTTP 429 (rate limit). You can change default timing with

  ```bash
  export POLL_INTERVAL_MS=10000
  export MAX_POLL_INTERVAL_MS=120000
  ```