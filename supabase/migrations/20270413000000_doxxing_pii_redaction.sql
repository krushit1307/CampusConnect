-- =============================================================================
-- Issue #5286 - Automated Doxxing Redaction (PII Regex)
-- Regex-redact SSN/phone/address on insert and flag the sender for review.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.redact_chat_pii(p_content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  redacted TEXT := coalesce(p_content, '');
BEGIN
  redacted := regexp_replace(
    redacted,
    '[0-9]{3}[-[:space:]][0-9]{2}[-[:space:]][0-9]{4}',
    '[REDACTED]',
    'g'
  );
  redacted := regexp_replace(
    redacted,
    '(\+?1[-.[:space:]]?)?(\(?[0-9]{3}\)?[-.[:space:]]?)[0-9]{3}[-.[:space:]]?[0-9]{4}',
    '[REDACTED]',
    'g'
  );
  redacted := regexp_replace(
    redacted,
    '[0-9]{1,5}[[:space:]]+[A-Za-z0-9][A-Za-z0-9.[:space:]]{0,40}[[:space:]]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way)\.?',
    '[REDACTED]',
    'gi'
  );
  redacted := regexp_replace(
    redacted,
    '(Dorm(itory)?|Residence Hall|Hall|Building|Apt|Apartment|Suite|Room)[[:space:]]+(Room[[:space:]]+)?[A-Za-z0-9-]+',
    '[REDACTED]',
    'gi'
  );
  RETURN redacted;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_redact_event_chat_pii()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.content := public.redact_chat_pii(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_redact_event_chat_pii ON public.event_chat_messages;
CREATE TRIGGER trg_redact_event_chat_pii
BEFORE INSERT OR UPDATE OF content ON public.event_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_redact_event_chat_pii();

CREATE OR REPLACE FUNCTION public.flag_doxxing_sender(p_user_id UUID, p_flagged_content TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.moderation_flags (user_id, violation_type, flagged_content)
  VALUES (p_user_id, 'doxxing', left(coalesce(p_flagged_content, ''), 2000));
END;
$$;

REVOKE ALL ON FUNCTION public.flag_doxxing_sender(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_doxxing_sender(UUID, TEXT) TO anon, authenticated, service_role;
