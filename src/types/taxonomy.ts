export interface ClubTag {
  id: string;
  name: string; // e.g. "WebDev"
  slug: string; // e.g. "webdev"
  usageCount: number; // Total clubs + events using this tag
  category: string;
  isCanonical: boolean;
  mergedIntoTagId?: string;
  mergedIntoTagName?: string;
}

export interface TagSimilarityPair {
  tagA: ClubTag;
  tagB: ClubTag;
  coOccurrenceCount: number;
  jaccardSimilarity: number; // 0.0 to 1.0
  recommendedAction: 'merge' | 'review' | 'distinct';
  survivingCanonicalTag: ClubTag;
  redundantTag: ClubTag;
}

export interface TaxonomyMigrationLog {
  id: string;
  sourceTagName: string;
  targetCanonicalName: string;
  eventsMigratedCount: number;
  clubsMigratedCount: number;
  similarityScore: number;
  executedAt: string;
  status: 'completed' | 'dry_run' | 'reverted';
}
