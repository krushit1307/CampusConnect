export function generateCsv(payload: any): string {
  const { poll, options, votes } = payload;
  const isAnonymous = poll.is_anonymous;

  // Create a map for easy option lookup
  const optionMap = new Map();
  options.forEach((opt: any) => {
    optionMap.set(opt.id, opt.text);
  });

  // Define headers
  let headers = ["Vote ID", "Option", "Voted At"];
  if (!isAnonymous) {
    headers = ["Vote ID", "User ID", "Name", "Email", "Option", "Voted At"];
  }

  const lines = [];
  lines.push(headers.join(","));

  votes.forEach((vote: any) => {
    const row = [];
    row.push(`"${vote.id}"`);

    if (!isAnonymous) {
      row.push(`"${vote.user_id}"`);
      row.push(`"${vote.profiles?.full_name || "Unknown"}"`);
      row.push(`"${vote.profiles?.email || ""}"`);
    }

    const optionText = optionMap.get(vote.option_id) || "Unknown Option";
    row.push(`"${optionText.replace(/"/g, '""')}"`); // Escape quotes in option text
    row.push(`"${new Date(vote.created_at).toISOString()}"`);

    lines.push(row.join(","));
  });

  return lines.join("\n");
}
