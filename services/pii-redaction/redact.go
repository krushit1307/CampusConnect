package main

import (
	"os"
	"os/exec"
	"regexp"
	"strings"
)

const RedactionToken = "[REDACTED]"

var (
	ssnRe           = regexp.MustCompile(`\b\d{3}[-\s]\d{2}[-\s]\d{4}\b`)
	phoneRe         = regexp.MustCompile(`\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b`)
	streetRe        = regexp.MustCompile(`(?i)\b\d{1,5}\s+[A-Za-z0-9][A-Za-z0-9.\s]{0,40}\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way)\.?\b`)
	campusRe        = regexp.MustCompile(`(?i)\b(?:Dorm(?:itory)?|Residence\s+Hall|Hall|Building|Apt|Apartment|Suite|Room)\s+(?:Room\s+)?[A-Za-z0-9-]+\b`)
	nerPersonRe     = regexp.MustCompile(`\b(?:Mr|Ms|Mrs|Mx|Dr|Prof|Dean)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b`)
	nerLocationRe = regexp.MustCompile(`(?i)\b(?:live(?:s)?|living|resides?)\s+in\s+([^.,;]+)`)
)

type RedactionResult struct {
	Redacted  string   `json:"redacted"`
	Detected  bool     `json:"detected"`
	Kinds     []string `json:"kinds"`
}

func apply(input string, re *regexp.Regexp, kind string, kinds *[]string) string {
	if !re.MatchString(input) {
		return input
	}
	*kinds = append(*kinds, kind)
	return re.ReplaceAllString(input, RedactionToken)
}

func redactRegex(content string) RedactionResult {
	kinds := []string{}
	out := content
	out = apply(out, ssnRe, "ssn", &kinds)
	out = apply(out, phoneRe, "phone", &kinds)
	out = apply(out, streetRe, "address", &kinds)
	out = apply(out, campusRe, "address", &kinds)
	return RedactionResult{Redacted: out, Detected: len(kinds) > 0, Kinds: kinds}
}

func redactNER(content string) RedactionResult {
	kinds := []string{}
	out := apply(content, nerPersonRe, "person", &kinds)
	if nerLocationRe.MatchString(out) {
		kinds = append(kinds, "location")
		out = nerLocationRe.ReplaceAllStringFunc(out, func(match string) string {
			sub := nerLocationRe.FindStringSubmatch(match)
			if len(sub) < 2 || strings.TrimSpace(sub[1]) == RedactionToken {
				return match
			}
			return strings.Replace(match, sub[1], RedactionToken, 1)
		})
	}
	return RedactionResult{Redacted: out, Detected: len(kinds) > 0, Kinds: kinds}
}

func unique(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func pipeSpacyNER(content string) string {
	if os.Getenv("SPACY_NER") != "1" {
		return content
	}
	cmd := exec.Command("python3", "ner.py", content)
	cmd.Dir = "."
	out, err := cmd.Output()
	if err != nil {
		return content
	}
	trimmed := strings.TrimSpace(string(out))
	if trimmed == "" {
		return content
	}
	return trimmed
}

func Redact(content string) RedactionResult {
	regexPass := redactRegex(content)
	nerInput := pipeSpacyNER(regexPass.Redacted)
	nerPass := redactNER(nerInput)
	kinds := unique(append(regexPass.Kinds, nerPass.Kinds...))
	if nerInput != regexPass.Redacted {
		kinds = unique(append(kinds, "location"))
	}
	return RedactionResult{
		Redacted: nerPass.Redacted,
		Detected: len(kinds) > 0,
		Kinds:    kinds,
	}
}
