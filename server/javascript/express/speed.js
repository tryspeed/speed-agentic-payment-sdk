import { config } from "dotenv";
import { SPEED_API_URL, SPEED_CURRENCY, SPEED_PAYMENT_METHOD } from './constants.js';

config();


function buildRequestHeaders() {
    return {
        "Authorization": `Basic ${process.env.SPEED_KEY}`,
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

    const apiResponse = await fetch(SPEED_API_URL, {
        headers: buildRequestHeaders(),
        method: "POST",
        body: JSON.stringify(invoicePayload)
    });
    return apiResponse.json();
}