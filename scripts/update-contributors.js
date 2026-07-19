import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const README_PATH = path.join(__dirname, "../README.md");
const REPO = process.env.GITHUB_REPOSITORY || "krushit1307/CampusConnect";
const TOKEN = process.env.GITHUB_TOKEN;

async function getContributors() {
  const url = `https://api.github.com/repos/${REPO}/contributors`;
  const headers = {
    "User-Agent": "node.js",
  };
  if (TOKEN) {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch contributors: ${res.statusText}`);
  }
  return res.json();
}

function generateMarkdown(contributors) {
  // 1. Generate Hall of Fame (Top 5)
  const top5 = contributors.slice(0, 5);
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  let hallOfFame = "### 🏆 Hall of Fame (Top 5)\n\n";
  hallOfFame += "| Rank | Contributor | Contributions |\n";
  hallOfFame += "| :---: | :---: | :---: |\n";

  top5.forEach((c, idx) => {
    const medal = medals[idx] || `${idx + 1}`;
    hallOfFame += `| ${medal} | <a href="${c.html_url}"><img src="${c.avatar_url}" width="50" height="50" style="border-radius:50%;"/><br /><sub><b>${c.login}</b></sub></a> | ${c.contributions} |\n`;
  });

  // 2. Generate All Contributors Gallery
  let gallery = "\n### 👥 All Contributors\n\n";
  contributors.forEach((c) => {
    gallery += `<a href="${c.html_url}"><img src="${c.avatar_url}" width="40" height="40" style="border-radius:50%; margin:3px;" title="${c.login} (${c.contributions} contributions)"/></a>\n`;
  });

  return `${hallOfFame}${gallery}`;
}

async function main() {
  try {
    console.log(`Fetching contributors for ${REPO}...`);
    const contributors = await getContributors();
    console.log(`Found ${contributors.length} contributors.`);

    let readme = fs.readFileSync(README_PATH, "utf8");

    const startMarker = "<!-- START_CONTRIBUTORS_GALLERY -->";
    const endMarker = "<!-- END_CONTRIBUTORS_GALLERY -->";

    const newContent = generateMarkdown(contributors);
    const replacement = `${startMarker}\n${newContent}\n${endMarker}`;

    if (readme.includes(startMarker) && readme.includes(endMarker)) {
      const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);
      readme = readme.replace(regex, replacement);
      console.log("Updated existing contributors gallery in README.md.");
    } else {
      // Append to the end of README.md
      readme += `\n\n## 👥 Contributors\n\n${replacement}\n`;
      console.log("Appended new contributors gallery to README.md.");
    }

    fs.writeFileSync(README_PATH, readme, "utf8");
    console.log("Successfully updated README.md.");
  } catch (error) {
    console.error("Error updating contributors:", error);
    process.exit(1);
  }
}

main();
