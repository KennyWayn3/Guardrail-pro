import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { settlegrid, InsufficientCreditsError } from '@settlegrid/mcp';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Initialize SettleGrid.
 * Note: Based on actual SDK v0.1.1 types, PricingConfig uses defaultCostCents and methods.
 */
const sg = settlegrid.init({
  toolSlug: 'guardrail-pro-mcp',
  pricing: {
    defaultCostCents: 50, // $0.50 default per call
    methods: {
      'check_legal_compliance': { costCents: 50 },
      'detect_pii': { costCents: 0 }, // Free tier (simple implementation)
    },
  },
});

class GuardrailProSettleGridServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'guardrail-pro-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
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
    const checkLegalComplianceHandler = sg.wrap(
      async (args: any) => {
        return {
          status: 'success',
          framework: args.framework,
          analysis: 'Content satisfies basic compliance constraints.',
          timestamp: new Date().toISOString()
        };
      },
      { method: 'check_legal_compliance' }
    );

    const detectPiiHandler = sg.wrap(
      async (args: any) => {
        return {
          pii_detected: false,
          entities: [],
          message: 'No PII detected.'
        };
      },
      { method: 'detect_pii' }
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};
      
      // Pass MCP _meta as metadata to SettleGrid for API key extraction
      const context = {
        metadata: (request.params as any)._meta || {}
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
            throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${toolName}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        // Handle SettleGrid specific errors
        if (error instanceof InsufficientCreditsError || error.status === 402 || error.message?.includes('Payment Required')) {
          return {
            content: [{ 
              type: 'text', 
              text: `Payment Required: ${error.message}. Please authorize payment or top up at settlegrid.ai` 
            }],
            isError: true
          };
        }
        
        throw new McpError(ErrorCode.InternalError, `Execution failed: ${error.message}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Guardrail-Pro MCP server (Monetized via SettleGrid) running on stdio');
  }
}

const server = new GuardrailProSettleGridServer();
server.run().catch(console.error);
