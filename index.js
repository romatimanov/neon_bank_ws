const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

// === Константы ===
const DATA_PATH = path.join(__dirname, "data.json");
const MINE_ACCOUNT = "74213041477477406320783754";
const KNOWN_CURRENCY_CODES = [
  "ETH",
  "BTC",
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "AUD",
  "CAD",
  "CHF",
  "CNH",
  "HKD",
  "NZD",
  "RUB",
  "UAH",
  "BYR",
];

const currencyFeedSubscribers = [];

// === Утилиты ===
function readData() {
  if (!fs.existsSync(DATA_PATH)) {
    return { accounts: {}, mine: { currencies: {} }, exchange: {} };
  }
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function generateAccountId() {
  return String(Math.floor(Math.random() * 1e26)).padStart(26, "0");
}

function formatAmount(amount) {
  return Math.round(amount * 100) / 100;
}

function getExchangeRate(data, from, to) {
  const straight = Number(data.exchange[`${from}/${to}`]);
  if (!isNaN(straight)) return straight;

  const inverse = Number(data.exchange[`${to}/${from}`]);
  return inverse ? 1 / inverse : 1;
}

function setExchangeRate(data, from, to, rate) {
  const inverseKey = `${to}/${from}`;
  const directKey = `${from}/${to}`;

  if (data.exchange[inverseKey]) {
    data.exchange[inverseKey] = formatAmount(1 / rate);
  } else {
    data.exchange[directKey] = rate;
  }
}

// === WebSocket сервер ===
const wss = new WebSocketServer({ port: process.env.PORT || 3001 });

wss.on("connection", (ws) => {
  currencyFeedSubscribers.push(ws);
  console.log("Client connected");

  ws.on("close", () => {
    const index = currencyFeedSubscribers.indexOf(ws);
    if (index !== -1) currencyFeedSubscribers.splice(index, 1);
    console.log("Client disconnected");
  });
});

setInterval(() => {
  const data = readData();

  const len = KNOWN_CURRENCY_CODES.length;
  const i1 = Math.floor(Math.random() * len);
  let i2 = Math.floor(Math.random() * len);
  if (i1 === i2) i2 = (i2 + 1) % len;

  const from = KNOWN_CURRENCY_CODES[i1];
  const to = KNOWN_CURRENCY_CODES[i2];
  const rate = formatAmount(0.001 + Math.random() * 100);
  const previous = getExchangeRate(data, from, to);
  const change = rate > previous ? 1 : rate < previous ? -1 : 0;

  setExchangeRate(data, from, to, rate);
  writeData(data);

  currencyFeedSubscribers.forEach((ws) => {
    ws.send(
      JSON.stringify({
        type: "EXCHANGE_RATE_CHANGE",
        from,
        to,
        rate,
        change,
      })
    );
  });

  // Случайная транзакция
  if (Math.random() > 0.9) {
    const account = data.accounts[MINE_ACCOUNT];
    const amount = formatAmount(Math.random() * 1000);
    account.balance = formatAmount(account.balance + amount);
    account.transactions.push({
      amount,
      date: new Date().toISOString(),
      from: generateAccountId(),
      to: MINE_ACCOUNT,
    });
    writeData(data);
  }
}, 1000);

console.log(
  "✅ WebSocket server running on port " + (process.env.PORT || 3001)
);
