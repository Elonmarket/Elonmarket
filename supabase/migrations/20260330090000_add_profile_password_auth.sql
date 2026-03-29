-- Add password-based auth fields to profiles so username-only logins cannot be hijacked.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_salt TEXT,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.password_hash IS 'PBKDF2 password hash encoded as base64.';
COMMENT ON COLUMN public.profiles.password_salt IS 'Random salt encoded as base64 for password hashing.';
COMMENT ON COLUMN public.profiles.password_updated_at IS 'When the password was last set or rotated.';
