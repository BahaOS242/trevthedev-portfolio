export type ChatRole = "customer" | "assistant" | "system";

export type BookingSlot = "service" | "date" | "time" | "name" | "phone";

export type FlowType = "booking" | "reschedule" | "cancel";

export type ServiceId = "cleaning" | "whitening" | "exam" | "filling" | "crown" | "emergency";

export type SimulatedActionType =
	| "booking_captured"
	| "reschedule_captured"
	| "cancellation_captured"
	| "escalation_created"
	| "lead_captured";

export interface SimulatedAction {
	type: SimulatedActionType;
	label: string;
	details?: Record<string, string>;
}

export interface PendingRequest {
	flow: FlowType;
	slot: BookingSlot;
}

export interface ChatMessage {
	id: string;
	role: ChatRole;
	text: string;
	timestamp: string;
	/** Present on an assistant message that is waiting on specific booking
	 * info. Used as a hint for interpreting the next free-text customer
	 * reply — see src/lib/receptionist/engine.ts. */
	pending?: PendingRequest;
	/** Present on a low-confidence assistant fallback, so the engine can
	 * notice repeated confusion and escalate instead of looping forever. */
	wasFallback?: boolean;
	/** A simulated business action taken alongside this message. Never a
	 * real side effect — nothing is booked, cancelled, or persisted. */
	action?: SimulatedAction;
	quickReplies?: string[];
}

export interface ReceptionistTurnRequest {
	messages: ChatMessage[];
}

export interface ReceptionistTurnResponse {
	messages: ChatMessage[];
}
