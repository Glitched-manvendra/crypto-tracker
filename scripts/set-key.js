const fs = require('fs');
const path = require('path');
const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/set-key.js <COINGECKO_API_KEY>');
  process.exit(1);
}
const envPath = path.join(__dirname, '..', '.env');
const content = `COINGECKO_API_KEY=${key}\n`;
fs.writeFileSync(envPath, content, { encoding: 'utf8', flag: 'w' });
console.log('.env written (do not commit this file)');
