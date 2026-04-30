import { config } from "dotenv";
import { SPEED_BASE_URL, SPEED_CURRENCY, SPEED_PAYMENT_METHOD, ENV_VARS } from './constants.js';

config();


function buildRequestHeaders() {
    return {
        "Authorization": `Basic ${process.env[ENV_VARS.SPEED_KEY]}`,
        "Content-Type": "application/json",
    };
}

export async function createSpeedInvoice(sats) {
    const invoicePayload = {
        amount: sats,
        currency: SPEED_CURRENCY,
        target_currency: SPEED_CURRENCY,
        payment_methods: [SPEED_PAYMENT_METHOD]
    };

    const apiResponse = await fetch(`${SPEED_BASE_URL}/payments`, {
        headers: buildRequestHeaders(),
        method: "POST",
        body: JSON.stringify(invoicePayload)
    });
    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        throw new Error(`Speed API error (${apiResponse.status}): ${errorBody}`);
    }
    return apiResponse.json();
}