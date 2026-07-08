
-- Drop the overly permissive policy
DROP POLICY "Service role can manage analysis_logs" ON public.analysis_logs;

-- Only allow reading via anon (for display), inserts only via service role (edge functions)
CREATE POLICY "Anyone can read analysis logs"
ON public.analysis_logs
FOR SELECT
USING (true);

-- No INSERT/UPDATE/DELETE for anon - edge functions use service_role which bypasses RLS
