#!/usr/bin/env python3
"""Lightweight NER for leftover person/location mentions. Uses spaCy when installed."""

from __future__ import annotations

import re
import sys

REDACTED = "[REDACTED]"
PERSON_RE = re.compile(r"\b(?:Mr|Ms|Mrs|Mx|Dr|Prof|Dean)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b")
LOCATION_RE = re.compile(r"\b(?:live(?:s)?|living|resides?)\s+in\s+(?!\[REDACTED\])([^.,;]+)", re.I)


def redact_rules(text: str) -> str:
    text = PERSON_RE.sub(REDACTED, text)
    def _loc(match: re.Match[str]) -> str:
        place = match.group(1)
        if place.strip() == REDACTED:
            return match.group(0)
        return match.group(0).replace(place, REDACTED, 1)

    return LOCATION_RE.sub(_loc, text)


def redact_spacy(text: str) -> str:
    try:
        import spacy  # type: ignore
    except Exception:
        return redact_rules(text)

    try:
        nlp = spacy.load("en_core_web_sm")
    except Exception:
        return redact_rules(text)

    doc = nlp(text)
    spans = [ent for ent in doc.ents if ent.label_ in {"PERSON", "GPE", "LOC", "FAC"}]
    if not spans:
        return redact_rules(text)
    out = text
    for ent in sorted(spans, key=lambda item: item.start_char, reverse=True):
        out = out[: ent.start_char] + REDACTED + out[ent.end_char :]
    return out


if __name__ == "__main__":
    print(redact_spacy(" ".join(sys.argv[1:])))
