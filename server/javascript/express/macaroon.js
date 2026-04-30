import pkg from 'macaroon';
const { newMacaroon } = pkg;
import { config } from "dotenv";
import { decode } from 'light-bolt11-decoder';
import { MACAROON_VERSION, CAVEAT_KEYS } from './constants.js';
config();


export function createMacaroon(routeConfig, bolt11Invoice) {
  const paymentHash = decode(bolt11Invoice).sections.find(s => s.name === CAVEAT_KEYS.PAYMENT_HASH).value;
  const macaroon = newMacaroon({
    version: MACAROON_VERSION,
    rootKey: Buffer.from(process.env.MACAROON_SIGNING_SECRET, 'hex'),
    identifier: crypto.randomUUID(),
  });
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.METHOD} = ${routeConfig.method}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.PATH} = ${routeConfig.path}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.SATS} = ${routeConfig.sats}`);
  macaroon.addFirstPartyCaveat(`${CAVEAT_KEYS.PAYMENT_HASH} = ${paymentHash}`);
  const serializedMacaroon = macaroon.exportJSON();
  return Buffer.from(JSON.stringify(serializedMacaroon)).toString('base64');
}

export function verifyMacaroon(macaroon, receivedPreimage, routeConfig) {
  macaroon.verify(
    Buffer.from(process.env.MACAROON_SIGNING_SECRET, 'hex'),
    (caveat) => {
      if (caveat === `${CAVEAT_KEYS.METHOD} = ${routeConfig.method}`) return;
      if (caveat === `${CAVEAT_KEYS.PATH} = ${routeConfig.path}`) return;
      if (caveat === `${CAVEAT_KEYS.SATS} = ${routeConfig.sats}`) return;

      const [caveatKey] = caveat.split(' = ');
      if (caveatKey === CAVEAT_KEYS.PAYMENT_HASH) return;

      return `caveat not satisfied: ${caveat}`;
    },
    []
  );
}