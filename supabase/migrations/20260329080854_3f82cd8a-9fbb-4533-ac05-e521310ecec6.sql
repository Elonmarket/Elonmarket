
-- Grant SELECT permission to anon and authenticated roles on wallet_config
GRANT SELECT ON public.wallet_config TO anon;
GRANT SELECT ON public.wallet_config TO authenticated;
