export const MACAROON_VERSION = 2;

export const CAVEAT_KEYS = {
    METHOD: 'method',
    PATH: 'path',
    SATS: 'sats',
    PAYMENT_HASH: 'payment_hash',
    EXPIRES_AT: 'expires_at'
};

export const HEADERS = {
    AUTHORIZATION: 'authorization',
    WWW_AUTHENTICATE: 'www-authenticate',
};

export const L402_SCHEME = 'L402';
export const HASH_ALGORITHM = 'SHA-256';

export const ENV_VARS = {
    SPEED_KEY: 'SPEED_KEY',
    SPEED_MACAROON_SECRET: 'SPEED_MACAROON_SECRET',
    SPEED_BASE_URL: 'SPEED_BASE_URL',
};

export const SPEED_BASE_URL = 'https://api.tryspeed.dev';
export const SPEED_CURRENCY = 'SATS';
export const SPEED_PAYMENT_METHOD = 'lightning';
export const TEN_MINUTES_IN_MS = 1000 * 60 * 10;