/**
 * BahaOS Growth Audit — scoring engine.
 *
 * Architecture:
 *   1. `parseAuditData()` fetches a URL and a handful of related resources (robots.txt,
 *      sitemap.xml, the http:// variant) and reduces everything to one plain `AuditData`
 *      struct of already-parsed signals (word count, tag presence, link types, etc).
 *   2. `buildXChecks(data)` functions (one per category) turn those signals into `Check`
 *      objects — the only place pass/fail decisions and copy live.
 *   3. `scoreCategory()` / `scoreOverall()` turn checks into 0–100 scores. Category scores
 *      are always normalized to their own points before the category weight is applied, so
 *      adding or removing checks from a category never has to be rebalanced against the rest.
 *
 * To add a new check: write the signal into `AuditData` (if needed), add one `makeCheck(...)`
 * call inside the matching `buildXChecks` function, done — scoring, category totals, and the
 * overall score all update automatically.
 */

export type Category = "visibility" | "conversion" | "experience" | "trust" | "technical";
export type Severity = "high" | "medium" | "low";
export type CheckStatus = "pass" | "fail" | "unavailable";

export interface Check {
	id: string;
	category: Category;
	status: CheckStatus;
	severity: Severity;
	points: number;
	maxPoints: number;
	title: string;
	description: string;
	whyItMatters: string;
	recommendation: string;
}

export interface CategoryResult {
	id: Category;
	label: string;
	weight: number;
	score: number;
	checks: Check[];
}

export interface AuditResult {
	url: string;
	score: number;
	opportunitiesCount: number;
	categories: CategoryResult[];
	biggestOpportunity: (Check & { framing: string }) | null;
}

export class AuditInputError extends Error {}
export class AuditFetchError extends Error {}

// ---------------------------------------------------------------------------
// Category weights — must sum to 100. Category scores are normalized to 0-100
// independently of how many checks they contain, then combined by weight.
// ---------------------------------------------------------------------------
export const CATEGORY_META: Record<Category, { label: string; weight: number }> = {
	visibility: { label: "Visibility", weight: 20 },
	conversion: { label: "Conversion", weight: 25 },
	experience: { label: "Experience", weight: 20 },
	trust: { label: "Trust", weight: 15 },
	technical: { label: "Technical", weight: 20 },
};

export const CATEGORY_ORDER: Category[] = [
	"visibility",
	"conversion",
	"experience",
	"trust",
	"technical",
];

const SEVERITY_POINTS: Record<Severity, number> = { high: 10, medium: 6, low: 3 };

const FRAMING_BY_CATEGORY: Record<Category, string> = {
	visibility:
		"Your site is technically functional, but your search visibility has room to improve.",
	conversion:
		"Your site is reachable, but there's a clear opportunity to make it easier for visitors to take action.",
	experience: "Visitors can find your site, but the on-page experience has room to improve.",
	trust:
		"Your site works, but a few trust signals are missing that could help visitors feel confident reaching out.",
	technical: "Your site has a technical foundation issue worth addressing first.",
};

const AUDIT_UA = "BahaOSGrowthAudit/1.0 (+https://trevthedev.com)";
const MAIN_FETCH_TIMEOUT_MS = 9000;
const SECONDARY_FETCH_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Check factories
// ---------------------------------------------------------------------------

function makeCheck(args: {
	id: string;
	category: Category;
	severity: Severity;
	passed: boolean;
	title: string;
	description: string;
	whyItMatters: string;
	recommendation: string;
}): Check {
	const maxPoints = SEVERITY_POINTS[args.severity];
	return {
		id: args.id,
		category: args.category,
		status: args.passed ? "pass" : "fail",
		severity: args.severity,
		points: args.passed ? maxPoints : 0,
		maxPoints,
		title: args.title,
		description: args.description,
		whyItMatters: args.whyItMatters,
		recommendation: args.recommendation,
	};
}

