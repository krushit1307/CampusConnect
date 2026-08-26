-- Migration: 20260723010000_message_notifications.sql
-- Description: Trigger real-time notifications on new direct messages

CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS trigger AS $$
DECLARE
  v_sender_name TEXT;
BEGIN
  -- Retrieve the sender's full name
  SELECT NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), '') INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  
  -- Insert into notifications table
  -- The existing Supabase Realtime subscription in NavbarNotificationDropdown 
  -- will automatically push this to the user via WebSockets.
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    NEW.receiver_id,
    'reply',
    'New Message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a new secure message.',
    '/messages'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind the trigger to direct_messages table
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message_notification();
