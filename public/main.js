const socket = io();
const tableBody = document.getElementById('coins-body');
const searchInput = document.getElementById('search');
const lastUpdatedEl = document.getElementById('last-updated');

let previous = new Map();
let latest = [];
let sortKey = 'market_cap';
let sortDir = 'desc';
let currentPage = 1;
let perPage = 25;

function formatPrice(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  const digits = n >= 10 ? 2 : n >= 1 ? 4 : 6;
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatDelta(prev, now) {
  if (prev == null || now == null) return null;
  if (prev === 0) return null;
  const pct = ((now - prev) / prev) * 100;
  return pct;
}

function coinIdDisplay(id){
  return id.replace(/-/g,' ');
}

function render(prices) {
  latest = prices || [];
  const q = (searchInput.value || '').trim().toLowerCase();
  if (!latest || latest.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No data</td></tr>';
    return;
  }

  const list = latest
    .filter(p => !q || p.id.toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q) || (p.symbol || '').toLowerCase().includes(q))
    .slice()
    .sort((a,b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (av === bv) return 0;
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * perPage;
  const pageSlice = list.slice(start, start + perPage);

  tableBody.innerHTML = pageSlice.map((p, i) => {
    const prev = previous.get(p.id);
    const change = p.change_24h;
    const changeClass = change == null ? '' : (change >= 0 ? 'up' : 'down');
    const changeText = change == null ? '—' : (change >= 0 ? '▲ ' : '▼ ') + Math.abs(change).toFixed(2) + '%';
    return `
      <tr data-id="${p.id}">
        <td class="rank">${i + 1}</td>
        <td class="coin">
          <div class="coin-row">
            <img src="${p.image}" alt="${p.symbol}" class="coin-icon"/>
            <div class="coin-meta">
              <div class="coin-name">${p.name}</div>
              <div class="coin-id muted">${p.symbol.toUpperCase()}</div>
            </div>
          </div>
        </td>
        <td class="price">${formatPrice(p.price)}</td>
        <td class="change ${changeClass}">${changeText}</td>
        <td class="market-cap">${p.market_cap ? '$' + Number(p.market_cap).toLocaleString() : '—'}</td>
      </tr>
    `;
  }).join('');

  // update pagination info
  document.getElementById('page-info').textContent = `${currentPage} / ${pages}`;

  // row highlight animation for price changes
  list.forEach(p => {
    const id = p.id;
    const row = tableBody.querySelector(`tr[data-id="${id}"]`);
    const prev = previous.get(id);
    if (!row) return;
    if (prev == null || p.price == null) return;
    if (p.price > prev) {
      row.classList.add('changed-up');
      setTimeout(()=>row.classList.remove('changed-up'), 800);
    } else if (p.price < prev) {
      row.classList.add('changed-down');
      setTimeout(()=>row.classList.remove('changed-down'), 800);
    }
  });

  // update previous snapshot
  latest.forEach(p => previous.set(p.id, p.price));
  updateSortHeaders();
  lastUpdatedEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
}

socket.on('connect', () => console.log('connected to server'));
socket.on('prices', data => render(data));

// Fetch initially in case socket arrives later
fetch('/api/prices').then(r => r.json()).then(render).catch(()=>{});

searchInput.addEventListener('input', () => render(latest));

// Pagination controls
document.getElementById('per-page').addEventListener('change', (e) => {
  perPage = Number(e.target.value);
  currentPage = 1;
  render(latest);
});

document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 1) { currentPage--; render(latest); }
});

document.getElementById('next-page').addEventListener('click', () => {
  const total = latest.filter(p => !searchInput.value || p.id.toLowerCase().includes(searchInput.value.toLowerCase()) || (p.name||'').toLowerCase().includes(searchInput.value.toLowerCase()) || (p.symbol||'').toLowerCase().includes(searchInput.value.toLowerCase())).length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (currentPage < pages) { currentPage++; render(latest); }
});

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(isLight){
  document.documentElement.style.setProperty('--bg1', isLight ? '#ffffff' : '#0f1724');
  document.documentElement.style.setProperty('--bg2', isLight ? '#f6f8fb' : '#071020');
  localStorage.setItem('theme-light', isLight ? '1' : '0');
}
themeToggle.addEventListener('change', (e)=> applyTheme(e.target.checked));
// initialize theme
applyTheme(localStorage.getItem('theme-light') === '1');
themeToggle.checked = localStorage.getItem('theme-light') === '1';

// Table sorting
document.querySelectorAll('#coins-table thead th').forEach(th => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (!key) return;
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'desc'; }
    render(latest);
  });
});

// Update header sort indicators when rendering
function updateSortHeaders(){
  document.querySelectorAll('#coins-table thead th').forEach(th => {
    th.classList.remove('sorted','asc','desc');
    const k = th.dataset.key;
    if (k && k === sortKey){
      th.classList.add('sorted', sortDir);
    }
  });
}