function makeUnavailableCheck(args: {
	id: string;
	category: Category;
	title: string;
	description: string;
}): Check {
	return {
		id: args.id,
		category: args.category,
		status: "unavailable",
		severity: "low",
		points: 0,
		maxPoints: 0,
		title: args.title,
		description: args.description,
		whyItMatters: "",
		recommendation: "",
	};
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function scoreCategory(checks: Check[]): number {
	const scored = checks.filter((c) => c.status !== "unavailable");
	const maxPoints = scored.reduce((sum, c) => sum + c.maxPoints, 0);
	if (maxPoints === 0) return 0;
	const points = scored.reduce((sum, c) => sum + c.points, 0);
	return Math.max(0, Math.min(100, Math.round((points / maxPoints) * 100)));
}

export function scoreOverall(categories: CategoryResult[]): number {
	const weighted = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
	return Math.max(0, Math.min(100, Math.round(weighted / 100)));
}

function pickBiggestOpportunity(checks: Check[]): (Check & { framing: string }) | null {
	const fails = checks.filter((c) => c.status === "fail");
	if (fails.length === 0) return null;
	const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
	fails.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.maxPoints - a.maxPoints);
	const top = fails[0];
	return { ...top, framing: FRAMING_BY_CATEGORY[top.category] };
}

// ---------------------------------------------------------------------------
// HTML parsing helpers — small, dependency-free, regex-based. Good enough for
// a lightweight single-fetch audit; not a full HTML parser.
// ---------------------------------------------------------------------------

function decodeEntities(text: string): string {
	return text
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&mdash;/g, "—")
		.replace(/&ndash;/g, "–");
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1).trimEnd()}…`;
}

function getOpenTags(html: string, tagName: string): string[] {
	const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
	return html.match(re) ?? [];
}

function getElements(html: string, tagName: string): { tag: string; inner: string }[] {
	const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
	const out: { tag: string; inner: string }[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		out.push({ tag: `<${tagName} ${m[1]}>`, inner: m[2] });
	}
	return out;
}

function attr(tag: string, name: string): string | null {
	const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
	const m = tag.match(re);
	if (!m) return null;
	return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
}

function tagText(inner: string): string {
	return decodeEntities(inner.replace(/<[^>]+>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

function extractBodyText(html: string): string {
	const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
	let content = bodyMatch ? bodyMatch[1] : html;
	content = content.replace(/<script[\s\S]*?<\/script>/gi, " ");
	content = content.replace(/<style[\s\S]*?<\/style>/gi, " ");
	content = content.replace(/<!--[\s\S]*?-->/g, " ");
	content = content.replace(/<[^>]+>/g, " ");
	return decodeEntities(content).replace(/\s+/g, " ").trim();
}

const CTA_TEXT_RE =
	/\b(get started|contact us|call now|book now|buy now|shop now|sign up|schedule (a |your )?(call|consult|demo|appointment)|request a quote|free consultation|order now|start now|reserve|apply now)\b/i;

const BOOKING_RE =
	/\b(book now|book online|schedule an? appointment|reserve a table|reserve now|calendly|acuityscheduling|book a (call|demo|consult|appointment))\b/i;

interface AuditData {
	targetUrl: string;
	finalUrl: string;
	origin: string;
	hostname: string;
	usedHttps: boolean;
	responseTimeMs: number;
	titleText: string;
	metaDescription: string;
	h1Count: number;
	h2Count: number;
	wordCount: number;
	imgCount: number;
	imgsWithAlt: number;
	imgsWithDims: number;
	hasViewport: boolean;
	hasFavicon: boolean;
	hasCanonical: boolean;
	hasStructuredData: boolean;
	hasOpenGraph: boolean;
	langAttr: string | null;
	internalLinkCount: number;
	hasPhoneLink: boolean;
	hasEmailLink: boolean;
	hasContactForm: boolean;
	hasBookingLink: boolean;
	hasCtaButton: boolean;
	hasPrivacyLink: boolean;
	hasSocialLinks: boolean;
	hasEmailInText: boolean;
	robotsOk: boolean;
	robotsBlocksAll: boolean;
	sitemapOk: boolean;
	httpsRedirects: boolean;
}

async function fetchTextWithTimeout(
	url: string,
	ms: number,
): Promise<{ ok: boolean; text: string }> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), ms);
		const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": AUDIT_UA } });
		clearTimeout(timeout);
		const text = res.ok ? await res.text() : "";
		return { ok: res.ok, text };
	} catch {
		return { ok: false, text: "" };
	}
}

async function checkHttpsRedirect(targetUrl: string): Promise<boolean> {
	try {
		const u = new URL(targetUrl);
		const httpUrl = `http://${u.host}${u.pathname}${u.search}`;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), SECONDARY_FETCH_TIMEOUT_MS);
		const res = await fetch(httpUrl, {
			signal: controller.signal,
			redirect: "follow",
			headers: { "user-agent": AUDIT_UA },
		});
		clearTimeout(timeout);
		return res.url.startsWith("https://");
	} catch {
		return false;
	}
}

