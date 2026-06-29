package com.tryspeed;

import org.junit.jupiter.api.Test;

import java.net.http.HttpResponse;
import java.util.Map;

public class L402HttpClientTest {

    private static final String API_KEY = "YOUR_API_KEY_HERE";
    private static final String PROTECTED_URL = "L402_PROTECTED_URL_HERE";

    @Test
    void fetchWithoutCustomHeaders() throws Exception {
        L402HttpClient client = L402HttpClient.builder()
                .apiKey(API_KEY)
                .build();

        HttpResponse<String> response = client.fetch(PROTECTED_URL);
        System.out.println("Status: " + response.statusCode());
        System.out.println("Body:   " + response.body());
    }

    @Test
    void fetchWithCustomHeaders() throws Exception {
        L402HttpClient client = L402HttpClient.builder()
                .apiKey(API_KEY)
                .build();

        Map<String, String> headers = Map.of("Accept", "application/json");
        HttpResponse<String> response = client.fetch(PROTECTED_URL, headers);
        System.out.println("Status: " + response.statusCode());
        System.out.println("Body:   " + response.body());
    }

    @Test
    void fetchWithCustomHttpClient() throws Exception {
        java.net.http.HttpClient customHttpClient = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build();

        L402HttpClient client = L402HttpClient.builder()
                .apiKey(API_KEY)
                .httpClient(customHttpClient)
                .build();

        HttpResponse<String> response = client.fetch(PROTECTED_URL);
        System.out.println("Status: " + response.statusCode());
        System.out.println("Body:   " + response.body());
    }

}
