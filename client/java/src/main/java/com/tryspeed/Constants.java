package com.tryspeed;

final class Constants {

    private Constants() {
    }

    static final String BOLT11_AMOUNT_REGEX = "^ln(?:bc|tb|bcrt|tbs)(\\d+)([munp])?1";
    static final String CURRENCY_SATS = "SATS";
    static final String INVOICE_REGEX = "invoice=\"([^\"]+)\"";
    static final String MACAROON_REGEX = "macaroon=\"([^\"]+)\"";
    static final String SPEED_BASE_URL = "https://api.tryspeed.dev";
    static final String WITHDRAW_METHOD_LIGHTNING = "lightning";
    static final int POLL_MAX_ATTEMPTS = 30;
    static final long SAT_PER_BTC = 100_000_000L;
    static final long POLL_INTERVAL_MS = 1000L;
}
