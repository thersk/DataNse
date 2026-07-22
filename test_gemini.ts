import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function run() {
  const dateStr = "16-Jan-2025";
  console.log(`Querying Gemini with Search Grounding for date: ${dateStr}...`);
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Search for National Stock Exchange of India (NSE) F&O Participant wise Open Interest data for ${dateStr}.
Find the exact numbers in the F&O - Participant wise Open Interest CSV (fao_participant_oi_${dateStr.replace(/-/g, '')}.csv or similar).
Return the data in a clean structured JSON format. It must have the columns:
Participant, Future Index Long, Future Index Short, Future Stock Long, Future Stock Short, Option Index Call Long, Option Index Put Long, Option Index Call Short, Option Index Put Short, Option Stock Call Long, Option Stock Put Long, Option Stock Call Short, Option Stock Put Short.
The participants are: Client, DII, FII, Pro, TOTAL.
Double check the numbers from your search grounding sources to ensure they are the real exact actual numbers, not simulated or placeholder data.
Also, if ${dateStr} was a holiday or weekend, state that clearly and find the data for the trading day on or immediately before it.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    console.log("Response text:");
    console.log(response.text);
    
    console.log("\nGrounding Metadata Chunks:");
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      console.log(JSON.stringify(chunks, null, 2));
    }
  } catch (error) {
    console.error("Error in Gemini Call:", error);
  }
}

run();
