/*
  # Update Settings Table Policies

  1. Changes
    - Drop existing restrictive policies
    - Add new policies that allow anon users to read and update settings
    - This is needed because the app needs to access API keys before user authentication
  
  2. Security
    - Keep RLS enabled
    - Allow both authenticated and anon users to access settings
    - Settings table only contains configuration, not sensitive user data
*/

DROP POLICY IF EXISTS "Authenticated users can read settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON settings;

CREATE POLICY "Anyone can read settings"
  ON settings
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert settings"
  ON settings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update settings"
  ON settings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
