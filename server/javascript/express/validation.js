import { VALID_TARGET_CURRENCIES, MACAROON_SECRET_HEX_LENGTH } from './constants.js';

const HEX_RE = new RegExp(`^[0-9a-fA-F]{${MACAROON_SECRET_HEX_LENGTH}}$`);

export function validateOptions({ speedApiKey, macaroonSecret, configs }) {
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

    for (let i = 0; i < configs.length; i++) {
        const c = configs[i];
        const label = `configs[${i}]`;

        if (!c.method || typeof c.method !== 'string') {
            throw new Error(`l402: ${label}.method must be a non-empty string (e.g. 'GET')`);
        }
        if (!c.path || typeof c.path !== 'string') {
            throw new Error(`l402: ${label}.path must be a non-empty string`);
        }
        if (typeof c.amount !== 'number' || !isFinite(c.amount) || c.amount <= 0) {
            throw new Error(`l402: ${label}.amount must be a positive finite number`);
        }
        if (!c.currency || typeof c.currency !== 'string') {
            throw new Error(`l402: ${label}.currency must be a non-empty string (e.g. 'USD', 'SATS')`);
        }
        if (c.targetCurrency !== undefined && !VALID_TARGET_CURRENCIES.includes(c.targetCurrency)) {
            throw new Error(`l402: ${label}.targetCurrency must be one of ${VALID_TARGET_CURRENCIES.join(', ')}`);
        }
    }
}