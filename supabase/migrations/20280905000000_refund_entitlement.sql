-- Issue #5011: Ticket Refund Entitlement Engine
--
-- A refund request stores the cause it was made under, because a cancellation
-- by the organiser and a change of mind by the buyer are opposite events that
-- happen to produce the same bank transaction. There is deliberately no
-- `refunded` boolean anywhere below: the cause and the settled decision are the
-- record, and a boolean would be the thing everyone reads instead.
--
-- Amounts are held in minor units as integers. A refund that does not sum to
-- the amount authorised is a reconciliation problem, not a rounding one.
--
-- A material change records both when it was decided and when buyers were told,
-- because the window runs from the second. Storing only the first is how a
-- buyer loses a right they were never in a position to exercise.

CREATE TABLE IF NOT EXISTS public.refundable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Whether this is a ticket for a specific dated event. The cooling-off
  -- exemption turns on this column and nothing else.
  is_dated BOOLEAN NOT NULL DEFAULT TRUE,
  cancelled_at TIMESTAMPTZ,
  -- The moment the event stopped happening. Sessions starting after it were
  -- not performed, which is what a pro-rata claim is measured against.
  abandoned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id),
  CHECK (cancelled_at IS NULL OR abandoned_at IS NULL)
);

-- Sessions exist so that a day-two-only ticket and a full pass are owed
-- different fractions of the same abandonment.
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  -- Relative worth for pro-rata purposes. A keynote day is not half a workshop day.
  weight NUMERIC(6, 2) NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS event_sessions_event_idx ON public.event_sessions (event_id, starts_at);

CREATE TABLE IF NOT EXISTS public.refundable_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ NOT NULL,
  -- Charged once for the order, however many tickets it contains, and so
  -- reversed once. A per-ticket column here would be refunded per ticket.
  per_order_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (per_order_fee_minor >= 0),
  fee_reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.refundable_orders(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Advertised price. Nobody paid this; the tender rows are what was paid.
  face_value_minor INTEGER NOT NULL CHECK (face_value_minor >= 0),
  sold_at TIMESTAMPTZ NOT NULL,
  -- Entitlement follows the ticket, so this is the current holder rather than
  -- the buyer on the order.
  holder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  admitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_tickets_holder_idx ON public.order_tickets (holder_id, event_id);
CREATE INDEX IF NOT EXISTS order_tickets_sold_idx ON public.order_tickets (event_id, sold_at);

-- Which sessions a specific ticket admits to. Without this a pro-rata claim can
-- only be computed against the event, which is the wrong denominator.
CREATE TABLE IF NOT EXISTS public.order_ticket_sessions (
  ticket_id UUID NOT NULL REFERENCES public.order_tickets(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, session_id)
);

-- What was actually paid, by tender. A ticket bought with a half-price code and
-- part-paid from credit is worth its face value to nobody, and refunding face
-- value in cash is how a cancellation becomes a way of extracting money.
CREATE TABLE IF NOT EXISTS public.ticket_tender_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.order_tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('CARD', 'ACCOUNT_CREDIT', 'DISCOUNT', 'HARDSHIP_WAIVER')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, kind)
);

CREATE TABLE IF NOT EXISTS public.material_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- A support act, a room within the same building and a twenty-minute shift
  -- are changes; they are not these.
  kind TEXT NOT NULL CHECK (
    kind IN (
      'HEADLINE_ACT', 'VENUE', 'DATE', 'START_TIME_MAJOR', 'FORMAT',
      'SUPPORT_ACT', 'ROOM_WITHIN_VENUE', 'START_TIME_MINOR'
    )
  ),
  description TEXT NOT NULL,
  declared_at TIMESTAMPTZ NOT NULL,
  -- When buyers were actually told. The window runs from here, not from above.
  notified_at TIMESTAMPTZ NOT NULL,
  window_hours INTEGER NOT NULL DEFAULT 72 CHECK (window_hours > 0),
  declared_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (notified_at >= declared_at)
);

