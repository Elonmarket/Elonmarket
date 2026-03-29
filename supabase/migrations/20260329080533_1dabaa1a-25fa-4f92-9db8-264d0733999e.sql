
-- Allow public read access to wallet_config (contains no secrets - only public blockchain addresses and settings)
CREATE POLICY "Wallet config is viewable by everyone"
ON public.wallet_config
FOR SELECT
TO public
USING (true);

-- Enable realtime for wallet_config so frontend can detect changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_config;