function normalizeUrl(input: string): string | null {
	let value = input.trim();
	if (!value) return null;
	if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
	try {
		const parsed = new URL(value);
		if (!parsed.hostname.includes(".")) return null;
		return parsed.toString();
	} catch {
		return null;
	}
}

async function parseAuditData(rawUrl: string): Promise<AuditData> {
	const targetUrl = normalizeUrl(rawUrl);
	if (!targetUrl) throw new AuditInputError("Please enter a valid website URL.");

	const startedAt = Date.now();
	let html: string;
	let finalUrl: string;
	let usedHttps: boolean;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), MAIN_FETCH_TIMEOUT_MS);
		const response = await fetch(targetUrl, {
			signal: controller.signal,
			redirect: "follow",
			headers: { "user-agent": AUDIT_UA },
		});
		clearTimeout(timeout);
		html = await response.text();
		finalUrl = response.url || targetUrl;
		usedHttps = finalUrl.startsWith("https://");
	} catch (err) {
		throw new AuditFetchError(err instanceof Error ? err.message : "Fetch failed");
	}

	const responseTimeMs = Date.now() - startedAt;
	const origin = new URL(finalUrl).origin;
	const hostname = new URL(finalUrl).hostname;

	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const titleText = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

	const metaTags = getOpenTags(html, "meta");
	const descriptionTag = metaTags.find((tag) => (attr(tag, "name") ?? "").toLowerCase() === "description");
	const metaDescription = descriptionTag ? (attr(descriptionTag, "content") ?? "").trim() : "";
	const hasViewport = metaTags.some((tag) => (attr(tag, "name") ?? "").toLowerCase() === "viewport");
	const hasOpenGraph = metaTags.some((tag) => (attr(tag, "property") ?? "").toLowerCase().startsWith("og:"));

	const linkTags = getOpenTags(html, "link");
	const hasFavicon = linkTags.some((tag) => /icon/i.test(attr(tag, "rel") ?? ""));
	const hasCanonical = linkTags.some((tag) => (attr(tag, "rel") ?? "").toLowerCase() === "canonical");

	const hasStructuredData = /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);

	const htmlTagMatch = html.match(/<html\b[^>]*>/i);
	const langAttr = htmlTagMatch ? attr(htmlTagMatch[0], "lang") : null;

	const h1Elements = getElements(html, "h1");
	const h2Elements = getElements(html, "h2");
	const bodyText = extractBodyText(html);
	const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

	const imgTags = getOpenTags(html, "img");
	const imgsWithAlt = imgTags.filter((tag) => (attr(tag, "alt") ?? "").trim().length > 0).length;
	const imgsWithDims = imgTags.filter((tag) => attr(tag, "width") && attr(tag, "height")).length;

	const anchorElements = getElements(html, "a");
	const buttonElements = getElements(html, "button");
	const internalPaths = new Set<string>();
	let hasPhoneLink = false;
	let hasEmailLink = false;
	let hasBookingLink = false;
	let hasCtaButton = false;
	let hasPrivacyLink = false;
	let hasSocialLinks = false;

	for (const { tag, inner } of anchorElements) {
		const href = attr(tag, "href") ?? "";
		const text = tagText(inner);
		if (/^tel:/i.test(href)) hasPhoneLink = true;
		if (/^mailto:/i.test(href)) hasEmailLink = true;
		if (BOOKING_RE.test(href) || BOOKING_RE.test(text)) hasBookingLink = true;
		if (CTA_TEXT_RE.test(text)) hasCtaButton = true;
		if (/privacy( policy)?|terms( of (service|use))?/i.test(text)) hasPrivacyLink = true;
		if (/facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com/i.test(href)) {
			hasSocialLinks = true;
		}
		if (href && !/^(tel:|mailto:|#|javascript:)/i.test(href)) {
			try {
				const resolved = new URL(href, finalUrl);
				if (resolved.hostname === hostname && resolved.href !== finalUrl) {
					internalPaths.add(resolved.pathname + resolved.search);
				}
			} catch {
				// ignore unparsable hrefs
			}
		}
	}

	for (const { inner } of buttonElements) {
		if (CTA_TEXT_RE.test(tagText(inner))) hasCtaButton = true;
	}

	const hasEmailInText = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(bodyText);
	const hasContactForm = getOpenTags(html, "form").length > 0;

	const [robots, sitemap, httpsRedirects] = await Promise.all([
		fetchTextWithTimeout(`${origin}/robots.txt`, SECONDARY_FETCH_TIMEOUT_MS),
		fetchTextWithTimeout(`${origin}/sitemap.xml`, SECONDARY_FETCH_TIMEOUT_MS),
		checkHttpsRedirect(targetUrl),
	]);
	const robotsBlocksAll = /user-agent:\s*\*[\s\S]{0,80}?disallow:\s*\/\s*(\r?\n|$)/i.test(robots.text);
	const sitemapOk = sitemap.ok && /<urlset|<sitemapindex/i.test(sitemap.text);

	return {
		targetUrl,
		finalUrl,
		origin,
		hostname,
		usedHttps,
		responseTimeMs,
		titleText,
		metaDescription,
		h1Count: h1Elements.length,
		h2Count: h2Elements.length,
		wordCount,
		imgCount: imgTags.length,
		imgsWithAlt,
		imgsWithDims,
		hasViewport,
		hasFavicon,
		hasCanonical,
		hasStructuredData,
		hasOpenGraph,
		langAttr,
		internalLinkCount: internalPaths.size,
		hasPhoneLink,
		hasEmailLink,
		hasContactForm,
		hasBookingLink,
		hasCtaButton,
		hasPrivacyLink,
		hasSocialLinks,
		hasEmailInText,
		robotsOk: robots.ok,
		robotsBlocksAll,
		sitemapOk,
		httpsRedirects,
	};
}

