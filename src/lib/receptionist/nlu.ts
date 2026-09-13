import { findServiceByText } from "./knowledge";

/**
 * Deterministic, regex-based intent detection and slot extraction.
 *
 * This stands in for a real NLU/LLM call. It is intentionally isolated
 * from the dialogue manager (engine.ts) so a real provider (OpenAI,
 * Anthropic, etc.) could later replace just this module's exports without
 * touching the conversation/booking logic that depends on them.
 */

export type Intent =
	| "greeting"
	| "faq_hours"
	| "faq_location"
	| "faq_services"
	| "faq_pricing"
	| "faq_insurance"
	| "faq_emergency"
	| "faq_new_patient"
	| "faq_payment"
	| "book"
	| "reschedule"
	| "cancel"
	| "escalate"
	| "thanks"
	| "unknown";

interface IntentRule {
	intent: Intent;
	patterns: RegExp[];
}

// Order matters: earlier rules win when a message matches more than one
// (e.g. "I need to reschedule, this is an emergency" should escalate, not
// quietly start a reschedule flow).
const RULES: IntentRule[] = [
	{
		intent: "escalate",
		patterns: [/\btalk to (a |an )?(human|real person|someone|agent|manager)\b/i, /\bspeak (to|with) (a |an )?(person|human|someone|manager)\b/i],
	},
	{
		intent: "faq_emergency",
		patterns: [
			/\bemergency\b/i,
			/\b(a lot of|so much|severe|terrible) pain\b/i,
			/\bbroken tooth\b/i,
			/\bknocked out\b/i,
			/\bswoll(en|ing)\b/i,
			/\btooth (really |is )?hurts?\b/i,
		],
	},
	{
		intent: "cancel",
		patterns: [/\bcancel\b/i, /\bcan'?t make it\b/i, /\bwon'?t be able to (come|make it)\b/i],
	},
	{
		intent: "reschedule",
		patterns: [
			/\bresched/i,
			/\bmove my appointment\b/i,
			/\bchange (my|the) appointment\b/i,
			/\ba different (time|day|date)\b/i,
		],
	},
	{
		intent: "book",
		patterns: [
			/\bbook\b/i,
			/\bschedule\b/i,
			/\bappointment\b/i,
			/\bcome in\b/i,
			/\bset up (a|an)\b/i,
		],
	},
	{
		intent: "faq_hours",
		patterns: [/\bhours?\b/i, /\bopen\b/i, /\bclose[sd]?\b/i, /\bwhat time\b/i],
	},
	{
		intent: "faq_location",
		patterns: [/\bwhere\b/i, /\blocation\b/i, /\baddress\b/i, /\bdirections?\b/i],
	},
	{
		intent: "faq_pricing",
		patterns: [/\bprice[sd]?\b/i, /\bcost[s]?\b/i, /\bhow much\b/i, /\brate[s]?\b/i],
	},
	{
		intent: "faq_insurance",
		patterns: [/\binsurance\b/i, /\bcoverage\b/i, /\bcovered\b/i],
	},
	{
		intent: "faq_new_patient",
		patterns: [/\bnew patients?\b/i, /\bfirst (time|visit)\b/i, /\bnever been\b/i],
	},
	{
		intent: "faq_payment",
		patterns: [/\bpayment\b/i, /\bpay\b/i, /\bcards?\b/i, /\bfinanc/i],
	},
	{
		intent: "faq_services",
		patterns: [/\bservices?\b/i, /\bdo you (do|offer|have)\b/i, /\bwhat.*offer\b/i],
	},
	{
		intent: "thanks",
		patterns: [/\bthank(s| you)\b/i],
	},
	{
		// Anchored to the whole message: a plain "hi" is a greeting, but
		// "hi, do you do whitening?" should route to that actual question,
		// not get swallowed as smalltalk.
		intent: "greeting",
		patterns: [/^\s*(hi|hello|hey|good (morning|afternoon|evening))[!.,\s]*$/i],
	},
];

