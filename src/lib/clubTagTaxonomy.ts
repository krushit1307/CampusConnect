export type ClubTagNode = {
  id: string;
  name: string;
  parent_tag_id: string | null;
};

export function normalizeClubTagName(raw: string): string {
  return raw.replace(/^#+/, "").trim().toLowerCase();
}

export function findTagByName(tags: ClubTagNode[], name: string): ClubTagNode | undefined {
  const normalized = normalizeClubTagName(name);
  return tags.find((tag) => normalizeClubTagName(tag.name) === normalized);
}

/** Followed tag plus every parent up the tree (MachineLearning → ComputerScience → Technology). */
export function walkAncestors(tagId: string, tags: ClubTagNode[]): string[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const ids: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(tagId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ids.push(current.id);
    current = current.parent_tag_id ? byId.get(current.parent_tag_id) : undefined;
  }

  return ids;
}

/** Event tag plus every child down the tree (MachineLearning → NeuralNetworks). */
export function walkDescendants(tagId: string, tags: ClubTagNode[]): string[] {
  const children = new Map<string, ClubTagNode[]>();
  for (const tag of tags) {
    if (!tag.parent_tag_id) continue;
    const siblings = children.get(tag.parent_tag_id) ?? [];
    siblings.push(tag);
    children.set(tag.parent_tag_id, siblings);
  }

  const ids: string[] = [];
  const stack = [tagId];
  const seen = new Set<string>();

  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const child of children.get(id) ?? []) {
      stack.push(child.id);
    }
  }

  return ids;
}

export function visibleEventTagIdsForFollowedTags(
  followedTagIds: string[],
  tags: ClubTagNode[],
): Set<string> {
  const visible = new Set<string>();
  for (const followedId of followedTagIds) {
    for (const ancestorId of walkAncestors(followedId, tags)) {
      visible.add(ancestorId);
    }
  }
  return visible;
}

export function eventMatchesFollowedTags(
  eventTagIds: string[],
  followedTagIds: string[],
  tags: ClubTagNode[],
): boolean {
  const visible = visibleEventTagIdsForFollowedTags(followedTagIds, tags);
  return eventTagIds.some((id) => visible.has(id));
}

export function notifySubscriberTagIds(eventTagIds: string[], tags: ClubTagNode[]): Set<string> {
  const notify = new Set<string>();
  for (const eventTagId of eventTagIds) {
    for (const descendantId of walkDescendants(eventTagId, tags)) {
      notify.add(descendantId);
    }
  }
  return notify;
}
