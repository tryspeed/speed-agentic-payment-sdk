import { SPEED_BASE_URL, SPEED_CURRENCY, SPEED_PAYMENT_METHOD } from './constants.js';

export async function createSpeedInvoice(currency, amount, targetCurrency, apiKey) {
    const invoicePayload = {
        currency,
        amount,
        target_currency: targetCurrency ?? SPEED_CURRENCY,
        payment_methods: [SPEED_PAYMENT_METHOD]
    };

    const apiResponse = await fetch(`${SPEED_BASE_URL}/payments`, {
        headers: {
            "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
            "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(invoicePayload)
    });
    if (!apiResponse.ok) {
        const errorBody = await apiResponse.text();
        throw new Error(`Speed API error (${apiResponse.status}): ${errorBody}`);
    }
    return apiResponse.json();
}