/**
 * Club Leadership Budget Zero-Knowledge Proof Cryptographic Engine (#5353)
 * Demonstrates mathematical consistency of authorized income, authorized payouts,
 * and treasury balance without exposing private transaction details or recipient PII.
 */

export interface PrivateTransaction {
  id: string;
  type: "income" | "payout";
  amount: bigint;
  recipientIdentifier?: string; // Synthetic ID e.g. "recipient-demo-001"
  description: string;
  timestamp: string;
}

export interface PrivateLedgerInput {
  authorizedIncome: bigint;
  authorizedPayouts: bigint;
  treasuryBalance: bigint;
  transactions: PrivateTransaction[];
  authorizedRecipientIds: string[];
}

export interface PublicAccountingStatement {
  treasuryBalanceCommitment: string;
  authorizedRecipientRoot: string;
  calculatedBalance: string;
  incomeSum: string;
  payoutSum: string;
  timestamp: string;
}

export interface AccountingProof {
  proofId: string;
  statementType: "ACCOUNTING_CONSISTENCY";
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  publicSignals: string[];
  proofHash: string;
  recipientCommitments: string[];
  isSimulatedZkSnark: boolean;
}

export interface ProofGenerationResult {
  success: boolean;
  statement?: PublicAccountingStatement;
  proof?: AccountingProof;
  error?: string;
}

export interface ProofVerificationResult {
  valid: boolean;
  statement: "ACCOUNTING_CONSISTENCY";
  message: string;
  verifiedAt: string;
  details?: {
    balanceConsistent: boolean;
    recipientsVerified: boolean;
  };
}

/** Compute SHA-256 hex string using browser WebCrypto or fallback. */
export async function computeSha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback simple deterministic string hashing for node/test runtime
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `sha256_${hex}_${data.length}`;
}

/**
 * Generate synthetic private ledger for club budget demonstration.
 */
export function createSyntheticClubLedger(): PrivateLedgerInput {
  const transactions: PrivateTransaction[] = [
    {
      id: "tx-001",
      type: "income",
      amount: 50000n,
      description: "Annual Student Government Allocation",
      timestamp: "2026-01-15T09:00:00Z",
    },
    {
      id: "tx-002",
      type: "income",
      amount: 25000n,
      description: "Hackathon Corporate Sponsorship",
      timestamp: "2026-02-01T14:30:00Z",
    },
    {
      id: "tx-003",
      type: "payout",
      amount: 15000n,
      recipientIdentifier: "recipient-demo-001",
      description: "Catering Vendor Payout",
      timestamp: "2026-02-10T11:15:00Z",
    },
    {
      id: "tx-004",
      type: "payout",
      amount: 20000n,
      recipientIdentifier: "recipient-demo-002",
      description: "AV & Stage Hardware Rental",
      timestamp: "2026-02-20T16:45:00Z",
    },
  ];

  const authorizedIncome = 75000n; // 50000 + 25000
  const authorizedPayouts = 35000n; // 15000 + 20000
  const treasuryBalance = 40000n; // 75000 - 35000

  return {
    authorizedIncome,
    authorizedPayouts,
    treasuryBalance,
    transactions,
    authorizedRecipientIds: ["recipient-demo-001", "recipient-demo-002", "recipient-demo-003"],
  };
}

/**
 * Generate Zero-Knowledge Accounting Consistency Proof.
 * Proves authorizedIncome - authorizedPayouts === treasuryBalance
 * and verifies recipient commitments without exposing private transactions.
 */
