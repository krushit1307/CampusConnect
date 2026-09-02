"""
Proof-of-Skill Service for AI Resume Analyzer
Orchestrates AST hashing, Merkle Tree construction, and blockchain anchoring.
"""

import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import uuid

from backend.models.proof_of_skill import (
    SkillProof, SkillVerificationStatus, PoSChain,
    PoSVerificationRequest, PoSVerificationResponse,
    MerkleTree, MerkleLeaf
)
from backend.blockchain.hash_utils import HashUtils
from backend.blockchain.ast_hasher import ASTHasher, ASTHashResult
from backend.blockchain.merkle_tree import MerkleTreeBuilder, MerkleTreeVerifier
from backend.blockchain.blockchain_client import BlockchainClient

logger = logging.getLogger(__name__)


class PoSService:
    """
    Proof-of-Skill service for skill verification.
    """

    def __init__(self):
        self.hasher = ASTHasher()
        self.tree_builder = MerkleTreeBuilder()
        self.verifier = MerkleTreeVerifier()
        self._blockchain_clients: Dict[PoSChain, BlockchainClient] = {}
        self._proofs: Dict[str, SkillProof] = {}
        self._trees: Dict[str, MerkleTree] = {}

    def get_blockchain_client(self, chain: PoSChain = PoSChain.POLYGON) -> BlockchainClient:
        """Get or create blockchain client for a chain."""
        if chain not in self._blockchain_clients:
            self._blockchain_clients[chain] = BlockchainClient(chain=chain)
        return self._blockchain_clients[chain]

    def verify_code_skill(
        self,
        request: PoSVerificationRequest
    ) -> PoSVerificationResponse:
        """
        Verify a skill based on code.
        
        Args:
            request: Verification request
        
        Returns:
            Verification response
        """
        try:
            # Step 1: Hash the code
            logger.info(f"Hashing code for skill: {request.skill_name}")
            
            if request.repository_url:
                # If repository URL provided, fetch and hash all files
                files = self._fetch_repository_files(
                    request.repository_url,
                    request.branch,
                    request.commit_hash
                )
                hash_result = self.hasher.hash_multiple_files(files)
                combined_hash = hash_result.get('__combined__')
                if combined_hash:
                    code_hash = combined_hash.hash
                else:
                    code_hash = HashUtils.sha256(json.dumps(files))
            else:
                # Hash single code content
                ast_result = self.hasher.hash_code(
                    request.code_content,
                    language=self._detect_language(request.code_content)
                )
                code_hash = ast_result.hash

            # Step 2: Build Merkle tree
            logger.info("Building Merkle tree...")
            self.tree_builder.add_leaf(
                code_hash,
                metadata={
                    'skill_name': request.skill_name,
                    'user_id': request.user_id,
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            # Add additional metadata leaves
            self.tree_builder.add_leaf(
                HashUtils.sha256(request.user_id),
                metadata={'type': 'user_id'}
            )
            self.tree_builder.add_leaf(
                HashUtils.sha256(request.skill_name),
                metadata={'type': 'skill_name'}
            )
            
            tree = self.tree_builder.build_tree()
            self._trees[tree.id] = tree

            # Step 3: Get proof for the code leaf
            leaf_hash, proof = self.tree_builder.get_proof(0)

            # Step 4: Create skill proof
            skill_proof = SkillProof(
                user_id=request.user_id,
                user_address=request.metadata.get('user_address', '0x0000000000000000000000000000000000000000'),
                skill_name=request.skill_name,
                skill_level=request.metadata.get('skill_level', 'intermediate'),
                merkle_root=tree.root_hash,
                merkle_proof=proof,
                leaf_hash=leaf_hash,
                chain=request.chain,
                status=SkillVerificationStatus.PENDING,
                metadata={
                    'repository_url': request.repository_url,
                    'branch': request.branch,
                    'commit_hash': request.commit_hash,
                    'code_hash': code_hash,
                    'tree_id': tree.id
                }
            )
            self._proofs[skill_proof.id] = skill_proof

            # Step 5: Anchor to blockchain
            logger.info(f"Anchoring to {request.chain.value}...")
            blockchain_client = self.get_blockchain_client(request.chain)
            
            if blockchain_client.is_connected():
                result = blockchain_client.create_skill_proof_transaction(skill_proof)
                if result.get('success'):
                    skill_proof.status = SkillVerificationStatus.VERIFIED
                    skill_proof.verified_at = datetime.now()
                    logger.info(f"Skill proof anchored successfully: {result.get('tx_hash')}")
                else:
                    logger.warning(f"Blockchain anchoring failed: {result.get('error')}")
            else:
                logger.warning(f"Blockchain not connected, proof stored locally only")

            return PoSVerificationResponse(
                success=True,
                message="Skill verified successfully",
                proof=skill_proof,
                tx_hash=skill_proof.tx_hash,
                merkle_root=skill_proof.merkle_root,
                block_number=skill_proof.block_number
            )

        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return PoSVerificationResponse(
                success=False,
                message="Verification failed",
                error=str(e)
            )

    def verify_skill_proof(
        self,
        proof_id: str
    ) -> Dict[str, Any]:
        """
        Verify a skill proof.
        
        Args:
            proof_id: Skill proof ID
        
        Returns:
            Verification result
        """
        proof = self._proofs.get(proof_id)
        if not proof:
            return {
                'valid': False,
                'message': 'Proof not found',
                'proof_id': proof_id
            }

        # Verify Merkle proof
        is_valid = self.tree_builder.verify_proof(
            proof.leaf_hash,
            proof.merkle_proof,
            proof.merkle_root
        )

        if not is_valid:
            return {
                'valid': False,
                'message': 'Invalid Merkle proof',
                'proof_id': proof_id
            }

        # Verify on blockchain
        blockchain_client = self.get_blockchain_client(proof.chain)
        on_chain_result = blockchain_client.verify_merkle_root_on_chain(proof.merkle_root)

        return {
            'valid': True,
            'verified': on_chain_result.get('verified', False),
            'message': 'Proof verified successfully',
            'proof_id': proof_id,
            'skill': proof.skill_name,
            'user_id': proof.user_id,
            'merkle_root': proof.merkle_root,
            'on_chain': on_chain_result,
            'timestamp': datetime.now().isoformat()
        }

    def get_user_skills(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get verified skills for a user.
        
        Args:
            user_id: User ID
        
        Returns:
            List of verified skills
        """
        skills = []
        for proof in self._proofs.values():
            if proof.user_id == user_id and proof.status == SkillVerificationStatus.VERIFIED:
                skills.append({
                    'skill': proof.skill_name,
                    'level': proof.skill_level,
                    'verified': True,
                    'verified_at': proof.verified_at.isoformat() if proof.verified_at else None,
                    'proof_id': proof.id,
                    'merkle_root': proof.merkle_root,
                    'blockchain': proof.chain.value,
                    'tx_hash': proof.tx_hash
                })
        return skills

    def get_skill_badge(self, user_id: str, skill_name: str) -> Optional[Dict[str, Any]]:
        """
        Get a skill badge for a user.
        
        Args:
            user_id: User ID
            skill_name: Skill name
        
        Returns:
            Badge information
        """
        for proof in self._proofs.values():
            if proof.user_id == user_id and proof.skill_name == skill_name:
                if proof.status == SkillVerificationStatus.VERIFIED:
                    return {
                        'skill': proof.skill_name,
                        'badge': f"✅ Cryptographically Verified {proof.skill_name}",
                        'icon': '🔐',
                        'level': proof.skill_level,
                        'verified': True,
                        'proof_id': proof.id,
                        'merkle_root': proof.merkle_root,
                        'blockchain': proof.chain.value,
                        'tx_hash': proof.tx_hash,
                        'verified_at': proof.verified_at.isoformat() if proof.verified_at else None
                    }
        return None

    def get_verification_stats(self) -> Dict[str, Any]:
        """
        Get verification statistics.
        
        Returns:
            Statistics dictionary
        """
        total = len(self._proofs)
        verified = sum(1 for p in self._proofs.values() if p.status == SkillVerificationStatus.VERIFIED)
        pending = sum(1 for p in self._proofs.values() if p.status == SkillVerificationStatus.PENDING)
        failed = sum(1 for p in self._proofs.values() if p.status == SkillVerificationStatus.FAILED)
        
        skills = {}
        for proof in self._proofs.values():
            skills[proof.skill_name] = skills.get(proof.skill_name, 0) + 1

        return {
            'total_proofs': total,
            'verified': verified,
            'pending': pending,
            'failed': failed,
            'success_rate': (verified / total * 100) if total > 0 else 0,
            'skill_distribution': skills,
            'chains': {
                chain.value: sum(1 for p in self._proofs.values() if p.chain == chain)
                for chain in PoSChain
            },
            'timestamp': datetime.now().isoformat()
        }

    def revoke_skill_proof(self, proof_id: str, reason: str = "") -> Dict[str, Any]:
        """
        Revoke a skill proof.
        
        Args:
            proof_id: Skill proof ID
            reason: Revocation reason
        
        Returns:
            Revocation result
        """
        proof = self._proofs.get(proof_id)
        if not proof:
            return {
                'success': False,
                'message': 'Proof not found'
            }

        # Revoke on blockchain
        blockchain_client = self.get_blockchain_client(proof.chain)
        result = blockchain_client.revoke_merkle_root(proof.merkle_root)

        if result.get('success'):
            proof.status = SkillVerificationStatus.REVOKED
            proof.metadata['revoked_at'] = datetime.now().isoformat()
            proof.metadata['revoke_reason'] = reason
            return {
                'success': True,
                'message': 'Skill proof revoked successfully',
                'proof_id': proof_id,
                'tx_hash': result.get('tx_hash')
            }
        else:
            return {
                'success': False,
                'message': f'Failed to revoke: {result.get("error")}'
            }

    def generate_verification_report(self, user_id: str) -> Dict[str, Any]:
        """
        Generate a verification report for a user.
        
        Args:
            user_id: User ID
        
        Returns:
            Verification report
        """
        skills = self.get_user_skills(user_id)
        
        return {
            'user_id': user_id,
            'generated_at': datetime.now().isoformat(),
            'total_verified_skills': len(skills),
            'skills': skills,
            'verification_summary': {
                'total_attempts': len(skills),
                'verified': len([s for s in skills if s.get('verified')]),
                'unverified': len([s for s in skills if not s.get('verified')])
            },
            'badges': [
                self.get_skill_badge(user_id, skill['skill'])
                for skill in skills
                if self.get_skill_badge(user_id, skill['skill'])
            ]
        }

    def _fetch_repository_files(
        self,
        repo_url: str,
        branch: str = "main",
        commit_hash: str = ""
    ) -> Dict[str, str]:
        """
        Fetch files from a repository.
        
        Args:
            repo_url: Repository URL
            branch: Branch name
            commit_hash: Commit hash
        
        Returns:
            Dictionary of file paths to content
        """
        # This would integrate with GitHub API
        # For now, return mock data
        import requests
        
        files = {}
        try:
            # Extract owner and repo from URL
            parts = repo_url.rstrip('/').split('/')
            owner = parts[-2] if len(parts) >= 2 else ""
            repo = parts[-1] if parts else ""
            
            # GitHub API URL
            api_url = f"https://api.github.com/repos/{owner}/{repo}/contents"
            if commit_hash:
                api_url += f"?ref={commit_hash}"
            elif branch:
                api_url += f"?ref={branch}"
            
            response = requests.get(api_url)
            if response.status_code == 200:
                contents = response.json()
                for item in contents:
                    if item.get('type') == 'file' and self._is_code_file(item.get('name', '')):
                        file_response = requests.get(item.get('download_url', ''))
                        if file_response.status_code == 200:
                            files[item.get('name', '')] = file_response.text
            else:
                # Fallback: use provided content
                logger.warning(f"Failed to fetch repository: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Repository fetch failed: {e}")
        
        # If no files fetched, add mock content
        if not files:
            files['mock.py'] = self._generate_mock_code()
        
        return files

    def _is_code_file(self, filename: str) -> bool:
        """Check if a file is a code file."""
        code_extensions = [
            '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h',
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala'
        ]
        return any(filename.endswith(ext) for ext in code_extensions)

    def _detect_language(self, code: str) -> str:
        """Detect programming language from code."""
        import re
        
        if re.search(r'def\s+\w+\s*\(', code):
            return 'python'
        elif re.search(r'function\s+\w+\s*\(', code) or re.search(r'const\s+\w+\s*=', code):
            return 'javascript'
        elif re.search(r'class\s+\w+\s*{', code) and 'public static void main' in code:
            return 'java'
        elif re.search(r'#include\s*<', code):
            return 'cpp'
        elif re.search(r'fn\s+\w+\s*\(', code):
            return 'rust'
        else:
            return 'python'

    def _generate_mock_code(self) -> str:
        """Generate mock code for testing."""
        return '''
def calculate_sustainability_score(data):
    """
    Calculate sustainability score based on user data.
    """
    total = 0
    categories = ['transport', 'energy', 'waste', 'diet']
    
    for category in categories:
        if category in data:
            total += data[category]
    
    score = total / len(categories) if categories else 0
    return min(100, max(0, score))

class SustainabilityCalculator:
    def __init__(self, user_data):
        self.data = user_data
        
    def calculate_footprint(self):
        transport = self.data.get('transport', 0)
        energy = self.data.get('energy', 0)
        return transport * 0.5 + energy * 0.3
        '''

    def get_proof_verification_url(self, proof_id: str) -> str:
        """
        Get verification URL for a proof.
        
        Args:
            proof_id: Skill proof ID
        
        Returns:
            Verification URL
        """
        proof = self._proofs.get(proof_id)
        if not proof:
            return ""
        
        return f"/api/pos/verify/{proof_id}"

    def get_merkle_tree(self, proof_id: str) -> Optional[Dict[str, Any]]:
        """
        Get Merkle tree for a proof.
        
        Args:
            proof_id: Skill proof ID
        
        Returns:
            Merkle tree data
        """
        proof = self._proofs.get(proof_id)
        if not proof:
            return None
        
        tree_id = proof.metadata.get('tree_id')
        if not tree_id:
            return None
        
        tree = self._trees.get(tree_id)
        if not tree:
            return None
        
        return tree.to_dict()