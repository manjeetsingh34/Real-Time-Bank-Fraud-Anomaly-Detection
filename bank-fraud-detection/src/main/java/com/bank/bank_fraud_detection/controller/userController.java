package com.bank.bank_fraud_detection.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin
public class userController {
    private final JdbcTemplate jdbcTemplate;

    public userController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping
    public List<Map<String, Object>> getUsers() {
        String sql = """
            SELECT user_id, user_name
            FROM users
            ORDER BY user_name
            """;

        return jdbcTemplate.queryForList(sql);
    }

}
