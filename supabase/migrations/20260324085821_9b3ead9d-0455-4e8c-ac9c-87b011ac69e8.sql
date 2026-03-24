-- Restrict claims to own records only (contains wallet addresses, signed messages)
DROP POLICY IF EXISTS "Claims are viewable" ON public.claims;
CREATE POLICY "Users can view own claims"
ON public.claims FOR SELECT TO public
USING (
  wallet_address = (
    SELECT wallet_address FROM public.profiles 
    WHERE id = ( SELECT public.get_user_by_wallet(current_setting('request.jwt.claims', true)::json->>'sub') )
  )
  OR ( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text
);

-- Restrict votes to own records only (contains wallet addresses, token balances)
DROP POLICY IF EXISTS "Votes are viewable" ON public.votes;
CREATE POLICY "Users can view own votes"
ON public.votes FOR SELECT TO public
USING (
  wallet_address = (
    SELECT wallet_address FROM public.profiles 
    WHERE id = ( SELECT public.get_user_by_wallet(current_setting('request.jwt.claims', true)::json->>'sub') )
  )
  OR ( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text
);