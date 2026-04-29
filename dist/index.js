"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const mcp_1 = require("@settlegrid/mcp");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const ComplianceEngine_js_1 = require("./ComplianceEngine.js");
dotenv_1.default.config();
const sg = mcp_1.settlegrid.init({
    toolSlug: 'legal-compliance-mcp',
    pricing: {
        defaultCostCents: 5,
        methods: {
            'check_legal_compliance': { costCents: 5 },
            'detect_pii': { costCents: 0 },
        },
    },
});
class GuardrailProSettleGridServer {
    server;
    app;
    transport;
    engine;
    constructor() {
        this.app = (0, express_1.default)();
        this.engine = new ComplianceEngine_js_1.ComplianceEngine();
        this.server = new index_js_1.Server({
            name: 'legal-compliance-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
        this.setupExpress();
    }
    setupHandlers() {
        const tools = [
            {
                name: 'check_legal_compliance',
                description: 'Performs deep semantic analysis of text for GDPR/HIPAA compliance. Pricing: 5 cents per call.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: { type: 'string', description: 'Content to analyze' },
                        framework: { type: 'string', enum: ['GDPR', 'HIPAA'], description: 'The compliance framework to check against' }
                    },
                    required: ['content', 'framework']
                }
            },
            {
                name: 'detect_pii',
                description: 'Detects PII in text. Free tier: 5 calls per day.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        content: { type: 'string', description: 'Content to analyze for PII' }
                    },
                    required: ['content']
                }
            }
        ];
        const checkLegalComplianceHandler = sg.wrap(async (args) => {
            return await this.engine.checkCompliancePremium(args.content, args.framework);
        }, { method: 'check_legal_compliance' });
        const detectPiiHandler = sg.wrap(async (args) => {
            return await this.engine.scrubPii(args.content);
        }, { method: 'detect_pii' });
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            const args = request.params.arguments || {};
            const context = {
                metadata: request.params._meta || {}
            };
            try {
                let result;
                switch (toolName) {
                    case 'check_legal_compliance':
                        result = await checkLegalComplianceHandler(args, context);
                        break;
                    case 'detect_pii':
                        result = await detectPiiHandler(args, context);
                        break;
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Tool not found: ${toolName}`);
                }
                return {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                };
            }
            catch (error) {
                if (error instanceof mcp_1.InsufficientCreditsError || error.status === 402 || error.message?.includes('Payment Required')) {
                    return {
                        content: [{ type: 'text', text: `Payment Required: ${error.message}. Please authorize payment at settlegrid.ai` }],
                        isError: true
                    };
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Execution failed: ${error.message}`);
            }
        });
    }
    setupExpress() {
        this.app.get('/sse', async (req, res) => {
            this.transport = new sse_js_1.SSEServerTransport('/messages', res);
            await this.server.connect(this.transport);
            console.log('New SSE connection established');
        });
        this.app.post('/messages', async (req, res) => {
            if (!this.transport) {
                res.status(400).send('No active SSE connection');
                return;
            }
            await this.transport.handlePostMessage(req, res);
        });
        this.app.get('/', (req, res) => {
            res.send('Guardrail-Pro MCP Server is running! Use /sse for MCP connections.');
        });
        this.app.get('/health', (req, res) => {
            res.status(200).send('OK');
        });
        this.app.get('/.well-known/mcp/server-card.json', (req, res) => {
            res.sendFile(path_1.default.resolve(__dirname, '../server-card.json'));
        });
        this.app.get('/.well-known/smithery-verification', (req, res) => {
            res.send('smithery-verification=2788e1e225f8d0b652ae5f0c2eefa090879a0201e93aa008b863a6ad284c9d02');
        });
    }
    run() {
        const port = process.env.PORT || 3000;
        this.app.listen(port, () => {
            console.log(`Guardrail-Pro MCP server (SSE) listening on port ${port}`);
            console.log(`SSE endpoint: http://localhost:${port}/sse`);
            console.log(`Messages endpoint: http://localhost:${port}/messages`);
        });
    }
}
const server = new GuardrailProSettleGridServer();
server.run();
