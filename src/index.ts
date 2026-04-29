import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SettleGrid } from '@settlegrid/mcp';
import dotenv from 'dotenv';

dotenv.config();

// 1. Initialize the SettleGrid wrapper using the API Key
const sg = new SettleGrid({
  apiKey: process.env.SETTLEGRID_API_KEY || ''
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
    // Tool configurations
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
    const checkLegalComplianceHandler = sg.wrap({
      toolName: 'check_legal_compliance',
      pricing: {
        model: 'per_call',
        price: 0.50,
        currency: 'USD'
      },
      handler: async (args: any) => {
        // Mocked legal compliance analysis logic
        return {
          status: 'success',
          framework: args.framework,
          analysis: 'Content satisfies basic compliance constraints.',
          timestamp: new Date().toISOString()
        };
      }
    });

    const detectPiiHandler = sg.wrap({
      toolName: 'detect_pii',
      pricing: {
        model: 'tiered',
        tier: 'Free',
        limits: {
          callsPerDay: 5
        }
      },
      handler: async (args: any) => {
        // Mocked PII detection logic
        return {
          pii_detected: false,
          entities: [],
          message: 'No PII detected.'
        };
      }
    });

    // Handle List Tools Request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools
    }));

    // Handle Call Tool Request
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};
      
      try {
        let result;
        
        // SettleGrid's wrapper automatically intercepts the request to validate payment/funds.
        // If the AI agent hasn't authorized payment or lacks funds, it throws or handles 
        // the '402 Payment Required' before executing the inner logic.
        switch (toolName) {
          case 'check_legal_compliance':
            result = await checkLegalComplianceHandler(args, request, extra);
            break;
          case 'detect_pii':
            result = await detectPiiHandler(args, request, extra);
            break;
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${toolName}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        // Map SettleGrid 402/Quota errors to standard MCP errors
        if (error.status === 402 || error.code === 'insufficient_funds' || error.message?.includes('Payment Required')) {
          return {
            content: [{ type: 'text', text: `Payment Required: ${error.message}` }],
            isError: true
          };
        } else if (error.code === 'quota_exceeded' || error.message?.includes('limit')) {
          return {
            content: [{ type: 'text', text: `Usage Limit Exceeded: ${error.message}` }],
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
