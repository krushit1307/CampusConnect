-- Migration: Update parse_mentions_from_content to support Tiptap HTML mention nodes

CREATE OR REPLACE FUNCTION public.parse_mentions_from_content()
RETURNS TRIGGER AS $$
DECLARE
    tag_handle TEXT;
    target_user_id UUID;
    uuid_match TEXT;
BEGIN
    -- Extract all matches of plain text @username
    FOR tag_handle IN 
        SELECT (regexp_matches(NEW.content, '@([a-zA-Z0-9_]+)', 'g'))[1]
    LOOP
        -- Find user by handle (case-insensitive)
        SELECT id INTO target_user_id 
        FROM public.profiles 
        WHERE LOWER(handle) = LOWER(tag_handle);

        -- If target user exists and is not the author, insert mention
        IF target_user_id IS NOT NULL AND target_user_id != NEW.author_id THEN
            IF TG_TABLE_NAME = 'posts' THEN
                INSERT INTO public.mentions (user_id, post_id)
                VALUES (target_user_id, NEW.id)
                ON CONFLICT DO NOTHING;
            ELSIF TG_TABLE_NAME = 'comments' THEN
                INSERT INTO public.mentions (user_id, post_id, comment_id)
                VALUES (target_user_id, NEW.post_id, NEW.id)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END LOOP;

    -- Extract all matches of Tiptap HTML mention nodes
    -- Pattern looks for data-type="mention" and extracts the data-id UUID
    FOR uuid_match IN 
        SELECT (regexp_matches(NEW.content, 'data-type="mention"[^>]*data-id="([0-9a-fA-F-]+)"', 'g'))[1]
    LOOP
        target_user_id := uuid_match::UUID;

        -- Verify target user exists and is not the author
        IF target_user_id IS NOT NULL AND target_user_id != NEW.author_id AND EXISTS(SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
            IF TG_TABLE_NAME = 'posts' THEN
                INSERT INTO public.mentions (user_id, post_id)
                VALUES (target_user_id, NEW.id)
                ON CONFLICT DO NOTHING;
            ELSIF TG_TABLE_NAME = 'comments' THEN
                INSERT INTO public.mentions (user_id, post_id, comment_id)
                VALUES (target_user_id, NEW.post_id, NEW.id)
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
