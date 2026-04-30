import { importMacaroon } from 'macaroon';
import { createMacaroon, verifyMacaroon } from './macaroon.js';
import { createSpeedInvoice } from './speed.js';
import NodeCache from 'node-cache';
import { CAVEAT_KEYS, HEADERS, L402_SCHEME, HASH_ALGORITHM } from './constants.js';
import { ERROR_MESSAGES } from './errors.js';

const cache = new NodeCache();
const lock = new Map();

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

async function isPreimageValid(macaroon, receivedPreimage) {
    const paymentHash = getPaymentHash(macaroon);
    const receivedPaymentHash = await computePreimageHash(receivedPreimage);
    return paymentHash === receivedPaymentHash;
}

async function computePreimageHash(preimage) {
    const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, Buffer.from(preimage, 'hex'));
    return Buffer.from(hashBuffer).toString("hex");
}

function getPaymentHash(macaroon) {
    const decoder = new TextDecoder();

    const caveat = macaroon.caveats.find(c =>
        decoder.decode(c.identifier).startsWith(`${CAVEAT_KEYS.PAYMENT_HASH} = `)
    );

    return caveat
        ? decoder.decode(caveat.identifier).split(' = ')[1]
        : null;
}

export default (configs) => {
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
                const invoiceResponse = await createSpeedInvoice(endpointConfig.sats);
                const lightningInvoice = invoiceResponse.payment_method_options.lightning.payment_request;
                const macaroon = createMacaroon(endpointConfig, lightningInvoice);
                response.status(402).set(HEADERS.WWW_AUTHENTICATE, `${L402_SCHEME} macaroon="${macaroon}", invoice="${lightningInvoice}"`).json({});
            }
            catch (err) {
                console.error(err);
                response.status(500).json({ message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR });
            }
            return;
        }

        const authorizationHeader = request.headers[HEADERS.AUTHORIZATION].trim();
        const [encodedMacaroon, receivedPreimage] = authorizationHeader
            .replace(L402_SCHEME, '')
            .trim()
            .split(':').map(s => s.trim());

        try {
            const macaroonObject = JSON.parse(
                Buffer.from(encodedMacaroon, 'base64').toString('utf8')
            );
            const macaroon = importMacaroon(macaroonObject);
            const paymentHash = getPaymentHash(macaroon);

            if (lock.get(paymentHash)) {
                response.status(409).json({ message: ERROR_MESSAGES.PAYMENT_ALREADY_PROCESSING });
                return;
            }
            lock.set(paymentHash, true);

            const cachedResponse = cache.get(paymentHash);
            if (cachedResponse) {
                response.status(cachedResponse.status).set('Content-Type', cachedResponse.contentType).send(cachedResponse.body);
                return;
            }

            verifyMacaroon(macaroon, receivedPreimage, endpointConfig);
            const preimageValid = await isPreimageValid(macaroon, receivedPreimage);
            if (preimageValid) {
                const originalSend = response.send.bind(response);
                response.send = (body) => {
                    cache.set(paymentHash, { body, contentType: response.getHeader('Content-Type'), status: response.statusCode });
                    return originalSend(body);
                };
                next();
            }
        } catch (error) {
            console.error(error);
            response.status(400).json({ message: ERROR_MESSAGES.MALFORMED_AUTH_HEADER });
        } finally {
            lock.delete(paymentHash);
        }
    };
}
