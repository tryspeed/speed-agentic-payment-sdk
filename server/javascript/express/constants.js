export const MACAROON_VERSION = 2;

export const CAVEAT_KEYS = {
    AMOUNT: 'amount',
    CURRENCY: 'currency',
    METHOD: 'method',
    PATH: 'path',
    PAYMENT_HASH: 'payment_hash',
    EXPIRES_AT: 'expires_at'
};

export const HEADERS = {
    AUTHORIZATION: 'authorization',
    WWW_AUTHENTICATE: 'www-authenticate',
};

export const DEFAULT_CAVEAT_TTL_MS = 1000 * 60 * 10;
export const DEFAULT_TARGET_CURRENCY = 'SATS';
export const HASH_ALGORITHM = 'SHA-256';
export const L402_SCHEME = 'L402';
export const MACAROON_SECRET_HEX_LENGTH = 64;
export const MAX_CAVEATS = 20;
export const SPEED_BASE_URL = 'https://api.tryspeed.com';
export const SPEED_PAYMENT_METHOD = 'lightning';
export const VALID_TARGET_CURRENCIES = [DEFAULT_TARGET_CURRENCY, 'USDT', 'USDC'];
export const FETCH_TIMEOUT_MS = 10_000;
