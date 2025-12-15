const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
// Keep a concise, valid list of CoinGecko IDs here. Avoid embedding
// non-ASCII or display names — use the API 'ids' values like 'bitcoin'.
// If you want a custom list of coin ids, set them here. If the array
// is empty or small, the server will fetch the top `DEFAULT_MARKET_COUNT`
// by market cap instead (this is convenient to cover at least 100 coins).
const COINS = [];
const DEFAULT_MARKET_COUNT = 100;
let latestPrices = [];

// Optionally load a .env file for local development. Create a file named
// `.env` at the project root containing (example):
//
// COINGECKO_API_KEY=your_api_key_here
//
// If set, we will send the API key as the `x-cg-pro-api-key` header to
// CoinGecko (used by the CoinGecko PRO endpoints). For deployments, set
// the `COINGECKO_API_KEY` environment variable instead of committing a
// `.env` file with a secret.
try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || null;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/prices', (req, res) => {
  res.json(latestPrices);
});

async function fetchPrices() {
  if (fetchInProgress) {
    // Prevent overlapping fetches; schedule another attempt later
    scheduleNext();
    return;
  }
  fetchInProgress = true;
  try {
    // Use the markets endpoint to get richer data (image, market_cap, 24h change).
    // If `COINS` is empty or small, request the top `DEFAULT_MARKET_COUNT` by market cap.
    const url = COINS.length >= DEFAULT_MARKET_COUNT
      ? `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.join(',')}&order=market_cap_desc&per_page=${COINS.length}&page=1&sparkline=false&price_change_percentage=24h`
      : `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${DEFAULT_MARKET_COUNT}&page=1&sparkline=false&price_change_percentage=24h`;
    const headers = COINGECKO_API_KEY ? { 'x-cg-pro-api-key': COINGECKO_API_KEY } : {};
    const resp = await axios.get(url, { timeout: 5000, headers });

    // Success: reset poll interval and emit (add small jitter to avoid thundering)
    currentPollInterval = DEFAULT_POLL_INTERVAL + Math.floor(Math.random() * 2000);
    const data = resp.data || [];
    latestPrices = data.map(c => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      image: c.image,
      price: c.current_price,
      market_cap: c.market_cap,
      change_24h: c.price_change_percentage_24h
    }));
    io.emit('prices', latestPrices);
    console.log('emitted markets', new Date().toISOString());
  } catch (err) {
    const status = err.response?.status;
    if (status === 429) {
      const retryAfter = err.response?.headers?.['retry-after'];
      const raMs = retryAfter ? Number(retryAfter) * 1000 : null;
      const jitter = Math.floor(Math.random() * 1000);
      currentPollInterval = raMs || Math.min(currentPollInterval * 2 + jitter, MAX_POLL_INTERVAL);
      console.warn(`Rate limited by CoinGecko (429). Backing off to ${currentPollInterval}ms.`);
    } else {
      currentPollInterval = Math.min(currentPollInterval * 2, MAX_POLL_INTERVAL);
      console.error('fetchPrices error', err.message);
    }
  } finally {
    fetchInProgress = false;
    // Schedule the next run (adaptive)
    scheduleNext();
  }
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.emit('prices', latestPrices);
  socket.on('disconnect', () => console.log('client disconnected', socket.id));
});

// Polling strategy: start with DEFAULT_POLL_INTERVAL, but back off
// exponentially (with an upper bound) on errors (especially 429).
const DEFAULT_POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS) || 10000;
const MAX_POLL_INTERVAL = Number(process.env.MAX_POLL_INTERVAL_MS) || 2 * 60 * 1000; // 2 minutes
let currentPollInterval = DEFAULT_POLL_INTERVAL;
let fetchInProgress = false;

function scheduleNext() {
  setTimeout(fetchPrices, currentPollInterval);
}

async function fetchPricesLoopStarter() {
  await fetchPrices();
}

fetchPricesLoopStarter();

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
