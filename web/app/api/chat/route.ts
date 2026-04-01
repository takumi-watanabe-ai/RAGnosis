import { sendChatMessage } from "@/lib/api";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await sendChatMessage(message);

    // Format response for assistant-ui
    const result = {
      role: "assistant",
      content: response.answer,
      sources: response.sources,
      metadata: response.metadata,
    };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
