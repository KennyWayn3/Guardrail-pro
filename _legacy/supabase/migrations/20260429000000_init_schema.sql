-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  stripe_customer_id TEXT,
  plan_tier TEXT DEFAULT 'Free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create api_keys table
CREATE TABLE public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  usage_count INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by hash
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash);
