-- Lock down transfer_logs and claim_logs (internal financial data)
DROP POLICY IF EXISTS "Transfer logs are viewable" ON public.transfer_logs;
CREATE POLICY "Only service role can read transfer logs"
ON public.transfer_logs FOR SELECT TO public
USING (( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text);

DROP POLICY IF EXISTS "Claim logs are viewable" ON public.claim_logs;
CREATE POLICY "Only service role can read claim logs"
ON public.claim_logs FOR SELECT TO public
USING (( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text);

-- Restrict user_roles SELECT to own roles only (prevent admin enumeration)
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO public
USING (
  user_id = ( SELECT public.get_user_by_wallet(current_setting('request.jwt.claims', true)::json->>'sub') )
  OR ( SELECT current_setting('role'::text, true) AS current_setting) = 'service_role'::text
);