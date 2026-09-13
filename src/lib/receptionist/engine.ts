import {
	CLINIC_NAME,
	CLINIC_HOURS_TEXT,
	CLINIC_ADDRESS,
	EMERGENCY_POLICY,
	INSURANCE_INFO,
	NEW_PATIENT_INFO,
	PAYMENT_INFO,
	SERVICES,
	bookableServices,
	findServiceByText,
} from "./knowledge";
import {
	detectIntent,
	extractDate,
	extractName,
	extractNameFallback,
	extractPhone,
	extractPhoneFallback,
	extractTime,
} from "./nlu";
import type { BookingSlot, ChatMessage, FlowType, PendingRequest, SimulatedAction } from "./types";

/**
 * Stateless dialogue manager: the "AI Agent" stage of
 * WhatsApp -> Webhook/API -> AI Agent -> Business Knowledge -> Business
 * Actions -> CRM/Booking/Notifications. Nothing here is persisted between
 * requests — every turn is recomputed from the full message transcript the
 * client sends back, the same way a real chat-completion API is stateless
 * between calls.
 *
 * "Business Actions" in this demo never touch a real system — they return
 * a SimulatedAction that the UI renders as a clearly-labeled demo card.
 * Swapping in real booking/CRM/calendar calls later means replacing only
 * the functions in this file that build a SimulatedAction, not the intent
 * detection or slot-filling logic above them.
 */

const FLOW_SLOTS: Record<FlowType, BookingSlot[]> = {
	booking: ["service", "date", "time", "name", "phone"],
	reschedule: ["date", "time", "name", "phone"],
	cancel: ["name", "phone"],
};

const GREETING_QUICK_REPLIES = [
	"Book an appointment",
	"Ask about services",
	"What are your hours?",
	"I have a dental emergency",
];

function now(): string {
	return new Date().toISOString();
}

function makeMessage(
	text: string,
	extra: Partial<Omit<ChatMessage, "id" | "role" | "text" | "timestamp">> = {},
): ChatMessage {
	return {
		id: crypto.randomUUID(),
		role: "assistant",
		text,
		timestamp: now(),
		...extra,
	};
}

export function greetingTurn(): ChatMessage[] {
	return [
		makeMessage(
			`Hi! 👋 Thanks for contacting ${CLINIC_NAME}. I'm the virtual receptionist. How can I help you today?`,
			{ quickReplies: GREETING_QUICK_REPLIES },
		),
	];
}

interface Draft {
	service?: string;
	date?: string;
	time?: string;
	name?: string;
	phone?: string;
}

function slotFilled(draft: Draft, slot: BookingSlot): boolean {
	return Boolean(draft[slot]);
}

function missingSlots(flow: FlowType, draft: Draft): BookingSlot[] {
	return FLOW_SLOTS[flow].filter((slot) => !slotFilled(draft, slot));
}

/** Runs every extractor over one message and merges any hits into draft. */
function extractInto(draft: Draft, text: string, pendingSlot?: BookingSlot): void {
	const service = findServiceByText(text);
	if (service) draft.service = service.name;

	const date = extractDate(text);
	if (date) draft.date = date;

	const time = extractTime(text);
	if (time) draft.time = time;

	const phone = extractPhone(text);
	if (phone) draft.phone = phone;

	const name = extractName(text);
	if (name) draft.name = name;

	// Targeted fallbacks only apply when the previous question specifically
	// asked for that exact slot — otherwise a stray short message could be
	// misread as someone's name or phone number.
	if (pendingSlot === "name" && !draft.name) {
		const fallbackName = extractNameFallback(text);
		if (fallbackName) draft.name = fallbackName;
	}
	if (pendingSlot === "phone" && !draft.phone) {
		const fallbackPhone = extractPhoneFallback(text);
		if (fallbackPhone) draft.phone = fallbackPhone;
	}
}

function askForNextSlot(flow: FlowType, draft: Draft): ChatMessage {
	const missing = missingSlots(flow, draft);
	const next = missing[0];
	const pending: PendingRequest = { flow, slot: next };

	// These combined questions only apply when it's actually that pair's
	// turn — i.e. next is the first slot of the pair — so booking still
	// asks for the service before jumping to date/time.
	if (next === "date" && missing.includes("time")) {
		const lead = flow === "reschedule" ? "what new day and time" : "what day and time";
		return makeMessage(`Great — ${lead} works best for you?`, { pending });
	}

	if (next === "name" && missing.includes("phone")) {
		const reason = flow === "cancel" ? "so I can flag the right appointment" : "so the team can follow up";
		return makeMessage(`Could I get your name and phone number, ${reason}?`, { pending });
	}

	switch (next) {
		case "service":
			return makeMessage(
				"Sure! Which service are you looking to book — cleaning, whitening, an exam, a filling, or a crown?",
				{ pending, quickReplies: bookableServices().map((s) => s.name) },
			);
		case "date":
			return makeMessage("What day works best for you?", { pending });
		case "time":
			return makeMessage("And what time were you thinking?", { pending });
		case "name":
			return makeMessage("Could I get your name?", { pending });
		case "phone":
			return makeMessage("And the best phone number to reach you?", { pending });
	}
}

