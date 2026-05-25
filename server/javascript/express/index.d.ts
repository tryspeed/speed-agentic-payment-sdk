import type { RequestHandler } from 'express';

/** HTTP method string (uppercase). */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

/**
 * Per-route payment configuration.
 *
 * @example
 * { method: 'GET', path: '/api/data', amount: 1000, currency: 'USD' }
 */
export interface RouteConfig {
  /** HTTP method to match (case-sensitive, uppercase). */
  method: HttpMethod;
  /**
   * Express-style path pattern passed to `path-to-regexp`.
   * @example '/api/resource/:id'
   */
  path: string;
  /** Payment amount in the smallest unit of `currency` (e.g. cents for USD, sats for SATS). */
  amount: number;
  /** ISO 4217 currency code or `'SATS'` for satoshis. */
  currency: string;
  /**
   * Target settlement currency for the Speed invoice.
   * Defaults to `'SATS'` when omitted.
   */
  targetCurrency?: string;
}

/** Options passed to the `l402Middleware` factory. */
export interface L402MiddlewareOptions {
  /** Speed API key used to create Lightning invoices. */
  speedApiKey: string;
  /** Hex-encoded secret used to sign and verify macaroons. */
  macaroonSecret: string;
  /**
   * Macaroon TTL in milliseconds. Defaults to 10 minutes when omitted.
   * Must be a positive number if provided.
   */
  caveatTtlMs?: number;
  /**
   * Route-level payment rules.
   * Routes not listed here are passed through without a payment check.
   */
  configs: RouteConfig[];
}

/**
 * Creates an Express middleware that enforces L402 payment-required flows.
 *
 * - Unlisted routes pass through freely.
 * - Requests without an `Authorization` header receive a `402` challenge
 *   containing a Speed Lightning invoice and a signed macaroon.
 * - Requests with a valid `L402 <macaroon>:<preimage>` credential are
 *   forwarded to the next handler; responses are cached for the macaroon TTL.
 *
 * @example
 * ```ts
 * import l402Middleware from '@tryspeed/l402-express';
 *
 * app.use(l402Middleware({
 *   speedApiKey: process.env.SPEED_KEY!,
 *   macaroonSecret: process.env.SPEED_MACAROON_SECRET!,
 *   configs: [
 *     { method: 'GET', path: '/api/data', amount: 1000, currency: 'USD' },
 *   ],
 * }));
 * ```
 */
declare function l402Middleware(options: L402MiddlewareOptions): RequestHandler;

export default l402Middleware;