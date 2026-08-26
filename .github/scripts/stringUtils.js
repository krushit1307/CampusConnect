export function normalizeCommentBody(body) {
  return String(body || "")
    .trim()
    .toLowerCase();
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

export function isCommand(body, command) {
  const text = normalizeCommentBody(body);
  const regex = new RegExp("^" + command + "(?:\\s|$)");
  return regex.test(text);
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
