-- supabase/migrations/20261120000000_club_constitution_history.sql

CREATE TABLE club_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  version_number integer NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, version_number)
);

-- Enable RLS
ALTER TABLE club_documents ENABLE ROW LEVEL SECURITY;

-- Allow public read access to club documents
CREATE POLICY "Public read access to club documents"
  ON club_documents
  FOR SELECT
  USING (true);

-- Allow organizers/secretaries to insert (this is typically enforced by the RPC, but good for defense-in-depth)
CREATE POLICY "Organizers can insert documents"
  ON club_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clubs c
      WHERE c.id = club_id
      AND c.created_by = auth.uid()
    )
  );

-- Create a storage bucket for club documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('club_documents', 'club_documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the new bucket
CREATE POLICY "Public Access to Club Documents"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'club_documents' );

CREATE POLICY "Organizers can upload club documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'club_documents' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM clubs WHERE created_by = auth.uid()
    )
  );

-- RPC for atomic version calculation and insertion
CREATE OR REPLACE FUNCTION upload_club_document(p_club_id uuid, p_file_url text, p_uploaded_by uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_version integer;
  v_result json;
BEGIN
  -- Verify the user is the organizer of the club
  IF NOT EXISTS (
    SELECT 1 FROM clubs
    WHERE id = p_club_id AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only club organizers can upload documents.';
  END IF;

  -- Lock the club row to prevent concurrent uploads causing version conflicts
  PERFORM id
  FROM clubs
  WHERE id = p_club_id
  FOR UPDATE;

  -- Calculate the next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next_version
  FROM club_documents
  WHERE club_id = p_club_id;

  -- Insert the new document
  INSERT INTO club_documents (club_id, file_url, version_number, uploaded_by)
  VALUES (p_club_id, p_file_url, v_next_version, p_uploaded_by)
  RETURNING row_to_json(club_documents.*) INTO v_result;

  -- Optionally, update the clubs table to point to this new constitution URL directly 
  -- (if we want to maintain the legacy constitution_url column for backwards compatibility)
  UPDATE clubs
  SET constitution_url = p_file_url, bylaws_version = v_next_version
  WHERE id = p_club_id;

  RETURN v_result;
END;
$$;
