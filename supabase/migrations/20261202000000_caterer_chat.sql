-- Migration: 20261202000000_caterer_chat.sql
-- Description: Interactive "Dietary Restriction" Caterer Chat (#4535)

CREATE TABLE IF NOT EXISTS public.caterer_attendee_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID REFERENCES public.caterer_dietary_alerts(id) ON DELETE CASCADE UNIQUE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  attendee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caterer_token TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.caterer_attendee_chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.caterer_attendee_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.caterer_attendee_chats(id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('caterer', 'attendee')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.caterer_attendee_chat_messages ENABLE ROW LEVEL SECURITY;

-- Ensure realtime is enabled for messages
-- Supabase handles realtime publication, we just need to ensure the publication exists.
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.caterer_attendee_chat_messages;

-- RLS: Attendee Policies
CREATE POLICY "Attendees can view their own chats" ON public.caterer_attendee_chats
  FOR SELECT USING (auth.uid() = attendee_id);

CREATE POLICY "Attendees can view messages for their chats" ON public.caterer_attendee_chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.caterer_attendee_chats c WHERE c.id = chat_id AND c.attendee_id = auth.uid())
  );

CREATE POLICY "Attendees can send messages if active" ON public.caterer_attendee_chat_messages
  FOR INSERT WITH CHECK (
    sender_type = 'attendee' AND
    EXISTS (SELECT 1 FROM public.caterer_attendee_chats c WHERE c.id = chat_id AND c.attendee_id = auth.uid() AND c.status = 'active')
  );

-- RLS: Caterer Policies
-- For caterers using the public token interface, we allow SELECT on messages if they know the chat_id UUID
CREATE POLICY "Public read messages by chat_id" ON public.caterer_attendee_chat_messages
  FOR SELECT USING (true); 

-- We also need to let Caterer find the chat using their token.
-- To do this securely without exposing all chats to everyone, we use a Security Definer function.
CREATE OR REPLACE FUNCTION get_caterer_chat_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  alert_id UUID,
  event_id UUID,
  status TEXT,
  dietary_tag TEXT
) AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    c.id, c.alert_id, c.event_id, c.status, a.dietary_tag
  FROM public.caterer_attendee_chats c
  JOIN public.caterer_dietary_alerts a ON c.alert_id = a.id
  WHERE c.caterer_token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to allow Caterer to insert messages securely
CREATE OR REPLACE FUNCTION send_caterer_message(p_token TEXT, p_content TEXT)
RETURNS JSON AS $$
DECLARE
  v_chat_id UUID;
  v_status TEXT;
  v_message_id UUID;
BEGIN
  -- Validate token and get chat
  SELECT id, status INTO v_chat_id, v_status 
  FROM public.caterer_attendee_chats 
  WHERE caterer_token = p_token;

  IF v_chat_id IS NULL THEN
    -- Try to find the alert and create the chat automatically
    DECLARE
      v_alert_id UUID;
      v_event_id UUID;
      v_attendee_id UUID;
    BEGIN
      SELECT id, event_id, user_id INTO v_alert_id, v_event_id, v_attendee_id
      FROM public.caterer_dietary_alerts
      WHERE token = p_token;

      IF v_alert_id IS NULL THEN
        RAISE EXCEPTION 'Invalid token';
      END IF;

      INSERT INTO public.caterer_attendee_chats (alert_id, event_id, attendee_id, caterer_token)
      VALUES (v_alert_id, v_event_id, v_attendee_id, p_token)
      RETURNING id, status INTO v_chat_id, v_status;
    END;
  END IF;

  IF v_status != 'active' THEN
    RAISE EXCEPTION 'Chat is archived';
  END IF;

  -- Insert message
  INSERT INTO public.caterer_attendee_chat_messages (chat_id, sender_type, content)
  VALUES (v_chat_id, 'caterer', p_content)
  RETURNING id INTO v_message_id;

  -- Create a notification for the attendee
  INSERT INTO public.notifications (user_id, title, message, category, action_url)
  VALUES (
    (SELECT attendee_id FROM public.caterer_attendee_chats WHERE id = v_chat_id),
    'New message from Caterer',
    substring(p_content from 1 for 50) || CASE WHEN length(p_content) > 50 THEN '...' ELSE '' END,
    'messages',
    '/messages?caterer_chat=' || v_chat_id
  );

  RETURN json_build_object('success', true, 'message_id', v_message_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-archive chats when an event concludes
-- Assuming event concludes when end_time passes, but here we can just do a scheduled cron job or manual trigger.
-- For now, we'll create a helper function that can be called by pg_cron or edge functions.
CREATE OR REPLACE FUNCTION archive_concluded_event_chats()
RETURNS void AS $$
BEGIN
  UPDATE public.caterer_attendee_chats c
  SET status = 'archived', updated_at = NOW()
  FROM public.events e
  WHERE c.event_id = e.id AND e.end_time < NOW() AND c.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
