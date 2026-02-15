import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

/* ===============================
   Fix __dirname (ES Modules)
================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===============================
   MIDDLEWARE
================================ */
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

/* ===============================
   HOME ROUTE
================================ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "AI.html"));
});

/* ===============================
   STREAMING CHAT ROUTE
================================ */
app.post("/api/chat", async (req, res) => {
  try {
    const userPrompt = req.body.prompt;

    if (!userPrompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).send("Missing GEMINI_API_KEY.");
    }

    // Set streaming headers (important for Railway)
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `
You are a friendly, intelligent AI assistant.
Be slightly conversational (about 10% human).
Use emojis occasionally but not excessively.
Avoid sounding robotic.
Be clear and structured.

User message:
${userPrompt}
                  `
                }
              ]
            }
          ]
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API Error:", errorText);
      return res.status(500).send("Gemini API error.");
    }

    const reader = geminiResponse.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split by newline (SSE format)
      const lines = buffer.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // Gemini streaming sends: "data: {json}"
        if (line.startsWith("data:")) {
          line = line.replace("data:", "").trim();
        }

        if (line === "[DONE]") continue;

        try {
          const parsed = JSON.parse(line);

          const textChunk =
            parsed.candidates?.[0]?.content?.parts?.[0]?.text;

          if (textChunk) {
            res.write(textChunk);
          }
        } catch (err) {
          // Ignore partial/incomplete JSON chunks
        }
      }

      // Keep last incomplete chunk in buffer
      buffer = lines[lines.length - 1];
    }

    res.end();

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).send("Something went wrong.");
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
