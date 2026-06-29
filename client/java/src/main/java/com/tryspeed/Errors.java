package com.tryspeed;

public class Errors {

    public static class InvalidInvoiceException extends RuntimeException {
        public InvalidInvoiceException(String message) {
            super(message);
        }
    }

    public static class PaymentException extends RuntimeException {
        public PaymentException(String message) {
            super(message);
        }
    }

    public static class L402ParseException extends RuntimeException {
        public L402ParseException(String message) {
            super(message);
        }
    }
}
