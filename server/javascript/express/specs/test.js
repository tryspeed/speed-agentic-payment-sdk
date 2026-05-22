import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newMacaroon, importMacaroon } from 'macaroon';
import { validateOptions } from '../validation.js';
import { createMacaroon, verifyMacaroon } from '../macaroon.js';
import { CAVEAT_KEYS, MACAROON_VERSION } from '../constants.js';

const VALID_SECRET = 'a'.repeat(64);
const VALID_CONFIG = { method: 'GET', path: '/paid', amount: 100, currency: 'USD' };
const VALID_OPTIONS = { speedApiKey: 'test-key', macaroonSecret: VALID_SECRET, configs: [VALID_CONFIG] };

// Known valid BOLT11 invoice with payment_hash = f5636521...
const TEST_BOLT11 = 'lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567';
const TEST_PAYMENT_HASH = 'f5636521e98000697a6700b979c288ddad56cb3995a2eb07550872c466ccc3e5';

const decoder = new TextDecoder();

// ─── validateOptions ──────────────────────────────────────────────────────────

describe('validateOptions', () => {
    it('throws if speedApiKey is missing', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, speedApiKey: '' }), /speedApiKey/);
    });

    it('throws if speedApiKey is not a string', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, speedApiKey: 123 }), /speedApiKey/);
    });

    it('throws if macaroonSecret is wrong length', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, macaroonSecret: 'abc' }), /macaroonSecret/);
    });

    it('throws if macaroonSecret is not hex', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, macaroonSecret: 'z'.repeat(64) }), /macaroonSecret/);
    });

    it('throws if configs is not an array', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, configs: {} }), /configs/);
    });

    it('throws if configs is empty', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, configs: [] }), /configs/);
    });

    it('throws if config is missing method', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, configs: [{ ...VALID_CONFIG, method: '' }] }), /method/);
    });

    it('throws if config is missing path', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, configs: [{ ...VALID_CONFIG, path: '' }] }), /path/);
    });

    it('throws if config amount is 0', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, configs: [{ ...VALID_CONFIG, amount: 0 }] }), /amount/);
    });

    it('throws if config amount is negative', () => {
        assert.throws(() => validateOptions({ ...VALID_OPTIONS, configs: [{ ...VALID_CONFIG, amount: -1 }] }), /amount/);
    });

    it('throws if targetCurrency is invalid', () => {
        assert.throws(
            () => validateOptions({ ...VALID_OPTIONS, configs: [{ ...VALID_CONFIG, targetCurrency: 'INVALID' }] }),
            /targetCurrency/
        );
    });

    it('does not throw for valid options', () => {
        assert.doesNotThrow(() => validateOptions(VALID_OPTIONS));
    });
});

// ─── createMacaroon ───────────────────────────────────────────────────────────

describe('createMacaroon', () => {
    it('returns a base64-encoded string', () => {
        const result = createMacaroon(VALID_CONFIG, TEST_BOLT11, VALID_SECRET);
        assert.equal(typeof result, 'string');
        assert.doesNotThrow(() => Buffer.from(result, 'base64'));
    });

    it('encodes all required caveats', () => {
        const result = createMacaroon(VALID_CONFIG, TEST_BOLT11, VALID_SECRET);
        const m = importMacaroon(JSON.parse(Buffer.from(result, 'base64').toString('utf8')));
        const caveats = m.caveats.map(c => decoder.decode(c.identifier));

        assert.ok(caveats.some(c => c === `method = GET`));
        assert.ok(caveats.some(c => c === `path = /paid`));
        assert.ok(caveats.some(c => c === `amount = 100`));
        assert.ok(caveats.some(c => c === `currency = USD`));
        assert.ok(caveats.some(c => c === `payment_hash = ${TEST_PAYMENT_HASH}`));
    });

    it('includes a future expires_at caveat', () => {
        const before = Date.now();
        const result = createMacaroon(VALID_CONFIG, TEST_BOLT11, VALID_SECRET);
        const m = importMacaroon(JSON.parse(Buffer.from(result, 'base64').toString('utf8')));
        const caveats = m.caveats.map(c => decoder.decode(c.identifier));
        const expiryStr = caveats.find(c => c.startsWith('expires_at = '));
        assert.ok(expiryStr, 'expires_at caveat missing');
        const expiresAt = Number(expiryStr.split(' = ')[1]);
        assert.ok(expiresAt > before);
    });

    it('throws on an invalid BOLT11 invoice', () => {
        assert.throws(() => createMacaroon(VALID_CONFIG, 'not-a-bolt11', VALID_SECRET));
    });
});

// ─── verifyMacaroon ───────────────────────────────────────────────────────────

function buildMacaroon({
    secret = VALID_SECRET,
    config = VALID_CONFIG,
    paymentHash = TEST_PAYMENT_HASH,
    expiresAt = Date.now() + 600_000,
    extraCaveat = null,
} = {}) {
    const m = newMacaroon({
        version: MACAROON_VERSION,
        rootKey: Buffer.from(secret, 'hex'),
        identifier: crypto.randomUUID(),
    });
    m.addFirstPartyCaveat(`${CAVEAT_KEYS.EXPIRES_AT} = ${expiresAt}`);
    m.addFirstPartyCaveat(`${CAVEAT_KEYS.METHOD} = ${config.method}`);
    m.addFirstPartyCaveat(`${CAVEAT_KEYS.PATH} = ${config.path}`);
    m.addFirstPartyCaveat(`${CAVEAT_KEYS.AMOUNT} = ${config.amount}`);
    m.addFirstPartyCaveat(`${CAVEAT_KEYS.CURRENCY} = ${config.currency}`);
    m.addFirstPartyCaveat(`${CAVEAT_KEYS.PAYMENT_HASH} = ${paymentHash}`);
    if (extraCaveat) m.addFirstPartyCaveat(extraCaveat);
    return m;
}

describe('verifyMacaroon', () => {
    it('does not throw for a valid macaroon', () => {
        const m = buildMacaroon();
        assert.doesNotThrow(() => verifyMacaroon(m, VALID_CONFIG, VALID_SECRET));
    });

    it('throws if macaroonSecret is wrong', () => {
        const m = buildMacaroon();
        assert.throws(() => verifyMacaroon(m, VALID_CONFIG, 'b'.repeat(64)));
    });

    it('throws if method caveat does not match route config', () => {
        const m = buildMacaroon({ config: { ...VALID_CONFIG, method: 'POST' } });
        assert.throws(() => verifyMacaroon(m, VALID_CONFIG, VALID_SECRET));
    });

    it('throws if path caveat does not match route config', () => {
        const m = buildMacaroon({ config: { ...VALID_CONFIG, path: '/other' } });
        assert.throws(() => verifyMacaroon(m, VALID_CONFIG, VALID_SECRET));
    });

    it('throws if expires_at is in the past', () => {
        const m = buildMacaroon({ expiresAt: Date.now() - 1000 });
        assert.throws(() => verifyMacaroon(m, VALID_CONFIG, VALID_SECRET));
    });

    it('throws if an unknown caveat is present', () => {
        const m = buildMacaroon({ extraCaveat: 'unknown_key = some_value' });
        assert.throws(() => verifyMacaroon(m, VALID_CONFIG, VALID_SECRET));
    });
});