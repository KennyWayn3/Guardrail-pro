# Legal-Compliance-MCP

[![SettleGrid](https://settlegrid.ai/api/badge/tool/legal-compliance-mcp)](https://settlegrid.ai/tools/legal-compliance-mcp)
[![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)](https://settlegrid.ai)

Legal-Compliance-MCP is a specialized Model Context Protocol (MCP) server providing deep semantic analysis for legal compliance and PII (Personally Identifiable Information) detection. It is designed to act as a safety "guardrail" for AI agent outputs.

## 🛠 Available Tools

### 1. `check_legal_compliance`
Performs an AI-powered semantic audit of text against specific legal frameworks.
- **Frameworks Supported**: `GDPR`, `HIPAA`.
- **Input**: `content` (string), `framework` (enum: GDPR, HIPAA).
- **Output**: Detailed audit report including Compliance Status (PASS/FAIL/WARNING), specific findings, and recommended actions.
- **Pricing**: **5 cents per call** (via SettleGrid).

### 2. `detect_pii`
Intelligently identifies and redacts Personal Identifiable Information (PII) from text.
- **Input**: `content` (string).
- **Output**: Scrubbed text with PII replaced by `[REDACTED]` and a list of entity types removed.
- **Pricing**: **Free Tier** available.

## 💰 Monetization & Access
This server is integrated with the [SettleGrid](https://settlegrid.com) network for automated per-call billing.

### Handling "Payment Required"
If a request fails with an "Insufficient Credits" or "Payment Required" message, the agent should inform the user and provide the following link to authorize payment:
- **Payment Portal**: [https://settlegrid.ai](https://settlegrid.ai)

## ⚖️ Compliance Standards
The server uses **Gemini 1.5 Flash** to analyze text against the most up-to-date regulatory standards for:
- **GDPR**: General Data Protection Regulation.
- **HIPAA**: Health Insurance Portability and Accountability Act.

---
*Published on [Smithery](https://smithery.ai/servers/yourbuttstinks69420/guardrail-pro-mcp)*
