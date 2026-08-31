export const PII_REDACTION_TOKEN = "[REDACTED]";
export const DOXXING_VIOLATION_TYPE = "doxxing";

export type DoxxingMatchKind = "ssn" | "phone" | "address" | "person" | "location";

export type DoxxingRedaction = {
  redacted: string;
  detected: boolean;
  kinds: DoxxingMatchKind[];
};

const SSN_RE = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const STREET_ADDRESS_RE =
  /\b\d{1,5}\s+[A-Za-z0-9][A-Za-z0-9.\s]{0,40}\s(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way)\.?\b/gi;
const CAMPUS_ADDRESS_RE =
  /\b(?:Dorm(?:itory)?|Residence\s+Hall|Hall|Building|Apt|Apartment|Suite|Room)\s+(?:Room\s+)?[A-Za-z0-9-]+\b/gi;
const NER_PERSON_RE = /\b(?:Mr|Ms|Mrs|Mx|Dr|Prof|Dean)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
const NER_LOCATION_RE = /\b(?:live(?:s)?|living|resides?)\s+in\s+(?!\[REDACTED\])([^.,;]+)/gi;

function applyPattern(
  input: string,
  pattern: RegExp,
  kind: DoxxingMatchKind,
  kinds: Set<DoxxingMatchKind>,
): string {
  pattern.lastIndex = 0;
  if (!pattern.test(input)) return input;
  kinds.add(kind);
  pattern.lastIndex = 0;
  return input.replace(pattern, PII_REDACTION_TOKEN);
}

/** Fast regex pass for SSN, phone, and standard/campus address formats. */
export function redactPiiRegex(content: string): DoxxingRedaction {
  const kinds = new Set<DoxxingMatchKind>();
  let redacted = content;
  redacted = applyPattern(redacted, SSN_RE, "ssn", kinds);
  redacted = applyPattern(redacted, PHONE_RE, "phone", kinds);
  redacted = applyPattern(redacted, STREET_ADDRESS_RE, "address", kinds);
  redacted = applyPattern(redacted, CAMPUS_ADDRESS_RE, "address", kinds);
  return { redacted, detected: kinds.size > 0, kinds: [...kinds] };
}

/** Lightweight NER for leftover person/location mentions. */
export function redactWithNer(content: string): DoxxingRedaction {
  const kinds = new Set<DoxxingMatchKind>();
  let redacted = content;
  redacted = applyPattern(redacted, NER_PERSON_RE, "person", kinds);
  NER_LOCATION_RE.lastIndex = 0;
  if (NER_LOCATION_RE.test(redacted)) {
    kinds.add("location");
    NER_LOCATION_RE.lastIndex = 0;
    redacted = redacted.replace(NER_LOCATION_RE, (_full, place: string) => {
      const trimmed = String(place).trim();
      if (!trimmed || trimmed === PII_REDACTION_TOKEN) return _full;
      return _full.replace(place, PII_REDACTION_TOKEN);
    });
  }
  return { redacted, detected: kinds.size > 0, kinds: [...kinds] };
}

export function redactDoxxingPii(content: string): DoxxingRedaction {
  const regexPass = redactPiiRegex(content);
  const nerPass = redactWithNer(regexPass.redacted);
  const kinds = [...new Set([...regexPass.kinds, ...nerPass.kinds])];
  return {
    redacted: nerPass.redacted,
    detected: kinds.length > 0,
    kinds,
  };
}

export async function interceptChatPayload(content: string): Promise<DoxxingRedaction> {
  const url = process.env.PII_REDACTION_URL;
  if (url) {
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/redact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (response.ok) {
        const body = (await response.json()) as DoxxingRedaction;
        if (body?.redacted) return body;
      }
    } catch {
      // Fall back to the in-process regex/NER pipeline.
    }
  }
  return redactDoxxingPii(content);
}
