const API_URL = "/api/transactions";

const form = document.getElementById("transactionForm");
const submitButton = document.getElementById("submitButton");
const buttonText = document.getElementById("buttonText");
const errorMessage = document.getElementById("errorMessage");

const emptyResult = document.getElementById("emptyResult");
const resultContent = document.getElementById("resultContent");

const historyBody = document.getElementById("historyBody");

let transactions = [];
let counts = {
    total: 0,
    allowed: 0,
    review: 0,
    blocked: 0
};

// Read a field from a response using possible backend field names.
function getValue(object, names, fallback = "") {
    for (const name of names) {
        if (
            object &&
            object[name] !== undefined &&
            object[name] !== null
        ) {
            return object[name];
        }
    }

    return fallback;
}

// Convert a risk level or decision to a standard category.
function normalizeDecision(value) {
    const text = String(value || "").toUpperCase();

    if (text.includes("BLOCK")) return "BLOCKED";
    if (text.includes("REVIEW")) return "REVIEW";
    if (text.includes("ALLOW")) return "ALLOWED";

    return "";
}

function normalizeRisk(value, score) {
    const text = String(value || "").toUpperCase();

    if (text.includes("HIGH")) return "HIGH";
    if (text.includes("MEDIUM") || text.includes("MODERATE")) {
        return "MEDIUM";
    }
    if (text.includes("LOW")) return "LOW";

    if (score >= 70) return "HIGH";
    if (score >= 30) return "MEDIUM";

    return "LOW";
}

// Hide any previous error.
function hideError() {
    errorMessage.hidden = true;
    errorMessage.textContent = "";
}

// Show an error message.
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

// Update the dashboard summary cards.
function updateCounters() {
    document.getElementById("totalCount").textContent = counts.total;
    document.getElementById("allowedCount").textContent = counts.allowed;
    document.getElementById("reviewCount").textContent = counts.review;
    document.getElementById("blockedCount").textContent = counts.blocked;
}

// Add a transaction to the session history.
function addToHistory(transaction) {
    transactions.unshift(transaction);

    // Keep the most recent 20 transactions.
    transactions = transactions.slice(0, 20);

    renderHistory();
}

document.addEventListener("DOMContentLoaded", loadUsers);

// Display recent transactions in the table.
function renderHistory() {
    historyBody.replaceChildren();

    if (transactions.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.className = "no-history";
        cell.textContent = "No transactions analyzed yet.";

        row.appendChild(cell);
        historyBody.appendChild(row);
        return;
    }

    transactions.forEach(transaction => {
        const row = document.createElement("tr");

        addCell(row, transaction.id);
        addCell(row, transaction.userId);
        addCell(
            row,
            "₹" + Number(transaction.amount).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        );

        const riskCell = document.createElement("td");
        const riskBadge = document.createElement("span");

        riskBadge.className =
            "table-badge " + transaction.risk.toLowerCase();

        riskBadge.textContent = transaction.risk;

        riskCell.appendChild(riskBadge);
        row.appendChild(riskCell);

        const decisionCell = document.createElement("td");
        const decisionBadge = document.createElement("span");

        decisionBadge.className =
            "table-badge " + transaction.risk.toLowerCase();

        decisionBadge.textContent = transaction.decision;

        decisionCell.appendChild(decisionBadge);
        row.appendChild(decisionCell);

        historyBody.appendChild(row);
    });
}


// Safely add text to a table cell.
function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

// Display the latest fraud analysis.
function displayResult(transaction) {
    emptyResult.hidden = true;
    resultContent.hidden = false;

    const badge = document.getElementById("resultBadge");
    const symbol = document.getElementById("resultSymbol");
    const decisionText = document.getElementById("resultDecision");
    const scoreFill = document.getElementById("scoreFill");

    badge.className = "result-badge";
    scoreFill.className = "score-fill";

    if (transaction.risk === "HIGH") {
        badge.classList.add("high");
        scoreFill.classList.add("high");
        symbol.textContent = "!";
    } else if (transaction.risk === "MEDIUM") {
        badge.classList.add("medium");
        scoreFill.classList.add("medium");
        symbol.textContent = "◷";
    } else {
        symbol.textContent = "✓";
    }

    decisionText.textContent = transaction.decision;

    document.getElementById("riskScore").textContent =
        transaction.score + "/100";

    scoreFill.style.width = transaction.score + "%";

    document.getElementById("resultTransactionId").textContent =
        transaction.id;

    document.getElementById("resultRiskLevel").textContent =
        transaction.risk;

    document.getElementById("resultReason").textContent =
        transaction.reason || "Analysis completed.";
}

