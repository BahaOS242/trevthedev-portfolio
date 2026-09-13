/**
 * Customer-facing ROI model for the "What could this be worth to your
 * business?" calculator. Pure functions, no DOM — the UI (in
 * ReceptionistEconomics.astro) is the only thing that knows this exists.
 *
 * This is intentionally separate from the product's own internal
 * economics (price, CAC, LTV, margin, etc.) — this module answers a
 * different question: "if a business pays for this, what might it return
 * to them?" All outputs are illustrative planning assumptions, never
 * framed as guaranteed or actual results.
 */

export const AI_COST_MONTHLY = 300;
export const AI_COST_ANNUAL = AI_COST_MONTHLY * 12;

export interface RoiInputs {
	/** Revenue Engine #1 — Recovered Bookings */
	missedBookingsPerMonth: number;
	avgRevenuePerNewCustomer: number;
	/** 0–1 */
	recoveryRate: number;

	/** Revenue Engine #2 — Retention */
	activeCustomers: number;
	/** 0–1 */
	currentRetentionRate: number;
	/** 0–1 */
	expectedRetentionRate: number;
	avgAnnualRevenuePerRetainedCustomer: number;

	/** Revenue Engine #3 — Reactivation (optional) */
	reactivationEnabled: boolean;
	inactiveCustomers: number;
	/** 0–1 */
	reactivationRate: number;
	revenuePerReactivatedCustomer: number;
}

export interface RoiResult {
	recoveredAnnualRevenue: number;
	retentionImprovement: number;
	additionalRetainedCustomers: number;
	retainedAnnualRevenue: number;
	reactivationAnnualRevenue: number;
	totalAnnualImpact: number;
	netAnnualImpact: number;
	/** netAnnualImpact / AI_COST_ANNUAL */
	roiMultiple: number;
}

export const DEFAULT_ROI_INPUTS: RoiInputs = {
	missedBookingsPerMonth: 20,
	avgRevenuePerNewCustomer: 300,
	recoveryRate: 0.5,

	activeCustomers: 500,
	currentRetentionRate: 0.7,
	expectedRetentionRate: 0.8,
	avgAnnualRevenuePerRetainedCustomer: 800,

	reactivationEnabled: true,
	inactiveCustomers: 100,
	reactivationRate: 0.2,
	revenuePerReactivatedCustomer: 800,
};

export function calculateRoi(inputs: RoiInputs): RoiResult {
	const recoveredMonthlyRevenue =
		inputs.missedBookingsPerMonth * inputs.recoveryRate * inputs.avgRevenuePerNewCustomer;
	const recoveredAnnualRevenue = recoveredMonthlyRevenue * 12;

	const retentionImprovement = inputs.expectedRetentionRate - inputs.currentRetentionRate;
	const additionalRetainedCustomers = inputs.activeCustomers * retentionImprovement;
	const retainedAnnualRevenue = additionalRetainedCustomers * inputs.avgAnnualRevenuePerRetainedCustomer;

	const reactivationAnnualRevenue = inputs.reactivationEnabled
		? inputs.inactiveCustomers * inputs.reactivationRate * inputs.revenuePerReactivatedCustomer
		: 0;

	const totalAnnualImpact = recoveredAnnualRevenue + retainedAnnualRevenue + reactivationAnnualRevenue;
	const netAnnualImpact = totalAnnualImpact - AI_COST_ANNUAL;
	const roiMultiple = netAnnualImpact / AI_COST_ANNUAL;

	return {
		recoveredAnnualRevenue,
		retentionImprovement,
		additionalRetainedCustomers,
		retainedAnnualRevenue,
		reactivationAnnualRevenue,
		totalAnnualImpact,
		netAnnualImpact,
		roiMultiple,
	};
}
