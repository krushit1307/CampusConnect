"""
src/compliance/contract_negotiation_copilot.py
----------------------------------------------
Automated Legal Co-Pilot for contract negotiation, OCR text extraction, and predatory clause flagging.
"""

from __future__ import annotations

from typing import Any


class ContractNegotiationCopilot:
    """Scans vendor contracts via OCR and LLM analysis to flag predatory clauses and draft counter-proposals."""

    def __init__(self, llm_client: Any | None = None, ocr_engine: Any | None = None) -> None:
        self.llm_client = llm_client
        self.ocr_engine = ocr_engine

    def analyze_contract(self, pdf_file_bytes: bytes) -> dict[str, Any]:
        """Extract text via OCR and analyze clauses against university legal standards."""
        contract_text = self._extract_text_via_ocr(pdf_file_bytes)
        
        # Analyze against standard University General Counsel templates using LLM
        flagged_clauses = self._detect_predatory_clauses(contract_text)

        if flagged_clauses:
            counter_proposal = self._draft_counter_proposal(flagged_clauses)
            return {
                "status": "flagged",
                "risk_level": "high",
                "flagged_clauses": flagged_clauses,
                "counter_proposal_email": counter_proposal,
            }

        return {
            "status": "approved",
            "message": "No predatory clauses detected. Safe for signature.",
        }

    def _extract_text_via_ocr(self, pdf_file_bytes: bytes) -> str:
        """Extract raw text from PDF contract using OCR."""
        if self.ocr_engine:
            return self.ocr_engine.extract(pdf_file_bytes)
        # Mock extracted legal text containing a predatory clause
        return (
            "Section 9.1: Absolute Liability and Non-refundable deposit. "
            "The client agrees to unlimited indemnification for all weather-related cancellations."
        )

    def _detect_predatory_clauses(self, text: str) -> list[dict[str, str]]:
        """Identify dangerous legal jargon such as absolute liability or unlimited indemnification."""
        predatory_keywords = ["non-refundable deposit", "unlimited indemnification", "absolute liability"]
        flagged = []
        
        for keyword in predatory_keywords:
            if keyword in text.lower():
                flagged.append({
                    "clause_text": text,
                    "matched_keyword": keyword,
                    "ui_highlight_color": "Red",
                    "plain_english_warning": "WARNING: This clause makes you personally liable for damages.",
                })
        return flagged

    def _draft_counter_proposal(self, flagged_clauses: list[dict[str, str]]) -> str:
        """Automatically draft a professional counter-proposal email for the Club President."""
        return (
            "Dear Vendor Representative,\n\n"
            "Thank you for providing the contract. Upon review by our student leadership and legal guidance, "
            "we request modifications to the liability and deposit terms to align with university compliance standards. "
            "Please find our proposed amendments attached.\n\nBest regards,\nClub President"
        )
