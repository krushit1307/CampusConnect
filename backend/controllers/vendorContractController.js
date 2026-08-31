// backend/controllers/vendorContractController.js
import { verifyCorporateEntityStatus } from '../services/corporateVerificationService.js';

/**
 * Controller to process vendor contract execution requests.
 * Enforces corporate compliance checks before releasing escrow or allowing signature.
 */
export const executeVendorContract = async (req, res) => {
  const { contractId, vendorEin, vendorState } = req.body;

  if (!contractId || !vendorEin || !vendorState) {
    return res.status(400).json({ error: "Missing required contract or corporate compliance parameters." });
  }

  try {
    // 1. Trigger automated Lambda/Service to scrape the State Business Registry
    const verificationResult = await verifyCorporateEntityStatus(vendorEin, vendorState);

    if (!verificationResult.success || !verificationResult.data) {
      return res.status(500).json({ error: "Failed to communicate with state registry APIs. Please try again later." });
    }

    const { status, entityName } = verificationResult.data;

    // 2. Evaluate Entity Status against legal compliance matrix
    const invalidStatuses = ['Dissolved', 'Suspended', 'Inactive', 'Revoked'];
    
    if (invalidStatuses.includes(status)) {
      console.warn(`[LEGAL RISK BLOCKED] Attempted contract execution with non-compliant entity: ${entityName} (${status})`);
      
      // 3. Render compliance error and abort contract
      return res.status(403).json({
        success: false,
        error: "Compliance Error: Your corporate entity is not in Good Standing with the state. Contract aborted.",
        details: {
          entityName,
          statusFound: status,
          stateChecked: vendorState
        }
      });
    }

    // 4. Entity is in Good Standing, proceed with contract execution and escrow transfer
    console.log(`[Compliance Passed] Entity ${entityName} is Active. Proceeding with contract ${contractId}.`);

    // (Mock database logic for actually signing the contract and transferring escrow would go here)
    
    return res.status(200).json({
      success: true,
      message: `Contract successfully executed with verified entity: ${entityName}.`,
      escrowStatus: "PENDING_RELEASE"
    });

  } catch (error) {
    console.error("[Vendor Controller] Error executing compliance checks:", error);
    return res.status(500).json({ error: "Internal server error during contract compliance processing." });
  }
};
