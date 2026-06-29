package com.tryspeed;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Map;

public class Speed {

    private final HttpClient httpClient;
    private final ObjectMapper mapper = new ObjectMapper();

    public Speed(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    private String pollWithdraw(String withdrawId, String apiKey) throws Exception {
        for (int i = 0; i < Constants.POLL_MAX_ATTEMPTS; i++) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(Constants.SPEED_BASE_URL + "/withdraws/" + withdrawId))
                    .header("Authorization", "Basic " + apiKey)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode json = mapper.readTree(response.body());

            if (json.has(JsonKeys.STATUS) && "paid".equals(json.get(JsonKeys.STATUS).asString())) {
                return json.get(JsonKeys.PAYMENT_PREIMAGE).asString();
            }

            Thread.sleep(Constants.POLL_INTERVAL_MS);
        }
        throw new Errors.PaymentException("Payment not confirmed after " + Constants.POLL_MAX_ATTEMPTS + " attempts");
    }

    public String payInvoice(String invoice, long amount, String apiKey) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put(JsonKeys.AMOUNT, amount);
        body.put(JsonKeys.CURRENCY, Constants.CURRENCY_SATS);
        body.put(JsonKeys.TARGET_CURRENCY, Constants.CURRENCY_SATS);
        body.put(JsonKeys.WITHDRAW_METHOD, Constants.WITHDRAW_METHOD_LIGHTNING);
        body.put(JsonKeys.WITHDRAW_REQUEST, invoice);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(Constants.SPEED_BASE_URL + "/send"))
                .header("Authorization", "Basic " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode json = mapper.readTree(response.body());

        if (json.has(JsonKeys.ERRORS)) {
            StringBuilder sb = new StringBuilder();
            for (JsonNode e : json.get(JsonKeys.ERRORS)) {
                if (!sb.isEmpty()) sb.append(", ");
                sb.append(e.get(JsonKeys.MESSAGE).asString());
            }
            throw new Errors.PaymentException(sb.toString());
        }

        return pollWithdraw(json.get(JsonKeys.WITHDRAW_ID).asString(), apiKey);
    }
}
