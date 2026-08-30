// =============================================================================
// Service: CryptoDonationGasEstimatorService
// Purpose: Real-time multi-chain crypto gas fee estimation, net yield calculation,
//          and low-cost layer-2 routing for campus donation goals.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export type SupportedChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'solana' | 'base';
export type CryptoToken = 'ETH' | 'MATIC' | 'SOL' | 'USDC' | 'USDT';
export type GasSpeed = 'slow' | 'standard' | 'fast' | 'instant';
export type NetworkCongestionLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CONGESTED';
export type EfficiencyGrade = 'OPTIMAL' | 'ACCEPTABLE' | 'HIGH_FEE_WARNING';

export interface NetworkGasState {
  chain: SupportedChain;
  chain_name: string;
  native_token: string;
  token_usd_price: number;
  base_gwei: number; // or lamports for Solana
  priority_fee_gwei: number;
  total_gas_gwei: number;
  congestion_level: NetworkCongestionLevel;
  block_time_seconds: number;
  updated_at: string;
}

export interface DonationGasEstimate {
  chain: SupportedChain;
  chain_name: string;
  token: CryptoToken;
  gross_donation_usd: number;
  gross_donation_crypto: number;
  estimated_gas_crypto: number;
  estimated_gas_usd: number;
  net_received_usd: number;
  net_received_crypto: number;
  gas_percentage_of_donation: number; // e.g. 2.5%
  efficiency_grade: EfficiencyGrade;
  gas_speed: GasSpeed;
  estimated_confirm_time_sec: number;
  recommendation_note: string;
}

export interface ChainGasComparison {
  chain: SupportedChain;
  chain_name: string;
  native_token: string;
  estimated_gas_usd: number;
  gas_percentage: number;
  savings_vs_ethereum_usd: number;
  savings_vs_ethereum_percent: number;
  is_recommended: boolean;
}

export interface DonationGoalCampaign {
  id: string;
  title: string;
  organizer: string;
  target_goal_usd: number;
  current_raised_usd: number;
  crypto_wallet_address: string;
  supported_chains: SupportedChain[];
}

export class CryptoDonationGasEstimatorService {
  // Chain metadata and USD price approximations
  private static CHAIN_META: Record<SupportedChain, { name: string; nativeToken: string; defaultUSD: number; gasUnitsTransfer: number }> = {
    ethereum: { name: 'Ethereum Mainnet', nativeToken: 'ETH', defaultUSD: 3400.0, gasUnitsTransfer: 21000 },
    polygon: { name: 'Polygon PoS', nativeToken: 'MATIC', defaultUSD: 0.85, gasUnitsTransfer: 21000 },
    arbitrum: { name: 'Arbitrum One (L2)', nativeToken: 'ETH', defaultUSD: 3400.0, gasUnitsTransfer: 5000 },
    optimism: { name: 'OP Mainnet (L2)', nativeToken: 'ETH', defaultUSD: 3400.0, gasUnitsTransfer: 5000 },
    solana: { name: 'Solana Mainnet', nativeToken: 'SOL', defaultUSD: 145.0, gasUnitsTransfer: 5000 },
    base: { name: 'Base L2', nativeToken: 'ETH', defaultUSD: 3400.0, gasUnitsTransfer: 4500 }
  };