// ---------------------------------------------------------------------------
// Check builders — one function per category
// ---------------------------------------------------------------------------

function buildVisibilityChecks(d: AuditData): Check[] {
	return [
		makeCheck({
			id: "title-tag",
			category: "visibility",
			severity: "high",
			passed: d.titleText.length >= 10 && d.titleText.length <= 65,
			title: "Page Title",
			description: d.titleText
				? `Found: "${truncate(d.titleText, 90)}" (${d.titleText.length} characters).`
				: "No <title> tag was found.",
			whyItMatters:
				"The title tag is what shows as the clickable headline in search results and browser tabs — often the first thing a potential customer sees about you.",
			recommendation:
				"Write a unique, descriptive title around 10–65 characters that includes what you do and, if relevant, where.",
		}),
		makeCheck({
			id: "meta-description",
			category: "visibility",
			severity: "medium",
			passed: d.metaDescription.length > 0,
			title: "Meta Description",
			description: d.metaDescription
				? `Found: "${truncate(d.metaDescription, 120)}".`
				: "No meta description was found.",
			whyItMatters:
				"Google may generate its own search snippet when a page doesn't provide a useful meta description. A stronger description can help communicate the page's relevance to searchers.",
			recommendation:
				"Write a concise, relevant description that accurately summarizes the page and its primary service or location.",
		}),
		makeCheck({
			id: "canonical",
			category: "visibility",
			severity: "low",
			passed: d.hasCanonical,
			title: "Canonical Tag",
			description: d.hasCanonical ? "A canonical link tag was found." : "No canonical link tag was found.",
			whyItMatters:
				"A canonical tag tells search engines which URL is the \"real\" version when a page is reachable multiple ways, preventing duplicate-content confusion.",
			recommendation: "Add a <link rel=\"canonical\"> tag pointing to the preferred URL of each page.",
		}),
		makeCheck({
			id: "structured-data",
			category: "visibility",
			severity: "medium",
			passed: d.hasStructuredData,
			title: "Structured Data",
			description: d.hasStructuredData
				? "Structured data (JSON-LD) was found."
				: "No structured data (JSON-LD) was found.",
			whyItMatters:
				"Structured data (schema.org markup) helps search engines understand your business type, services, and details — sometimes unlocking richer search results.",
			recommendation:
				"Add JSON-LD structured data describing your business. Organization or LocalBusiness schema is a good starting point.",
		}),
		makeCheck({
			id: "open-graph",
			category: "visibility",
			severity: "medium",
			passed: d.hasOpenGraph,
			title: "Social Share Tags",
			description: d.hasOpenGraph ? "Open Graph tags were found." : "No Open Graph tags were found.",
			whyItMatters:
				"Open Graph tags control how your page looks when shared on social media or messaging apps. Without them, shared links can look bare or broken.",
			recommendation:
				"Add Open Graph tags (og:title, og:description, og:image) so shared links display properly.",
		}),
		makeCheck({
			id: "h1-present",
			category: "visibility",
			severity: "high",
			passed: d.h1Count >= 1,
			title: "H1 Heading",
			description: d.h1Count >= 1 ? "A top-level H1 heading was found." : "No <h1> heading was found on the page.",
			whyItMatters:
				"The H1 is the primary heading that tells visitors and search engines what the page is about at a glance.",
			recommendation: "Add one clear H1 heading that describes the main purpose of the page.",
		}),
		makeCheck({
			id: "h1-uniqueness",
			category: "visibility",
			severity: "low",
			passed: d.h1Count <= 1,
			title: "Single H1",
			description:
				d.h1Count > 1
					? `${d.h1Count} H1 headings were found on this page.`
					: "The page uses a single H1 heading.",
			whyItMatters:
				"Multiple H1s can dilute the page's primary topic signal for search engines and confuse the page's structure.",
			recommendation: "Use a single H1 for the main heading, and H2/H3 tags for subheadings.",
		}),
		makeCheck({
			id: "heading-structure",
			category: "visibility",
			severity: "low",
			passed: d.h2Count >= 1 || d.wordCount < 100,
			title: "Heading Structure",
			description:
				d.h2Count >= 1
					? `${d.h2Count} subheading${d.h2Count === 1 ? "" : "s"} (H2) found.`
					: "No H2 subheadings were found.",
			whyItMatters:
				"Subheadings break longer content into scannable sections for visitors and help search engines understand your page's structure.",
			recommendation: "Add H2 subheadings to organize longer sections of content.",
		}),
		makeCheck({
			id: "content-depth",
			category: "visibility",
			severity: "medium",
			passed: d.wordCount >= 150,
			title: "Content Signal",
			description: `This page has roughly ${d.wordCount} words of visible content.`,
			whyItMatters:
				"Very thin pages give search engines and visitors little to evaluate. This is a rough signal, not a quality judgment — a short, well-written page can still work fine.",
			recommendation:
				"Where it adds real value, expand the page with genuinely useful content about your services, process, or location.",
		}),
		makeCheck({
			id: "image-alt-text",
			category: "visibility",
			severity: "medium",
			passed: d.imgCount === 0 || d.imgsWithAlt / d.imgCount >= 0.8,
			title: "Image Alt Text",
			description:
				d.imgCount === 0 ? "No images were detected on this page." : `${d.imgsWithAlt}/${d.imgCount} images have alt text.`,
			whyItMatters:
				"Alt text describes images to visitors using screen readers and to search engines that can't \"see\" images.",
			recommendation: "Add descriptive alt text to images that convey meaningful content.",
		}),
		makeCheck({
			id: "internal-links",
			category: "visibility",
			severity: "low",
			passed: d.internalLinkCount >= 3,
			title: "Internal Links",
			description: `${d.internalLinkCount} distinct internal link${d.internalLinkCount === 1 ? "" : "s"} found on this page.`,
			whyItMatters: "Internal links help visitors explore your site and help search engines discover your other pages.",
			recommendation: "Link to other relevant pages on your site — services, about, contact — from your main pages.",
		}),
	];
}

