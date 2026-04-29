export type SubscriptionTier = 'Free' | 'Pro' | 'Enterprise';

export interface SubscriptionContext {
  valid: boolean;
  tier: SubscriptionTier;
  remainingCalls?: number;
  message?: string;
  l4sDetails?: {
    invoice: string;
    macaroon?: string;
  };
}

interface CacheEntry {
  context: SubscriptionContext;
  expiresAt: number;
}

export class SubscriptionManager {
  private cache: Map<string, CacheEntry> = new Map();
  private CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes cache

  /**
   * Verify an API key with the billing backend.
   * Includes local caching to avoid DB hits on every call.
   */
  public async verifyKey(apiKey: string | undefined, l4sToken?: string): Promise<SubscriptionContext> {
    // If L4S token is provided, prioritize it
    if (l4sToken) {
      return this.verifyL4SToken(l4sToken);
    }

    if (!apiKey) {
      return {
        valid: false,
        tier: 'Free',
        message: 'No API key or L4S token provided. Payment required.',
        l4sDetails: {
          invoice: 'l4s_inv_sample123' // Mock L4S invoice
        }
      };
    }

    // Check Cache
    const cached = this.cache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    // Mock verification against billing backend (e.g., Stripe, Supabase)
    const context = await this.fetchSubscriptionFromBillingBackend(apiKey);

    // Update Cache
    this.cache.set(apiKey, {
      context,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return context;
  }

  /**
   * Mock implementation of a call to the billing backend.
   * In production, this would make an HTTP request to your billing API
   * using process.env.BILLING_API_KEY.
   */
  private async fetchSubscriptionFromBillingBackend(apiKey: string): Promise<SubscriptionContext> {
    try {
      // In production, configure this via an environment variable (e.g. process.env.BILLING_ENDPOINT)
      const backendUrl = process.env.BILLING_ENDPOINT || 'http://localhost:4000/validate-key';
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        return {
          valid: false,
          tier: 'Free',
          message: data.error || 'Invalid API key.'
        };
      }

      return {
        valid: true,
        tier: data.tier as SubscriptionTier,
        remainingCalls: data.remainingCalls
      };
    } catch (error) {
      console.error('[Billing API Error]', error);
      // Fallback for demo purposes if backend isn't running
      if (apiKey.startsWith('ent_')) return { valid: true, tier: 'Enterprise', remainingCalls: Infinity };
      if (apiKey.startsWith('pro_')) return { valid: true, tier: 'Pro', remainingCalls: 1000 };
      if (apiKey.startsWith('free_')) return { valid: true, tier: 'Free', remainingCalls: 5 };
      return { valid: false, tier: 'Free', message: 'Unable to verify API key with backend.' };
    }
  }

  /**
   * Verifies an L4S (Layers for Sovereignty) token.
   * L4S tokens encapsulate sovereign identity and payment proofs (e.g., macaroons + signatures).
   */
  private async verifyL4SToken(token: string): Promise<SubscriptionContext> {
    // Mock L4S Validation Logic
    if (token.startsWith('l4s_valid_')) {
      // Determine tier based on token capabilities (mock)
      const tier = token.includes('ent') ? 'Enterprise' : 'Pro';
      return { valid: true, tier, remainingCalls: Infinity };
    }
    
    return {
      valid: false,
      tier: 'Free',
      message: 'L4S Token is invalid or expired. Please complete the Layers for Sovereignty payment.',
      l4sDetails: {
        invoice: 'l4s_inv_new789'
      }
    };
  }

  /**
   * Telemetry function to track tool usage for billing.
   * Pings the billing backend to decrement quota or add to metered usage.
   */
  public async trackUsage(apiKey: string, toolName: string): Promise<void> {
    if (!apiKey || apiKey.startsWith('free_')) {
        // Handle free tier usage tracking
        return;
    }
    
    // In production:
    // await fetch(process.env.BILLING_ENDPOINT + '/track', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${process.env.BILLING_API_KEY}` },
    //   body: JSON.stringify({ apiKey, toolName, timestamp: new Date().toISOString() })
    // });
    
    console.error(`[Telemetry] Tracked usage of ${toolName} for key ${apiKey}`);
  }
}
