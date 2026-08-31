import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/client";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Calculator from "lucide-react/dist/esm/icons/calculator";
import ArrowRightLeft from "lucide-react/dist/esm/icons/arrow-right-left";

const DAF_ABI = [
  "function routeDonation(address _recipientClubWallet, address _volatileToken, uint256 _amount) external returns (uint256)",
];

const DAF_CONTRACT_ADDRESS = "0xCf742353EE374ea1800a5b35c243b11e5454b1cd"; // Localhost deployment default address
const VOLATILE_TOKEN_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27ead9083C756Cc2"; // Mock WETH
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

interface DafDonationWidgetProps {
  clubId: string;
  clubWalletAddress: string;
}

interface DafRecord {
  id: string;
  original_token: string;
  original_amount: number;
  usdc_amount_received: number;
  created_at: string;
}

export function DafDonationWidget({ clubId, clubWalletAddress }: DafDonationWidgetProps) {
  const [account, setAccount] = useState<string | null>(null);
  const [usdValue, setUsdValue] = useState("12000");
  const [tokenType, setTokenType] = useState("WETH");
  const [costBasisPercentage, setCostBasisPercentage] = useState("30");
  const [records, setRecords] = useState<DafRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Capital gains calculations
  const donationAmount = Number(usdValue) || 0;
  const costBasis = donationAmount * (Number(costBasisPercentage) / 100);
  const capitalGains = donationAmount - costBasis;
  const federalTaxRate = 0.2; // 20% Capital Gains tax
  const stateTaxRate = 0.05; // 5% State Tax
  const taxSavings = capitalGains * (federalTaxRate + stateTaxRate);

  const fetchRecords = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("daf_donations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRecords(data);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
    } else {
      alert("Please install MetaMask!");
    }
  };

  const handleRouteDonation = async () => {
    if (!account) return alert("Please connect wallet first!");
    setIsLoading(true);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // For WETH, parse amount (18 decimals)
      const amountIn = ethers.utils.parseEther((donationAmount / 3000).toFixed(4)); // Assumes $3,000/WETH rate

      const contract = new ethers.Contract(DAF_CONTRACT_ADDRESS, DAF_ABI, signer);
      const tx = await contract.routeDonation(
        clubWalletAddress || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        VOLATILE_TOKEN_ADDRESS,
        amountIn,
      );
      await tx.wait();

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("daf_donations").insert({
        donor_id: user?.id,
        recipient_club_id: clubId,
        original_token: tokenType,
        original_amount: donationAmount / 3000,
        usdc_amount_received: donationAmount,
      });

      alert("Crypto routed through DAF and liquidated to stablecoin!");
      fetchRecords();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to execute DAF routing transaction.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="daf-donation-widget"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6 space-y-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 border-b-4 border-black pb-3">
        <TrendingUp className="text-emerald-600 animate-pulse" size={18} />
        Crypto Capital Gains & Centralized DAF Router
      </h3>

      {/* Calculator tool */}
      <div className="space-y-4">
        <h4 className="font-bold uppercase flex items-center gap-1">
          <Calculator size={14} /> Tax-Exempt Capital Gains Calculator
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label>Donation Amount (USD)</label>
            <input
              type="number"
              value={usdValue}
              onChange={(e) => setUsdValue(e.target.value)}
              className="border-2 border-black px-2 py-1.5"
              data-testid="daf-amount-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label>Cost Basis (%)</label>
            <input
              type="number"
              value={costBasisPercentage}
              onChange={(e) => setCostBasisPercentage(e.target.value)}
              className="border-2 border-black px-2 py-1.5"
              data-testid="daf-basis-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label>Token Selection</label>
            <select
              value={tokenType}
              onChange={(e) => setTokenType(e.target.value)}
              className="border-2 border-black px-2 py-1.5"
            >
              <option value="WETH">WETH (Volatile)</option>
              <option value="WBTC">WBTC (Volatile)</option>
            </select>
          </div>
        </div>

        {/* Calculated savings block */}
        <div className="bg-emerald-50 border-2 border-black p-4 space-y-2">
          <div className="font-black text-emerald-800 uppercase text-[10px]">
            ⚡ Projected Tax Savings Benefits
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-emerald-700 font-bold">
            <div>Taxable Capital Gains: ${capitalGains.toLocaleString()}</div>
            <div>Capital Gains Tax Saved (25%): ${taxSavings.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Web3 routing triggers */}
      <div className="border-t-4 border-black pt-4 space-y-4">
        <h4 className="font-bold uppercase flex items-center gap-1.5">
          <ArrowRightLeft size={16} /> Volatility Escrow & DAF Router
        </h4>

        {donationAmount > 10000 && (
          <div className="bg-yellow-50 border-2 border-black p-3 text-[10px] font-bold text-yellow-800">
            ⚠️ Volatility Warning: Donation exceeds $10,000 threshold. Transaction will be routed
            through the University DAF Contract to auto-liquidate WETH to USDC.
          </div>
        )}

        {!account ? (
          <button
            onClick={connectWallet}
            data-testid="connect-daf-wallet-btn"
            className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
          >
            🦊 Connect MetaMask
          </button>
        ) : (
          <div className="space-y-3">
            <div className="text-[10px] bg-slate-100 p-2 border-2 border-black inline-block">
              Wallet Connected: <strong>{account}</strong>
            </div>
            <button
              onClick={handleRouteDonation}
              disabled={isLoading}
              data-testid="daf-route-btn"
              className="border-2 border-black bg-[#a3e635] px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000] block"
            >
              {isLoading ? "Executing DAF Swap..." : `Donate ${donationAmount} USDC via DAF`}
            </button>
          </div>
        )}
      </div>

      {/* History of Routed DAF donations */}
      <div className="border-t-4 border-black pt-4">
        <h4 className="font-bold uppercase mb-3 text-zinc-700">Routed DAF Liquidations History</h4>
        {records.length === 0 ? (
          <div className="bg-slate-50 border-2 border-black p-4 text-center text-gray-500">
            No DAF routed liquidations recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div
                key={r.id}
                data-testid={`daf-record-${r.id}`}
                className="border-2 border-black p-3 bg-slate-50 flex justify-between items-center"
              >
                <div>
                  <span className="font-bold block">
                    Swapped {r.original_amount} {r.original_token} to USDC
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <strong className="text-emerald-600 text-sm">
                    +{r.usdc_amount_received} USDC
                  </strong>
                  <span className="text-[9px] text-zinc-500 block uppercase font-bold">
                    Liquidated
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
