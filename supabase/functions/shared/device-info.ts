export interface ParsedDeviceInfo {
  device_info: string;
  browser: string;
  os: string;
}

/**
 * Lightweight User-Agent parser used to label active device sessions
 * (e.g. "MacBook - Chrome", "iPhone - Safari"). Deliberately small:
 * no external dependencies for an edge runtime.
 */
export function parseUserAgent(userAgent: string | null | undefined): ParsedDeviceInfo {
  const ua = userAgent || "";
  let browser = "Unknown";
  let os = "Unknown";

  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/FxiOS\//.test(ua)) browser = "Firefox";
  else if (/CriOS\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  if (/Windows Phone/.test(ua)) os = "Windows Phone";
  else if (/iPad|iPhone|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { device_info: `${os} • ${browser}`, browser, os };
}
