"""
Hash Utilities for Proof-of-Skill
Cryptographic hashing functions for Merkle Trees and AST hashing.
"""

import hashlib
import json
from typing import Any, Dict, List, Optional, Union
import re


class HashUtils:
    """
    Utility class for cryptographic hashing operations.
    """

    @staticmethod
    def sha256(data: Union[str, bytes]) -> str:
        """Generate SHA-256 hash."""
        if isinstance(data, str):
            data = data.encode('utf-8')
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def keccak256(data: Union[str, bytes]) -> str:
        """Generate Keccak-256 hash (Ethereum compatible)."""
        try:
            from eth_hash.auto import keccak
            if isinstance(data, str):
                data = data.encode('utf-8')
            return keccak(data).hex()
        except ImportError:
            # Fallback to SHA-256 if eth-hash is not available
            return HashUtils.sha256(data)

    @staticmethod
    def double_hash(data: Union[str, bytes]) -> str:
        """Generate double SHA-256 hash."""
        first = HashUtils.sha256(data)
        if isinstance(first, str):
            first = first.encode('utf-8')
        return HashUtils.sha256(first)

    @staticmethod
    def hash_object(obj: Dict[str, Any]) -> str:
        """Hash a Python object."""
        json_str = json.dumps(obj, sort_keys=True, default=str)
        return HashUtils.sha256(json_str)

    @staticmethod
    def hash_ast_node(node: Dict[str, Any]) -> str:
        """Hash an AST node."""
        # Remove non-essential fields
        clean_node = {k: v for k, v in node.items() if k not in ['children', 'metadata']}
        # Add children hashes
        if 'children' in node:
            child_hashes = [HashUtils.hash_ast_node(c) for c in node['children']]
            clean_node['child_hashes'] = child_hashes
        return HashUtils.hash_object(clean_node)

    @staticmethod
    def hash_code_artifact(content: str, language: str = "python") -> str:
        """
        Hash code artifact with language-specific normalization.
        
        Args:
            content: Code content
            language: Programming language
        
        Returns:
            Hash string
        """
        # Normalize content based on language
        normalized = HashUtils._normalize_code(content, language)
        return HashUtils.sha256(normalized)

    @staticmethod
    def _normalize_code(content: str, language: str) -> str:
        """Normalize code for consistent hashing."""
        # Remove comments
        if language == "python":
            content = re.sub(r'#.*$', '', content, flags=re.MULTILINE)
            content = re.sub(r'""".*?"""', '', content, flags=re.DOTALL)
            content = re.sub(r"'''.*?'''", '', content, flags=re.DOTALL)
        elif language in ["javascript", "typescript"]:
            content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        elif language in ["java", "c", "cpp", "csharp"]:
            content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        elif language == "rust":
            content = re.sub(r'//.*$', '', content, flags=re.MULTILINE)
            content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        
        # Remove whitespace
        content = re.sub(r'\s+', ' ', content)
        content = content.strip()
        
        return content

    @staticmethod
    def hash_file_content(content: bytes, file_path: str) -> str:
        """Hash file content with path metadata."""
        # Combine file path and content
        combined = f"{file_path}:{content.hex()}"
        return HashUtils.sha256(combined)

    @staticmethod
    def hash_repository_code(files: Dict[str, bytes], language: str = "python") -> str:
        """
        Hash an entire repository's code.
        
        Args:
            files: Dictionary of file paths to content
            language: Primary language
        
        Returns:
            Combined hash
        """
        file_hashes = []
        for path, content in sorted(files.items()):
            file_hash = HashUtils.hash_file_content(content, path)
            file_hashes.append(file_hash)
        
        # Combine all file hashes
        combined = "".join(file_hashes)
        return HashUtils.sha256(combined)

    @staticmethod
    def hash_with_salt(data: Union[str, bytes], salt: str) -> str:
        """Hash data with a salt."""
        combined = f"{salt}:{data}"
        return HashUtils.sha256(combined)

    @staticmethod
    def create_verification_hash(
        skill_name: str,
        user_address: str,
        merkle_root: str,
        timestamp: str
    ) -> str:
        """
        Create a verification hash for anchoring to blockchain.
        """
        data = {
            'skill': skill_name,
            'user': user_address,
            'merkle_root': merkle_root,
            'timestamp': timestamp
        }
        return HashUtils.hash_object(data)

    @staticmethod
    def verify_merkle_proof(leaf_hash: str, proof: List[str], root_hash: str) -> bool:
        """
        Verify a Merkle proof.
        
        Args:
            leaf_hash: Leaf hash
            proof: List of sibling hashes
            root_hash: Expected root hash
        
        Returns:
            True if proof is valid
        """
        current_hash = leaf_hash
        for sibling in proof:
            if current_hash < sibling:
                current_hash = HashUtils.sha256(current_hash + sibling)
            else:
                current_hash = HashUtils.sha256(sibling + current_hash)
        return current_hash == root_hash