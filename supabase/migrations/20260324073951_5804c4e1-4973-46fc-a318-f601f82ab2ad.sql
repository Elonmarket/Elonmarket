-- Remove public SELECT from wallet_config (contains wallet addresses, payout %)
DROP POLICY IF EXISTS "Wallet config is viewable" ON public.wallet_config;

-- Create a new policy: only service_role can read wallet_config
CREATE POLICY "Only service role can read wallet config"
ON public.wallet_config
FOR SELECT
TO public
USING (( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text);

-- Remove public SELECT from bot_config (contains RPC endpoints, program IDs)
DROP POLICY IF EXISTS "Bot config is viewable" ON public.bot_config;

-- Create a new policy: only service_role can read bot config
CREATE POLICY "Only service role can read bot config"
ON public.bot_config
FOR SELECT
TO public
USING (( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text);