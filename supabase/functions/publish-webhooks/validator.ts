export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "https:") {
      return false; // Force HTTPS
    }

    const hostname = parsedUrl.hostname;

    // Reject common internal ranges and localhost
    const disallowedHostnames = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "169.254.169.254", // AWS metadata
      "[::1]",
    ];

    if (disallowedHostnames.includes(hostname)) {
      return false;
    }

    // Reject internal IP ranges (10.x.x.x, 172.16.x.x - 172.31.x.x, 192.168.x.x)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const octet1 = parseInt(match[1], 10);
      const octet2 = parseInt(match[2], 10);

      if (octet1 === 10) return false;
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return false;
      if (octet1 === 192 && octet2 === 168) return false;
    }

    // TODO: Ideally resolve DNS and check resolved IP to prevent DNS rebinding

    return true;
  } catch {
    return false;
  }
}