function buildConversionChecks(d: AuditData): Check[] {
	const pathCount = [d.hasPhoneLink, d.hasEmailLink, d.hasContactForm, d.hasBookingLink, d.hasCtaButton].filter(
		Boolean,
	).length;

	return [
		makeCheck({
			id: "phone-link",
			category: "conversion",
			severity: "medium",
			passed: d.hasPhoneLink,
			title: "Phone Number Link",
			description: d.hasPhoneLink ? "A clickable phone link (tel:) was found." : "No clickable phone link was found.",
			whyItMatters:
				"On mobile, a tappable phone number lets visitors call you in one tap instead of copying a number.",
			recommendation: "Add a tel: link to your phone number, for example <a href=\"tel:+1234567890\">.",
		}),
		makeCheck({
			id: "email-link",
			category: "conversion",
			severity: "medium",
			passed: d.hasEmailLink,
			title: "Email Link",
			description: d.hasEmailLink ? "A clickable email link (mailto:) was found." : "No clickable email link was found.",
			whyItMatters: "A mailto link lets visitors message you directly without hunting for your address.",
			recommendation: "Add a mailto: link to your email address, for example <a href=\"mailto:you@business.com\">.",
		}),
		makeCheck({
			id: "contact-form",
			category: "conversion",
			severity: "medium",
			passed: d.hasContactForm,
			title: "Contact Form",
			description: d.hasContactForm ? "A form was found on this page." : "No form was found on this page.",
			whyItMatters:
				"A form gives visitors a low-friction way to reach out without leaving the page or opening their email app.",
			recommendation: "Add a simple contact form capturing name, email, and message.",
		}),
		makeCheck({
			id: "booking-link",
			category: "conversion",
			severity: "low",
			passed: d.hasBookingLink,
			title: "Booking or Scheduling Link",
			description: d.hasBookingLink ? "A booking or scheduling link was found." : "No booking or scheduling link was found.",
			whyItMatters:
				"For service businesses, letting visitors book directly removes a back-and-forth step that can lose interest.",
			recommendation: "If you take appointments or bookings, link directly to a booking tool from your main pages.",
		}),
		makeCheck({
			id: "cta-button",
			category: "conversion",
			severity: "high",
			passed: d.hasCtaButton,
			title: "Clear Call-to-Action",
			description: d.hasCtaButton
				? "A link or button with clear action wording was found (e.g. \"Get Started\", \"Book Now\")."
				: "No link or button with clear action wording was found.",
			whyItMatters:
				"Without an obvious next step, visitors who are ready to act have no clear path to take, and that interest is lost.",
			recommendation:
				"Add a clear call-to-action — a button or link that tells visitors exactly what to do next, like \"Book a Consultation\" or \"Get a Quote\".",
		}),
		makeCheck({
			id: "multiple-conversion-paths",
			category: "conversion",
			severity: "high",
			passed: pathCount >= 2,
			title: "Multiple Conversion Paths",
			description: `${pathCount} distinct conversion path type${pathCount === 1 ? "" : "s"} detected (phone, email, form, booking, or CTA).`,
			whyItMatters:
				"Different visitors prefer different ways to reach out — phone, email, a form, or booking directly. Relying on just one path narrows who's willing to convert.",
			recommendation: "Offer at least two ways to take action, for example a phone number alongside a contact form.",
		}),
		makeUnavailableCheck({
			id: "primary-cta-clarity",
			category: "conversion",
			title: "Primary Call-to-Action Clarity",
			description:
				"Requires deeper analysis. Whether a site has one clear, prominent primary action depends on visual layout and design, not just page code.",
		}),
		makeUnavailableCheck({
			id: "cta-prominence",
			category: "conversion",
			title: "CTA Visual Prominence",
			description:
				"Requires deeper analysis. How visible a call-to-action is — placement, contrast, size — needs a visual design review, not just code analysis.",
		}),
	];
}

