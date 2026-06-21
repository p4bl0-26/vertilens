import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const AI_TIMEOUT_MS = 6000;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({
        risk: "UNKNOWN",
        confidence: 0,
        reasons: ["No image provided"]
      });
    }

    if (!process.env.GEMINI_API_KEY) {
       return NextResponse.json({
        risk: "UNKNOWN",
        confidence: 0,
        reasons: ["AI analysis unavailable (Missing API key)"]
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");
    
    const prompt = `You are a digital media forensic analyst.

Analyze the uploaded image for indicators commonly associated with AI-generated or synthetic content.

Look only for:
* unnatural textures
* malformed hands or fingers
* inconsistent lighting
* impossible reflections
* distorted text
* repeated background patterns
* synthetic image artifacts
* unrealistic facial details

Do not claim certainty.
Do not state that the image is definitely AI generated.

Return only a likelihood assessment.
Return ONLY valid JSON:
{
"risk":"LOW|MEDIUM|HIGH",
"confidence":0,
"reasons":[
"reason 1",
"reason 2",
"reason 3"
]
}

Confidence must be 0-100.
No markdown.
No explanations.
No extra text.`;

    const fetchPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          }
        },
        prompt
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Analysis timeout")), AI_TIMEOUT_MS)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await Promise.race([fetchPromise, timeoutPromise]) as any;
    
    const text = response.text;
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      // Fallback manual cleanup in case the model outputs markdown anyway
      const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
      json = JSON.parse(cleanedText);
    }

    return NextResponse.json({
      risk: json.risk || "UNKNOWN",
      confidence: json.confidence || 0,
      reasons: json.reasons || []
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[api/ai-analysis] Error:", err.message);
    const message = err.message === "Analysis timeout" ? "Analysis timeout" : "AI analysis unavailable";
    return NextResponse.json({
      risk: "UNKNOWN",
      confidence: 0,
      reasons: [message]
    });
  }
}
