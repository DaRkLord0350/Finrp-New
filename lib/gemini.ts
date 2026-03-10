import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export function getGeminiModel() {
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

export async function generateBusinessInsight(
  prompt: string,
  context: string
): Promise<string> {
  const model = getGeminiModel();

  const systemPrompt = `You are FinRP's AI Business Advisor, an expert financial consultant and business strategist.
You have access to the following business data and context:

${context}

You help SME business owners:
- Analyze financial performance and trends
- Identify revenue opportunities and risks  
- Provide actionable business recommendations
- Explain compliance requirements
- Forecast and plan for growth

Be concise, data-driven, and actionable. Format responses in clear markdown.`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: `User question: ${prompt}` },
  ]);

  return result.response.text();
}
