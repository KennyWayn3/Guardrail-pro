import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { settlegrid, InsufficientCreditsError } from '@settlegrid/mcp';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { ComplianceEngine } from './ComplianceEngine.js';

dotenv.config();

/**
 * Initialize SettleGrid.
 */
const sg = settlegrid.init({
  toolSlug: 'legal-compliance-mcp',
  pricing: {
    defaultCostCents: 5, // 5 cents per call
    methods: {
      'check_legal_compliance': { costCents: 5 },
      'detect_pii': { costCents: 0 },
    },
  },
});

class GuardrailProSettleGridServer {
  private server: Server;
  private app: express.Application;
  private transport?: SSEServerTransport;
  private engine: ComplianceEngine;

  constructor() {
    this.app = express();
    this.engine = new ComplianceEngine();
    this.server = new Server(
      {
        name: 'legal-compliance-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupExpress();
  }

  private setupHandlers() {
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

    const checkLegalComplianceHandler = sg.wrap(
      async (args: any) => {
        return await this.engine.checkCompliancePremium(args.content, args.framework);
      },
      { method: 'check_legal_compliance' }
    );

    const detectPiiHandler = sg.wrap(
      async (args: any) => {
        return await this.engine.scrubPii(args.content);
      },
      { method: 'detect_pii' }
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};
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
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: any) {
        if (error instanceof InsufficientCreditsError || error.status === 402 || error.message?.includes('Payment Required')) {
          return {
            content: [{ type: 'text', text: `Payment Required: ${error.message}. Please authorize payment at settlegrid.ai` }],
            isError: true
          };
        }
        throw new McpError(ErrorCode.InternalError, `Execution failed: ${error.message}`);
      }
    });
  }

  private setupExpress() {
    this.app.get('/sse', async (req, res) => {
      this.transport = new SSEServerTransport('/messages', res);
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
      res.sendFile(path.resolve(__dirname, '../server-card.json'));
    });

    this.app.get('/.well-known/smithery-verification', (req, res) => {
      res.send('smithery-verification=2788e1e225f8d0b652ae5f0c2eefa090879a0201e93aa008b863a6ad284c9d02');
    });
  }

  public run() {
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
