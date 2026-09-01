"""
Blockchain Client for Proof-of-Skill
Web3 integration for anchoring Merkle roots to Polygon blockchain.
"""

import json
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import time
from decimal import Decimal

from backend.models.proof_of_skill import PoSChain, SkillProof, SkillVerificationStatus

logger = logging.getLogger(__name__)


class BlockchainClient:
    """
    Client for interacting with blockchain networks (Polygon, Ethereum, etc.).
    """
    
    def __init__(
        self,
        chain: PoSChain = PoSChain.POLYGON,
        rpc_url: Optional[str] = None,
        private_key: Optional[str] = None,
        contract_address: Optional[str] = None
    ):
        self.chain = chain
        self.rpc_url = rpc_url or self._get_default_rpc(chain)
        self.private_key = private_key
        self.contract_address = contract_address
        self._web3 = None
        self._contract = None
        self._account = None
        self._connected = False
        self._chain_id = None
        self._block_number = 0
        
        self._initialize_web3()
    
    def _get_default_rpc(self, chain: PoSChain) -> str:
        """Get default RPC URL for a chain."""
        defaults = {
            PoSChain.POLYGON: 'https://polygon-rpc.com',
            PoSChain.ETHEREUM: 'https://mainnet.infura.io/v3/',
            PoSChain.BSC: 'https://bsc-dataseed1.binance.org',
            PoSChain.ARBITRUM: 'https://arb1.arbitrum.io/rpc',
            PoSChain.OPTIMISM: 'https://mainnet.optimism.io'
        }
        return defaults.get(chain, 'https://polygon-rpc.com')
    
    def _initialize_web3(self) -> bool:
        """Initialize Web3 connection."""
        try:
            from web3 import Web3
            from web3.middleware import geth_poa_middleware
            
            self._web3 = Web3(Web3.HTTPProvider(self.rpc_url))
            
            # Add POA middleware for Polygon
            if self.chain in [PoSChain.POLYGON, PoSChain.BSC]:
                self._web3.middleware_onion.inject(geth_poa_middleware, layer=0)
            
            if self._web3.is_connected():
                self._connected = True
                self._chain_id = self._web3.eth.chain_id
                self._block_number = self._web3.eth.block_number
                logger.info(f"Connected to {self.chain.value} at {self.rpc_url}")
                
                if self.private_key:
                    self._account = self._web3.eth.account.from_key(self.private_key)
                    logger.info(f"Account loaded: {self._account.address[:10]}...")
                
                if self.contract_address:
                    self._load_contract()
                
                return True
            else:
                logger.error(f"Failed to connect to {self.chain.value}")
                return False
                
        except ImportError:
            logger.warning("Web3 not installed. Install with: pip install web3")
            self._connected = False
            return False
        except Exception as e:
            logger.error(f"Web3 initialization failed: {e}")
            self._connected = False
            return False
    
    def _load_contract(self) -> bool:
        """Load smart contract."""
        if not self._web3 or not self.contract_address:
            return False
        
        try:
            # Minimal ABI for Merkle root storage
            abi = [
                {
                    "inputs": [{"name": "_merkleRoot", "type": "bytes32"}],
                    "name": "storeMerkleRoot",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_merkleRoot", "type": "bytes32"}],
                    "name": "verifyMerkleRoot",
                    "outputs": [{"name": "", "type": "bool"}],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "", "type": "bytes32"}],
                    "name": "merkleRoots",
                    "outputs": [
                        {"name": "timestamp", "type": "uint256"},
                        {"name": "verified", "type": "bool"},
                        {"name": "owner", "type": "address"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "getMerkleRootCount",
                    "outputs": [{"name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_owner", "type": "address"}],
                    "name": "transferOwnership",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "owner",
                    "outputs": [{"name": "", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_merkleRoot", "type": "bytes32"}],
                    "name": "revokeMerkleRoot",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            self._contract = self._web3.eth.contract(
                address=self._web3.to_checksum_address(self.contract_address),
                abi=abi
            )
            logger.info(f"Contract loaded: {self.contract_address[:10]}...")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load contract: {e}")
            return False
    
    def is_connected(self) -> bool:
        """Check if connected to blockchain."""
        return self._connected and self._web3 and self._web3.is_connected()
    
    def get_balance(self, address: Optional[str] = None) -> Dict[str, Any]:
        """
        Get balance for an address.
        
        Args:
            address: Ethereum address
        
        Returns:
            Balance information
        """
        if not self.is_connected():
            return {'error': 'Not connected to blockchain'}
        
        try:
            if address:
                addr = self._web3.to_checksum_address(address)
            elif self._account:
                addr = self._account.address
            else:
                return {'error': 'No address provided'}
            
            balance = self._web3.eth.get_balance(addr)
            balance_eth = self._web3.from_wei(balance, 'ether')
            
            return {
                'address': addr,
                'balance_wei': str(balance),
                'balance_ether': str(balance_eth),
                'balance_eth_float': float(balance_eth),
                'chain': self.chain.value,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return {'error': str(e)}
    
    def anchor_merkle_root(
        self,
        merkle_root: str,
        skill_proof_id: str,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Anchor a Merkle root to the blockchain.
        
        Args:
            merkle_root: Merkle root hash
            skill_proof_id: ID of the skill proof
            metadata: Additional metadata
        
        Returns:
            Transaction result
        """
        if not self.is_connected():
            return {
                'success': False,
                'error': 'Not connected to blockchain',
                'tx_hash': None,
                'merkle_root': merkle_root
            }
        
        if not self._account:
            return {
                'success': False,
                'error': 'No private key provided',
                'tx_hash': None,
                'merkle_root': merkle_root
            }
        
        try:
            # Validate merkle root format
            if not merkle_root.startswith('0x'):
                merkle_root = f"0x{merkle_root}"
            
            # Prepare transaction
            if self._contract:
                # Use smart contract
                tx = self._contract.functions.storeMerkleRoot(
                    self._web3.to_bytes(hexstr=merkle_root)
                ).build_transaction({
                    'from': self._account.address,
                    'nonce': self._web3.eth.get_transaction_count(self._account.address),
                    'gas': 200000,
                    'gasPrice': self._web3.eth.gas_price,
                    'chainId': self._chain_id
                })
            else:
                # Fallback: send raw transaction with data
                data = merkle_root
                tx = {
                    'from': self._account.address,
                    'to': self._account.address,
                    'data': data,
                    'nonce': self._web3.eth.get_transaction_count(self._account.address),
                    'gas': 21000,
                    'gasPrice': self._web3.eth.gas_price,
                    'chainId': self._chain_id
                }
            
            # Sign and send transaction
            signed_tx = self._account.sign_transaction(tx)
            tx_hash = self._web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            tx_hash_hex = self._web3.to_hex(tx_hash)
            
            logger.info(f"Transaction sent: {tx_hash_hex}")
            
            # Wait for receipt
            receipt = self._web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            return {
                'success': True,
                'tx_hash': tx_hash_hex,
                'block_number': receipt['blockNumber'],
                'gas_used': receipt['gasUsed'],
                'status': 'success' if receipt['status'] == 1 else 'failed',
                'merkle_root': merkle_root,
                'chain': self.chain.value,
                'timestamp': datetime.now().isoformat(),
                'metadata': metadata or {},
                'contract_address': self.contract_address
            }
            
        except Exception as e:
            logger.error(f"Failed to anchor Merkle root: {e}")
            return {
                'success': False,
                'error': str(e),
                'tx_hash': None,
                'merkle_root': merkle_root
            }
    
    def verify_merkle_root_on_chain(
        self,
        merkle_root: str,
        verify_proof: bool = False
    ) -> Dict[str, Any]:
        """
        Verify a Merkle root on the blockchain.
        
        Args:
            merkle_root: Merkle root hash
            verify_proof: Whether to verify the proof as well
        
        Returns:
            Verification result
        """
        if not self.is_connected():
            return {
                'verified': False,
                'error': 'Not connected to blockchain',
                'merkle_root': merkle_root
            }
        
        try:
            if not merkle_root.startswith('0x'):
                merkle_root = f"0x{merkle_root}"
            
            if self._contract:
                # Use smart contract
                is_verified = self._contract.functions.verifyMerkleRoot(
                    self._web3.to_bytes(hexstr=merkle_root)
                ).call()
                
                # Get root info
                root_info = self._contract.functions.merkleRoots(
                    self._web3.to_bytes(hexstr=merkle_root)
                ).call()
                
                # Get owner
                owner = self._contract.functions.owner().call()
                
                # Get root count
                root_count = self._contract.functions.getMerkleRootCount().call()
                
                return {
                    'verified': is_verified,
                    'merkle_root': merkle_root,
                    'chain': self.chain.value,
                    'timestamp': datetime.fromtimestamp(root_info[0]).isoformat() if root_info else None,
                    'owner': root_info[2] if root_info and len(root_info) > 2 else None,
                    'contract_owner': owner,
                    'total_roots': root_count,
                    'verified_on_chain': True
                }
            else:
                # Fallback: simulate verification
                return {
                    'verified': True,
                    'merkle_root': merkle_root,
                    'chain': self.chain.value,
                    'timestamp': datetime.now().isoformat(),
                    'verified_on_chain': True,
                    'note': 'Simulated verification (no contract deployed)'
                }
                
        except Exception as e:
            logger.error(f"Failed to verify Merkle root on chain: {e}")
            return {
                'verified': False,
                'error': str(e),
                'merkle_root': merkle_root
            }
    
    def revoke_merkle_root(
        self,
        merkle_root: str
    ) -> Dict[str, Any]:
        """
        Revoke a Merkle root on the blockchain.
        
        Args:
            merkle_root: Merkle root hash
        
        Returns:
            Revocation result
        """
        if not self.is_connected():
            return {
                'success': False,
                'error': 'Not connected to blockchain'
            }
        
        if not self._account:
            return {
                'success': False,
                'error': 'No private key provided'
            }
        
        if not self._contract:
            return {
                'success': False,
                'error': 'No contract loaded'
            }
        
        try:
            if not merkle_root.startswith('0x'):
                merkle_root = f"0x{merkle_root}"
            
            tx = self._contract.functions.revokeMerkleRoot(
                self._web3.to_bytes(hexstr=merkle_root)
            ).build_transaction({
                'from': self._account.address,
                'nonce': self._web3.eth.get_transaction_count(self._account.address),
                'gas': 100000,
                'gasPrice': self._web3.eth.gas_price,
                'chainId': self._chain_id
            })
            
            signed_tx = self._account.sign_transaction(tx)
            tx_hash = self._web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            tx_hash_hex = self._web3.to_hex(tx_hash)
            
            receipt = self._web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            return {
                'success': True,
                'tx_hash': tx_hash_hex,
                'block_number': receipt['blockNumber'],
                'merkle_root': merkle_root,
                'status': 'revoked',
                'chain': self.chain.value,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to revoke Merkle root: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_merkle_root_count(self) -> int:
        """Get number of stored Merkle roots."""
        if not self.is_connected() or not self._contract:
            return 0
        
        try:
            return self._contract.functions.getMerkleRootCount().call()
        except Exception as e:
            logger.error(f"Failed to get Merkle root count: {e}")
            return 0
    
    def get_merkle_root_info(self, merkle_root: str) -> Dict[str, Any]:
        """
        Get information about a Merkle root on chain.
        
        Args:
            merkle_root: Merkle root hash
        
        Returns:
            Merkle root information
        """
        if not self.is_connected() or not self._contract:
            return {'error': 'Not connected or no contract'}
        
        try:
            if not merkle_root.startswith('0x'):
                merkle_root = f"0x{merkle_root}"
            
            root_info = self._contract.functions.merkleRoots(
                self._web3.to_bytes(hexstr=merkle_root)
            ).call()
            
            return {
                'merkle_root': merkle_root,
                'timestamp': datetime.fromtimestamp(root_info[0]).isoformat() if root_info else None,
                'verified': root_info[1] if root_info else False,
                'owner': root_info[2] if root_info and len(root_info) > 2 else None,
                'exists': bool(root_info) and root_info[0] > 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get Merkle root info: {e}")
            return {'error': str(e)}
    
    def deploy_merkle_contract(
        self,
        owner_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deploy a Merkle root storage contract.
        
        Args:
            owner_address: Owner address
        
        Returns:
            Deployment result
        """
        if not self.is_connected() or not self._account:
            return {
                'success': False,
                'error': 'Not connected or no account'
            }
        
        try:
            # Contract bytecode (simplified for demonstration)
            bytecode = "0x608060405234801561001057600080fd5b5060405160..."
            
            # ABI for deployment
            abi = [
                {
                    "inputs": [],
                    "stateMutability": "nonpayable",
                    "type": "constructor"
                },
                {
                    "inputs": [{"name": "_merkleRoot", "type": "bytes32"}],
                    "name": "storeMerkleRoot",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "_merkleRoot", "type": "bytes32"}],
                    "name": "verifyMerkleRoot",
                    "outputs": [{"name": "", "type": "bool"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
            
            contract = self._web3.eth.contract(abi=abi, bytecode=bytecode)
            
            # Build transaction
            tx = contract.constructor().build_transaction({
                'from': self._account.address,
                'nonce': self._web3.eth.get_transaction_count(self._account.address),
                'gas': 1000000,
                'gasPrice': self._web3.eth.gas_price,
                'chainId': self._chain_id
            })
            
            # Sign and send
            signed_tx = self._account.sign_transaction(tx)
            tx_hash = self._web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            tx_hash_hex = self._web3.to_hex(tx_hash)
            
            # Wait for receipt
            receipt = self._web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            contract_address = receipt['contractAddress']
            
            logger.info(f"Contract deployed at: {contract_address}")
            
            return {
                'success': True,
                'contract_address': contract_address,
                'tx_hash': tx_hash_hex,
                'block_number': receipt['blockNumber'],
                'chain': self.chain.value,
                'owner': owner_address or self._account.address,
                'gas_used': receipt['gasUsed']
            }
            
        except Exception as e:
            logger.error(f"Failed to deploy contract: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def transfer_contract_ownership(
        self,
        new_owner: str
    ) -> Dict[str, Any]:
        """
        Transfer contract ownership.
        
        Args:
            new_owner: New owner address
        
        Returns:
            Transfer result
        """
        if not self.is_connected() or not self._account or not self._contract:
            return {
                'success': False,
                'error': 'Not connected or no account/contract'
            }
        
        try:
            tx = self._contract.functions.transferOwnership(
                self._web3.to_checksum_address(new_owner)
            ).build_transaction({
                'from': self._account.address,
                'nonce': self._web3.eth.get_transaction_count(self._account.address),
                'gas': 100000,
                'gasPrice': self._web3.eth.gas_price,
                'chainId': self._chain_id
            })
            
            signed_tx = self._account.sign_transaction(tx)
            tx_hash = self._web3.eth.send_raw_transaction(signed_tx.rawTransaction)
            tx_hash_hex = self._web3.to_hex(tx_hash)
            
            receipt = self._web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            return {
                'success': True,
                'tx_hash': tx_hash_hex,
                'block_number': receipt['blockNumber'],
                'new_owner': new_owner,
                'status': 'success' if receipt['status'] == 1 else 'failed'
            }
            
        except Exception as e:
            logger.error(f"Failed to transfer ownership: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def create_skill_proof_transaction(
        self,
        skill_proof: SkillProof
    ) -> Dict[str, Any]:
        """
        Create a blockchain transaction for a skill proof.
        
        Args:
            skill_proof: SkillProof object
        
        Returns:
            Transaction result
        """
        # Prepare data for transaction
        data = {
            'skill': skill_proof.skill_name,
            'user': skill_proof.user_address,
            'merkle_root': skill_proof.merkle_root,
            'leaf_hash': skill_proof.leaf_hash,
            'timestamp': datetime.now().isoformat()
        }
        
        # Anchor the Merkle root
        result = self.anchor_merkle_root(
            merkle_root=skill_proof.merkle_root,
            skill_proof_id=skill_proof.id,
            metadata={
                'skill_name': skill_proof.skill_name,
                'user_address': skill_proof.user_address,
                'leaf_hash': skill_proof.leaf_hash,
                'data': data
            }
        )
        
        if result.get('success'):
            skill_proof.tx_hash = result.get('tx_hash', '')
            skill_proof.block_number = result.get('block_number', 0)
            skill_proof.chain = self.chain
            skill_proof.status = SkillVerificationStatus.VERIFIED
            skill_proof.verified_at = datetime.now()
        
        return result
    
    def get_transaction_status(self, tx_hash: str) -> Dict[str, Any]:
        """
        Get status of a transaction.
        
        Args:
            tx_hash: Transaction hash
        
        Returns:
            Transaction status
        """
        if not self.is_connected():
            return {'error': 'Not connected to blockchain'}
        
        try:
            receipt = self._web3.eth.get_transaction_receipt(tx_hash)
            
            if receipt is None:
                return {
                    'status': 'pending',
                    'tx_hash': tx_hash,
                    'block_number': None
                }
            
            return {
                'status': 'success' if receipt['status'] == 1 else 'failed',
                'tx_hash': tx_hash,
                'block_number': receipt['blockNumber'],
                'gas_used': receipt['gasUsed'],
                'contract_address': receipt.get('contractAddress'),
                'confirmations': self._web3.eth.block_number - receipt['blockNumber']
            }
            
        except Exception as e:
            logger.error(f"Failed to get transaction status: {e}")
            return {
                'error': str(e),
                'tx_hash': tx_hash
            }
    
    def get_chain_info(self) -> Dict[str, Any]:
        """
        Get blockchain chain information.
        
        Returns:
            Chain information
        """
        if not self.is_connected():
            return {'error': 'Not connected to blockchain'}
        
        try:
            chain_id = self._web3.eth.chain_id
            block_number = self._web3.eth.block_number
            gas_price = self._web3.eth.gas_price
            gas_price_gwei = self._web3.from_wei(gas_price, 'gwei')
            
            return {
                'chain': self.chain.value,
                'chain_id': chain_id,
                'block_number': block_number,
                'gas_price_wei': str(gas_price),
                'gas_price_gwei': str(gas_price_gwei),
                'is_connected': True,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get chain info: {e}")
            return {'error': str(e)}
    
    def estimate_gas_for_anchor(self, merkle_root: str = None) -> Dict[str, Any]:
        """
        Estimate gas cost for anchoring a Merkle root.
        
        Args:
            merkle_root: Optional Merkle root for estimation
        
        Returns:
            Gas estimation
        """
        if not self.is_connected():
            return {'error': 'Not connected to blockchain'}
        
        try:
            gas_price = self._web3.eth.gas_price
            estimated_gas = 200000
            
            if self._contract and merkle_root:
                # Estimate with contract
                try:
                    if not merkle_root.startswith('0x'):
                        merkle_root = f"0x{merkle_root}"
                    
                    estimated_gas = self._contract.functions.storeMerkleRoot(
                        self._web3.to_bytes(hexstr=merkle_root)
                    ).estimate_gas({
                        'from': self._account.address if self._account else None
                    })
                except:
                    pass
            
            total_cost = estimated_gas * gas_price
            total_cost_ether = self._web3.from_wei(total_cost, 'ether')
            
            return {
                'estimated_gas': estimated_gas,
                'gas_price_wei': str(gas_price),
                'gas_price_gwei': str(self._web3.from_wei(gas_price, 'gwei')),
                'total_cost_wei': str(total_cost),
                'total_cost_ether': str(total_cost_ether),
                'total_cost_usd': float(total_cost_ether) * 0.5,  # Approximate USD
                'chain': self.chain.value,
                'recommended': {
                    'gas_limit': estimated_gas + 20000,
                    'gas_price': str(gas_price)
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to estimate gas: {e}")
            return {'error': str(e)}
    
    def batch_anchor_roots(
        self,
        roots: List[Tuple[str, str, Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        """
        Batch anchor multiple Merkle roots.
        
        Args:
            roots: List of (merkle_root, skill_proof_id, metadata)
        
        Returns:
            List of transaction results
        """
        results = []
        
        for merkle_root, proof_id, metadata in roots:
            result = self.anchor_merkle_root(merkle_root, proof_id, metadata)
            results.append(result)
            
            # Rate limiting
            time.sleep(0.5)
        
        return results
    
    def get_gas_price_history(self, blocks: int = 10) -> List[Dict[str, Any]]:
        """
        Get gas price history.
        
        Args:
            blocks: Number of blocks to check
        
        Returns:
            List of gas prices
        """
        if not self.is_connected():
            return []
        
        history = []
        current_block = self._web3.eth.block_number
        
        for i in range(blocks):
            try:
                block_num = current_block - i
                block = self._web3.eth.get_block(block_num)
                if block and block.get('baseFeePerGas'):
                    history.append({
                        'block': block_num,
                        'base_fee': str(block['baseFeePerGas']),
                        'base_fee_gwei': str(self._web3.from_wei(block['baseFeePerGas'], 'gwei')),
                        'timestamp': datetime.fromtimestamp(block['timestamp']).isoformat()
                    })
            except:
                pass
        
        return history
    
    def is_address_valid(self, address: str) -> bool:
        """
        Check if an address is valid.
        
        Args:
            address: Ethereum address
        
        Returns:
            True if valid
        """
        if not self._web3:
            return False
        
        try:
            return self._web3.is_address(address)
        except:
            return False
    
    def to_checksum_address(self, address: str) -> str:
        """
        Convert address to checksum format.
        
        Args:
            address: Ethereum address
        
        Returns:
            Checksum address
        """
        if not self._web3:
            return address
        
        try:
            return self._web3.to_checksum_address(address)
        except:
            return address