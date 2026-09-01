import { ClubTag, TagSimilarityPair, TaxonomyMigrationLog } from '@/types/taxonomy';

/**
 * Calculates Jaccard Similarity Index between two tag co-occurrence sets:
 * J(A, B) = |A ∩ B| / |A ∪ B|
 */
export function calculateJaccardSimilarity(
  coOccurrences: number,
  countA: number,
  countB: number
): number {
  const union = countA + countB - coOccurrences;
  if (union <= 0) return 0;
  return Math.min(1.0, Math.round((coOccurrences / union) * 1000) / 1000);
}

/**
 * Analyzes candidate tag pairs and identifies redundant synonyms for canonicalization.
 */
export function analyzeTagSynonyms(
  tagPairs: { tagA: ClubTag; tagB: ClubTag; coOccurrences: number }[],
  similarityThreshold: number = 0.85
): TagSimilarityPair[] {
  return tagPairs.map(({ tagA, tagB, coOccurrences }) => {
    const similarity = calculateJaccardSimilarity(coOccurrences, tagA.usageCount, tagB.usageCount);

    // Surviving tag is the one with higher global usage
    const isAPopular = tagA.usageCount >= tagB.usageCount;
    const survivingCanonicalTag = isAPopular ? tagA : tagB;
    const redundantTag = isAPopular ? tagB : tagA;

    let recommendedAction: 'merge' | 'review' | 'distinct' = 'distinct';
    if (similarity >= similarityThreshold) {
      recommendedAction = 'merge';
    } else if (similarity >= 0.65) {
      recommendedAction = 'review';
    }

    return {
      tagA,
      tagB,
      coOccurrenceCount: coOccurrences,
      jaccardSimilarity: similarity,
      recommendedAction,
      survivingCanonicalTag,
      redundantTag,
    };
  });
}

/**
 * Executes a simulated database migration merging redundant tag records into the canonical tag.
 */
export function executeTaxonomyMigration(
  pair: TagSimilarityPair,
  isDryRun: boolean = false
): TaxonomyMigrationLog {
  return {
    id: `mig-${Date.now()}`,
    sourceTagName: pair.redundantTag.name,
    targetCanonicalName: pair.survivingCanonicalTag.name,
    eventsMigratedCount: Math.round(pair.redundantTag.usageCount * 0.75),
    clubsMigratedCount: Math.round(pair.redundantTag.usageCount * 0.25),
    similarityScore: pair.jaccardSimilarity,
    executedAt: new Date().toISOString(),
    status: isDryRun ? 'dry_run' : 'completed',
  };
}
