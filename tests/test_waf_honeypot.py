import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from backend.services.waf_honeypot import router

client = TestClient(router)

@patch("backend.services.waf_honeypot.quarantine_ip_at_edge_waf")
def test_honeypot_triggers_immediate_block_on_malicious_signature(mock_waf_update):
    """
    Verifies that anomalous traffic hitting the honey pot triggers edge blocking actions.
    """
    response = client.get(
        "/api/v1/tickets/early-bird-secret-vip-link-do-not-click",
        headers={
            "User-Agent": "Mozilla/5.0 ScraperBot/2.0",
            "x-client-tls-ciphers": "ECDHE-RSA-AES128-GCM-SHA256",
            "x-client-tcp-window": "65535"
        }
    )
    
    # Assert network edge isolation rules executed correctly
    assert response.status_code == 403
    mock_waf_update.assert_called_once()
    assert "Automated ML-WAF Mitigation" in response.json()["detail"]
