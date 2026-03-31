ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS quoted_tweet_author_name text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS quoted_tweet_author_username text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS quoted_tweet_author_avatar text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS media_type text;