CREATE INDEX IF NOT EXISTS material_changes_event_idx ON public.material_changes (event_id, declared_at DESC);

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.order_tickets(id) ON DELETE CASCADE,
  -- The cause is the question. The same ticket asked about under a different
  -- cause is a different question with a different answer.
  cause TEXT NOT NULL CHECK (
    cause IN (
      'ORGANISER_CANCELLATION', 'MATERIAL_CHANGE', 'PARTIAL_PERFORMANCE',
      'CHANGE_OF_MIND', 'DUPLICATE_PURCHASE'
    )
  ),
  material_change_id UUID REFERENCES public.material_changes(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  requested_at TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL CHECK (
    outcome IN (
      'REFUND_DUE', 'DISCRETIONARY', 'REFUSED_UNKNOWN_TICKET', 'REFUSED_NOT_HOLDER',
      'REFUSED_ADMITTED', 'REFUSED_EVENT_NOT_CANCELLED', 'REFUSED_NO_MATERIAL_CHANGE',
      'REFUSED_CHANGE_NOT_MATERIAL', 'REFUSED_SOLD_AFTER_CHANGE', 'REFUSED_WINDOW_CLOSED',
      'REFUSED_NOTHING_UNPERFORMED', 'REFUSED_NO_DUPLICATE'
    )
  ),
  -- Owed, available, or neither. Discretion granted inconsistently is what
  -- generates the complaint, so it is recorded rather than inferred.
  entitlement TEXT NOT NULL CHECK (entitlement IN ('MANDATORY', 'DISCRETIONARY', 'NONE')),
  pro_rata_numerator NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (pro_rata_numerator >= 0),
  pro_rata_denominator NUMERIC(8, 2) NOT NULL DEFAULT 1 CHECK (pro_rata_denominator > 0),
  fee_refunded BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (pro_rata_numerator <= pro_rata_denominator),
  CHECK (
    (outcome IN ('REFUND_DUE', 'DISCRETIONARY') AND entitlement <> 'NONE')
    OR (outcome NOT IN ('REFUND_DUE', 'DISCRETIONARY') AND entitlement = 'NONE')
  ),
  CHECK (cause <> 'MATERIAL_CHANGE' OR outcome <> 'REFUND_DUE' OR material_change_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS refund_requests_ticket_idx ON public.refund_requests (ticket_id, requested_at);

-- One settled decision per ticket. A second request replays the first answer
-- rather than producing a second payment, and this is where that is enforced.
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_settled_per_ticket
  ON public.refund_requests (ticket_id)
  WHERE outcome IN ('REFUND_DUE', 'DISCRETIONARY');

-- The refund decomposed by tender. Each component returns to where it came
-- from; discount and waiver value is extinguished because it was never money.
CREATE TABLE IF NOT EXISTS public.refund_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.refund_requests(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('CARD', 'ACCOUNT_CREDIT', 'DISCOUNT', 'HARDSHIP_WAIVER')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  disposition TEXT NOT NULL CHECK (disposition IN ('PAID', 'RETURNED_TO_CREDIT', 'EXTINGUISHED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, kind),
  CHECK (
    (kind = 'CARD' AND disposition = 'PAID')
    OR (kind = 'ACCOUNT_CREDIT' AND disposition = 'RETURNED_TO_CREDIT')
    OR (kind IN ('DISCOUNT', 'HARDSHIP_WAIVER') AND disposition = 'EXTINGUISHED')
  )
);

ALTER TABLE public.refundable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refundable_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ticket_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tender_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_components ENABLE ROW LEVEL SECURITY;

-- A buyer sees the tickets they hold now, which is the same rule the engine
-- resolves a request against.
CREATE POLICY order_tickets_holder_read ON public.order_tickets
  FOR SELECT USING (holder_id = auth.uid());

CREATE POLICY refund_requests_own_read ON public.refund_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.order_tickets t
      WHERE t.id = refund_requests.ticket_id AND t.holder_id = auth.uid()
    )
  );

CREATE POLICY refund_components_own_read ON public.refund_components
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.refund_requests r
      WHERE r.id = refund_components.request_id AND r.requested_by = auth.uid()
    )
  );

CREATE POLICY event_sessions_public_read ON public.event_sessions FOR SELECT USING (TRUE);
CREATE POLICY material_changes_public_read ON public.material_changes FOR SELECT USING (TRUE);
