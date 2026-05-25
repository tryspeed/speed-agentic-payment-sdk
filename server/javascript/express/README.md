# @tryspeed/l402-express

[![npm version](https://img.shields.io/badge/npm-1.0.0-blue)](https://www.npmjs.com/package/@tryspeed/l402-express)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js: >=18](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org)

Express middleware that enforces [L402](https://docs.lightning.engineering/the-lightning-network/l402) payment-required flows using [Speed](https://www.tryspeed.com) Lightning invoices and macaroon credentials.

---

## Contents

- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration reference](#configuration-reference)
- [Generating the macaroon secret](#generating-the-macaroon-secret)
- [API key security](#api-key-security)
- [Environment variables](#environment-variables)
- [Error responses](#error-responses)
- [TypeScript](#typescript)
- [License](#license)

---

## How it works

L402 is an HTTP-native payment protocol built on Lightning Network. The flow has three steps:

1. **Challenge** — a client makes a request to a protected endpoint without payment credentials. The middleware responds with `402 Payment Required`, a Lightning invoice (created via the Speed API), and a signed macaroon.
2. **Payment** — the client pays the Lightning invoice and receives a preimage (proof of payment).
3. **Access** — the client retries the request with an `Authorization: L402 <macaroon>:<preimage>` header. The middleware verifies the macaroon signature, the caveats (method, path, amount, currency, expiry), and the preimage against the payment hash. On success the request is forwarded to your route handler.

Responses to verified requests are cached for the duration of the macaroon's TTL (10 minutes), so replaying a valid credential returns the cached response instantly without hitting your handler again.

---

## Prerequisites

- **Node.js 18 or higher**
- **Express 4 or higher**
- **A Speed account and API key** — sign up and manage keys at [app.tryspeed.com/dashboard](https://app.tryspeed.com/dashboard)

### Getting a Speed API key

1. Log in to the [Speed Web Application](https://app.tryspeed.com/dashboard).
2. Select the mode — **Test** for development, **Live** for production.
3. Navigate to **Developers → API keys → Standard keys**.
4. Click **Reveal key** to copy your secret key (prefix `sk_test_…` or `sk_live_…`).

Use your **publishable key** or **secret key** as the `speedApiKey` option. The publishable key is sufficient for creating payments. Secret keys (`sk_test_…` / `sk_live_…`) work too but carry broader account privileges — prefer the publishable key when it covers your use case.

---

## Installation

```bash
npm install @tryspeed/l402-express
```

`express` is a peer dependency and must be installed separately if you have not done so already:

```bash
npm install express
```

---

## Quick start

```js
import express from 'express';
import l402Middleware from '@tryspeed/l402-express';

const app = express();

app.use(
  l402Middleware({
    speedApiKey: process.env.SPEED_KEY,
    macaroonSecret: process.env.SPEED_MACAROON_SECRET,
    configs: [
      {
        method: 'GET',
        path: '/api/report',
        amount: 100,       // $1.00 USD
        currency: 'USD',
        targetCurrency: 'SATS',
      },
    ],
  })
);

app.get('/api/report', (req, res) => {
  res.json({ data: 'paid content here' });
});

app.listen(3000);
```

Any route not listed in `configs` passes through freely without a payment check.

---

## Configuration reference

### Middleware options

| Option | Type | Required | Description |
|---|---|---|---|
| `speedApiKey` | `string` | Yes | Your Speed secret API key (`sk_test_…` or `sk_live_…`). |
| `macaroonSecret` | `string` | Yes | 32-byte hex-encoded secret used to sign and verify macaroons. Generate one with `npx l402-generate-secret`. |
| `caveatTtlMs` | `number` | No | Macaroon TTL in milliseconds. Defaults to 10 minutes when omitted. Must be a positive number if provided. |
| `configs` | `RouteConfig[]` | Yes | Array of route-level payment rules. |

### RouteConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `method` | `string` | Yes | HTTP method to match, uppercase (e.g. `'GET'`, `'POST'`). |
| `path` | `string` | Yes | [path-to-regexp](https://github.com/pillarjs/path-to-regexp) pattern (e.g. `'/api/resource/:id'`). |
| `amount` | `number` | Yes | Payment amount in the smallest unit of `currency` (e.g. cents for `USD`, whole units for `SATS`). |
| `currency` | `string` | Yes | ISO 4217 currency code for the payment amount (e.g. `'USD'`, `'EUR'`, `'SATS'`). |
| `targetCurrency` | `string` | No | Cryptocurrency to settle in: `'SATS'`, `'USDT'`, or `'USDC'`. Defaults to `'SATS'` when omitted. |

**Example — charge $2.50 USD, settle in SATS:**

```js
{
  method: 'POST',
  path: '/api/generate',
  amount: 250,
  currency: 'USD',
  targetCurrency: 'SATS',
}
```

**Example — charge 1000 sats directly:**

```js
{
  method: 'GET',
  path: '/api/data',
  amount: 1000,
  currency: 'SATS',
}
```

---

## Generating the macaroon secret

The macaroon secret is a private 32-byte key used to sign credentials. It must be kept secret — anyone who obtains it can forge valid macaroons.

Generate one with the CLI tool bundled in this package:

```bash
npx l402-generate-secret
```

This prints a 64-character hex string. Store it as an environment variable and never commit it to source control.

```
b3f1a2c4e5d6...  ← copy this into SPEED_MACAROON_SECRET
```

Rotate this secret if you suspect it has been compromised. All previously issued macaroons will immediately become invalid.

---

## API key security

Speed API keys carry full account privileges. Follow these practices:

- **Never** embed secret keys in client-side code, public repositories, or anywhere outside a secure server environment.
- Store keys in environment variables or a secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault).
- Use **Test mode keys** (`sk_test_…`) during development and **Live mode keys** (`sk_live_…`) in production only.
- If a key is compromised, rotate it immediately from **Developers → API keys** in the [Speed dashboard](https://app.tryspeed.com/dashboard). A rotated key is permanently disabled; you cannot rotate the same key again within 24 hours.
- Consider [restricted API keys](https://app.tryspeed.com/apikeys/restricted-keys) to limit the scope of what each key can do.

---

## Environment variables

The middleware does not read environment variables directly. Pass your secrets explicitly via the options object:

```js
l402Middleware({
  speedApiKey: process.env.SPEED_KEY,
  macaroonSecret: process.env.SPEED_MACAROON_SECRET,
  configs: [...],
})
```

Recommended `.env` layout (use [dotenv](https://github.com/motdotla/dotenv) or your platform's secret injection):

```env
SPEED_KEY=sk_test_...
SPEED_MACAROON_SECRET=<64-char hex from npx l402-generate-secret>
```

---

## Error responses

| Status | Condition | Body |
|---|---|---|
| `402` | No `Authorization` header — payment required. | `{}` with `WWW-Authenticate` header containing the macaroon and Lightning invoice. |
| `400` | `Authorization` header present but malformed or macaroon verification failed. | `{ "message": "Malformed 'authorization' header" }` |
| `401` | Preimage does not match the payment hash in the macaroon. | `{ "message": "Invalid payment preimage" }` |
| `409` | A request with the same macaroon is already being processed. | `{ "message": "Payment is already being processed" }` |
| `500` | Speed API call failed when creating the invoice. | `{ "message": "Internal server error" }` |

### WWW-Authenticate header format

```
L402 macaroon="<base64-encoded macaroon>", invoice="<BOLT11 invoice>"
```

The client pays the `invoice` and uses the returned preimage together with the `macaroon` to form the `Authorization` header:

```
Authorization: L402 <macaroon>:<preimage>
```

---

## TypeScript

The package ships with a bundled declaration file. No `@types` package is needed. Named types `RouteConfig` and `L402MiddlewareOptions` are available as named exports.

---

## License

[MIT](./LICENSE)