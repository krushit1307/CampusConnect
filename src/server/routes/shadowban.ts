import express from "express";
import OpenAI from "openai";

const router = express.Router();

// Initialize OpenAI client
// Ensure your .env file has OPENAI_API_KEY set
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/generate-apology", async (req, res) => {
  try {
    // In a full implementation, you would fetch these from the database using the user's session ID.
    // For this step, we'll accept them in the request body.
    const { toxicMessages } = req.body;

    if (!toxicMessages || !Array.isArray(toxicMessages) || toxicMessages.length === 0) {
      return res.status(400).json({ error: "No toxic messages provided." });
    }

    // Issue #4913 Requirement: "Draft a sincere, 1-paragraph apology letter from this user
    // acknowledging why these specific messages were harmful to the community."
    const prompt = `
      You are helping a user write an apology for their behavior on a community platform.
      Here are the user's recent toxic messages:
      
      ${toxicMessages.map((msg: string) => `- "${msg}"`).join("\n")}
      
      Task: Draft a sincere, 1-paragraph apology letter from this user acknowledging why these specific messages were harmful to the community. 
      Write it in the first person ("I"). Do not include any introductory or concluding text, just the paragraph itself.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7, // 0.7 gives a good balance of sincerity and standard phrasing
    });

    const apology = completion.choices[0].message.content?.trim();

    res.json({ apology });
  } catch (error) {
    console.error("Error generating apology:", error);
    res.status(500).json({ error: "Failed to generate apology. Please try again later." });
  }
});

export default router;
