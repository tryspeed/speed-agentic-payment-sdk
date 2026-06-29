package com.tryspeed;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class L402HttpClient {

    private final HttpClient httpClient;
    private final String apiKey;
    private final Speed speed;

    private L402HttpClient(Builder builder) {
        this.httpClient = builder.httpClient;
        this.apiKey = Base64.getEncoder().encodeToString(builder.apiKey.getBytes(StandardCharsets.UTF_8));
        this.speed = new Speed(this.httpClient);
    }

    public HttpResponse<String> fetch(String url, Map<String, String> headers) throws Exception {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder().uri(URI.create(url)).GET();
        if (headers != null) headers.forEach(requestBuilder::header);

        HttpResponse<String> initialResponse = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());

        if (initialResponse.statusCode() != 402) {
            return initialResponse;
        }

        String wwwAuth = initialResponse.headers().firstValue("www-authenticate")
                .orElseThrow(() -> new Errors.L402ParseException("Missing www-authenticate header"));

        String macaroon = extractGroup(wwwAuth, Constants.MACAROON_REGEX);
        String invoice = extractGroup(wwwAuth, Constants.INVOICE_REGEX);

        if (macaroon == null || invoice == null) {
            throw new Errors.L402ParseException("Failed to parse L402 www-authenticate header");
        }

        long amount = Bolt11Decoder.getAmountSats(invoice);
        String preimage = speed.payInvoice(invoice, amount, apiKey);

        Map<String, String> authHeaders = new HashMap<>();
        if (headers != null) authHeaders.putAll(headers);
        authHeaders.put("Authorization", "L402 " + macaroon + ":" + preimage);

        HttpRequest.Builder retryBuilder = HttpRequest.newBuilder().uri(URI.create(url)).GET();
        authHeaders.forEach(retryBuilder::header);
        return httpClient.send(retryBuilder.build(), HttpResponse.BodyHandlers.ofString());
    }

    public HttpResponse<String> fetch(String url) throws Exception {
        return fetch(url, null);
    }

    private static String extractGroup(String header, String regex) {
        Matcher m = Pattern.compile(regex).matcher(header);
        return m.find() ? m.group(1) : null;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private HttpClient httpClient;
        private String apiKey;

        public Builder httpClient(HttpClient httpClient) {
            this.httpClient = httpClient;
            return this;
        }

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public L402HttpClient build() {
            if (apiKey == null || apiKey.isBlank()) {
                throw new IllegalStateException("apiKey is required");
            }
            if (httpClient == null) {
                httpClient = HttpClient.newHttpClient();
            }
            return new L402HttpClient(this);
        }
    }
}