function completeFlow(flow: FlowType, draft: Draft): ChatMessage {
	if (flow === "booking") {
		const action: SimulatedAction = {
			type: "booking_captured",
			label: "Appointment request captured (demo)",
			details: {
				service: draft.service ?? "",
				date: draft.date ?? "",
				time: draft.time ?? "",
				name: draft.name ?? "",
				phone: draft.phone ?? "",
			},
		};
		return makeMessage(
			`Perfect — I've captured your request for a ${draft.service} on ${draft.date} at ${draft.time}. A member of the clinic team would confirm the appointment.`,
			{ action },
		);
	}

	if (flow === "reschedule") {
		const action: SimulatedAction = {
			type: "reschedule_captured",
			label: "Reschedule request captured (demo)",
			details: {
				newDate: draft.date ?? "",
				newTime: draft.time ?? "",
				name: draft.name ?? "",
				phone: draft.phone ?? "",
			},
		};
		return makeMessage(
			`Got it — I've noted your request to move your appointment to ${draft.date} at ${draft.time}. Someone from the team will confirm the change with you.`,
			{ action },
		);
	}

	const action: SimulatedAction = {
		type: "cancellation_captured",
		label: "Cancellation request captured (demo)",
		details: { name: draft.name ?? "", phone: draft.phone ?? "" },
	};
	return makeMessage(
		`Understood — I've flagged ${draft.name}'s appointment for cancellation. The clinic team will confirm it's been cancelled on their end.`,
		{ action },
	);
}

function escalationMessages(prefix?: string): ChatMessage[] {
	const body =
		"I'd be happy to have someone from the clinic team help with that. I've noted your request and a team member can follow up with you.";
	const action: SimulatedAction = {
		type: "escalation_created",
		label: "Escalated to clinic team (demo)",
	};
	// Sent as two short messages rather than one long paragraph — closer to
	// how a real receptionist would actually text this.
	return prefix ? [makeMessage(prefix), makeMessage(body, { action })] : [makeMessage(body, { action })];
}

function faqAnswer(intent: ReturnType<typeof detectIntent>, text: string): ChatMessage {
	const mentionedService = findServiceByText(text);

	if (mentionedService) {
		const bookPrompt = mentionedService.bookable
			? " Would you like me to tell you more, or help you schedule an appointment?"
			: " Would you like me to flag this for the team to call you back?";
		return makeMessage(
			`Yes! ${mentionedService.name} — ${mentionedService.description} Pricing is ${mentionedService.priceLabel}, and it takes about ${mentionedService.durationMinutes} minutes.${bookPrompt}`,
		);
	}

	switch (intent) {
		case "faq_hours":
			return makeMessage(CLINIC_HOURS_TEXT);
		case "faq_location":
			return makeMessage(`We're located at ${CLINIC_ADDRESS}.`);
		case "faq_services": {
			const list = SERVICES.map((s) => s.name).join(", ");
			return makeMessage(
				`We offer ${list}. Want details on any of these, or should I help you book one?`,
			);
		}
		case "faq_pricing": {
			const priced = SERVICES.map((s) => `${s.name.toLowerCase()} (${s.priceLabel})`).join(", ");
			return makeMessage(`Pricing depends on the service: ${priced}. Want details on a specific one?`);
		}
		case "faq_insurance":
			return makeMessage(INSURANCE_INFO);
		case "faq_new_patient":
			return makeMessage(NEW_PATIENT_INFO);
		case "faq_payment":
			return makeMessage(PAYMENT_INFO);
		default:
			return makeMessage(
				"I'm not totally sure I caught that — I can help with clinic info, booking, rescheduling, or cancellations. What would you like to do?",
				{ wasFallback: true },
			);
	}
}

function trailingFallbackStreak(history: ChatMessage[]): number {
	let streak = 0;
	for (let i = history.length - 1; i >= 0; i--) {
		const message = history[i];
		if (message.role !== "assistant") continue;
		if (!message.wasFallback) break;
		streak++;
	}
	return streak;
}

function findPending(history: ChatMessage[]): PendingRequest | undefined {
	for (let i = history.length - 1; i >= 0; i--) {
		const message = history[i];
		if (message.role === "assistant") return message.pending;
	}
	return undefined;
}

