ALTER TABLE public.tweets
  ADD COLUMN IF NOT EXISTS tweet_url text,
  ADD COLUMN IF NOT EXISTS quoted_tweet_author_name text,
  ADD COLUMN IF NOT EXISTS quoted_tweet_author_username text,
  ADD COLUMN IF NOT EXISTS quoted_tweet_author_avatar text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;