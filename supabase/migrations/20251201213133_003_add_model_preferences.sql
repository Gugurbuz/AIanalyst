/*
  # Add AI Model Preferences

  1. Changes
    - Add ai_provider column to user_profiles (gemini or openai)
    - Add ai_model column to user_profiles to store selected model
    - Set default values: provider='openai', model='gpt-4-turbo'

  2. Security
    - No RLS changes needed as user_profiles already has RLS enabled
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'ai_provider'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN ai_provider text DEFAULT 'openai';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'ai_model'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN ai_model text DEFAULT 'gpt-4-turbo';
  END IF;
END $$;

UPDATE user_profiles 
SET ai_provider = 'openai', ai_model = 'gpt-4-turbo'
WHERE ai_provider IS NULL OR ai_model IS NULL;