  /**
   * Fetches real-time or estimated network gas state for a given blockchain.
   */
  static fetchChainGasState(chain: SupportedChain, baseGweiOverride?: number): NetworkGasState {
    const meta = this.CHAIN_META[chain] || this.CHAIN_META.ethereum;

    let defaultGwei = 24.0;
    let congestion: NetworkCongestionLevel = 'MODERATE';

    switch (chain) {
      case 'ethereum':
        defaultGwei = baseGweiOverride ?? 26.5;
        congestion = defaultGwei > 40 ? 'HIGH' : defaultGwei > 60 ? 'CONGESTED' : 'MODERATE';
        break;
      case 'arbitrum':
        defaultGwei = baseGweiOverride ?? 0.15;
        congestion = 'LOW';
        break;
      case 'optimism':
        defaultGwei = baseGweiOverride ?? 0.18;
        congestion = 'LOW';
        break;
      case 'base':
        defaultGwei = baseGweiOverride ?? 0.08;
        congestion = 'LOW';
        break;
      case 'polygon':
        defaultGwei = baseGweiOverride ?? 45.0;
        congestion = 'LOW';
        break;
      case 'solana':
        defaultGwei = baseGweiOverride ?? 0.000005; // SOL lamports mapped
        congestion = 'LOW';
        break;
    }

    const priorityFee = chain === 'ethereum' ? 1.5 : 0.05;
    const totalGwei = defaultGwei + priorityFee;

    return {
      chain,
      chain_name: meta.name,
      native_token: meta.nativeToken,
      token_usd_price: meta.defaultUSD,
      base_gwei: defaultGwei,
      priority_fee_gwei: priorityFee,
      total_gas_gwei: Math.round(totalGwei * 100) / 100,
      congestion_level: congestion,
      block_time_seconds: chain === 'solana' ? 0.4 : chain === 'ethereum' ? 12.0 : 2.0,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Calculates donation gas fee in USD & Crypto, net yield reaching goal, and efficiency rating.
   */
  static calculateDonationGasImpact(
    chain: SupportedChain,
    token: CryptoToken = 'ETH',
    donationUSD: number = 50.0,
    speed: GasSpeed = 'standard',
    baseGweiOverride?: number
  ): DonationGasEstimate {
    const gasState = this.fetchChainGasState(chain, baseGweiOverride);
    const meta = this.CHAIN_META[chain];

    // Speed Multipliers
    let speedMultiplier = 1.0;
    let confirmTimeSec = gasState.block_time_seconds;

    if (speed === 'slow') {
      speedMultiplier = 0.85;
      confirmTimeSec *= 2.5;
    } else if (speed === 'fast') {
      speedMultiplier = 1.25;
      confirmTimeSec *= 0.8;
    } else if (speed === 'instant') {
      speedMultiplier = 1.6;
      confirmTimeSec *= 0.5;
    }

    // Calculate gas in Native Token & USD
    let gasCostUSD = 0;
    let gasCostCrypto = 0;

    if (chain === 'solana') {
      gasCostCrypto = 0.000005 * speedMultiplier;
      gasCostUSD = gasCostCrypto * meta.defaultUSD;
    } else if (chain === 'polygon') {
      // Gwei * Units / 1e9 * Polygon USD
      gasCostCrypto = (gasState.total_gas_gwei * speedMultiplier * meta.gasUnitsTransfer) / 1e9;
      gasCostUSD = gasCostCrypto * meta.defaultUSD;
    } else {
      // EVM (ETH, Arbitrum, Optimism, Base)
      gasCostCrypto = (gasState.total_gas_gwei * speedMultiplier * meta.gasUnitsTransfer) / 1e9;
      gasCostUSD = gasCostCrypto * meta.defaultUSD;
    }

    // Rounding
    gasCostUSD = Math.round(gasCostUSD * 100) / 100;
    gasCostCrypto = Math.round(gasCostCrypto * 1000000) / 1000000;

    const netReceivedUSD = Math.max(0, Math.round((donationUSD - gasCostUSD) * 100) / 100);
    const grossCrypto = Math.round((donationUSD / meta.defaultUSD) * 1000000) / 1000000;
    const netCrypto = Math.max(0, Math.round((grossCrypto - gasCostCrypto) * 1000000) / 1000000);

    const gasPercentage = donationUSD > 0 ? Math.round((gasCostUSD / donationUSD) * 1000) / 10 : 0;

    // Efficiency Grade
    let grade: EfficiencyGrade = 'OPTIMAL';
    let note = "Optimal gas efficiency. Maximum funds directly support the campaign goal.";

    if (gasPercentage > 15.0 || gasCostUSD > 8.0) {
      grade = 'HIGH_FEE_WARNING';
      note = `Warning: Gas fee consumes ${gasPercentage}% of your donation. Consider using an L2 network like Arbitrum or Base.`;
    } else if (gasPercentage > 5.0 || gasCostUSD > 2.5) {
      grade = 'ACCEPTABLE';
      note = "Acceptable gas fee, but L2 networks offer 90%+ lower overhead.";
    }

    return {
      chain,
      chain_name: meta.name,
      token,
      gross_donation_usd: donationUSD,
      gross_donation_crypto: grossCrypto,
      estimated_gas_crypto: gasCostCrypto,
      estimated_gas_usd: gasCostUSD,
      net_received_usd: netReceivedUSD,
      net_received_crypto: netCrypto,
      gas_percentage_of_donation: gasPercentage,
      efficiency_grade: grade,
      gas_speed: speed,
      estimated_confirm_time_sec: Math.round(confirmTimeSec),
      recommendation_note: note
    };
  }

  /**
   * Compares gas costs across all supported chains for a specific donation amount.
   */
  static compareAllChainsGasFees(donationUSD: number = 50.0): ChainGasComparison[] {
    const chains: SupportedChain[] = ['ethereum', 'arbitrum', 'base', 'optimism', 'polygon', 'solana'];

    const ethEstimate = this.calculateDonationGasImpact('ethereum', 'ETH', donationUSD);
    const ethGasUSD = Math.max(0.01, ethEstimate.estimated_gas_usd);

    return chains.map((chain) => {
      const est = this.calculateDonationGasImpact(chain, 'ETH', donationUSD);
      const savingsUSD = Math.max(0, Math.round((ethGasUSD - est.estimated_gas_usd) * 100) / 100);
      const savingsPercent = ethGasUSD > 0 ? Math.round((savingsUSD / ethGasUSD) * 1000) / 10 : 0;

      return {
        chain,
        chain_name: est.chain_name,
        native_token: this.CHAIN_META[chain].nativeToken,
        estimated_gas_usd: est.estimated_gas_usd,
        gas_percentage: est.gas_percentage_of_donation,
        savings_vs_ethereum_usd: savingsUSD,
        savings_vs_ethereum_percent: savingsPercent,
        is_recommended: chain === 'arbitrum' || chain === 'base' || chain === 'solana'
      };
    });
  }

  /**
   * Returns sample donation campaign goal.
   */
  static getSampleCampaign(): DonationGoalCampaign {
    return {
      id: "camp-stem-2026",
      title: "Campus Robotics & STEM Student Competition Fund",
      organizer: "Autonomous Systems Club & IEEE Student Chapter",
      target_goal_usd: 10000.0,
      current_raised_usd: 6450.0,
      crypto_wallet_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      supported_chains: ['ethereum', 'arbitrum', 'base', 'polygon', 'solana']
    };
  }
}
