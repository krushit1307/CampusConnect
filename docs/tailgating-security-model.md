# Tailgating & Emergency Door Locking Integration Security Model

This document outlines the architecture, detection rules, privacy policy, and local hardware simulation guidelines for the Tailgating/Perimeter Detection system.

---

## 1. System Architecture & Event Flow

The system evaluates doorway entry threshold crossings against expected authorized badge card events within short, self-closing detection windows.

```
[Access Control]
       │ Ingest Badge Swipe
       ▼
[Detection Window Manager] ──► (Open Window for X seconds)
       │
       ├─► [Camera Observations Ingestion] (Collect anonymous tracking ID entries)
       ▼
[Threshold Detection Engine] ──► (Compare Observed vs Expected count)
       │
       ▼
[Tailgating Rule Engine]
       │ Evaluates Breach Rules
       ▼
[Incident pipeline] ──► [Siren / Lock Dispatch] (Simulation Only)
                    ──► [Police Alert Dispatcher]
```

---

## 2. Threat & Rule Evaluation Matrix

| Detection Rule         | Expected Count | Observed Count | Severity        | Action Triggered                    |
| :--------------------- | :------------- | :------------- | :-------------- | :---------------------------------- |
| **Normal Access**      | $N \ge 1$      | $N$            | INFO            | None / Log                          |
| **Tailgating Breach**  | $N \ge 1$      | $> N$          | HIGH / CRITICAL | Local Siren Action & Dispatch alert |
| **Missing Crossing**   | $1$            | $0$            | LOW             | Flag Alert log (user did not enter) |
| **Unauthorized Entry** | $0$ (No swipe) | $\ge 1$        | CRITICAL        | Security Lockout command initiated  |

---

## 3. Privacy & Bounding Box Principles

This system protects people and facility safety while adhering to strict privacy controls:

- **No Facial Recognition / Biometrics**: People counters report anonymous integer tracking IDs only.
- **Short-Lived Detection Windows**: Tracking IDs are only cached for the brief entry evaluation window (usually 5 seconds) and are not tracked across doors.
- **Evidence Reference Retention**: No copies of raw videos are held. References expire and are purged after the configuration retention window (e.g. 7 days).
- **Access Audit Trail**: Administrative audit logs capture any personnel who access evidence metadata or resolve alerts.
