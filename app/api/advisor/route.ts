import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { orgId } = await auth();
    if (!orgId) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const { message } = body;

    if (!message) return new Response("Message required", { status: 400 });

    const businessContext = `
You are an AI Business Advisor for FinRP, an AI-powered business operating system.
Organization ID: ${orgId}

Current business snapshot (March 2025):
- Total Revenue MTD: $51,200 (up 13.2% from last month)
- Total Customers: 124 (8.1% growth)
- Invoices Sent: 39 this month
- Overdue Invoices: 5 (total $18,400 outstanding)
- Top Customer: NovaBuild Co at $67,400 YTD
- Upcoming: Q1 GST Filing due March 31, Annual Tax Return due April 15

Recent Invoices:
- INV-00039: Acme Corp $8,400 - PAID
- INV-00038: TechFlow Ltd $3,200 - SENT
- INV-00037: BrightStar Inc $5,800 - OVERDUE (42 days)
- INV-00036: Quantum Media $1,900 - PAID
- INV-00035: NovaBuild Co $12,100 - SENT

Respond with clear, structured markdown. Use ## for sections, **bold** for emphasis, and bullet points. Be concise and actionable.

User question: ${message}`;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      // Graceful fallback when no API key configured
      const fallback = `## Business Advisor Response\n\nI'm ready to help with your business questions. To enable AI responses, please add your \`GEMINI_API_KEY\` to \`.env.local\`.\n\n**Based on your current data:**\n- Revenue is trending up 13.2% MoM ✅\n- 5 overdue invoices need follow-up ⚠️\n- Q1 GST Filing due March 31st – action required soon`;
      return new Response(JSON.stringify({ response: fallback }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Call Gemini with streaming
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: businessContext }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiRes.ok || !geminiRes.body) {
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    // Stream the response back
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json || json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                if (text) {
                  fullText += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: text })}\n\n`));
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
          // Send final complete message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, response: fullText })}\n\n`));
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[ADVISOR_STREAM]", error);
    return new Response(
      JSON.stringify({ response: "I'm unable to connect to the AI advisor right now. Please check your GEMINI_API_KEY in .env.local." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
