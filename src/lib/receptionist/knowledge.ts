import type { ServiceId } from "./types";

/**
 * Demo business knowledge for the WhatsApp AI Receptionist portfolio demo.
 * BrightSmile Dental is a fictional clinic — every fact here is
 * illustrative, not a real business's information.
 */

export const CLINIC_NAME = "BrightSmile Dental";

export const CLINIC_HOURS: { days: string; hours: string }[] = [
	{ days: "Monday – Friday", hours: "8:00 AM – 5:00 PM" },
	{ days: "Saturday", hours: "9:00 AM – 1:00 PM" },
	{ days: "Sunday", hours: "Closed" },
];

export const CLINIC_HOURS_TEXT =
	"We're open Monday to Friday, 8:00 AM to 5:00 PM, and Saturday 9:00 AM to 1:00 PM. Closed Sundays.";

export const CLINIC_ADDRESS = "482 Bay Street, Nassau, The Bahamas";

export interface ServiceInfo {
	id: ServiceId;
	name: string;
	description: string;
	priceLabel: string;
	durationMinutes: number;
	aliases: string[];
	bookable: boolean;
}

export const SERVICES: ServiceInfo[] = [
	{
		id: "cleaning",
		name: "Dental Cleaning",
		description: "A routine cleaning and polish to keep your teeth and gums healthy.",
		priceLabel: "$95",
		durationMinutes: 45,
		aliases: ["cleaning", "clean", "polish", "hygiene"],
		bookable: true,
	},
	{
		id: "whitening",
		name: "Teeth Whitening",
		description: "Professional in-office whitening for a noticeably brighter smile.",
		priceLabel: "$250",
		durationMinutes: 60,
		aliases: ["whitening", "whiten", "bleaching", "white teeth", "brighten"],
		bookable: true,
	},
	{
		id: "exam",
		name: "Dental Exam & X-Rays",
		description:
			"A full check-up with digital X-rays — the standard first visit for new patients.",
		priceLabel: "$85",
		durationMinutes: 30,
		aliases: ["exam", "checkup", "check-up", "x-ray", "xray", "consultation"],
		bookable: true,
	},
	{
		id: "filling",
		name: "Filling",
		description: "Treating a cavity with a tooth-colored composite filling.",
		priceLabel: "From $150",
		durationMinutes: 45,
		aliases: ["filling", "fillings", "cavity"],
		bookable: true,
	},
	{
		id: "crown",
		name: "Crown",
		description: "A custom crown to restore a damaged or heavily worn tooth.",
		priceLabel: "From $850",
		durationMinutes: 60,
		aliases: ["crown", "crowns", "cap"],
		bookable: true,
	},
	{
		id: "emergency",
		name: "Emergency Dental Visit",
		description:
			"Priority same-day care for urgent issues like severe pain, swelling, or a broken tooth.",
		priceLabel: "Varies by treatment",
		durationMinutes: 30,
		aliases: [
			"emergency",
			"urgent",
			"broken tooth",
			"severe pain",
			"swelling",
			"swollen",
			"knocked out",
		],
		bookable: false,
	},
];

export const INSURANCE_INFO =
	"We accept most major dental insurance plans. Coverage varies by plan, so our front desk team will verify your specific benefits before your visit.";

export const PAYMENT_INFO =
	"We accept cash, debit, and all major credit cards. Payment plans are also available for larger treatments like crowns.";

export const NEW_PATIENT_INFO =
	"New patients are always welcome! Your first visit usually includes an exam and X-rays. You can fill out new patient forms in advance or in office — just plan to arrive about 15 minutes early.";

export const EMERGENCY_POLICY =
	"That sounds like it needs prompt attention. I can't book emergency visits directly here, but I've flagged this for the clinic team to call you back right away. If this is a medical emergency, please call 911 or go to your nearest emergency room.";

export function findServiceByText(text: string): ServiceInfo | undefined {
	const lower = text.toLowerCase();
	return SERVICES.find((service) => service.aliases.some((alias) => lower.includes(alias)));
}

export function findServiceById(id: ServiceId): ServiceInfo | undefined {
	return SERVICES.find((service) => service.id === id);
}

export function bookableServices(): ServiceInfo[] {
	return SERVICES.filter((service) => service.bookable);
}
