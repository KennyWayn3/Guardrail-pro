const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Use raw body for Stripe Webhook signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // In a real scenario, you'd get the user_id from session.client_reference_id or metadata
    const userId = session.client_reference_id; 

    // 1. Generate secure API key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKey = `gpr_${rawKey}`; // gpr = guardrail pro

    // 2. Hash the key for storage
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // 3. Save to Supabase
    const { error } = await supabase.from('api_keys').insert([
      {
        user_id: userId,
        key_hash: keyHash,
        status: 'active',
        usage_count: 0,
        max_uses: 1000 // Depends on the purchased plan
      }
    ]);

    if (error) {
      console.error('Error saving API key:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // Note: In a typical flow, the rawKey is emailed to the user or 
    // displayed once in the UI via a separate secure endpoint they pull from.
    // For this example, we mock a fulfillment action.
    console.log(`Successfully generated and stored key for user ${userId}`);
    // await sendEmailWithKey(session.customer_details.email, apiKey);
  }

  res.json({ received: true });
});

// Endpoint for the MCP Server to validate a key
app.use(express.json()); // Need JSON parsing for this route
app.post('/validate-key', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ valid: false, error: 'No key provided' });

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const { data, error } = await supabase
    .from('api_keys')
    .select('status, usage_count, max_uses, user_id, profiles(plan_tier)')
    .eq('key_hash', keyHash)
    .single();

  if (error || !data) {
    return res.status(404).json({ valid: false, error: 'Invalid API key' });
  }

  if (data.status !== 'active') {
    return res.status(403).json({ valid: false, error: 'API key is revoked' });
  }

  if (data.usage_count >= data.max_uses) {
    return res.status(402).json({ valid: false, error: 'Usage Limit Reached' });
  }

  // Increment usage count asynchronously (in production, use a more robust counter or RPC)
  await supabase.rpc('increment_usage', { row_id: keyHash }); // Assuming RPC exists

  res.json({
    valid: true,
    tier: data.profiles?.plan_tier || 'Pro',
    remainingCalls: data.max_uses - data.usage_count - 1
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