function buildExperienceChecks(d: AuditData): Check[] {
	return [
		makeCheck({
			id: "viewport",
			category: "experience",
			severity: "high",
			passed: d.hasViewport,
			title: "Mobile-Friendly Viewport",
			description: d.hasViewport ? "A viewport meta tag was found." : "No viewport meta tag was found.",
			whyItMatters:
				"Without a mobile viewport tag, a site may render zoomed-out or oddly sized on phones, where most visitors likely browse.",
			recommendation:
				"Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the page head.",
		}),
		makeCheck({
			id: "response-time",
			category: "experience",
			severity: "medium",
			passed: d.responseTimeMs < 2000,
			title: "Server Response Time",
			description: `The server responded in ${d.responseTimeMs}ms.`,
			whyItMatters: "Slow-loading pages frustrate visitors and are more likely to be abandoned before they see your content.",
			recommendation: "Improve server response time through caching, a faster host, or lighter page resources.",
		}),
		makeCheck({
			id: "image-sizing",
			category: "experience",
			severity: "low",
			passed: d.imgCount === 0 || d.imgsWithDims / d.imgCount >= 0.5,
			title: "Image Sizing Hints",
			description:
				d.imgCount === 0
					? "No images were detected on this page."
					: `${d.imgsWithDims}/${d.imgCount} images specify width and height.`,
			whyItMatters:
				"Images without defined dimensions can cause the page to visibly jump around as it loads, which feels unpolished.",
			recommendation:
				"Set width and height attributes (or aspect-ratio in CSS) on images so the browser can reserve space before they load.",
		}),
		makeCheck({
			id: "favicon",
			category: "experience",
			severity: "low",
			passed: d.hasFavicon,
			title: "Favicon",
			description: d.hasFavicon ? "A favicon was found." : "No favicon was found.",
			whyItMatters:
				"A favicon is a small but noticeable detail — its absence can make a site feel unfinished in browser tabs and bookmarks.",
			recommendation: "Add a favicon.ico or a <link rel=\"icon\"> in the page head.",
		}),
	];
}

