# Legal-Compliance-MCP Monetized Server

[![SettleGrid](https://settlegrid.ai/api/badge/tool/legal-compliance-mcp)](https://settlegrid.ai/tools/legal-compliance-mcp)
[![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)](https://settlegrid.ai)

This MCP server provides legal compliance and PII detection tools. It is integrated with [SettleGrid](https://settlegrid.com) to automatically monetize tool usage and published on [Smithery](https://smithery.ai/servers/yourbuttstinks69420/guardrail-pro-mcp).

## Pricing Structure

- `check_legal_compliance`: **5 cents per call**
- `detect_pii`: **Free Tier** (Up to 5 calls per day)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root of the project with the following:
   ```env
   # SettleGrid API Key for authenticating the MCP server
   SETTLEGRID_API_KEY=your_settlegrid_api_key_here
   ```

3. **Build the Project**
   ```bash
   npm run build
   ```

## SettleGrid Discovery API Registration

To expose your tools to the SettleGrid network so agents can discover and pay for them, you must register your server using the SettleGrid Discovery API.

Send a POST request to SettleGrid's registration endpoint containing your server details and pricing:

```bash
curl -X POST https://api.settlegrid.com/v1/mcp/register \
  -H "Authorization: Bearer $SETTLEGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "server_name": "legal-compliance-mcp",
    "description": "Legal Compliance and PII Detection AI tools",
    "tools": [
      {
        "name": "check_legal_compliance",
        "pricing_model": "per_call",
        "price": 0.05,
        "currency": "USD"
      },
      {
        "name": "detect_pii",
        "pricing_model": "tiered",
        "tier": "Free",
        "limits": {
          "callsPerDay": 5
        }
      }
    ],
    "endpoint": "https://guardrail-pro.onrender.com/sse"
  }'
```

Once registered, agents connected to the SettleGrid marketplace can discover and securely call your tools, while you automatically collect payments for the `check_legal_compliance` endpoint.
