import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export class ComplianceEngine {
  public async checkCompliancePremium(content: string, framework: string): Promise<any> {
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
      } catch (e) {
        return {
          status: 'success',
          analysis: text,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error: any) {
      console.error('[Gemini Error]', error);
      return {
        status: 'error',
        message: 'Failed to perform compliance analysis.',
        details: error.message
      };
    }
  }

  public async scrubPii(content: string): Promise<any> {
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
      } catch (e) {
        return {
          status: 'success',
          scrubbedContent: text,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error: any) {
      return {
        status: 'error',
        message: 'Failed to scrub PII.',
        details: error.message
      };
    }
  }
}
