import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Route that sends prompt directly to Gemini (your old route)
app.post("/api/gemini", async (req, res) => {
  const userPrompt = req.body.prompt;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
      }),
    }
  );

  const data = await response.json();
  res.json(data);
});

// 🧠 NEW: analyze love test answers
app.post("/api/analyze", async (req, res) => {
  const { name, answers } = req.body;

  // Combine all answers into one AI prompt
  const userText = answers
    .map((ans, i) => `Q${i + 1}: ${ans}`)
    .join("\n");

  const prompt = `
You are an analysis assistant for a love test.
The participant's name is ${name}.
Their answers are:
${userText}

Please analyze their responses.
Give:
1. A short description of their emotional depth and honesty.
2. A love level in percentage (0–100%).
3. 1–2 suggestions of what they can do to improve or maintain their love.
Respond in a short, clear way that fits under 150 words.
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI.";

    res.json({ result: aiText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error connecting to Gemini API" });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
