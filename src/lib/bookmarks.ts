export interface SavedEventRelation<TEvent> {
  id: string;
  user_id: string;
  event: TEvent | TEvent[] | null;
}

export function normalizeSavedEvent<TEvent>(
  relation: SavedEventRelation<TEvent>,
): (TEvent & { saved_events: { id: string; user_id: string }[] }) | null {
  const rawEvent = relation.event;
  if (!rawEvent) return null;

  const event = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
  if (!event) return null;

  return {
    ...event,
    saved_events: [{ id: relation.id, user_id: relation.user_id }],
  };
}

export function normalizeSavedEvents<TEvent>(
  relations: SavedEventRelation<TEvent>[],
): (TEvent & { saved_events: { id: string; user_id: string }[] })[] {
  return relations.map(normalizeSavedEvent).filter(
    (
      event,
    ): event is TEvent & {
      saved_events: { id: string; user_id: string }[];
    } => event !== null,
  );
}
