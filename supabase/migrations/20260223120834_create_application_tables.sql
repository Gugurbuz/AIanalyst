/*
  # Create Application Tables

  1. New Tables
    - `user_profiles` - User profile information with plan details
      - `id` (uuid, primary key, references auth.users)
      - `plan` (text) - Subscription plan: free, pro, corporate
      - `token_limit` (integer) - Monthly token limit
      - `tokens_used` (integer) - Tokens used this period
      - `plan_start_date` (timestamptz) - When plan started
      - `plan_end_date` (timestamptz) - When plan ends
      - `created_at` (timestamptz)

    - `templates` - Document generation templates
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable for system templates)
      - `name` (text) - Template name
      - `document_type` (text) - analysis, test, traceability, bpmn
      - `prompt` (text) - The template prompt
      - `is_system_template` (boolean)
      - `created_at` (timestamptz)

    - `conversations` - Chat conversations
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `is_shared` (boolean)
      - `share_id` (uuid, unique)
      - `total_tokens_used` (integer)
      - `created_at` (timestamptz)

    - `conversation_details` - Individual messages in conversations
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references conversations)
      - `role` (text) - user, assistant, system
      - `content` (text)
      - `thought` (jsonb) - AI thinking process
      - `feedback` (jsonb) - User feedback on message
      - `grounding_metadata` (jsonb) - Web search sources
      - `created_at` (timestamptz)

    - `documents` - Generated documents current state
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references conversations)
      - `user_id` (uuid, references auth.users)
      - `document_type` (text)
      - `content` (text)
      - `current_version_id` (uuid)
      - `is_stale` (boolean)
      - `template_id` (uuid)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `document_versions` - Document version history
      - `id` (uuid, primary key)
      - `conversation_id` (uuid)
      - `user_id` (uuid)
      - `document_type` (text)
      - `content` (text)
      - `version_number` (integer)
      - `reason_for_change` (text)
      - `template_id` (uuid)
      - `tokens_used` (integer)
      - `created_at` (timestamptz)

    - `tasks` - Project board tasks
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `conversation_id` (uuid, nullable)
      - `parent_id` (uuid, nullable, self-reference)
      - `task_key` (text)
      - `title` (text)
      - `description` (text)
      - `status` (text) - todo, inprogress, done
      - `priority` (text) - low, medium, high, critical
      - `type` (text) - epic, story, test_case, task
      - `assignee` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - System templates are readable by all authenticated users
*/

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  token_limit integer NOT NULL DEFAULT 100000,
  tokens_used integer NOT NULL DEFAULT 0,
  plan_start_date timestamptz NOT NULL DEFAULT now(),
  plan_end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  document_type text NOT NULL,
  prompt text NOT NULL,
  is_system_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates and system templates"
  ON templates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_system_template = true);

CREATE POLICY "Users can insert own templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_system_template = false);

CREATE POLICY "Users can update own templates"
  ON templates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_system_template = false)
  WITH CHECK (user_id = auth.uid() AND is_system_template = false);

CREATE POLICY "Users can delete own templates"
  ON templates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND is_system_template = false);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Yeni Konuşma',
  is_shared boolean NOT NULL DEFAULT false,
  share_id uuid UNIQUE,
  total_tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Conversation Details (Messages) Table
CREATE TABLE IF NOT EXISTS conversation_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  thought jsonb,
  feedback jsonb,
  grounding_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversation_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON conversation_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_details.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON conversation_details FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_details.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in own conversations"
  ON conversation_details FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_details.conversation_id
      AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_details.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  content text NOT NULL DEFAULT '',
  current_version_id uuid,
  is_stale boolean NOT NULL DEFAULT false,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, document_type)
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Document Versions Table
CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  content text NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  reason_for_change text,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  tokens_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document versions"
  ON document_versions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own document versions"
  ON document_versions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  task_key text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  type text NOT NULL DEFAULT 'task',
  assignee text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_details_conversation_id ON conversation_details(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_conversation_id ON document_versions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_conversation_id ON tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, plan, token_limit, tokens_used, plan_start_date)
  VALUES (NEW.id, 'free', 100000, 0, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
