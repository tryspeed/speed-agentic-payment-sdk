import { newMacaroon } from 'macaroon';
import { decode } from 'light-bolt11-decoder';
import { MACAROON_VERSION, CAVEAT_KEYS, DEFAULT_CAVEAT_TTL_MS } from './constants.js';
import { randomUUID } from 'node:crypto';

export function createMacaroon(routeConfig, bolt11Invoice, macaroonSecret, caveatTtlMs) {
  const paymentHashSection = decode(bolt11Invoice).sections.find(s => s.name === CAVEAT_KEYS.PAYMENT_HASH);
  if (!paymentHashSection) {
    throw new Error('Invalid BOLT11 invoice: missing payment_hash');
  }
  const paymentHash = paymentHashSection.value;
  const macaroon = newMacaroon({
    version: MACAROON_VERSION,
    rootKey: Buffer.from(macaroonSecret, 'hex'),
    identifier: randomUUID(),
  });
  const effectiveTtlMs = caveatTtlMs ?? DEFAULT_CAVEAT_TTL_MS;

  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.PAYMENT_HASH} = ${paymentHash}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.EXPIRES_AT} = ${Date.now() + effectiveTtlMs}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.METHOD} = ${routeConfig.method}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.PATH} = ${routeConfig.path}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.AMOUNT} = ${routeConfig.amount}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.CURRENCY} = ${routeConfig.currency}`);
  const serializedMacaroon = macaroon.exportJSON();
  return Buffer.from(JSON.stringify(serializedMacaroon)).toString('base64');
}

export function verifyMacaroon(macaroon, routeConfig, macaroonSecret) {
  macaroon.verify(
    Buffer.from(macaroonSecret, 'hex'),
    (caveat) => {
      if (caveat === `${CAVEAT_KEYS.METHOD} = ${routeConfig.method}`) return;
      if (caveat === `${CAVEAT_KEYS.PATH} = ${routeConfig.path}`) return;
      if (caveat === `${CAVEAT_KEYS.AMOUNT} = ${routeConfig.amount}`) return;
      if (caveat === `${CAVEAT_KEYS.CURRENCY} = ${routeConfig.currency}`) return;

      const [caveatKey, caveatValue] = caveat.split(' = ');
      if (caveatKey === CAVEAT_KEYS.PAYMENT_HASH) return;
      if (caveatKey === CAVEAT_KEYS.EXPIRES_AT) {
        const expiresAt = Number(caveatValue);
        if (isNaN(expiresAt) || Date.now() > expiresAt) return `caveat not satisfied: ${caveat}`;
        return;
      }

      return `caveat not satisfied: ${caveat}`;
    },
    []
  );
}