/**
 * Equity Swap Service & State Machine Orchestrator (Issue #5140).
 *
 * Manages the lifecycle of sponsor B2B software license equity swaps:
 * 1. Calculate PPP software valuation adjustments ($ retail vs $ PPP).
 * 2. Manage offer state machine: OFFERED -> ACCEPTED -> AGREEMENT_GENERATED -> SIGNED -> FINALIZED -> BLOCKCHAIN_RECORDED -> LICENSE_PROVISIONED -> ACTIVE.
 * 3. Orchestrate dual e-signatures (founder & sponsor).
 * 4. Anchor SHA-256 agreement hash to Polygon blockchain.
 * 5. Provision software entitlement key.
 * 6. Enforce immutability of finalized agreements.
 */

import { agreementGenerator, AgreementGenerator } from "./agreementGenerator";
import { blockchainAnchorService, BlockchainAnchorService } from "./blockchainAnchorService";
import {
  licenseProvisioningService,
  LicenseProvisioningService,
} from "./licenseProvisioningService";
import {
  CreateOfferInput,
  EquitySwapAgreement,
  EquitySwapState,
  SignatureRecord,
  SponsorPppOffer,
} from "@/types/equitySwap";

export class EquitySwapService {
  private offers: Map<string, SponsorPppOffer> = new Map();
  private agreements: Map<string, EquitySwapAgreement> = new Map();

  private agreementGen: AgreementGenerator;
  private blockchainAnchor: BlockchainAnchorService;
  private licenseProvisioner: LicenseProvisioningService;

  constructor(
    agreementGen: AgreementGenerator = agreementGenerator,
    blockchainAnchor: BlockchainAnchorService = blockchainAnchorService,
    licenseProvisioner: LicenseProvisioningService = licenseProvisioningService,
  ) {
    this.agreementGen = agreementGen;
    this.blockchainAnchor = blockchainAnchor;
    this.licenseProvisioner = licenseProvisioner;

    this.seedDefaultOffers();
  }

  /**
   * Seed default sponsor B2B software PPP offers for testing & startup access.
   */
  private seedDefaultOffers() {
    const defaultOffers: CreateOfferInput[] = [
      {
        sponsorId: "sp_aws",
        sponsorName: "AWS Cloud for Startups",
        softwareLicenseName: "AWS Enterprise Cloud Credits (100k)",
        softwareCategory: "cloud_infrastructure",
        retailUsdValue: 100000,
        regionalPppFactor: 0.4, // 40% PPP ratio
        equityPercentage: 0.5, // 0.5% SAFE equity
        description: "100k AWS Cloud Credits + Architecture Support for Student MVP scale.",
      },
      {
        sponsorId: "sp_mixpanel",
        sponsorName: "Mixpanel Analytics",
        softwareLicenseName: "Mixpanel Enterprise Growth Plan",
        softwareCategory: "analytics",
        retailUsdValue: 24000,
        regionalPppFactor: 0.5,
        equityPercentage: 0.25, // 0.25% SAFE equity
        description: "1 Year Unlimited Behavioral Analytics & Funnel Tracking.",
      },
      {
        sponsorId: "sp_github",
        sponsorName: "GitHub Enterprise",
        softwareLicenseName: "GitHub Enterprise + Copilot Business (50 Seats)",
        softwareCategory: "developer_tools",
        retailUsdValue: 18000,
        regionalPppFactor: 0.5,
        equityPercentage: 0.15, // 0.15% SAFE equity
        description: "50 Seats GitHub Enterprise, Copilot AI Coding, Advanced Security.",
      },
    ];

    defaultOffers.forEach((o) => this.createPppOffer(o));
  }