function buildTrustChecks(d: AuditData): Check[] {
	return [
		makeCheck({
			id: "contact-info-visible",
			category: "trust",
			severity: "medium",
			passed: d.hasPhoneLink || d.hasEmailLink || d.hasEmailInText,
			title: "Visible Contact Information",
			description:
				d.hasPhoneLink || d.hasEmailLink || d.hasEmailInText
					? "Contact information (a phone number, email link, or visible email address) was found on the page."
					: "No phone number, email link, or visible email address was found on the page.",
			whyItMatters:
				"Visible contact details are one of the fastest ways visitors judge whether a business is real and reachable.",
			recommendation: "Make sure a phone number or email address appears clearly on the page, not just buried in a form.",
		}),
		makeCheck({
			id: "privacy-terms-link",
			category: "trust",
			severity: "low",
			passed: d.hasPrivacyLink,
			title: "Privacy Policy / Terms Link",
			description: d.hasPrivacyLink ? "A privacy policy or terms link was found." : "No privacy policy or terms link was found.",
			whyItMatters:
				"A visible privacy or terms link signals the business is established and follows standard practices — small but noticeable to cautious visitors.",
			recommendation: "Add a footer link to a privacy policy and/or terms of service page.",
		}),
		makeCheck({
			id: "social-profile-links",
			category: "trust",
			severity: "low",
			passed: d.hasSocialLinks,
			title: "Social Profile Links",
			description: d.hasSocialLinks ? "Links to social profiles were found." : "No links to social profiles were found.",
			whyItMatters: "Linked social profiles give visitors an easy way to verify the business is active and legitimate.",
			recommendation: "Link to active social profiles (Instagram, Facebook, LinkedIn, etc.) if you maintain them.",
		}),
	];
}

