import { importMacaroon } from 'macaroon';
import { createMacaroon, verifyMacaroon } from './macaroon.js';
import { createSpeedInvoice } from './speed.js';
import NodeCache from 'node-cache';
import { CAVEAT_KEYS, HEADERS, L402_SCHEME, HASH_ALGORITHM } from './constants.js';
import { ERROR_MESSAGES } from './errors.js';

const cache = new NodeCache();
const lock = new Map();

const l402Middleware = ({ speedApiKey, macaroonSecret, configs }) => {
    const endpointConfigMap = new Map();
    for (const config of configs) {
        endpointConfigMap.set(config.method + " " + config.path, config);
    }

    return async (request, response, next) => {

        const endpointConfig = getEndpointConfig(request, endpointConfigMap);
        if (isFreeEndpoint(endpointConfig)) {
            next();
            return;
        }
        if (isPaymentMissing(request)) {
            try {
                const invoiceResponse = await createSpeedInvoice(endpointConfig.currency, endpointConfig.amount, endpointConfig.targetCurrency, speedApiKey);
                const lightningInvoice = invoiceResponse.payment_method_options.lightning.payment_request;
                const macaroon = createMacaroon(endpointConfig, lightningInvoice, macaroonSecret);
                response.status(402).set(HEADERS.WWW_AUTHENTICATE, `${L402_SCHEME} macaroon="${macaroon}", invoice="${lightningInvoice}"`).json({});
            }
            catch (err) {
                console.error(err);
                response.status(500).json({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
            }
            return;
        }

        const authorizationHeader = request.headers[HEADERS.AUTHORIZATION].trim();
        const l402Match = authorizationHeader.match(
            /^L402\s+([^:\s]+):([^:\s]+)$/i
        );
        if (!l402Match) {
            response.status(400).json({ message: ERROR_MESSAGES.MALFORMED_AUTH_HEADER });
            return;
        }

        const [, encodedMacaroon, receivedPreimage] = l402Match;

        let paymentHash;
        try {
            const macaroonObject = JSON.parse(
                Buffer.from(encodedMacaroon, 'base64').toString('utf8')
            );
            const macaroon = importMacaroon(macaroonObject);

            verifyMacaroon(macaroon, endpointConfig, macaroonSecret);
            const preimageValid = await isPreimageValid(macaroon, receivedPreimage);

            paymentHash = extractCaveatFromMacaroon(macaroon, CAVEAT_KEYS.PAYMENT_HASH);
            const cachedResponse = cache.get(paymentHash);
            if (cachedResponse) {
                response.status(cachedResponse.status).set('Content-Type', cachedResponse.contentType).send(cachedResponse.body);
                return;
            }

            if (lock.get(paymentHash)) {
                response.status(409).json({ message: ERROR_MESSAGES.PAYMENT_ALREADY_PROCESSING });
                return;
            }
            lock.set(paymentHash, true);


            if (preimageValid) {
                const expiresAt = Number(extractCaveatFromMacaroon(macaroon, CAVEAT_KEYS.EXPIRES_AT));
                const originalSend = response.send.bind(response);
                response.send = (body) => {
                    const ttl = Math.floor((expiresAt - Date.now()) / 1000);
                    if (ttl > 0) {
                        cache.set(paymentHash, { body, contentType: response.getHeader('Content-Type'), status: response.statusCode }, ttl);
                    }
                    return originalSend(body);
                };
                response.on('finish', () => {
                    lock.delete(paymentHash);
                });
                next();
            } else {
                lock.delete(paymentHash);
                response.status(401).json({ message: ERROR_MESSAGES.INVALID_PREIMAGE });
            }
        } catch (error) {
            console.error(error);
            response.status(400).json({ message: ERROR_MESSAGES.MALFORMED_AUTH_HEADER });
            if (paymentHash && lock.has(paymentHash)) {
                lock.delete(paymentHash);
            }
        }
    }
};

function getEndpointConfig(request, endpointConfigMap) {
    return endpointConfigMap.get(request.method + " " + request.path);
}

function isFreeEndpoint(endpointConfig) {
    return (endpointConfig == undefined || endpointConfig.sats == 0);
}

function isPaymentMissing(request) {
    const authorizationHeader = request.headers[HEADERS.AUTHORIZATION];
    return !authorizationHeader?.trim();
}

function extractCaveatFromMacaroon(macaroon, caveatKey) {
    const decoder = new TextDecoder();

    const caveat = macaroon.caveats.find(c =>
        decoder.decode(c.identifier).startsWith(`${caveatKey} = `)
    );

    return caveat
        ? decoder.decode(caveat.identifier).split(' = ')[1]
        : null;
}

async function computePreimageHash(preimage) {
    const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, Buffer.from(preimage, 'hex'));
    return Buffer.from(hashBuffer).toString("hex");
}

async function isPreimageValid(macaroon, receivedPreimage) {
    const paymentHash = extractCaveatFromMacaroon(macaroon, CAVEAT_KEYS.PAYMENT_HASH);
    const receivedPaymentHash = await computePreimageHash(receivedPreimage);
    return paymentHash === receivedPaymentHash;
}

export default l402Middleware;