import { AUTOMATION, IGNORE_BOTS } from "./constants.js";

export function normalizeCommentBody(body) {
  return String(body || "")
    .trim()
    .toLowerCase();
}

export function nowIso() {
  return new Date().toISOString();
}

export function hoursSince(isoTime, now = new Date()) {
  if (!isoTime) return Number.POSITIVE_INFINITY;
  const then = new Date(isoTime);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60);
}

export function withMarker(marker, body) {
  return `${body}\n\n<!-- ${marker} -->`;
}

export function hasMarker(text, marker) {
  return String(text || "").includes(`<!-- ${marker} -->`);
}

export function markerForUserIssue(baseMarker, username, issueNumber) {
  return `${baseMarker}:${String(username || "").toLowerCase()}:issue-${issueNumber}`;
}

export function isIgnoredBotUser(user) {
  const login = String(user?.login || "").toLowerCase();
  if (!login) return true;
  if (String(user?.type || "").toLowerCase() === "bot") return true;
  return IGNORE_BOTS.map((b) => b.toLowerCase()).includes(login);
}

export function isCommand(body, command) {
  const text = normalizeCommentBody(body);
  const regex = new RegExp("^" + command + "(?:\\s|$)");
  return regex.test(text);
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

export function extractLinkedIssueNumbers(text) {
  const source = String(text || "");
  const matches = new Set();
  const crossRefRegex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)|#(\d+)/gi;
  let match = crossRefRegex.exec(source);
  while (match) {
    const id = Number(match[1] || match[2]);
    if (Number.isFinite(id) && id > 0) matches.add(id);
    match = crossRefRegex.exec(source);
  }
  return Array.from(matches);
}