// Read the backend result and convert it to the frontend format.
function parseBackendResult(data, submittedTransaction) {
    const rawScore = getValue(data, [
        "fraudScore",
        "riskScore",
        "score",
        "fraudProbability"
    ], 0);

    let score = Number(rawScore);

    if (!Number.isFinite(score)) {
        score = 0;
    }

    // The project's score is on a 0–100 scale.
    // If the backend returns a decimal probability between 0 and 1,
    // convert it to a percentage.
    if (
        score > 0 &&
        score <= 1 &&
        !(
            data &&
            (
                data.fraudScore !== undefined ||
                data.riskScore !== undefined ||
                data.score !== undefined
            )
        )
    ) {
        score *= 100;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const rawRisk = getValue(data, [
        "riskLevel",
        "risk",
        "risk_level"
    ], "");

    let risk = normalizeRisk(rawRisk, score);

    const rawDecision = getValue(data, [
        "decision",
        "status",
        "transactionStatus",
        "fraudDecision"
    ], "");

    let decision = normalizeDecision(rawDecision);

    // Use the backend decision if provided.
    // Otherwise apply the project's configured score thresholds.
    if (!decision) {
        decision = score >= 70
            ? "BLOCKED"
            : score >= 30
                ? "REVIEW"
                : "ALLOWED";
    }

    // If the backend provides a decision but not a risk level,
    // infer the display level from the decision.
    if (!rawRisk) {
        risk = decision === "BLOCKED"
            ? "HIGH"
            : decision === "REVIEW"
                ? "MEDIUM"
                : "LOW";
    }

    return {
        id: String(getValue(data, [
            "transactionId",
            "transaction_id",
            "id"
        ], submittedTransaction.transaction_id)),

        userId: String(getValue(data, [
            "userId",
            "user_id"
        ], submittedTransaction.user_id)),

        amount: Number(getValue(data, [
            "amount"
        ], submittedTransaction.amount)),

        score,
        risk,
        decision,

        reason: String(getValue(data, [
            "detectedRules",
            "reason",
            "message",
            "description",
            "rules"
        ], "Risk evaluation completed by the backend."))
    };
}

// Submit a transaction to Spring Boot.
form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideError();

    if (!form.reportValidity()) {
        return;
    }

    const transaction = {
        transaction_id: document.getElementById("transaction_id").value.trim(),
        user_id: document.getElementById("user_id").value,
        amount: Number(document.getElementById("amount").value),
        merchant: document.getElementById("merchant").value.trim(),
        location: document.getElementById("location").value.trim(),
        device_id: document.getElementById("device_id").value.trim(),
        transaction_type: document.getElementById("transaction_type").value
    };

    if (transaction.amount <= 0 || !Number.isFinite(transaction.amount)) {
        showError("Please enter a valid transaction amount greater than zero.");
        return;
    }

    submitButton.disabled = true;
    buttonText.textContent = "Analyzing transaction...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        const responseText = await response.text();

        let data = {};

        if (responseText.trim()) {
            try {
                data = JSON.parse(responseText);
            } catch {
                data = { message: responseText };
            }
        }

        if (!response.ok) {
            const detail = getValue(data, [
                "message",
                "error",
                "detail"
            ], "");

            if (response.status === 500) {
                throw new Error(
                    "The backend returned HTTP 500. Check the Spring Boot console " +
                    "for the actual database or Java error." +
                    (detail ? " Details: " + detail : "")
                );
            }

            throw new Error(
                "Request failed (HTTP " + response.status + "). " +
                (detail || "Please check your transaction details.")
            );
        }

        const result = parseBackendResult(data, transaction);

        // Update the result and dashboard.
        displayResult(result);
        addToHistory(result);

        counts.total++;

        if (result.decision === "BLOCKED") {
            counts.blocked++;
        } else if (result.decision === "REVIEW") {
            counts.review++;
        } else {
            counts.allowed++;
        }

        updateCounters();

        // Return the user to the result area.
        document.querySelector(".result-panel").scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });

    } catch (error) {
        console.error("Transaction analysis failed:", error);

        showError(
            error.message ||
            "Could not connect to the backend. Make sure Spring Boot is running."
        );

    } finally {
        submitButton.disabled = false;
        buttonText.textContent = "Analyze transaction";
    }
});

// Clear the visible session history and counters.
document.getElementById("clearHistory").addEventListener("click", function () {
    const confirmed = window.confirm(
        "Clear the transaction history and dashboard counters for this browser session?"
    );

    if (!confirmed) {
        return;
    }

    transactions = [];

    counts = {
        total: 0,
        allowed: 0,
        review: 0,
        blocked: 0
    };

    updateCounters();
    renderHistory();
});

// Highlight the selected sidebar item.
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", function () {
        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");
    });
});

// Initialize the dashboard.
updateCounters();
renderHistory();

// Load USers

async function loadUsers() {
    const dropdown = document.getElementById("user_id");

    if (!dropdown) {
        console.error("User dropdown not found in HTML!");
        return;
    }

    try {
        const response = await fetch("/api/users");

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const users = await response.json();

        dropdown.innerHTML = '<option value="">Select User</option>';

        users.forEach(user => {
            const option = document.createElement("option");

            option.value = user.user_id;
            option.textContent =
                `${user.user_name} (${user.user_id})`;

            dropdown.appendChild(option);
        });

        console.log("Users loaded successfully:", users);

    } catch (error) {
        console.error("Failed to load users:", error);
        dropdown.innerHTML =
            '<option value="">Unable to load users</option>';
    }
}

loadUsers();