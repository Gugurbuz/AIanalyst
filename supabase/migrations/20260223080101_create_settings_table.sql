/*
  # Create Settings Table

  1. New Tables
    - `settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) - Setting anahtarı (örn: 'OPENAI_API_KEY')
      - `value` (text) - Setting değeri
      - `created_at` (timestamptz) - Oluşturulma zamanı
      - `updated_at` (timestamptz) - Güncellenme zamanı
  
  2. Security
    - Enable RLS on `settings` table
    - Add policy for authenticated users to read settings
    - Add policy for authenticated users to update settings
*/

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO settings (key, value) VALUES ('OPENAI_API_KEY', '') 
ON CONFLICT (key) DO NOTHING;