export function detectIntent(text: string): Intent {
	for (const rule of RULES) {
		if (rule.patterns.some((pattern) => pattern.test(text))) {
			return rule.intent;
		}
	}

	// A bare service mention with no other verb ("do you do whitening?")
	// reads as a services/pricing question.
	if (findServiceByText(text)) {
		return "faq_services";
	}

	return "unknown";
}

const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/;
const TIME_RE = /\b(\d{1,2})(:\d{2})?\s?(am|pm|AM|PM)\b|\b(morning|afternoon|evening)\b/;
const WEEKDAY_RE =
	/\b(mon(day)?|tue(s|sday)?|wed(nesday)?|thu(rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?|today|tomorrow)\b/i;
const DATE_NUMERIC_RE = /\b(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?\b/;
const MONTH_DAY_RE =
	/\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\.?\s+\d{1,2}(st|nd|rd|th)?\b/i;
const NAME_HINT_RE =
	/\b(my name is|i'?m|this is|it'?s)\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*)?)/i;
// Catches "book a cleaning for Sarah" — only matches a capitalized word
// right after "for", since real names are almost always capitalized while
// stray lowercase words ("for tuesday", "for a cleaning") aren't.
const FOR_NAME_HINT_RE = /\bfor\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)\b/;
const NON_NAME_WORDS = new Set([
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
	"today",
	"tomorrow",
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december",
	"me",
	"him",
	"her",
	"us",
	"them",
]);

export function extractPhone(text: string): string | undefined {
	const match = text.match(PHONE_RE);
	if (!match) return undefined;
	const digits = match[1].replace(/\D/g, "");
	return digits.length >= 7 ? match[1].trim() : undefined;
}

export function extractTime(text: string): string | undefined {
	const match = text.match(TIME_RE);
	return match ? match[0] : undefined;
}

export function extractDate(text: string): string | undefined {
	const weekday = text.match(WEEKDAY_RE);
	if (weekday) return titleCase(weekday[0]);
	const numeric = text.match(DATE_NUMERIC_RE);
	if (numeric) return numeric[0];
	const monthDay = text.match(MONTH_DAY_RE);
	if (monthDay) return titleCase(monthDay[0]);
	return undefined;
}

export function extractName(text: string): string | undefined {
	const hinted = text.match(NAME_HINT_RE);
	if (hinted) return titleCase(hinted[2].trim());

	const forHinted = text.match(FOR_NAME_HINT_RE);
	if (forHinted) {
		const candidate = forHinted[1].trim();
		if (!NON_NAME_WORDS.has(candidate.toLowerCase().split(/\s+/)[0])) {
			return titleCase(candidate);
		}
	}

	return undefined;
}

/**
 * Best-effort: treat the whole message as a name when it's short and
 * doesn't read as any other known intent. Only ever called when the
 * engine specifically just asked for a name — so a combined reply like
 * "John Miller, 242-555-0111" still yields a name even though the digits
 * are stripped out first (they belong to the phone slot, not this one).
 */
export function extractNameFallback(text: string): string | undefined {
	const withoutPhone = text.replace(PHONE_RE, " ").replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
	const trimmed = withoutPhone || text.trim();
	if (!trimmed || trimmed.length > 40) return undefined;
	if (/\d/.test(trimmed)) return undefined;
	if (detectIntent(trimmed) !== "unknown") return undefined;
	return titleCase(trimmed);
}

/**
 * Best-effort: treat a short digit-heavy message as a phone number when
 * the stricter extractPhone regex didn't match. Only ever called when the
 * engine specifically just asked for a phone number.
 */
export function extractPhoneFallback(text: string): string | undefined {
	const digits = text.replace(/\D/g, "");
	return digits.length >= 7 && digits.length <= 15 ? text.trim() : undefined;
}

function titleCase(value: string): string {
	return value
		.split(/\s+/)
		.map((word) => (word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
		.join(" ");
}
