import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "AI.html"));
});

app.post("/api/chat", async (req, res) => {
  try {
    const { prompt, fileContent } = req.body;

    if (!prompt && !fileContent) {
      return res.status(400).json({ reply: "Please provide input." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ reply: "Server missing API key." });
    }

    let finalPrompt = `
You are a friendly AI assistant.
Be conversational and natural. Use emojis occasionally.

`;

    if (fileContent) {
      finalPrompt += `User uploaded file content:\n${fileContent}\n\n`;
    }

    if (prompt) {
      finalPrompt += `User message:\n${prompt}`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: finalPrompt }]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return res.status(500).json({ reply: "AI failed to respond." });
    }

    const data = await response.json();

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response generated.";

    res.json({ reply });

  } catch (error) {
    console.error("Server crash:", error);
    res.status(500).json({ reply: "Server crashed." });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});