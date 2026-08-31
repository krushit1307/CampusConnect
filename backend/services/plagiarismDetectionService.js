const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Extracts a normalized, variable-name-agnostic AST structural token stream.
 * Converts variable and function identifiers into generic tokens while preserving grammar structure.
 */
function tokenizeSourceToAST(sourceCode) {
  try {
    const ast = parser.parse(sourceCode, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript']
    });

    const tokens = [];

    traverse(ast, {
      enter(nodePath) {
        const type = nodePath.node.type;
        // Ignore noise/trivial structural nodes
        if (['Program', 'File', 'CommentLine', 'CommentBlock'].includes(type)) return;

        // Anonymize variable and function identifiers to capture structural clones
        if (type === 'Identifier') {
          tokens.push('IDENT');
        } else if (type === 'Literal' || type === 'StringLiteral' || type === 'NumericLiteral') {
          tokens.push('LITERAL');
        } else {
          tokens.push(type);
        }
      }
    });

    return tokens;
  } catch (err) {
    // Return empty tokens if syntax parsing fails
    return [];
  }
}

/**
 * Computes k-gram fingerprints from an AST token sequence.
 */
function generateFingerprints(tokens, k = 10) {
  const kGrams = new Set();
  if (tokens.length < k) return kGrams;

  for (let i = 0; i <= tokens.length - k; i++) {
    const slice = tokens.slice(i, i + k).join(':');
    kGrams.add(slice);
  }
  return kGrams;
}

/**
 * Calculates Jaccard / Containment structural similarity between two tokenized fingerprint sets.
 */
function calculateASTSimilarity(fingerprintsA, fingerprintsB) {
  if (fingerprintsA.size === 0 || fingerprintsB.size === 0) return 0;

  let intersectionCount = 0;
  for (const fp of fingerprintsA) {
    if (fingerprintsB.has(fp)) intersectionCount++;
  }

  const minSize = Math.min(fingerprintsA.size, fingerprintsB.size);
  return (intersectionCount / minSize) * 100; // Containment percentage
}

module.exports = {
  tokenizeSourceToAST,
  generateFingerprints,
  calculateASTSimilarity
};
