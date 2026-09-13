import type { APIRoute } from "astro";
import { greetingTurn, nextTurn } from "../../lib/receptionist/engine";
import type { ChatMessage } from "../../lib/receptionist/types";

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const badRequest = (message: string) => json(400, { error: message });

const MAX_MESSAGES = 60;
const MAX_TEXT_LENGTH = 500;

function isChatMessage(value: unknown): value is ChatMessage {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.id === "string" &&
		(v.role === "customer" || v.role === "assistant" || v.role === "system") &&
		typeof v.text === "string" &&
		typeof v.timestamp === "string"
	);
}

export const POST: APIRoute = async ({ request }) => {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return badRequest("Content-Type must be application/json.");
	}

	let payload: { messages?: unknown };
	try {
		payload = await request.json();
	} catch {
		return badRequest("Request body must be valid JSON.");
	}

	const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];

	if (rawMessages.length > MAX_MESSAGES) {
		return badRequest("This demo conversation has reached its length limit.");
	}
	if (!rawMessages.every(isChatMessage)) {
		return badRequest("Malformed message history.");
	}

	const messages = rawMessages as ChatMessage[];
	if (messages.some((m) => m.text.length > MAX_TEXT_LENGTH)) {
		return badRequest("Message is too long.");
	}
	if (messages.length > 0 && messages[messages.length - 1].role !== "customer") {
		return badRequest("The last message must be from the customer.");
	}

	try {
		const reply = messages.length === 0 ? greetingTurn() : nextTurn(messages);
		return json(200, { messages: reply });
	} catch (error) {
		console.error("Receptionist engine error:", error);
		return json(500, {
			error: "Something went wrong generating a response. Please try again.",
		});
	}
};
