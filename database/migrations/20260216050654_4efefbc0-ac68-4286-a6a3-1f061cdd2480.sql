
-- Create analysis_logs table to track all analyses
CREATE TABLE public.analysis_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT NOT NULL,
  analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  before_image TEXT,
  after_image TEXT,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) to insert
CREATE POLICY "Service role can manage analysis_logs"
ON public.analysis_logs
FOR ALL
USING (true)
WITH CHECK (true);
