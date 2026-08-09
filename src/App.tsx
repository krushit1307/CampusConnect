import React, { useState } from "react";
import { MarkdownEditor } from "./components/ui/markdown-editor";

export function App() {
  const [content, setContent] = useState("# Hello CampusConnect!\nType your markdown here...");

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1>CampusConnect Markdown Editor</h1>
      <p>Loaded successfully and bypassing database health check!</p>
      <div style={{ marginTop: "20px" }}>
        <MarkdownEditor value={content} onChange={(val) => setContent(val || "")} />
      </div>
    </div>
  );
}

export default App;