/** What slot (if any) was actually pending immediately before history[index]
 * was sent — used to replay each customer message with the fallback-slot
 * hint that applied *at that time*, not just the current one. */
function pendingBefore(history: ChatMessage[], index: number): PendingRequest | undefined {
	const prev = history[index - 1];
	return prev && prev.role === "assistant" ? prev.pending : undefined;
}

/** True once an assistant message anywhere in history already recorded a
 * lead_captured action — lead capture should only ever fire once. */
function leadAlreadyCaptured(history: ChatMessage[]): boolean {
	return history.some((m) => m.action?.type === "lead_captured");
}

function buildLeadAction(draft: Draft): SimulatedAction | undefined {
	// Called only while a booking/reschedule flow is active, so a name is
	// enough to qualify — the active flow itself is the appointment intent.
	if (!draft.name) return undefined;

	return {
		type: "lead_captured",
		label: "Lead captured (demo)",
		details: {
			name: draft.name,
			...(draft.phone ? { phone: draft.phone } : {}),
			...(draft.service ? { serviceInterest: draft.service } : {}),
		},
	};
}

export function nextTurn(history: ChatMessage[]): ChatMessage[] {
	const last = history[history.length - 1];
	if (!last || last.role !== "customer") {
		// Defensive: the API only ever calls this with a customer message on
		// top, but fall back to a fresh greeting rather than throwing.
		return greetingTurn();
	}

	const text = last.text;
	const intent = detectIntent(text);
	const pending = findPending(history);

	// Hard overrides: these interrupt any in-progress flow.
	if (intent === "faq_emergency") {
		return escalationMessages(EMERGENCY_POLICY);
	}
	if (intent === "escalate") {
		return escalationMessages();
	}

	// Determine whether we're starting a new flow, continuing one, or in
	// plain FAQ/smalltalk territory.
	let flow: FlowType | undefined;
	let flowStartIndex = history.length - 1;

	if (intent === "book") {
		flow = "booking";
	} else if (intent === "reschedule" || intent === "cancel") {
		flow = intent;
	} else if (pending) {
		flow = pending.flow;
		// Walk back to where this flow actually began so date/time slots
		// aren't accidentally reused from an earlier, unrelated flow.
		for (let i = history.length - 2; i >= 0; i--) {
			const m = history[i];
			if (m.role === "assistant" && !m.pending) break;
			flowStartIndex = i;
		}
	}

	if (flow) {
		const draft: Draft = {};
		// Name, phone, and service are reusable context for the whole
		// conversation — mentioning "teeth whitening" earlier and then
		// saying "I'd like to book that" should still carry the service
		// through, the same way an in-progress name/phone would. Each
		// customer message is replayed with whatever slot was actually
		// pending right before it was sent (not just the current one) —
		// otherwise a name accepted via fallback on an earlier turn would
		// silently vanish once the draft gets recomputed on a later turn.
		for (let i = 0; i < history.length; i++) {
			const message = history[i];
			if (message.role === "customer") {
				extractInto(draft, message.text, pendingBefore(history, i)?.slot);
			}
		}
		// Date/time (and any restated service/name/phone) belong to the
		// current flow attempt only, so an earlier unrelated flow's date
		// can't leak into a new one — later values here win.
		for (let i = flowStartIndex; i < history.length; i++) {
			const message = history[i];
			if (message.role !== "customer") continue;
			extractInto(draft, message.text, pendingBefore(history, i)?.slot);
		}

		const stillMissing = missingSlots(flow, draft);
		const reply = stillMissing.length > 0 ? askForNextSlot(flow, draft) : completeFlow(flow, draft);

		// Cancelling isn't a new-business signal, so only booking/reschedule
		// flows can qualify someone as a lead.
		const canCaptureLead = flow !== "cancel" && !leadAlreadyCaptured(history);
		const leadAction = canCaptureLead ? buildLeadAction(draft) : undefined;
		if (leadAction && !reply.action) {
			reply.action = leadAction;
		}

		return [reply];
	}

	if (intent === "greeting") {
		return [makeMessage("Hi again! How can I help?", { quickReplies: GREETING_QUICK_REPLIES })];
	}
	if (intent === "thanks") {
		return [makeMessage("You're welcome! Anything else I can help with?")];
	}

	const reply = faqAnswer(intent, text);

	if (reply.wasFallback && trailingFallbackStreak(history) >= 1) {
		// Two low-confidence replies in a row: stop guessing and escalate.
		return escalationMessages("I want to make sure you get a straight answer.");
	}

	return [reply];
}
