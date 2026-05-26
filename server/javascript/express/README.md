# @speeddev/l402-express

[![npm version](https://img.shields.io/badge/npm-0.1.0-blue)](https://www.npmjs.com/package/@speeddev/l402-express)
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

1. **Challenge** — a client makes a request to a protected endpoint without payment credentials. The middleware responds with `402 Payment Required`, a Lightning invoice (created using your Speed account's API Key), and a signed macaroon.
2. **Payment** — the client pays the Lightning invoice and receives a preimage (proof of payment).
3. **Access** — the client retries the request with an `Authorization: L402 <macaroon>:<preimage>` header. The middleware verifies the macaroon signature, the caveats (method, path, amount, currency, expiry), and the preimage against the payment hash. On success the request is forwarded to your route handler.

> **Note:** Responses to verified requests are cached for the duration of the macaroon's TTL (default 10 minutes), so replaying a valid credential returns the cached response instantly without hitting your handler again.

---

## Prerequisites

- **Node.js 18 or higher**
- **Express 4.19.2 or higher**
- **A Speed account and API key** — sign up and manage keys at - [app.tryspeed.com/apikeys/restricted-keys](https://app.tryspeed.com/apikeys/restricted-keys)

### Getting a Speed API key

1. Log in to the [Speed Merchant](https://app.tryspeed.com/dashboard).
2. Navigate to **Developers → API keys → Standard keys**.
3. Create a **Restricted Key** : Speed recommends using a restricted key (rk_live_...) for the speedApiKey option. While creating the restricted key, select Core → Payments as the module and grant Write permission.

Standard secret keys (sk_live_...) will also work, but they provide broader account privileges (including Send functionality).  Hence for better security and least-privilege access, we recommend using a restricted key.


---

## Installation

```bash
npm install @speeddev/l402-express
```

`express` is a peer dependency and must be installed separately if you have not done so already:

```bash
npm install express
```

---

## Quick start

```js
import express from 'express';
import l402Middleware from '@speeddev/l402-express';

const app = express();

app.use(
  l402Middleware({
    speedApiKey: process.env.SPEED_KEY,
    macaroonSecret: process.env.SPEED_MACAROON_SECRET,
    configs: [
      {
        method: 'GET',
        path: '/api/report',
        amount: 1,
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
| `speedApiKey` | `string` | Yes | Your Speed API key (`rk_live_…` or `sk_live_…`). |
| `macaroonSecret` | `string` | Yes | 32-byte hex-encoded secret used to sign and verify macaroons. Generate one with `npx l402-generate-secret`. |
| `caveatTtlMs` | `number` | No | Macaroon TTL in milliseconds. Defaults to 10 minutes when omitted. Must be a positive number if provided. |
| `configs` | `RouteConfig[]` | Yes | Array of route-level payment rules. |

### RouteConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `method` | `string` | Yes | HTTP method to match (e.g. `'GET'`, `'POST'`). Case-insensitive — normalized to uppercase automatically. |
| `path` | `string` | Yes | [path-to-regexp](https://github.com/pillarjs/path-to-regexp) pattern (e.g. `'/api/resource/:id'`). |
| `amount` | `number` | Yes | Payment amount you intend to collect.  |
| `currency` | `string` | Yes | ISO 4217 [currency code](https://apidocs.tryspeed.com/reference/enum-base-currency) for the payment amount (e.g. `'USD'`, `'EUR'`, `'SATS'`). |
| `targetCurrency` | `string` | No | Cryptocurrency to settle in: `'SATS'`, `'USDT'`, or `'USDC'`. Defaults to `'SATS'` when omitted. |

**Example — charge $2.50 USD, settle in SATS:**

```js
{
  method: 'POST',
  path: '/api/generate',
  amount: 2.5,
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

- **Never** embed secret keys in client-side code, public repositories, or anywhere outside a secure server environment.
- Consider [restricted API keys](https://app.tryspeed.com/apikeys/restricted-keys) to limit the scope of what each key can do.
- Store keys in environment variables or a secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault).
- If a key is compromised, rotate it immediately from the [Speed dashboard](https://app.tryspeed.com/dashboard).


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
SPEED_KEY=rk_live_...
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
| `500` | Speed API call failed due to any reason. | `{ "message": "Internal server error" }` |

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