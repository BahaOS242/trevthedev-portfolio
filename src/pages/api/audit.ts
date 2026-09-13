import type { APIRoute } from "astro";
import { items } from "@wix/data";
import { auth } from "@wix/essentials";
import {
	runGrowthAudit,
	formatFullReportText,
	AuditInputError,
	AuditFetchError,
} from "../../lib/audit-engine";

const COLLECTION_ID = "SiteAuditLeads";

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const badRequest = (message: string) => json(400, { error: message });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return badRequest("Content-Type must be application/json.");
	}

	let payload: { name?: unknown; email?: unknown; url?: unknown };
	try {
		payload = await request.json();
	} catch {
		return badRequest("Request body must be valid JSON.");
	}

	const name = typeof payload.name === "string" ? payload.name.trim() : "";
	const email = typeof payload.email === "string" ? payload.email.trim() : "";
	const rawUrl = typeof payload.url === "string" ? payload.url.trim() : "";

	if (!name) return badRequest("Please enter your name.");
	if (!EMAIL_RE.test(email)) return badRequest("Please enter a valid email address.");
	if (!rawUrl) return badRequest("Please enter a valid website URL.");

	const elevatedInsert = auth.elevate(items.insert);

	try {
		const result = await runGrowthAudit(rawUrl);

		try {
			await elevatedInsert(COLLECTION_ID, {
				_id: crypto.randomUUID(),
				name,
				email,
				websiteUrl: result.url,
				score: result.score,
				summary: formatFullReportText(result),
			});
		} catch (err) {
			console.error("Lead insert failed:", err);
		}

		return json(200, result);
	} catch (error) {
		if (error instanceof AuditInputError) {
			return badRequest(error.message);
		}

		console.error("Audit fetch failed:", error);

		try {
			await elevatedInsert(COLLECTION_ID, {
				_id: crypto.randomUUID(),
				name,
				email,
				websiteUrl: rawUrl,
				score: 0,
				summary: `Could not reach site: ${
					error instanceof AuditFetchError ? error.message : "unknown error"
				}`,
			});
		} catch (err) {
			console.error("Lead insert failed:", err);
		}

		return json(502, {
			error: "We couldn't reach that site. Double-check the URL and try again.",
		});
	}
};
