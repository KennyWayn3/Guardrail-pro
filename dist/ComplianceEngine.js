"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceEngine = void 0;
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
class ComplianceEngine {
    async checkCompliancePremium(content, framework) {
        const prompt = `Act as a senior ${framework} compliance auditor. 
    Analyze the following content for potential ${framework} violations:
    
    CONTENT:
    ${content}
    
    Provide a detailed analysis including:
    1. Compliance Status (PASS/FAIL/WARNING)
    2. Specific findings
    3. Recommended actions
    
    Return the response in JSON format.`;
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            try {
                return JSON.parse(text.replace(/```json|```/g, '').trim());
            }
            catch (e) {
                return {
                    status: 'success',
                    analysis: text,
                    timestamp: new Date().toISOString()
                };
            }
        }
        catch (error) {
            console.error('[Gemini Error]', error);
            return {
                status: 'error',
                message: 'Failed to perform compliance analysis.',
                details: error.message
            };
        }
    }
    async scrubPii(content) {
        const prompt = `Act as a PII detection and scrubbing tool.
    Detect and scrub all Personal Identifiable Information (PII) from the following text.
    Replace PII with [REDACTED].
    
    TEXT:
    ${content}
    
    Return the scrubbed text and a list of entity types removed in JSON format.`;
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            try {
                return JSON.parse(text.replace(/```json|```/g, '').trim());
            }
            catch (e) {
                return {
                    status: 'success',
                    scrubbedContent: text,
                    timestamp: new Date().toISOString()
                };
            }
        }
        catch (error) {
            return {
                status: 'error',
                message: 'Failed to scrub PII.',
                details: error.message
            };
        }
    }
}
exports.ComplianceEngine = ComplianceEngine;
