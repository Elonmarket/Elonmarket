ALTER TABLE tweets DROP CONSTRAINT IF EXISTS tweets_tweet_type_check;
ALTER TABLE tweets ADD CONSTRAINT tweets_tweet_type_check CHECK (tweet_type IN ('post', 'quote', 'repost'));