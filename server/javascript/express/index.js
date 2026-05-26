import { importMacaroon } from 'macaroon';
import { match } from 'path-to-regexp';
import { createMacaroon, verifyMacaroon } from './macaroon.js';
import { createSpeedInvoice } from './speed.js';
import NodeCache from 'node-cache';
import { webcrypto } from 'node:crypto';
import { CAVEAT_KEYS, HEADERS, L402_SCHEME, HASH_ALGORITHM, MAX_CAVEATS } from './constants.js';
import { ERROR_MESSAGES } from './errors.js';
import { validateOptions } from './validation.js';

const decoder = new TextDecoder();

const l402Middleware = ({ speedApiKey, macaroonSecret, caveatTtlMs, configs }) => {
    validateOptions({ speedApiKey, macaroonSecret, caveatTtlMs, configs });

    const cache = new NodeCache();
    const lock = new Map();

    const endpointMatchers = configs.map(config => ({
        method: config.method,
        matchPath: match(config.path),
        config,
    }));

    return async (request, response, next) => {

        const endpointConfig = getEndpointConfig(request, endpointMatchers);
        if (isFreeEndpoint(endpointConfig)) {
            next();
            return;
        }
        if (isPaymentMissing(request)) {
            await sendPaymentChallenge(response, endpointConfig, speedApiKey, macaroonSecret, caveatTtlMs);
            return;
        }

        const authorizationHeader = request.headers[HEADERS.AUTHORIZATION].trim();
        if (authorizationHeader.length > 2048) {
            return response.status(400).json({ message: ERROR_MESSAGES.MALFORMED_AUTH_HEADER });
        }
        const l402Match = authorizationHeader.match(
            /^L402\s+([^:\s]+):([^:\s]+)$/i
        );
        if (!l402Match) {
            response.status(400).json({ message: ERROR_MESSAGES.MALFORMED_AUTH_HEADER });
            return;
        }

        const [, encodedMacaroon, receivedPreimage] = l402Match;
        let macaroonIdentifier;
        try {
            const macaroonObject = JSON.parse(
                Buffer.from(encodedMacaroon, 'base64').toString('utf8')
            );
            const macaroon = importMacaroon(macaroonObject);
            if (macaroon.caveats.length > MAX_CAVEATS) {
                response.status(400).json({ message: ERROR_MESSAGES.TOO_MANY_CAVEATS });
                return;
            }
            macaroonIdentifier = Buffer.from(macaroon.identifier).toString("utf-8");

            const cachedResponse = cache.get(macaroonIdentifier);
            if (cachedResponse) {
                response.status(cachedResponse.status).set('Content-Type', cachedResponse.contentType).send(cachedResponse.body);
                return;
            }

            verifyMacaroon(macaroon, endpointConfig, macaroonSecret);
            const preimageValid = await isPreimageValid(macaroon, receivedPreimage);

            if (lock.get(macaroonIdentifier)) {
                response.status(409).json({ message: ERROR_MESSAGES.PAYMENT_ALREADY_PROCESSING });
                return;
            }

            if (preimageValid) {
                lock.set(macaroonIdentifier, true);
                const expiresAt = Number(extractCaveatFromMacaroon(macaroon, CAVEAT_KEYS.EXPIRES_AT));
                const originalSend = response.send.bind(response);
                response.send = (body) => {
                    const ttl = Math.floor((expiresAt - Date.now()) / 1000);
                    if (ttl > 0) {
                        cache.set(macaroonIdentifier, { body, contentType: response.getHeader('Content-Type'), status: response.statusCode }, ttl);
                    }
                    return originalSend(body);
                };
                response.on('finish', () => {
                    lock.delete(macaroonIdentifier);
                });
                next();
            } else {
                response.status(401).json({ message: ERROR_MESSAGES.INVALID_PREIMAGE });
            }
        } catch (error) {
            console.error(error);
            response.status(400).json({ message: ERROR_MESSAGES.MALFORMED_AUTH_HEADER });
            if (macaroonIdentifier) lock.delete(macaroonIdentifier);
        }
    }
};

async function sendPaymentChallenge(response, endpointConfig, speedApiKey, macaroonSecret, caveatTtlMs) {
    try {
        const invoiceResponse = await createSpeedInvoice(endpointConfig.currency, endpointConfig.amount, endpointConfig.targetCurrency, speedApiKey);
        const lightningInvoice = invoiceResponse.payment_method_options.lightning.payment_request;
        const macaroon = createMacaroon(endpointConfig, lightningInvoice, macaroonSecret, caveatTtlMs);
        response.status(402).set(HEADERS.WWW_AUTHENTICATE, `${L402_SCHEME} macaroon="${macaroon}", invoice="${lightningInvoice}"`).json({});
    } catch (err) {
        console.error(err);
        response.status(500).json({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
    }
}

function getEndpointConfig(request, endpointMatchers) {
    const entry = endpointMatchers.find(
        e => e.method === request.method && e.matchPath(request.path)
    );
    return entry?.config;
}

function isFreeEndpoint(endpointConfig) {
    return endpointConfig == undefined;
}

function isPaymentMissing(request) {
    const authorizationHeader = request.headers[HEADERS.AUTHORIZATION];
    return !authorizationHeader?.trim();
}

function extractCaveatFromMacaroon(macaroon, caveatKey) {
    const prefix = `${caveatKey} = `;
    for (const c of macaroon.caveats) {
        const decoded = decoder.decode(c.identifier);
        if (decoded.startsWith(prefix)) return decoded.slice(prefix.length);
    }
    return null;
}

async function computePreimageHash(preimage) {
    const hashBuffer = await webcrypto.subtle.digest(HASH_ALGORITHM, Buffer.from(preimage, 'hex'));
    return Buffer.from(hashBuffer).toString("hex");
}

async function isPreimageValid(macaroon, receivedPreimage) {
    const paymentHash = extractCaveatFromMacaroon(macaroon, CAVEAT_KEYS.PAYMENT_HASH);
    const receivedPaymentHash = await computePreimageHash(receivedPreimage);
    return paymentHash === receivedPaymentHash;
}

export default l402Middleware;