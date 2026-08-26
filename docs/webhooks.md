# Outbound Webhooks

Clubs can configure outbound webhooks to receive real-time HTTP POST notifications when events occur in their club on CampusConnect.

## Supported Events

Currently supported events:

- `event.created`
- `event.updated`
- `event.deleted`
- `post.created`
- `club.updated`
- `member.joined`
- `member.left`

## Payload Schema

The webhook payload is a JSON object with the following structure:

```json
{
  "event": "event.created",
  "timestamp": "2026-07-30T11:30:00Z",
  "club": {
    "id": "uuid-of-club"
  },
  "data": {
    "id": "uuid-of-event",
    "title": "Hackathon",
    "location": "Auditorium",
    "startsAt": "2026-08-15T09:00:00Z"
  }
}
```

## Security & Signatures

To verify that a webhook request was genuinely sent by CampusConnect, we include an HMAC-SHA256 signature in the `X-CampusConnect-Signature` header.

The signature is generated using your Webhook Secret (available in the Club Settings UI).

### Verifying Signatures in Node.js

```javascript
const crypto = require("crypto");

function verifySignature(payloadString, secret, signatureHeader) {
  const hash = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");

  const expectedSignature = `sha256=${hash}`;

  // Use crypto.timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
}
```

### Verifying Signatures in Python

```python
import hmac
import hashlib

def verify_signature(payload_string, secret, signature_header):
    hash_obj = hmac.new(
        secret.encode('utf-8'),
        payload_string.encode('utf-8'),
        hashlib.sha256
    )
    expected_signature = f"sha256={hash_obj.hexdigest()}"
    return hmac.compare_digest(signature_header, expected_signature)
```

## Retry Policy

If your server responds with a 5xx error or times out, CampusConnect will automatically retry the delivery with exponential backoff:

- **Attempt 1:** Immediate
- **Attempt 2:** +1 minute
- **Attempt 3:** +5 minutes
- **Attempt 4:** +15 minutes
- **Attempt 5:** +1 hour

After 5 failed attempts, the delivery is marked as permanently failed. Client errors (4xx responses) are generally not retried, except for `429 Too Many Requests`.

## Server-Side Request Forgery (SSRF) Protection

For security reasons, webhook URLs must be publicly accessible over HTTPS. We reject URLs pointing to:

- `localhost` or `127.0.0.1`
- Private network ranges (e.g., `10.x.x.x`, `192.168.x.x`)
- AWS Metadata endpoints (`169.254.169.254`)
