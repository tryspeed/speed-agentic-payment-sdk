package com.tryspeed;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

class Bolt11Decoder {

    public static long getAmountSats(String invoice) {
        Matcher matcher = Pattern.compile(Constants.BOLT11_AMOUNT_REGEX, Pattern.CASE_INSENSITIVE).matcher(invoice);

        if (!matcher.find()) {
            throw new Errors.InvalidInvoiceException("Invalid BOLT11 invoice or missing amount");
        }

        long amount = Long.parseLong(matcher.group(1));
        String multiplier = matcher.group(2);

        if (multiplier == null) {
            return amount * Constants.SAT_PER_BTC;
        }

        return switch (multiplier) {
            case "m" -> amount * Constants.SAT_PER_BTC / 1_000L;
            case "u" -> amount * Constants.SAT_PER_BTC / 1_000_000L;
            case "n" -> amount * Constants.SAT_PER_BTC / 1_000_000_000L;
            case "p" -> amount * Constants.SAT_PER_BTC / 1_000_000_000_000L;
            default -> throw new Errors.InvalidInvoiceException("Unknown multiplier: " + multiplier);
        };
    }
}
