package com.bank.bank_fraud_detection.controller;

import com.bank.bank_fraud_detection.service.FraudDetectionService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.*;
import java.util.Map;


@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final FraudDetectionService service;

    public TransactionController(FraudDetectionService service){
        this.service = service;
    }

    @PostMapping
    public Map<String, Object> addTransaction(
            @RequestBody Map<String, Object> transaction) {
        return service.checkTransaction(transaction);
    }

    @GetMapping
    public String getTransactions() {
        return "Transactions API is working";
    }
}
