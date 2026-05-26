import { VALID_TARGET_CURRENCIES, MACAROON_SECRET_HEX_LENGTH } from './constants.js';

const HEX_RE = new RegExp(`^[0-9a-fA-F]{${MACAROON_SECRET_HEX_LENGTH}}$`);

export function validateOptions({ speedApiKey, macaroonSecret, caveatTtlMs, configs }) {
    if (!speedApiKey || typeof speedApiKey !== 'string') {
        throw new Error('l402: speedApiKey must be a non-empty string');
    }

    if (!macaroonSecret || typeof macaroonSecret !== 'string') {
        throw new Error('l402: macaroonSecret must be a non-empty string');
    }
    if (!HEX_RE.test(macaroonSecret)) {
        throw new Error(`l402: macaroonSecret must be a ${MACAROON_SECRET_HEX_LENGTH}-character hex string (32 bytes). Generate one with: npx l402-generate-secret`);
    }

    if (!Array.isArray(configs) || configs.length === 0) {
        throw new Error('l402: configs must be a non-empty array');
    }

    if (caveatTtlMs !== undefined && (typeof caveatTtlMs !== 'number' || caveatTtlMs <= 0)) {
        throw new Error('l402: caveatTtlMs must be a positive number');
    }

    const seen = new Set();
    for (let i = 0; i < configs.length; i++) {
        const c = configs[i];
        const label = `configs[${i}]`;

        if (!c.method || typeof c.method !== 'string') {
            throw new Error(`l402: ${label}.method must be a non-empty string (e.g. 'GET')`);
        }
        c.method = c.method.toUpperCase();
        if (!c.path || typeof c.path !== 'string') {
            throw new Error(`l402: ${label}.path must be a non-empty string`);
        }
        if (typeof c.amount !== 'number' || !isFinite(c.amount) || c.amount <= 0) {
            throw new Error(`l402: ${label}.amount must be a positive finite number`);
        }
        if (!c.currency || typeof c.currency !== 'string') {
            throw new Error(`l402: ${label}.currency must be a non-empty string (e.g. 'USD', 'SATS')`);
        }

        const key = `${configs[i].method.toUpperCase()}:${configs[i].path}`;
        if (seen.has(key)) {
            throw new Error(`l402: duplicate route label — ${key} is already defined`);
        }
        seen.add(key);
    }
}