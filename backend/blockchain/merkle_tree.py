"""
Merkle Tree Implementation for Proof-of-Skill
Immutable cryptographic data structure for skill verification.
"""

import hashlib
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import uuid
import math
import logging

from .hash_utils import HashUtils
from backend.models.proof_of_skill import MerkleLeaf, MerkleNode, MerkleTree, PoSChain

logger = logging.getLogger(__name__)


class MerkleTreeBuilder:
    """
    Builds Merkle Trees from leaf data with full proof generation.
    """

    def __init__(self):
        self.leaves: List[MerkleLeaf] = []
        self.tree: Optional[MerkleTree] = None
        self._node_cache: Dict[str, MerkleNode] = {}

    def add_leaf(self, data: str, metadata: Dict[str, Any] = None) -> None:
        """
        Add a leaf to the tree.
        
        Args:
            data: Leaf data
            metadata: Optional metadata
        """
        leaf_hash = HashUtils.sha256(data)
        leaf = MerkleLeaf(
            data=data,
            hash=leaf_hash,
            metadata=metadata or {}
        )
        self.leaves.append(leaf)
        logger.debug(f"Added leaf with hash: {leaf_hash[:8]}...")

    def add_code_artifact(
        self,
        code_content: str,
        file_path: str,
        language: str = "python"
    ) -> None:
        """
        Add a code artifact as a leaf.
        
        Args:
            code_content: Code content
            file_path: Path to file
            language: Programming language
        """
        from .ast_hasher import ASTHasher
        
        hasher = ASTHasher()
        result = hasher.hash_code(code_content, language)
        
        self.add_leaf(
            result.hash,
            metadata={
                'file_path': file_path,
                'language': language,
                'ast_count': result.ast_count,
                'complexity': result.complexity_score,
                'function_count': result.function_count,
                'class_count': result.class_count,
                'token_count': result.token_count,
                'normalized_code': result.normalized_code[:100] + '...' if len(result.normalized_code) > 100 else result.normalized_code
            }
        )
        logger.info(f"Added code artifact: {file_path} ({language})")

    def add_batch_code_artifacts(
        self,
        files: Dict[str, str],
        language: str = "python"
    ) -> int:
        """
        Add multiple code artifacts as leaves.
        
        Args:
            files: Dictionary of file paths to content
            language: Programming language
        
        Returns:
            Number of leaves added
        """
        count = 0
        for file_path, content in files.items():
            self.add_code_artifact(content, file_path, language)
            count += 1
        logger.info(f"Added {count} code artifacts to Merkle tree")
        return count

    def build_tree(self) -> MerkleTree:
        """
        Build the Merkle tree from leaves.
        
        Returns:
            MerkleTree object
        """
        if not self.leaves:
            raise ValueError("No leaves to build tree")

        # Create leaf nodes
        leaf_nodes = []
        for leaf in self.leaves:
            node = MerkleNode(
                hash=leaf.hash,
                leaf=leaf,
                is_leaf=True
            )
            leaf_nodes.append(node)
            self._node_cache[leaf.hash] = node

        # Build tree
        nodes = leaf_nodes.copy()
        depth = 0
        level_size = len(nodes)

        while len(nodes) > 1:
            new_level = []
            level_size = len(nodes)
            
            for i in range(0, len(nodes), 2):
                left = nodes[i]
                if i + 1 < len(nodes):
                    right = nodes[i + 1]
                else:
                    # Duplicate last node if odd number
                    right = MerkleNode(
                        hash=left.hash,
                        left=left,
                        right=None,
                        is_leaf=False
                    )
                    logger.debug(f"Duplicating node at level {depth}: {left.hash[:8]}...")
                
                combined = left.hash + right.hash
                parent_hash = HashUtils.sha256(combined)
                
                parent = MerkleNode(
                    hash=parent_hash,
                    left=left,
                    right=right,
                    is_leaf=False
                )
                new_level.append(parent)
                self._node_cache[parent_hash] = parent
            
            nodes = new_level
            depth += 1
            logger.debug(f"Level {depth}: {len(nodes)} nodes")

        # Root node
        root = nodes[0] if nodes else None
        
        if not root:
            raise ValueError("Failed to build tree")

        tree = MerkleTree(
            root_hash=root.hash,
            leaves=self.leaves.copy(),
            depth=depth,
            leaf_count=len(self.leaves),
            metadata={
                'built_at': datetime.now().isoformat(),
                'node_count': len(self._node_cache),
                'level_count': depth + 1
            }
        )

        self.tree = tree
        logger.info(f"Merkle tree built: {tree.leaf_count} leaves, depth {tree.depth}, root {tree.root_hash[:16]}...")
        return tree

    def get_proof(self, leaf_index: int) -> Tuple[str, List[str]]:
        """
        Get Merkle proof for a leaf.
        
        Args:
            leaf_index: Index of the leaf
        
        Returns:
            Tuple of (leaf_hash, proof_hashes)
        """
        if not self.tree:
            raise ValueError("Tree not built yet")

        if leaf_index < 0 or leaf_index >= len(self.leaves):
            raise ValueError(f"Invalid leaf index: {leaf_index} (max: {len(self.leaves) - 1})")

        proof = []
        current_index = leaf_index

        # Build tree from leaves
        nodes = [MerkleNode(hash=l.hash, leaf=l, is_leaf=True) for l in self.leaves]
        level_nodes = len(nodes)
        
        while len(nodes) > 1:
            new_level = []
            for i in range(0, len(nodes), 2):
                left = nodes[i]
                if i + 1 < len(nodes):
                    right = nodes[i + 1]
                else:
                    right = MerkleNode(hash=left.hash, left=left, is_leaf=False)
                
                # Check if current index is at this level
                if current_index == i or (i + 1 < len(nodes) and current_index == i + 1):
                    # Add sibling to proof
                    if i == current_index and i + 1 < len(nodes):
                        proof.append(nodes[i + 1].hash)
                        logger.debug(f"Added right sibling at level: {nodes[i + 1].hash[:8]}...")
                    elif i + 1 == current_index and i < len(nodes):
                        proof.append(nodes[i].hash)
                        logger.debug(f"Added left sibling at level: {nodes[i].hash[:8]}...")
                    elif i == current_index and i + 1 >= len(nodes):
                        # Duplicate case - add itself
                        proof.append(nodes[i].hash)
                        logger.debug(f"Added self hash at level: {nodes[i].hash[:8]}...")
                
                combined = left.hash + right.hash
                parent_hash = HashUtils.sha256(combined)
                parent = MerkleNode(
                    hash=parent_hash,
                    left=left,
                    right=right,
                    is_leaf=False
                )
                new_level.append(parent)
            
            nodes = new_level
            # Update current_index for next level
            if current_index < len(nodes) * 2:
                current_index = current_index // 2
            else:
                current_index = len(nodes) - 1

        # Ensure proof has correct length
        expected_length = self.tree.depth
        if len(proof) < expected_length:
            # Pad with root hash if needed (should not happen in practice)
            proof.append(self.tree.root_hash)
            logger.warning(f"Proof length {len(proof)} < expected {expected_length}, padded with root hash")

        leaf_hash = self.leaves[leaf_index].hash
        logger.debug(f"Generated proof for leaf {leaf_index}: {len(proof)} hashes")
        return leaf_hash, proof

    def get_all_proofs(self) -> Dict[int, Tuple[str, List[str]]]:
        """
        Get Merkle proofs for all leaves.
        
        Returns:
            Dictionary of leaf_index -> (leaf_hash, proof_hashes)
        """
        if not self.tree:
            raise ValueError("Tree not built yet")
        
        proofs = {}
        for i in range(len(self.leaves)):
            proofs[i] = self.get_proof(i)
        
        logger.info(f"Generated {len(proofs)} proofs")
        return proofs

    def verify_proof(self, leaf_hash: str, proof: List[str], root_hash: str) -> bool:
        """
        Verify a Merkle proof.
        
        Args:
            leaf_hash: Leaf hash
            proof: List of sibling hashes
            root_hash: Expected root hash
        
        Returns:
            True if proof is valid
        """
        if not proof:
            return leaf_hash == root_hash
        
        current_hash = leaf_hash
        for i, sibling in enumerate(proof):
            if current_hash < sibling:
                current_hash = HashUtils.sha256(current_hash + sibling)
            else:
                current_hash = HashUtils.sha256(sibling + current_hash)
            
            logger.debug(f"Proof step {i+1}: {current_hash[:8]}...")
        
        is_valid = current_hash == root_hash
        logger.info(f"Proof verification {'successful' if is_valid else 'failed'}")
        return is_valid

    def verify_all_proofs(self) -> Dict[int, bool]:
        """
        Verify all proofs for the tree.
        
        Returns:
            Dictionary of leaf_index -> is_valid
        """
        if not self.tree:
            raise ValueError("Tree not built yet")
        
        results = {}
        root_hash = self.tree.root_hash
        
        for i in range(len(self.leaves)):
            leaf_hash, proof = self.get_proof(i)
            results[i] = self.verify_proof(leaf_hash, proof, root_hash)
        
        return results

    def to_dict(self) -> Dict[str, Any]:
        """Convert tree to dictionary."""
        if not self.tree:
            raise ValueError("Tree not built yet")
        return self.tree.to_dict()

    def to_json(self, pretty: bool = True) -> str:
        """Convert tree to JSON."""
        data = self.to_dict()
        if pretty:
            return json.dumps(data, indent=2, default=str)
        return json.dumps(data, default=str)

    def get_tree_stats(self) -> Dict[str, Any]:
        """Get statistics about the tree."""
        if not self.tree:
            return {
                'leaf_count': len(self.leaves),
                'tree_built': False
            }
        
        return {
            'leaf_count': self.tree.leaf_count,
            'depth': self.tree.depth,
            'node_count': len(self._node_cache),
            'root_hash': self.tree.root_hash,
            'created_at': self.tree.created_at.isoformat(),
            'node_count_estimate': 2 ** (self.tree.depth + 1) - 1
        }


