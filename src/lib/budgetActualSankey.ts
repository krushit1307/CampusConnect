export interface BudgetLineItem {
  id: string;
  description: string;
  amount: number;
  requestTitle?: string | null;
}

export interface ActualExpense {
  id: string;
  description: string;
  amount: number;
  vendor?: string | null;
  reconciliationStatus?: string | null;
}

export interface SankeyNode {
  id: string;
  name: string;
  kind: "budget" | "actual" | "unspent" | "overrun" | "unallocated";
  amount: number;
  description?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  variance: number;
  overrun: boolean;
  label: string;
}

export interface BudgetActualSankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totals: {
    approved: number;
    actual: number;
    variance: number;
    unspent: number;
    overrun: number;
  };
}

const STOP_WORDS = new Set(["a", "an", "and", "for", "of", "on", "the", "to"]);

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

function matchScore(budgetDescription: string, actualDescription: string) {
  const budgetWords = new Set(normalizeWords(budgetDescription));
  const actualWords = new Set(normalizeWords(actualDescription));
  if (budgetWords.size === 0 || actualWords.size === 0) return 0;

  const overlap = [...budgetWords].filter((word) => actualWords.has(word)).length;
  const score = overlap / Math.max(budgetWords.size, actualWords.size);
  const budgetText = normalizeWords(budgetDescription).join(" ");
  const actualText = normalizeWords(actualDescription).join(" ");

  return budgetText.includes(actualText) || actualText.includes(budgetText) ? score + 1 : score;
}

function formatAmount(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function addNode(nodes: SankeyNode[], node: SankeyNode) {
  nodes.push({ ...node, amount: Number(node.amount.toFixed(2)) });
}

export function buildBudgetActualSankeyData(
  budgets: BudgetLineItem[],
  actuals: ActualExpense[],
): BudgetActualSankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const usedActualIds = new Set<string>();
  const approved = budgets.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const actual = actuals.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);

  for (const budget of budgets) {
    const budgetAmount = Math.max(0, Number(budget.amount) || 0);
    const budgetNodeId = `budget-${budget.id}`;
    addNode(nodes, {
      id: budgetNodeId,
      name: `Approved ${budget.description}`,
      kind: "budget",
      amount: budgetAmount,
      description: budget.requestTitle || undefined,
    });

    const match = actuals
      .filter((item) => !usedActualIds.has(item.id))
      .map((item) => ({ item, score: matchScore(budget.description, item.description) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)[0]?.item;

    if (!match) {
      const unspentId = `unspent-${budget.id}`;
      addNode(nodes, {
        id: unspentId,
        name: `Unspent ${budget.description}`,
        kind: "unspent",
        amount: budgetAmount,
      });
      if (budgetAmount > 0) {
        links.push({
          source: budgetNodeId,
          target: unspentId,
          value: Number(budgetAmount.toFixed(2)),
          variance: Number((-budgetAmount).toFixed(2)),
          overrun: false,
          label: `${formatAmount(budgetAmount)} unspent`,
        });
      }
      continue;
    }

    usedActualIds.add(match.id);
    const actualAmount = Math.max(0, Number(match.amount) || 0);
    const actualNodeId = `actual-${match.id}`;
    addNode(nodes, {
      id: actualNodeId,
      name: `Actual ${match.vendor || match.description}`,
      kind: "actual",
      amount: actualAmount,
      description: match.description,
    });

    const matchedAmount = Math.min(budgetAmount, actualAmount);
    const overrunAmount = Math.max(0, actualAmount - budgetAmount);
    const unspentAmount = Math.max(0, budgetAmount - actualAmount);

    if (matchedAmount > 0) {
      links.push({
        source: budgetNodeId,
        target: actualNodeId,
        value: Number(matchedAmount.toFixed(2)),
        variance: Number((actualAmount - budgetAmount).toFixed(2)),
        overrun: false,
        label: `${formatAmount(matchedAmount)} matched · variance ${formatAmount(actualAmount - budgetAmount)}`,
      });
    }

    if (overrunAmount > 0) {
      const overrunNodeId = `overrun-${match.id}`;
      addNode(nodes, {
        id: overrunNodeId,
        name: `Overrun ${match.vendor || match.description}`,
        kind: "overrun",
        amount: overrunAmount,
      });
      links.push({
        source: overrunNodeId,
        target: actualNodeId,
        value: Number(overrunAmount.toFixed(2)),
        variance: Number(overrunAmount.toFixed(2)),
        overrun: true,
        label: `${formatAmount(overrunAmount)} over approved budget`,
      });
    }

    if (unspentAmount > 0) {
      const unspentId = `unspent-${budget.id}`;
      addNode(nodes, {
        id: unspentId,
        name: `Unspent ${budget.description}`,
        kind: "unspent",
        amount: unspentAmount,
      });
      links.push({
        source: budgetNodeId,
        target: unspentId,
        value: Number(unspentAmount.toFixed(2)),
        variance: Number((-unspentAmount).toFixed(2)),
        overrun: false,
        label: `${formatAmount(unspentAmount)} unspent`,
      });
    }
  }

  for (const unmatched of actuals.filter((item) => !usedActualIds.has(item.id))) {
    const actualAmount = Math.max(0, Number(unmatched.amount) || 0);
    if (actualAmount === 0) continue;

    const sourceId = `unallocated-${unmatched.id}`;
    const actualNodeId = `actual-${unmatched.id}`;
    addNode(nodes, {
      id: sourceId,
      name: `Unallocated actual ${unmatched.vendor || unmatched.description}`,
      kind: "unallocated",
      amount: actualAmount,
    });
    addNode(nodes, {
      id: actualNodeId,
      name: `Actual ${unmatched.vendor || unmatched.description}`,
      kind: "actual",
      amount: actualAmount,
      description: unmatched.description,
    });
    links.push({
      source: sourceId,
      target: actualNodeId,
      value: Number(actualAmount.toFixed(2)),
      variance: Number(actualAmount.toFixed(2)),
      overrun: true,
      label: `${formatAmount(actualAmount)} actual without an approved bucket`,
    });
  }

  const roundedApproved = Number(approved.toFixed(2));
  const roundedActual = Number(actual.toFixed(2));
  return {
    nodes,
    links,
    totals: {
      approved: roundedApproved,
      actual: roundedActual,
      variance: Number((roundedActual - roundedApproved).toFixed(2)),
      unspent: Number(
        links
          .filter((link) => link.target.startsWith("unspent-"))
          .reduce((sum, link) => sum + link.value, 0)
          .toFixed(2),
      ),
      overrun: Number(
        links
          .filter((link) => link.overrun)
          .reduce((sum, link) => sum + link.value, 0)
          .toFixed(2),
      ),
    },
  };
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
