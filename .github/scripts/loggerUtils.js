import { AUTOMATION, IGNORE_BOTS } from "./constants.js";

export function isIgnoredBotUser(user) {
  const login = String(user?.login || "").toLowerCase();
  if (!login) return true;
  if (String(user?.type || "").toLowerCase() === "bot") return true;
  return IGNORE_BOTS.map((b) => b.toLowerCase()).includes(login);
}

export function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function logInfo(core, message, details = {}) {
  core.info(
    `[${AUTOMATION.id}] ${message}${Object.keys(details).length ? ` ${JSON.stringify(details)}` : ""}`,
  );
}

export function logWarning(core, message, details = {}) {
  core.warning(
    `[${AUTOMATION.id}] ${message}${Object.keys(details).length ? ` ${JSON.stringify(details)}` : ""}`,
  );
}

export function logError(core, message, error, details = {}) {
  core.error(
    `[${AUTOMATION.id}] ${message} ${formatError(error)}${Object.keys(details).length ? ` ${JSON.stringify(details)}` : ""}`,
  );
}