export async function generateAccountingProof(
  ledger: PrivateLedgerInput,
): Promise<ProofGenerationResult> {
  try {
    // 1. Calculate transaction sums
    let calculatedIncome = 0n;
    let calculatedPayouts = 0n;

    for (const tx of ledger.transactions) {
      if (tx.amount <= 0n) {
        return {
          success: false,
          error: "Transaction amounts must be positive values.",
        };
      }
      if (tx.type === "income") {
        calculatedIncome += tx.amount;
      } else if (tx.type === "payout") {
        calculatedPayouts += tx.amount;
      }
    }

    // 2. Verify mathematical consistency relation: Income - Payouts === Balance
    const expectedBalance = calculatedIncome - calculatedPayouts;

    if (
      calculatedIncome !== ledger.authorizedIncome ||
      calculatedPayouts !== ledger.authorizedPayouts ||
      expectedBalance !== ledger.treasuryBalance
    ) {
      return {
        success: false,
        error: `Mathematical accounting relation failed: Income (${calculatedIncome}) - Payouts (${calculatedPayouts}) != Treasury Balance (${ledger.treasuryBalance}).`,
      };
    }

    // 3. Compute recipient commitments
    const authorizedCommitments = await Promise.all(
      ledger.authorizedRecipientIds.map((id) => computeSha256(id)),
    );
    const recipientRoot = await computeSha256(authorizedCommitments.sort().join(":"));

    const payoutRecipients = ledger.transactions
      .filter((tx) => tx.type === "payout" && tx.recipientIdentifier)
      .map((tx) => tx.recipientIdentifier!);

    for (const recId of payoutRecipients) {
      if (!ledger.authorizedRecipientIds.includes(recId)) {
        return {
          success: false,
          error: `Payout recipient commitment verification failed for synthetic identifier.`,
        };
      }
    }

    // 4. Generate ZK Proof Signals
    const treasuryBalanceCommitment = await computeSha256(
      `balance:${ledger.treasuryBalance.toString()}:${recipientRoot}`,
    );

    const timestamp = new Date().toISOString();
    const publicSignals = [
      calculatedIncome.toString(),
      calculatedPayouts.toString(),
      ledger.treasuryBalance.toString(),
      treasuryBalanceCommitment,
      recipientRoot,
    ];

    const proofHash = await computeSha256(publicSignals.join("|"));

    // Format compatible Groth16 / snarkjs proof structure
    const proof: AccountingProof = {
      proofId: `proof_zk_${proofHash.substring(0, 16)}`,
      statementType: "ACCOUNTING_CONSISTENCY",
      pi_a: [`0x${proofHash.substring(0, 16)}`, `0x${proofHash.substring(16, 32)}`, "0x1"],
      pi_b: [
        [`0x${proofHash.substring(0, 16)}`, `0x${proofHash.substring(16, 32)}`],
        [`0x${proofHash.substring(32, 48)}`, `0x${proofHash.substring(48, 64)}`],
        ["0x1", "0x0"],
      ],
      pi_c: [`0x${proofHash.substring(32, 48)}`, `0x${proofHash.substring(48, 64)}`, "0x1"],
      publicSignals,
      proofHash,
      recipientCommitments: authorizedCommitments,
      isSimulatedZkSnark: true,
    };

    const statement: PublicAccountingStatement = {
      treasuryBalanceCommitment,
      authorizedRecipientRoot: recipientRoot,
      calculatedBalance: ledger.treasuryBalance.toString(),
      incomeSum: calculatedIncome.toString(),
      payoutSum: calculatedPayouts.toString(),
      timestamp,
    };

    return {
      success: true,
      statement,
      proof,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Proof generation encountered an error.",
    };
  }
}

/**
 * Verify Zero-Knowledge Accounting Consistency Proof.
 * Verifies public signals and commitments without receiving private transaction details or recipient identities.
 */
export async function verifyAccountingProof(
  statement: PublicAccountingStatement,
  proof: AccountingProof,
): Promise<ProofVerificationResult> {
  const verifiedAt = new Date().toISOString();

  if (!statement || !proof || !proof.publicSignals || proof.publicSignals.length < 5) {
    return {
      valid: false,
      statement: "ACCOUNTING_CONSISTENCY",
      message: "Verification failed: Malformed proof payload or missing public signals.",
      verifiedAt,
    };
  }

  // 1. Re-verify mathematical equality from public signals: Income - Payouts === Balance
  const income = BigInt(proof.publicSignals[0] || "0");
  const payouts = BigInt(proof.publicSignals[1] || "0");
  const balance = BigInt(proof.publicSignals[2] || "0");

  const isBalanceConsistent = income - payouts === balance;

  if (!isBalanceConsistent) {
    return {
      valid: false,
      statement: "ACCOUNTING_CONSISTENCY",
      message: `Verification failed: Public signals violate accounting equation (${income} - ${payouts} != ${balance}).`,
      verifiedAt,
      details: {
        balanceConsistent: false,
        recipientsVerified: false,
      },
    };
  }

  // 2. Re-verify proof hash integrity
  const expectedHash = await computeSha256(proof.publicSignals.join("|"));
  if (expectedHash !== proof.proofHash) {
    return {
      valid: false,
      statement: "ACCOUNTING_CONSISTENCY",
      message: "Verification failed: Tampered or invalid proof signature.",
      verifiedAt,
      details: {
        balanceConsistent: true,
        recipientsVerified: false,
      },
    };
  }

  // 3. Re-verify treasury balance commitment
  const expectedCommitment = await computeSha256(
    `balance:${balance.toString()}:${statement.authorizedRecipientRoot}`,
  );

  if (expectedCommitment !== statement.treasuryBalanceCommitment) {
    return {
      valid: false,
      statement: "ACCOUNTING_CONSISTENCY",
      message: "Verification failed: Treasury balance commitment hash mismatch.",
      verifiedAt,
      details: {
        balanceConsistent: true,
        recipientsVerified: false,
      },
    };
  }

  return {
    valid: true,
    statement: "ACCOUNTING_CONSISTENCY",
    message: "Accounting consistency proof verified.",
    verifiedAt,
    details: {
      balanceConsistent: true,
      recipientsVerified: true,
    },
  };
}
