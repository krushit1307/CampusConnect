"""
AST Hasher for Proof-of-Skill
Generates cryptographic hashes from Abstract Syntax Trees of code.
"""

import ast
import hashlib
import json
import re
from typing import Dict, Any, List, Optional, Tuple, Union
import astor
from dataclasses import dataclass, field

from .hash_utils import HashUtils


@dataclass
class ASTHashResult:
    """Result of AST hashing."""
    hash: str = ""
    normalized_code: str = ""
    ast_count: int = 0
    complexity_score: float = 0.0
    token_count: int = 0
    function_count: int = 0
    class_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class ASTHasher:
    """
    Generates cryptographic hashes from Abstract Syntax Trees.
    Supports multiple programming languages.
    """

    def __init__(self):
        self.supported_languages = ['python', 'javascript', 'typescript', 'java', 'cpp', 'rust']
        self._language_parsers = {
            'python': self._parse_python,
            'javascript': self._parse_javascript,
            'typescript': self._parse_typescript,
            'java': self._parse_java,
            'cpp': self._parse_cpp,
            'rust': self._parse_rust
        }

    def hash_code(
        self,
        code: str,
        language: str = "python",
        include_metadata: bool = True
    ) -> ASTHashResult:
        """
        Hash code using AST analysis.
        
        Args:
            code: Source code string
            language: Programming language
            include_metadata: Include metadata in hash
        
        Returns:
            ASTHashResult object
        """
        if language not in self._language_parsers:
            raise ValueError(f"Unsupported language: {language}")

        # Parse code to AST
        try:
            ast_tree = self._language_parsers[language](code)
        except Exception as e:
            # Fallback to normalized text hashing
            normalized = HashUtils._normalize_code(code, language)
            return ASTHashResult(
                hash=HashUtils.sha256(normalized),
                normalized_code=normalized,
                ast_count=0,
                metadata={'error': str(e), 'fallback': True}
            )

        # Extract AST features
        features = self._extract_features(ast_tree, language)
        
        # Generate hash
        hash_input = self._create_hash_input(ast_tree, features, language, include_metadata)
        hash_value = HashUtils.sha256(hash_input)

        return ASTHashResult(
            hash=hash_value,
            normalized_code=self._normalize_ast(ast_tree, language),
            ast_count=features.get('node_count', 0),
            complexity_score=features.get('complexity', 0.0),
            token_count=features.get('token_count', 0),
            function_count=features.get('function_count', 0),
            class_count=features.get('class_count', 0),
            metadata=features.get('metadata', {})
        )

    def _parse_python(self, code: str) -> ast.AST:
        """Parse Python code to AST."""
        try:
            return ast.parse(code)
        except SyntaxError as e:
            # Try to fix common issues
            code = self._fix_python_syntax(code)
            return ast.parse(code)

    def _fix_python_syntax(self, code: str) -> str:
        """Fix common Python syntax issues."""
        # Add missing imports
        if 'print(' in code and 'from __future__ import print_function' not in code:
            code = 'from __future__ import print_function\n' + code
        
        # Fix async/await for older Python
        code = re.sub(r'async\s+def', 'def', code)
        code = re.sub(r'await\s+', '', code)
        
        return code

    def _parse_javascript(self, code: str) -> Dict[str, Any]:
        """Parse JavaScript code to AST."""
        try:
            import acorn
            return acorn.parse(code, {'ecmaVersion': 2022})
        except ImportError:
            # Fallback: use regex-based parsing
            return self._parse_js_regex(code)

    def _parse_typescript(self, code: str) -> Dict[str, Any]:
        """Parse TypeScript code to AST."""
        try:
            import typescript
            return typescript.parse(code)
        except ImportError:
            return self._parse_javascript(code)

    def _parse_java(self, code: str) -> Dict[str, Any]:
        """Parse Java code to AST."""
        try:
            import javalang
            tree = javalang.parse.parse(code)
            return self._java_ast_to_dict(tree)
        except ImportError:
            return self._parse_fallback(code, 'java')

    def _parse_cpp(self, code: str) -> Dict[str, Any]:
        """Parse C++ code to AST."""
        try:
            import pycparser
            return pycparser.parse_file(code, use_cpp=True)
        except ImportError:
            return self._parse_fallback(code, 'cpp')

    def _parse_rust(self, code: str) -> Dict[str, Any]:
        """Parse Rust code to AST."""
        try:
            import rust_parser
            return rust_parser.parse(code)
        except ImportError:
            return self._parse_fallback(code, 'rust')

    def _parse_fallback(self, code: str, language: str) -> Dict[str, Any]:
        """Fallback parser for unsupported languages."""
        return {
            'type': 'fallback',
            'language': language,
            'content': code,
            'node_count': 1
        }

    def _parse_js_regex(self, code: str) -> Dict[str, Any]:
        """Simple regex-based JavaScript parser fallback."""
        functions = re.findall(r'function\s+(\w+)\s*\([^)]*\)', code)
        classes = re.findall(r'class\s+(\w+)', code)
        
        return {
            'type': 'regex_parse',
            'functions': functions,
            'classes': classes,
            'node_count': len(functions) + len(classes) + 1
        }

    def _java_ast_to_dict(self, node) -> Dict[str, Any]:
        """Convert Java AST to dictionary."""
        if hasattr(node, '__dict__'):
            result = {}
            for key, value in node.__dict__.items():
                if isinstance(value, list):
                    result[key] = [self._java_ast_to_dict(item) for item in value if item]
                elif hasattr(value, '__dict__'):
                    result[key] = self._java_ast_to_dict(value)
                else:
                    result[key] = value
            return result
        return str(node)

    def _extract_features(self, ast_tree: Any, language: str) -> Dict[str, Any]:
        """Extract features from AST."""
        features = {
            'node_count': 0,
            'complexity': 0.0,
            'token_count': 0,
            'function_count': 0,
            'class_count': 0,
            'metadata': {}
        }

        if language == 'python':
            features = self._extract_python_features(ast_tree)
        elif language in ['javascript', 'typescript']:
            features = self._extract_js_features(ast_tree)
        elif language == 'java':
            features = self._extract_java_features(ast_tree)
        else:
            features = self._extract_generic_features(ast_tree)

        return features

    def _extract_python_features(self, tree: ast.AST) -> Dict[str, Any]:
        """Extract features from Python AST."""
        features = {
            'node_count': 0,
            'complexity': 0.0,
            'token_count': 0,
            'function_count': 0,
            'class_count': 0,
            'metadata': {}
        }

        class PythonASTVisitor(ast.NodeVisitor):
            def __init__(self):
                self.node_count = 0
                self.function_count = 0
                self.class_count = 0
                self.token_count = 0
                self.complexity = 1.0

            def generic_visit(self, node):
                self.node_count += 1
                self.token_count += len(ast.get_source_segment(None, node) or '')
                if isinstance(node, ast.FunctionDef):
                    self.function_count += 1
                    # Count nested complexity
                    self.complexity += len(node.body)
                elif isinstance(node, ast.ClassDef):
                    self.class_count += 1
                super().generic_visit(node)

        visitor = PythonASTVisitor()
        try:
            visitor.visit(tree)
        except:
            pass

        features['node_count'] = visitor.node_count
        features['function_count'] = visitor.function_count
        features['class_count'] = visitor.class_count
        features['token_count'] = visitor.token_count
        features['complexity'] = visitor.complexity

        return features

    def _extract_js_features(self, tree: Dict[str, Any]) -> Dict[str, Any]:
        """Extract features from JavaScript/TypeScript AST."""
        features = {
            'node_count': 0,
            'complexity': 0.0,
            'token_count': 0,
            'function_count': 0,
            'class_count': 0,
            'metadata': {}
        }

        def count_nodes(node):
            if isinstance(node, dict):
                features['node_count'] += 1
                if node.get('type') in ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']:
                    features['function_count'] += 1
                elif node.get('type') == 'ClassDeclaration':
                    features['class_count'] += 1
                for key, value in node.items():
                    if isinstance(value, (dict, list)):
                        if isinstance(value, list):
                            for item in value:
                                count_nodes(item)
                        else:
                            count_nodes(value)

        try:
            count_nodes(tree)
        except:
            pass

        features['complexity'] = features['node_count'] / 10 if features['node_count'] > 0 else 0

        return features

    def _extract_java_features(self, tree: Dict[str, Any]) -> Dict[str, Any]:
        """Extract features from Java AST."""
        features = {
            'node_count': 0,
            'complexity': 0.0,
            'token_count': 0,
            'function_count': 0,
            'class_count': 0,
            'metadata': {}
        }

        def count_java_nodes(node):
            if isinstance(node, dict):
                features['node_count'] += 1
                if node.get('type') in ['MethodDeclaration', 'ConstructorDeclaration']:
                    features['function_count'] += 1
                elif node.get('type') == 'ClassDeclaration':
                    features['class_count'] += 1
                for key, value in node.items():
                    if isinstance(value, (dict, list)):
                        if isinstance(value, list):
                            for item in value:
                                count_java_nodes(item)
                        else:
                            count_java_nodes(value)

        try:
            count_java_nodes(tree)
        except:
            pass

        features['complexity'] = features['node_count'] / 8 if features['node_count'] > 0 else 0

        return features

    def _extract_generic_features(self, tree: Any) -> Dict[str, Any]:
        """Extract generic features from any AST."""
        features = {
            'node_count': 1,
            'complexity': 0.0,
            'token_count': 0,
            'function_count': 0,
            'class_count': 0,
            'metadata': {'type': 'generic'}
        }
        return features

    def _normalize_ast(self, ast_tree: Any, language: str) -> str:
        """Normalize AST to a string representation."""
        try:
            if language == 'python':
                return astor.to_source(ast_tree)
            else:
                return json.dumps(ast_tree, sort_keys=True, default=str)
        except:
            return str(ast_tree)

    def _create_hash_input(
        self,
        ast_tree: Any,
        features: Dict[str, Any],
        language: str,
        include_metadata: bool
    ) -> str:
        """Create hash input from AST and features."""
        hash_components = []

        # AST structure
        ast_str = self._normalize_ast(ast_tree, language)
        hash_components.append(f"ast:{hashlib.sha256(ast_str.encode()).hexdigest()}")

        # Features
        hash_components.append(f"language:{language}")
        hash_components.append(f"node_count:{features.get('node_count', 0)}")
        hash_components.append(f"complexity:{features.get('complexity', 0)}")
        hash_components.append(f"function_count:{features.get('function_count', 0)}")
        hash_components.append(f"class_count:{features.get('class_count', 0)}")

        if include_metadata:
            hash_components.append(f"metadata:{json.dumps(features.get('metadata', {}), sort_keys=True)}")

        return "|".join(hash_components)

    def hash_multiple_files(
        self,
        files: Dict[str, str],
        language: str = "python"
    ) -> Dict[str, ASTHashResult]:
        """
        Hash multiple files and combine.
        
        Args:
            files: Dictionary of file paths to content
            language: Primary language
        
        Returns:
            Dictionary of file paths to ASTHashResult
        """
        results = {}
        combined_hash_input = []

        for file_path, content in files.items():
            result = self.hash_code(content, language)
            results[file_path] = result
            combined_hash_input.append(f"{file_path}:{result.hash}")

        # Combined hash
        combined = "|".join(sorted(combined_hash_input))
        combined_hash = HashUtils.sha256(combined)

        # Add combined result
        results['__combined__'] = ASTHashResult(
            hash=combined_hash,
            normalized_code=combined,
            ast_count=sum(r.ast_count for r in results.values() if r.ast_count),
            complexity_score=sum(r.complexity_score for r in results.values() if r.complexity_score),
            token_count=sum(r.token_count for r in results.values() if r.token_count),
            function_count=sum(r.function_count for r in results.values() if r.function_count),
            class_count=sum(r.class_count for r in results.values() if r.class_count),
            metadata={'combined': True, 'file_count': len(files)}
        )

        return results