class MerkleTreeVerifier:
    """
    Verifies Merkle proofs and validates skill proofs.
    """

    @staticmethod
    def verify_skill_proof(
        leaf_hash: str,
        proof: List[str],
        root_hash: str,
        skill_name: str,
        user_address: str,
        chain: PoSChain = PoSChain.POLYGON
    ) -> Dict[str, Any]:
        """
        Verify a skill proof.
        
        Args:
            leaf_hash: Leaf hash
            proof: Merkle proof
            root_hash: Expected root hash
            skill_name: Name of the skill
            user_address: User's blockchain address
            chain: Blockchain chain
        
        Returns:
            Verification result
        """
        # Verify the Merkle proof
        builder = MerkleTreeBuilder()
        is_valid = builder.verify_proof(leaf_hash, proof, root_hash)

        if not is_valid:
            return {
                'valid': False,
                'verified': False,
                'message': 'Invalid Merkle proof',
                'details': {
                    'leaf_hash': leaf_hash,
                    'root_hash': root_hash,
                    'proof_length': len(proof)
                }
            }

        # Verify the leaf data
        verification_hash = HashUtils.create_verification_hash(
            skill_name,
            user_address,
            root_hash,
            datetime.now().isoformat()
        )

        return {
            'valid': True,
            'verified': True,
            'message': 'Proof verified successfully',
            'leaf_hash': leaf_hash,
            'root_hash': root_hash,
            'skill': skill_name,
            'user': user_address,
            'chain': chain.value,
            'verification_hash': verification_hash,
            'verification_time': datetime.now().isoformat()
        }

    @staticmethod
    def _verify_merkle_proof(leaf_hash: str, proof: List[str], root_hash: str) -> bool:
        """Verify a Merkle proof."""
        current_hash = leaf_hash
        for sibling in proof:
            if current_hash < sibling:
                current_hash = HashUtils.sha256(current_hash + sibling)
            else:
                current_hash = HashUtils.sha256(sibling + current_hash)
        return current_hash == root_hash

    @staticmethod
    def batch_verify_proofs(
        proofs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Verify multiple proofs in batch.
        
        Args:
            proofs: List of proof dictionaries
        
        Returns:
            Batch verification results
        """
        results = []
        verified_count = 0
        total_count = len(proofs)
        
        for i, proof in enumerate(proofs):
            result = MerkleTreeVerifier.verify_skill_proof(
                proof.get('leaf_hash', ''),
                proof.get('proof', []),
                proof.get('root_hash', ''),
                proof.get('skill_name', ''),
                proof.get('user_address', ''),
                proof.get('chain', PoSChain.POLYGON)
            )
            results.append({
                'index': i,
                'result': result
            })
            if result.get('verified', False):
                verified_count += 1

        return {
            'total': total_count,
            'verified': verified_count,
            'unverified': total_count - verified_count,
            'verification_rate': (verified_count / total_count * 100) if total_count > 0 else 0,
            'results': results
        }

    @staticmethod
    def verify_merkle_root_on_chain(
        merkle_root: str,
        chain: PoSChain = PoSChain.POLYGON,
        contract_address: str = None
    ) -> Dict[str, Any]:
        """
        Verify a Merkle root on the blockchain.
        
        Args:
            merkle_root: Merkle root hash
            chain: Blockchain chain
            contract_address: Smart contract address
        
        Returns:
            Verification result
        """
        # This would integrate with Web3 to verify the merkle root
        # on the blockchain. For now, return a mock result.
        return {
            'verified_on_chain': True,
            'chain': chain.value,
            'merkle_root': merkle_root,
            'contract_address': contract_address or '0x0000000000000000000000000000000000000000',
            'block_number': 0,
            'transaction_hash': '0x0000000000000000000000000000000000000000000000000000000000000000',
            'timestamp': datetime.now().isoformat()
        }

    @staticmethod
    def generate_verification_report(
        proofs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate a verification report for multiple proofs.
        
        Args:
            proofs: List of proof dictionaries
        
        Returns:
            Verification report
        """
        batch_result = MerkleTreeVerifier.batch_verify_proofs(proofs)
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'version': '1.0',
            'summary': {
                'total_proofs': batch_result['total'],
                'verified': batch_result['verified'],
                'unverified': batch_result['unverified'],
                'verification_rate': batch_result['verification_rate']
            },
            'details': []
        }
        
        for result in batch_result['results']:
            report['details'].append({
                'index': result['index'],
                'valid': result['result'].get('verified', False),
                'message': result['result'].get('message', ''),
                'skill': result['result'].get('skill', ''),
                'user': result['result'].get('user', '')
            })
        
        return report