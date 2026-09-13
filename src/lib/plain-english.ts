/**
 * Plain-English sales copy for the BahaOS Growth Audit results dashboard.
 *
 * The audit engine (audit-engine.ts) produces accurate, technically-grounded
 * `Check` objects. This file is a separate presentation layer that translates
 * each check into non-technical language for a business-owner audience, plus
 * a suggested price for Trevor to fix it individually.
 *
 * Keyed by `Check.id` from audit-engine.ts. If a check ever exists without an
 * entry here (e.g. a new check gets added to the engine and this file isn't
 * updated yet), `getPlainEnglish()` falls back to the check's own existing
 * description/whyItMatters/recommendation fields rather than inventing copy.
 */

import type { Check } from "./audit-engine";

export interface PlainEnglishCopy {
	title: string;
	whatsHappening: string;
	whyItHurts: string;
	howTrevFixes: string;
	price: number | null;
}

const COPY: Record<string, PlainEnglishCopy> = {
	// --- Visibility ---
	"title-tag": {
		title: "Your Google search headline isn't set up well",
		whatsHappening:
			"The headline that shows up for your business in Google search results is missing, too short, or too long.",
		whyItHurts:
			"That headline is often the very first thing a potential customer sees about you — before they even click. A weak one makes people scroll past you for a competitor.",
		howTrevFixes:
			"I'll write a clear, specific headline that tells searchers exactly what you do and where — so they click you instead of the next listing.",
		price: 50,
	},
	"meta-description": {
		title: "Your Google search preview text is missing",
		whatsHappening:
			"The short description that shows under your listing in Google search results isn't set.",
		whyItHurts:
			"Google fills in its own generic text instead — which is often awkward and does nothing to convince someone to click through to your site.",
		howTrevFixes: "I'll write a compelling one-line pitch that makes people want to click your listing.",
		price: 50,
	},
	canonical: {
		title: "Search engines may be confused about your real page",
		whatsHappening: "Your site isn't clearly telling search engines which version of a page is the official one.",
		whyItHurts:
			"This can quietly split your search ranking across duplicate versions of the same page, so neither one ranks as well as it could.",
		howTrevFixes: "I'll set the correct technical signal so search engines rank one strong version of each page.",
		price: 40,
	},
	"structured-data": {
		title: "Search engines can't fully understand your business details",
		whatsHappening:
			"Your website isn't giving search engines a clear, structured summary of what your business does.",
		whyItHurts:
			"Without it, search engines have to guess at your business details from scattered text — which can mean your listing shows up incomplete or less relevant than a competitor's.",
		howTrevFixes: "I'll add the structured business information search engines look for, cleanly and correctly.",
		price: 75,
	},
	"open-graph": {
		title: "Your links look broken when shared",
		whatsHappening:
			"When someone shares your website link on WhatsApp, Facebook, or Instagram, it shows up blank or ugly instead of a proper preview.",
		whyItHurts:
			"A broken link preview makes your business look unprofessional right at the moment someone was about to check you out — costing you shares and word-of-mouth referrals.",
		howTrevFixes: "I'll set up a proper preview image and text so your links look sharp everywhere they're shared.",
		price: 40,
	},
	"h1-present": {
		title: "Your page has no clear main headline",
		whatsHappening: "Your page doesn't have one clear, main headline telling visitors what it's about.",
		whyItHurts:
			"Visitors land on the page and aren't instantly sure they're in the right place — and search engines struggle to know what to rank you for.",
		howTrevFixes: "I'll add one clear, strong headline that tells visitors and Google exactly what you offer.",
		price: 40,
	},
	"h1-uniqueness": {
		title: "Your page has too many 'main' headlines",
		whatsHappening: "Your page has more than one heading trying to act as the main headline.",
		whyItHurts: "It waters down your page's main message for both visitors and search engines.",
		howTrevFixes: "I'll clean this up to one clear headline with proper supporting sections underneath.",
		price: 30,
	},
	"heading-structure": {
		title: "Your content isn't broken into scannable sections",
		whatsHappening: "Your page content doesn't have subheadings breaking it into sections.",
		whyItHurts:
			"People skim before they read. Without subheadings, visitors can't quickly find what they came for — so they leave.",
		howTrevFixes: "I'll organize your content into clear, scannable sections.",
		price: 30,
	},
	"content-depth": {
		title: "There isn't much for visitors (or Google) to read",
		whatsHappening: "There isn't much actual written content on this page.",
		whyItHurts:
			"Thin pages give search engines very little to work with, and visitors very little reason to trust or stay.",
		howTrevFixes: "I'll help build out real, useful content about your services so people and search engines take you seriously.",
		price: 60,
	},
	"image-alt-text": {
		title: "Your images are invisible to Google and screen readers",
		whatsHappening: "Most of the images on your site have no description behind them.",
		whyItHurts:
			"Search engines can't 'see' images, so they skip them when deciding what your page is about — and visitors using screen readers can't understand your site either.",
		howTrevFixes: "I'll add proper descriptions to your images so they actually work for you instead of sitting dead weight.",
		price: 40,
	},
	"internal-links": {
		title: "Visitors have no path to the rest of your site",
		whatsHappening: "Your pages barely link to each other.",
		whyItHurts:
			"Visitors land on one page with no obvious way to see everything else you offer — so they leave instead of exploring.",
		howTrevFixes: "I'll connect your pages together so visitors (and search engines) can find everything you offer.",
		price: 35,
	},

	// --- Experience ---
	viewport: {
		title: "Your site doesn't work properly on phones",
		whatsHappening: "Your website isn't properly set up for phone screens.",
		whyItHurts:
			"Most of your customers are browsing on their phone. If your site looks broken or tiny on mobile, they leave in seconds — straight to a competitor whose site works.",
		howTrevFixes: "I'll fix your site so it looks and works properly on every phone size.",
		price: 60,
	},
	"response-time": {
		title: "Your website loads too slowly",
		whatsHappening: "Your website takes longer than it should to load.",
		whyItHurts: "Every extra second of load time loses you visitors — most people give up before a slow page even finishes loading.",
		howTrevFixes: "I'll speed up your site so visitors see it instantly instead of bouncing.",
		price: 75,
	},
	"image-sizing": {
		title: "Your page visibly jumps around while loading",
		whatsHappening: "Your images aren't set up properly, so the page shifts around as it loads.",
		whyItHurts: "It feels janky and unfinished — small technical details like this quietly make visitors trust your business less.",
		howTrevFixes: "I'll fix your images so the page loads smoothly without any visual jumping.",
		price: 30,
	},
	favicon: {
		title: "Your site is missing its browser tab icon",
		whatsHappening: "Your website doesn't have a small logo icon in the browser tab.",
		whyItHurts: "It's a small thing, but it makes your site feel unfinished, and your brand doesn't stick when visitors have multiple tabs open.",
		howTrevFixes: "I'll add a proper branded icon so your site looks complete and professional.",
		price: 25,
	},

	// --- Trust ---
	"contact-info-visible": {
		title: "Visitors can't easily find how to contact you",
		whatsHappening: "There's no phone number or email clearly visible on your website.",
		whyItHurts:
			"This is one of the fastest ways people judge whether a business is real. Without visible contact info, many visitors won't trust you enough to reach out.",
		howTrevFixes: "I'll make sure your phone number and email are clearly visible and clickable everywhere they matter.",
		price: 40,
	},
	"privacy-terms-link": {
		title: "Your site is missing a privacy policy",
		whatsHappening: "Your website doesn't have a privacy policy or terms link.",
		whyItHurts: "It's a small detail, but its absence can make your business look less established to cautious customers.",
		howTrevFixes: "I'll add a proper privacy policy and terms page so your site looks fully legitimate.",
		price: 45,
	},
	"social-profile-links": {
		title: "Visitors can't verify you on social media",
		whatsHappening: "Your website doesn't link out to your social media profiles.",
		whyItHurts: "Visitors who want to confirm you're a real, active business before buying have no easy way to do that — so some just leave.",
		howTrevFixes: "I'll link your active social profiles so visitors can quickly confirm you're legit.",
		price: 30,
	},

	// --- Technical ---
	https: {
		title: "Browsers are warning visitors your site is 'Not Secure'",
		whatsHappening: "Your website isn't secured properly.",
		whyItHurts: "Browsers show visitors a scary 'Not Secure' warning right in the address bar. Most people leave immediately when they see that.",
		howTrevFixes: "I'll secure your website properly so that warning disappears for good.",
		price: 60,
	},
	"https-redirect": {
		title: "There's an unsecured back door into your site",
		whatsHappening: "There's a version of your website that loads without the security lock, and it doesn't automatically redirect.",
		whyItHurts: "Some visitors and search engines can land on the insecure version of your site without you ever knowing.",
		howTrevFixes: "I'll make sure every visitor is automatically sent to the secure version of your site.",
		price: 40,
	},
	"language-attribute": {
		title: "Your site doesn't declare its language",
		whatsHappening: "Your website doesn't tell browsers what language it's written in.",
		whyItHurts: "This small technical gap can affect how correctly screen readers read your site aloud, and how well search engines match you to the right audience.",
		howTrevFixes: "I'll add the correct language setting so your site is read and served correctly everywhere.",
		price: 25,
	},
	"robots-txt": {
		title: "Search engines may not be fully allowed to see your site",
		whatsHappening: "Your website is missing, or has misconfigured, the file that tells search engines what they're allowed to look at.",
		whyItHurts: "In the worst case, this can accidentally block search engines from seeing your site at all.",
		howTrevFixes: "I'll set this up correctly so search engines can fully explore and index your site.",
		price: 30,
	},
	"sitemap-xml": {
		title: "Search engines might be missing some of your pages",
		whatsHappening: "Your website doesn't have a map that helps search engines find all of your pages.",
		whyItHurts: "Without it, search engines can miss pages on your site entirely — especially newer ones.",
		howTrevFixes: "I'll build and submit a proper sitemap so every page of your site gets found.",
		price: 35,
	},

	// --- Conversion ---
	"phone-link": {
		title: "Your phone number isn't tap-to-call",
		whatsHappening: "Your phone number on the site isn't clickable.",
		whyItHurts: "On mobile, that means a customer has to manually copy and dial your number instead of just tapping — and most won't bother.",
		howTrevFixes: "I'll make your number a one-tap click-to-call button.",
		price: 30,
	},
	"email-link": {
		title: "Your email isn't tap-to-send",
		whatsHappening: "Your email address on the site isn't clickable.",
		whyItHurts: "Visitors have to manually copy your email into their mail app — an extra step that loses you leads.",
		howTrevFixes: "I'll make your email a one-tap click-to-email link.",
		price: 25,
	},
	"contact-form": {
		title: "There's no simple way to message you from the site",
		whatsHappening: "Your website doesn't have a simple contact form.",
		whyItHurts: "Some customers don't want to call or wait for their email app to open — without a form, you lose every one of those leads.",
		howTrevFixes: "I'll build a simple, working contact form so visitors can reach you in seconds.",
		price: 90,
	},
	"booking-link": {
		title: "Customers can't book with you online",
		whatsHappening: "There's no direct way for visitors to book or schedule with you online.",
		whyItHurts: "Customers who want to book right now, outside business hours, have no way to — so they book with whoever does offer that.",
		howTrevFixes: "I'll set up a direct booking or scheduling link so you capture those customers automatically.",
		price: 100,
	},
	"cta-button": {
		title: "Nothing tells visitors what to do next",
		whatsHappening: "Nothing on your website clearly tells visitors what to do next.",
		whyItHurts: "Even visitors who are ready to buy or book leave because there's no obvious next step for them to take.",
		howTrevFixes: "I'll add clear buttons like 'Book Now' or 'Get a Quote' that tell visitors exactly what to do.",
		price: 65,
	},
	"multiple-conversion-paths": {
		title: "You're only giving customers one way to reach you",
		whatsHappening: "There's basically only one way — or zero ways — for a customer to actually reach out to you.",
		whyItHurts: "Different customers prefer different ways to reach out. Offering only one path turns away everyone who prefers another.",
		howTrevFixes: "I'll set up multiple simple ways for customers to reach you, so you stop losing the ones who don't like your only option.",
		price: 85,
	},
};

export function getPlainEnglish(check: Check): PlainEnglishCopy {
	const mapped = COPY[check.id];
	if (mapped) return mapped;
	// Defensive fallback for any future check not yet mapped here — reuses the
	// engine's own accurate copy rather than inventing something new.
	return {
		title: check.title,
		whatsHappening: check.description,
		whyItHurts: check.whyItMatters,
		howTrevFixes: check.recommendation,
		price: null,
	};
}