function buildTechnicalChecks(d: AuditData): Check[] {
	return [
		makeCheck({
			id: "https",
			category: "technical",
			severity: "high",
			passed: d.usedHttps,
			title: "HTTPS Enabled",
			description: d.usedHttps ? "The site loads over a secure (HTTPS) connection." : "The site does not load over HTTPS.",
			whyItMatters:
				"HTTPS encrypts data between visitors and your site, and browsers flag non-HTTPS sites as \"Not Secure,\" which can scare visitors away.",
			recommendation: "Install an SSL certificate and serve the site over HTTPS.",
		}),
		makeCheck({
			id: "https-redirect",
			category: "technical",
			severity: "medium",
			passed: d.httpsRedirects,
			title: "HTTP → HTTPS Redirect",
			description: d.httpsRedirects
				? "The unencrypted http:// version redirects to https://."
				: "The http:// version does not redirect to https://.",
			whyItMatters:
				"If the unencrypted address doesn't redirect, visitors and search engines can land on an insecure or duplicate version of the site.",
			recommendation: "Configure the server to redirect all http:// traffic to https://.",
		}),
		makeCheck({
			id: "language-attribute",
			category: "technical",
			severity: "low",
			passed: !!d.langAttr && d.langAttr.trim().length > 0,
			title: "Language Attribute",
			description: d.langAttr ? `Declared language: "${d.langAttr}".` : "No language attribute was found on the <html> tag.",
			whyItMatters:
				"Declaring a language helps browsers and screen readers render content correctly, and helps search engines serve it to the right audience.",
			recommendation: "Add a lang attribute to the <html> tag, for example <html lang=\"en\">.",
		}),
		makeCheck({
			id: "robots-txt",
			category: "technical",
			severity: "low",
			passed: d.robotsOk && !d.robotsBlocksAll,
			title: "Robots.txt",
			description: !d.robotsOk
				? "No robots.txt file was found."
				: d.robotsBlocksAll
					? "robots.txt appears to block all search engine crawlers."
					: "robots.txt was found and does not block all crawlers.",
			whyItMatters:
				"robots.txt tells search engines which parts of a site they're allowed to crawl. A missing or overly restrictive file can limit how much of the site gets indexed.",
			recommendation: "Add a robots.txt file, or review it to make sure it isn't blocking search engines from the whole site.",
		}),
		makeCheck({
			id: "sitemap-xml",
			category: "technical",
			severity: "low",
			passed: d.sitemapOk,
			title: "XML Sitemap",
			description: d.sitemapOk ? "A sitemap.xml file was found." : "No sitemap.xml file was found.",
			whyItMatters: "A sitemap helps search engines discover and index a site's pages faster and more completely.",
			recommendation: "Generate and publish a sitemap.xml file, and reference it in robots.txt.",
		}),
	];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runGrowthAudit(rawUrl: string): Promise<AuditResult> {
	const data = await parseAuditData(rawUrl);

	const checksByCategory: Record<Category, Check[]> = {
		visibility: buildVisibilityChecks(data),
		conversion: buildConversionChecks(data),
		experience: buildExperienceChecks(data),
		trust: buildTrustChecks(data),
		technical: buildTechnicalChecks(data),
	};

	const categories: CategoryResult[] = CATEGORY_ORDER.map((id) => {
		const checks = checksByCategory[id];
		return {
			id,
			label: CATEGORY_META[id].label,
			weight: CATEGORY_META[id].weight,
			score: scoreCategory(checks),
			checks,
		};
	});

	const allChecks = categories.flatMap((c) => c.checks);
	const opportunitiesCount = allChecks.filter((c) => c.status === "fail").length;

	return {
		url: data.finalUrl,
		score: scoreOverall(categories),
		opportunitiesCount,
		categories,
		biggestOpportunity: pickBiggestOpportunity(allChecks),
	};
}

/**
 * Full plain-text version of an audit, every check included — this is what gets
 * saved to the lead record so Trevor has the complete report the moment someone
 * runs the free scan, not just the top-2 teaser the visitor sees on-page.
 */
export function formatFullReportText(result: AuditResult): string {
	const lines: string[] = [];
	lines.push("BAHAOS GROWTH AUDIT — FULL REPORT");
	lines.push(`Site: ${result.url}`);
	lines.push(`Score: ${result.score}/100 | Opportunities: ${result.opportunitiesCount}`);
	lines.push("");

	for (const category of result.categories) {
		lines.push(`${category.label.toUpperCase()} — ${category.score}/100 (weight ${category.weight}%)`);
		for (const check of category.checks) {
			const marker = check.status === "pass" ? "PASS" : check.status === "fail" ? "FAIL" : "N/A ";
			lines.push(`  [${marker}] ${check.title} — ${check.description}`);
		}
		lines.push("");
	}

	if (result.biggestOpportunity) {
		lines.push(`BIGGEST OPPORTUNITY: ${result.biggestOpportunity.title}`);
		lines.push(`Fix: ${result.biggestOpportunity.recommendation}`);
	}

	return lines.join("\n");
}
