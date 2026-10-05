/**
 * One illustrative day of inbound WhatsApp traffic for a fictional
 * three-chair clinic, used by the "night shift" model on the receptionist
 * page. Times are 24h decimal hours. Sample data — not real customers.
 */

export type NightOutcome = "booked" | "answered" | "moved" | "escalated";

export interface NightMessage {
	t: number;
	name: string;
	msg: string;
	out: NightOutcome;
	what: string;
	value: number;
}

export const NIGHT_FEED: NightMessage[] = [
	{ t: 0.4, name: "Shantell R.", msg: "Do y'all do whitening before a wedding? It's in 3 weeks", out: "booked", what: "Whitening, Thu 10am", value: 350 },
	{ t: 1.8, name: "Marco K.", msg: "my back tooth is killing me can't sleep", out: "booked", what: "Emergency, 8am today", value: 95 },
	{ t: 6.6, name: "Deja M.", msg: "Morning! what time y'all open?", out: "answered", what: "Hours sent", value: 0 },
	{ t: 7.3, name: "Patrice B.", msg: "Need to move my 2pm cleaning to Saturday", out: "moved", what: "Moved to Sat 10:30am", value: 0 },
	{ t: 9.2, name: "Keno W.", msg: "how much is a filling", out: "booked", what: "Filling, Mon 3pm", value: 180 },
	{ t: 11.5, name: "Alicia F.", msg: "Do you take NIB?", out: "answered", what: "Insurance info sent", value: 0 },
	{ t: 12.4, name: "Tremaine S.", msg: "can I bring my 2 kids for checkups same day", out: "booked", what: "2 × Check-up, Sat 9am", value: 240 },
	{ t: 13.1, name: "Gina L.", msg: "I want to speak to Dr. Rolle about my bill", out: "escalated", what: "Handed to front desk", value: 0 },
	{ t: 15.7, name: "Omar P.", msg: "Cleaning next week? any day after 4", out: "booked", what: "Cleaning, Wed 4:30pm", value: 120 },
	{ t: 17.6, name: "Renee T.", msg: "Hi are you still open?", out: "booked", what: "Cleaning, Tomorrow 9am", value: 120 },
	{ t: 18.9, name: "Javon C.", msg: "where are y'all located", out: "answered", what: "Directions sent", value: 0 },
	{ t: 19.8, name: "Kayla N.", msg: "Haven't been in 2 yrs 😬 can I still come?", out: "booked", what: "New-patient exam, Fri 11am", value: 120 },
	{ t: 20.9, name: "Andre G.", msg: "chipped my front tooth at Junkanoo practice", out: "booked", what: "Emergency, 8am tomorrow", value: 95 },
	{ t: 21.6, name: "Simone H.", msg: "Do you do Invisalign consults?", out: "booked", what: "Consult, Tue 2pm", value: 150 },
	{ t: 22.4, name: "Brent A.", msg: "cancel my thursday please", out: "moved", what: "Cancelled, slot reopened", value: 0 },
	{ t: 23.3, name: "Nia O.", msg: "how much for a cleaning without insurance", out: "booked", what: "Cleaning, Mon 8am", value: 120 },
];

export const fmtHour = (h: number) => {
	const hh = Math.floor(h) % 24;
	const mm = Math.round((h - Math.floor(h)) * 60);
	const ap = hh < 12 ? "am" : "pm";
	const h12 = hh % 12 === 0 ? 12 : hh % 12;
	return `${h12}:${String(mm).padStart(2, "0")}${ap}`;
};