  /**
   * Creates a Sponsor Purchasing Power Parity (PPP) Software License Offer.
   */
  public createPppOffer(input: CreateOfferInput): SponsorPppOffer {
    if (input.equityPercentage <= 0 || input.equityPercentage > 10.0) {
      throw new Error("Equity percentage must be between 0.01% and 10.0%");
    }

    const pppFactor = input.regionalPppFactor ?? 0.5;
    const adjustedUsdValue = Number((input.retailUsdValue * pppFactor).toFixed(2));

    const offer: SponsorPppOffer = {
      id: `offer_${input.sponsorId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      sponsorId: input.sponsorId,
      sponsorName: input.sponsorName,
      softwareLicenseName: input.softwareLicenseName,
      softwareCategory: input.softwareCategory,
      retailUsdValue: input.retailUsdValue,
      pppAdjustmentFactor: pppFactor,
      adjustedUsdValue,
      equityPercentage: input.equityPercentage,
      equityInstrument: input.equityInstrument ?? "SAFE",
      licenseDurationMonths: input.licenseDurationMonths ?? 12,
      isAvailable: true,
      description: input.description,
    };

    this.offers.set(offer.id, offer);
    return offer;
  }

  public getOffers(): SponsorPppOffer[] {
    return Array.from(this.offers.values()).filter((o) => o.isAvailable);
  }

  public getOfferById(offerId: string): SponsorPppOffer | null {
    return this.offers.get(offerId) ?? null;
  }

  public getAgreementById(agreementId: string): EquitySwapAgreement | null {
    return this.agreements.get(agreementId) ?? null;
  }

  /**
   * Founder accepts sponsor PPP offer: State transition OFFERED -> ACCEPTED_BY_FOUNDER -> AGREEMENT_GENERATED.
   */
  public async acceptOfferAndGenerateAgreement(
    offerId: string,
    startupId: string,
    startupName: string,
    founderId: string,
    founderName: string,
  ): Promise<EquitySwapAgreement> {
    const offer = this.offers.get(offerId);
    if (!offer || !offer.isAvailable) {
      throw new Error("Offer not found or no longer available.");
    }

    // Generate structured SAFE agreement text
    const agreementText = this.agreementGen.generateAgreementText(
      offer,
      startupId,
      startupName,
      founderId,
      founderName,
    );

    const documentSha256Hash = await this.agreementGen.computeSha256Hash(agreementText);
    const nowIso = new Date().toISOString();

    const agreementId = `eq_swap_${startupId}_${Date.now()}`;

    const agreement: EquitySwapAgreement = {
      id: agreementId,
      offerId: offer.id,
      startupId,
      startupName,
      founderId,
      founderName,
      sponsorId: offer.sponsorId,
      sponsorName: offer.sponsorName,
      status: "AGREEMENT_GENERATED",
      softwareLicenseName: offer.softwareLicenseName,
      adjustedUsdValue: offer.adjustedUsdValue,
      equityPercentage: offer.equityPercentage,
      equityInstrument: offer.equityInstrument,
      agreementText,
      documentSha256Hash,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    this.agreements.set(agreementId, agreement);
    return agreement;
  }

  /**
   * Executes electronic signature for founder or sponsor.
   */
  public async signAgreement(
    agreementId: string,
    signerId: string,
    signerName: string,
    role: "founder" | "sponsor",
  ): Promise<EquitySwapAgreement> {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error("Agreement not found.");
    }

    // Verify valid state for signing
    if (agreement.status === "FINALIZED" || agreement.status === "ACTIVE") {
      throw new Error("Cannot sign an already finalized agreement.");
    }

    const signatureHash = await this.agreementGen.computeSha256Hash(
      `${signerId}:${signerName}:${role}:${Date.now()}`,
    );

    const sigRecord: SignatureRecord = {
      signerId,
      signerName,
      signerRole: role,
      signedAtIso: new Date().toISOString(),
      ipAddress: "127.0.0.1",
      signatureHash,
    };

    if (role === "founder") {
      agreement.founderSignature = sigRecord;
      agreement.status = "FOUNDER_SIGNED";
    } else {
      agreement.sponsorSignature = sigRecord;
      agreement.status = "SPONSOR_SIGNED";
    }

    agreement.updatedAtIso = new Date().toISOString();

    // If both parties have signed, finalize agreement and advance state machine
    if (agreement.founderSignature && agreement.sponsorSignature) {
      await this.finalizeAndProvision(agreement);
    }

    this.agreements.set(agreementId, agreement);
    return agreement;
  }

  /**
   * Dual-signature complete: Finalize, Anchor to Polygon Blockchain, Provision Software Key.
   */
  private async finalizeAndProvision(agreement: EquitySwapAgreement): Promise<void> {
    agreement.status = "FINALIZED";
    agreement.finalizedAtIso = new Date().toISOString();

    try {
      // 1. Polygon Blockchain Anchoring
      const anchor = await this.blockchainAnchor.anchorAgreementToPolygon(
        agreement.id,
        agreement.documentSha256Hash,
      );
      agreement.blockchainAnchor = anchor;
      agreement.status = "BLOCKCHAIN_RECORDED";

      // 2. B2B Software License Key Provisioning
      const offer = this.offers.get(agreement.offerId);
      if (offer) {
        const entitlement = await this.licenseProvisioner.provisionSoftwareLicense(
          offer,
          agreement.startupId,
        );
        agreement.licenseEntitlement = entitlement;
        agreement.status = "ACTIVE";
      }
    } catch (err) {
      console.error("[EquitySwapService] Finalization step error:", err);
      if (!agreement.blockchainAnchor) {
        agreement.status = "BLOCKCHAIN_FAILED";
      } else {
        agreement.status = "PROVISIONING_FAILED";
      }
    }

    agreement.updatedAtIso = new Date().toISOString();
  }
}

export const equitySwapService = new EquitySwapService();
