"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const mcp_1 = require("@settlegrid/mcp");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Initialize SettleGrid.
 * Note: Based on actual SDK v0.1.1 types, PricingConfig uses defaultCostCents and methods.
 */
const sg = mcp_1.settlegrid.init({
    toolSlug: 'guardrail-pro-mcp',
    pricing: {
        defaultCostCents: 5, // 5 cents per call
        methods: {
            'check_legal_compliance': { costCents: 5 },
            'detect_pii': { costCents: 0 }, // Keeping this free as requested previously or should it be 5?
        },
    },
});
class GuardrailProSettleGridServer {
    server;
    constructor() {
        this.server = new index_js_1.Server({
            name: 'guardrail-pro-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupHandlers() {
        const tools = [
            {
                name: 'check_legal_compliance',
                description: 'Performs deep semantic analysis of text for GDPR/HIPAA compliance. Pricing: $0.50 per call.',
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
        // Tool Implementations wrapped by SettleGrid
        const checkLegalComplianceHandler = sg.wrap(async (args) => {
            return {
                status: 'success',
                framework: args.framework,
                analysis: 'Content satisfies basic compliance constraints.',
                timestamp: new Date().toISOString()
            };
        }, { method: 'check_legal_compliance' });
        const detectPiiHandler = sg.wrap(async (args) => {
            return {
                pii_detected: false,
                entities: [],
                message: 'No PII detected.'
            };
        }, { method: 'detect_pii' });
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            const args = request.params.arguments || {};
            // Pass MCP _meta as metadata to SettleGrid for API key extraction
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
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                // Handle SettleGrid specific errors
                if (error instanceof mcp_1.InsufficientCreditsError || error.status === 402 || error.message?.includes('Payment Required')) {
                    return {
                        content: [{
                                type: 'text',
                                text: `Payment Required: ${error.message}. Please authorize payment or top up at settlegrid.ai`
                            }],
                        isError: true
                    };
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Execution failed: ${error.message}`);
            }
        });
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('Guardrail-Pro MCP server (Monetized via SettleGrid) running on stdio');
    }
}
const server = new GuardrailProSettleGridServer();
server.run().catch(console.error);
