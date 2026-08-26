interface Profile {
  id: string;
  full_name: string | null;
  handle?: string | null;
}

interface ClubMember {
  user_id: string;
  role: string;
}

interface Club {
  id: string;
  name: string;
  club_members: ClubMember[] | ClubMember | null;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  club_id: string;
  is_pinned: boolean;
  profiles: Profile[] | Profile | null;
  clubs: Club[] | Club | null;
  comments: unknown[] | null;
  post_reactions: PostReaction[] | null;
  image_url?: string;
}

interface PostReaction {
  emoji: string;
  user_id: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  parent_id?: string | null;
  parent_comment_id?: string | null;
  depth?: number;
  profiles: Profile[] | Profile | null;
}

export type CommentNode = Comment & { children: CommentNode[] };

export type OptimisticReaction = {
  countOffset: number;
  userReacted: boolean;
};

export function timeAgo(dateString: string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diff = new Date().getTime() - new Date(dateString).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) return rtf.format(-days, "day");

  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return rtf.format(-hours, "hour");

  const minutes = Math.floor(diff / (1000 * 60));
  return rtf.format(-Math.max(1, minutes), "minute");
}

export function combinePosts(prepended: Post[], fetched: Post[]): Post[] {
  const deduped = fetched.filter((fp) => !prepended.some((pp) => pp.id === fp.id));
  return [...prepended, ...deduped].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
}

export function filterPostsBySearch(posts: Post[], query: string): Post[] {
  if (!query.trim()) return posts;
  const q = query.toLowerCase();
  return posts.filter((post) => {
    const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
    const club = Array.isArray(post.clubs) ? post.clubs[0] : post.clubs;
    const contentMatch = post.content?.toLowerCase().includes(q);
    const authorMatch =
      author?.full_name?.toLowerCase().includes(q) || author?.handle?.toLowerCase().includes(q);
    const clubMatch = club?.name?.toLowerCase().includes(q);
    return contentMatch || authorMatch || clubMatch;
  });
}

export function buildCommentTree(commentsList: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  commentsList.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  commentsList.forEach((c) => {
    if (c.parent_comment_id && map.has(c.parent_comment_id)) {
      map.get(c.parent_comment_id)!.children.push(map.get(c.id)!);
    } else {
      roots.push(map.get(c.id)!);
    }
  });
  return roots;
}

export function computeReaction(
  reactions: PostReaction[] | null,
  emoji: string,
  optimistic: OptimisticReaction | undefined,
  userId: string | undefined,
): { count: number; isReacted: boolean } {
  const list = reactions ?? [];
  const baseCount = list.filter((r) => r.emoji === emoji).length;
  const baseIsReacted = userId
    ? list.some((r) => r.emoji === emoji && r.user_id === userId)
    : false;

  if (optimistic) {
    return {
      count: Math.max(0, baseCount + optimistic.countOffset),
      isReacted: optimistic.userReacted,
    };
  }
  return { count: baseCount, isReacted: baseIsReacted };
}
