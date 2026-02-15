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
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "AI.html"));
});

app.post("/api/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const response = await fetch(
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
                  text: `You are a friendly AI assistant.
Be slightly conversational and you may use emojis.

User message:
${prompt}`
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return res.status(500).send("Gemini API error");
    }

    // Tell browser we are streaming
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        let line = lines[i].trim();

        if (!line) continue;

        if (line.startsWith("data:")) {
          line = line.replace("data:", "").trim();
        }

        if (line === "[DONE]") continue;

        try {
          const parsed = JSON.parse(line);

          const text =
            parsed.candidates?.[0]?.content?.parts?.[0]?.text ||
            parsed.candidates?.[0]?.delta?.parts?.[0]?.text ||
            "";

          if (text) {
            res.write(text);
          }

        } catch {
          // ignore partial JSON
        }
      }

      buffer = lines[lines.length - 1];
    }

    res.end();

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).send("Server crashed");
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
