package com.bank.bank_fraud_detection.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

@Service
public class FraudDetectionService {

    private final JdbcTemplate jdbc;

    public FraudDetectionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Map<String, Object> checkTransaction(
            Map<String, Object> t) {

        String id = t.get("transaction_id").toString();
        String user = t.get("user_id").toString();
        String device = t.get("device_id").toString();

        BigDecimal amount =
                new BigDecimal(t.get("amount").toString());

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Amount must be greater than zero");
        }

        // Get customer's normal transaction limit
        BigDecimal limit = jdbc.queryForObject(
                "SELECT normal_limit FROM users WHERE user_id = ?",
                BigDecimal.class, user);

        // Check whether this device has been used before
        Integer knownDevice = jdbc.queryForObject(
                "SELECT COUNT(*) FROM transactions " +
                        "WHERE user_id = ? AND device_id = ?",
                Integer.class, user, device);

        // Count recent transactions
        Integer recentCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM transactions " +
                        "WHERE user_id = ? " +
                        "AND transaction_time >= NOW() - INTERVAL 10 MINUTE",
                Integer.class, user);

        List<String> rules = new ArrayList<>();

        if (amount.compareTo(limit) > 0) {
            rules.add("AMOUNT_ABOVE_NORMAL_LIMIT");
        }

        if (recentCount >= 3) {
            rules.add("FREQUENT_TRANSACTIONS");
        }

        if (knownDevice == 0) {
            rules.add("NEW_DEVICE");
        }

        // Assign a simple rule-based risk score
        int score = 0;

        if (amount.compareTo(limit) > 0) {
            score += 50;
        }

        if (recentCount >= 3) {
            score += 30;
        }

        if (knownDevice == 0) {
            score += 20;
        }

        score = Math.min(score, 100);

        String decision;
        String risk;

        if (score >= 70) {
            decision = "BLOCKED";
            risk = "HIGH";
        } else if (score >= 30) {
            decision = "REVIEW";
            risk = "MEDIUM";
        } else {
            decision = "ALLOWED";
            risk = "LOW";
        }

        // Save transaction
        jdbc.update(
                "INSERT INTO transactions " +
                        "(transaction_id, user_id, amount, merchant, " +
                        "location, device_id, transaction_type) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                id, user, amount,
                t.get("merchant"),
                t.get("location"),
                device,
                t.get("transaction_type")
        );

        // Save fraud detection result
        jdbc.update(
                "INSERT INTO fraud_logs " +
                        "(transaction_id, fraud_probability, risk_level, " +
                        "decision, detected_rules) " +
                        "VALUES (?, ?, ?, ?, ?)",
                id, BigDecimal.valueOf(score), risk,
                decision, String.join(", ", rules)
        );

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("transaction_id", id);
        result.put("risk_score", score);
        result.put("risk_level", risk);
        result.put("decision", decision);
        result.put("detected_rules", rules);

        return result;
    }

}
