-- =============================================================================
-- Migration: Enable ltree and add hierarchical path to comments
-- Issue: #2388 - Implement Hierarchical Trees (ltree) for deeply nested comments
-- Description: Replaces recursive CTEs with Postgres ltree extension for 
-- lightning-fast infinite nesting fetches. Includes GiST indexing and triggers 
-- for automatic path computation and orphan prevention.
-- =============================================================================

-- Enable the ltree extension
CREATE EXTENSION IF NOT EXISTS ltree;

-- Add the path column to the comments table
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS path ltree;

-- Create GiST index for fast hierarchical queries (e.g., path <@ 'root_id')
CREATE INDEX IF NOT EXISTS idx_comments_path_gist 
ON public.comments USING GIST (path);

-- Create B-Tree index for standard sorting within a subtree
CREATE INDEX IF NOT EXISTS idx_comments_path_btree 
ON public.comments USING BTREE (path);

-- Function to automatically compute the ltree path on INSERT
CREATE OR REPLACE FUNCTION public.compute_comment_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path ltree;
    node_id text;
BEGIN
    -- ltree nodes cannot contain hyphens, so we replace them with underscores
    node_id := replace(NEW.id::text, '-', '_');
    
    IF NEW.parent_id IS NULL THEN
        -- Root comment: path is just its own ID
        NEW.path := node_id::ltree;
    ELSE
        -- Reply: fetch parent's path and append current ID
        SELECT path INTO parent_path FROM public.comments WHERE id = NEW.parent_id;
        
        IF parent_path IS NULL THEN
            RAISE EXCEPTION 'Parent comment not found or path is null';
        END IF;
        
        NEW.path := parent_path || node_id::ltree;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute path computation before insert
DROP TRIGGER IF EXISTS trg_compute_comment_path ON public.comments;
CREATE TRIGGER trg_compute_comment_path
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.compute_comment_path();

-- Function to handle orphan prevention on DELETE
-- When a parent is deleted, cascade delete all descendants using ltree matching
CREATE OR REPLACE FUNCTION public.cascade_delete_descendants()
RETURNS TRIGGER AS $$
DECLARE
    deleted_path ltree;
BEGIN
    -- Get the path of the comment being deleted
    deleted_path := OLD.path;
    
    -- Delete all descendants where path matches the deleted subtree
    -- The <@ operator checks if a path is a descendant of the deleted path
    DELETE FROM public.comments 
    WHERE path <@ deleted_path AND id != OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute cascade delete before delete
DROP TRIGGER IF EXISTS trg_cascade_delete_descendants ON public.comments;
CREATE TRIGGER trg_cascade_delete_descendants
BEFORE DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_descendants();

-- Add comment for documentation
COMMENT ON COLUMN public.comments.path IS 'ltree materialized path representing the exact lineage of the comment (e.g., root_id.child_id.grandchild_id)';
