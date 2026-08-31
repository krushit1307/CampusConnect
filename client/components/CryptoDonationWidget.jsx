import React, { useState } from 'react';
import { ethers } from 'ethers';

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Mainnet USDC
const CLUB_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890"; // Mock Club Wallet

export const CryptoDonationWidget = ({ clubId, onDonationSuccess }) => {
  const [account, setAccount] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    } else {
      alert("Please install MetaMask or a compatible Web3 wallet!");
    }
  };

  const donateUSDC = async () => {
    if (!account) return alert("Connect wallet first");
    setIsProcessing(true);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Minimal ERC-20 ABI for transfer
      const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
      const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);

      // Donate 100 USDC (6 decimals for USDC)
      const amount = ethers.utils.parseUnits("100", 6);
      
      const tx = await usdcContract.transfer(CLUB_WALLET_ADDRESS, amount);
      setTxHash(tx.hash);
      
      // Notify backend to listen to this transaction
      await fetch('/api/donations/crypto/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, txHash: tx.hash, donorAddress: account, amount: 100 })
      });

      // Wait for 1 confirmation locally as well
      await tx.wait();
      
      setIsProcessing(false);
      if (onDonationSuccess) onDonationSuccess(tx.hash);
      
    } catch (error) {
      console.error("Transaction failed:", error);
      setIsProcessing(false);
    }
  };

  return (
    <div className="crypto-donation-box" style={{ padding: '24px', border: '1px solid #eaeaea', borderRadius: '12px', background: '#fdfdfd' }}>
      <h3 style={{ marginTop: 0, color: '#333' }}>Support the Club with Web3</h3>
      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>Donate directly using USDC on Ethereum.</p>
      
      {!account ? (
        <button onClick={connectWallet} style={{ background: '#f6851b', color: '#fff', padding: '12px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
          🦊 Connect MetaMask
        </button>
      ) : (
        <div>
          <div style={{ background: '#eef2f5', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.85rem', color: '#555' }}>
            <strong>Wallet:</strong> {account.slice(0, 6)}...{account.slice(-4)}
          </div>
          <button 
            onClick={donateUSDC} 
            disabled={isProcessing}
            style={{ background: '#2775ca', color: '#fff', padding: '12px 20px', border: 'none', borderRadius: '6px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold', width: '100%', opacity: isProcessing ? 0.7 : 1 }}
          >
            {isProcessing ? 'Processing Transaction...' : 'Donate 100 USDC'}
          </button>
          
          {txHash && (
            <div style={{ marginTop: '15px', fontSize: '0.85rem', color: '#2e7d32', background: '#e8f5e9', padding: '10px', borderRadius: '6px' }}>
              <strong>Transaction submitted!</strong><br />
              Hash: <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ color: '#0275d8' }}>{txHash.slice(0, 10)}...</a>
              <br/>
              <small>Awaiting on-chain confirmation to award your badge.</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
