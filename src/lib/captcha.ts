export function isCaptchaConfigured(siteKey?: string, secretKey?: string) {
  return Boolean(siteKey && secretKey);
}

export function shouldRequireCaptcha(siteKey?: string, secretKey?: string, token?: string) {
  return isCaptchaConfigured(siteKey, secretKey) && Boolean(token);
}
