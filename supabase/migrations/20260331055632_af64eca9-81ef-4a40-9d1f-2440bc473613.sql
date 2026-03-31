
CREATE TABLE public.poller_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.poller_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Poller logs are viewable by everyone"
  ON public.poller_logs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role can insert poller logs"
  ON public.poller_logs FOR INSERT
  TO public
  WITH CHECK ((SELECT current_setting('role'::text, true)) = 'service_role'::text);

CREATE POLICY "Service role can delete poller logs"
  ON public.poller_logs FOR DELETE
  TO public
  USING ((SELECT current_setting('role'::text, true)) = 'service_role'::text);

ALTER PUBLICATION supabase_realtime ADD TABLE public.poller_logs;
