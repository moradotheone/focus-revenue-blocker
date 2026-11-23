const assert = require('assert');
const { MonetizationService, JORGE_STRIPE_CONFIG } = require('../src/lib/monetization');
const { StorageService, DEFAULT_STATE } = require('../src/lib/storage');

console.log('Running FocusRevenue Monetization & Stripe Integration Tests...\n');

// Test 1: Success Fee Calculation (3%)
const revenue = 1500.00;
const fee = MonetizationService.calculateSuccessFee(revenue, 3.0);
assert.strictEqual(fee, 45.00, '3% of 1500€ should be exactly 45€');
console.log('✓ Test 1 Passed: 3% platform success fee calculation accurate.');

// Test 2: Billing Cycle Date Boundaries (Daily, Weekly, Monthly)
const dailyDates = MonetizationService.getCycleDates('daily', new Date('2026-11-23'));
assert.strictEqual(dailyDates.startDate, '2026-11-23');
assert.strictEqual(dailyDates.endDate, '2026-11-23');

const weeklyDates = MonetizationService.getCycleDates('weekly', new Date('2026-11-23')); // Monday
assert.strictEqual(weeklyDates.startDate, '2026-11-23');
assert.strictEqual(weeklyDates.endDate, '2026-11-29'); // Sunday

const monthlyDates = MonetizationService.getCycleDates('monthly', new Date('2026-11-23'));
assert.strictEqual(monthlyDates.startDate, '2026-11-01');
assert.strictEqual(monthlyDates.endDate, '2026-11-30');
console.log('✓ Test 2 Passed: Billing cycle date boundaries (daily, weekly, monthly) computed correctly.');

// Test 3: Cycle Revenue Calculation
const sampleTxs = [
  { amount: 100, date: '2026-11-23', isConfirmed: true },
  { amount: 50, date: '2026-11-24', isConfirmed: true },
  { amount: 200, date: '2026-11-10', isConfirmed: true }, // earlier this month
  { amount: 300, date: '2026-10-15', isConfirmed: true }  // last month
];

const dailyRev = MonetizationService.calculateCycleRevenue(sampleTxs, 'daily', new Date('2026-11-23'));
assert.strictEqual(dailyRev, 100);

const weeklyRev = MonetizationService.calculateCycleRevenue(sampleTxs, 'weekly', new Date('2026-11-23'));
assert.strictEqual(weeklyRev, 150); // 100 + 50

const monthlyRev = MonetizationService.calculateCycleRevenue(sampleTxs, 'monthly', new Date('2026-11-23'));
assert.strictEqual(monthlyRev, 350); // 100 + 50 + 200
console.log('✓ Test 3 Passed: Cycle revenue aggregation works across daily, weekly, and monthly periods.');

// Test 4: Stripe Checkout URL Generation with live credentials
const checkoutUrl = MonetizationService.buildCheckoutUrl(JORGE_STRIPE_CONFIG.paymentLinkUrl, {
  clientReferenceId: 'usr_freelance_99',
  prefilledEmail: 'dev@test.com'
});
assert(checkoutUrl.includes('buy.stripe.com/6oUcN50Xyfty6s83OVb3q05'));
assert(checkoutUrl.includes('client_reference_id=usr_freelance_99'));
assert(checkoutUrl.includes('prefilled_email=dev%40test.com'));
console.log('✓ Test 4 Passed: Live Stripe Payment Link generated with user tracking params.');

// Test 5: Proactive Penalty Evaluation
const activeMonetization = {
  penaltyEnabled: true,
  penaltyAccepted: true,
  penaltyAmount: 15.00
};

// 5.1 Goal achieved -> no penalty
const res1 = MonetizationService.evaluatePenalty(activeMonetization, 200, 250, false);
assert.strictEqual(res1.isPenalized, false);

// 5.2 Goal missed but emergency used -> ethical exemption
const res2 = MonetizationService.evaluatePenalty(activeMonetization, 200, 50, true);
assert.strictEqual(res2.isPenalized, false);

// 5.3 Goal missed without emergency -> penalty recorded
const res3 = MonetizationService.evaluatePenalty(activeMonetization, 200, 50, false);
assert.strictEqual(res3.isPenalized, true);
assert.strictEqual(res3.penaltyAmount, 15.00);
console.log('✓ Test 5 Passed: Proactive commitment and ethical exemption evaluated accurately.');

// Test 6: Settlement Application and History Ledger
const mockState = {
  monetization: {
    pendingSettlement: 45.00,
    settlementHistory: [],
    billingCycle: 'weekly'
  }
};

MonetizationService.applySettlement(mockState, {
  id: 'settle_test_1',
  amount: 45.00,
  stripeReference: 'cs_test_live_441'
});

assert.strictEqual(mockState.monetization.pendingSettlement, 0);
assert.strictEqual(mockState.monetization.settlementHistory.length, 1);
assert.strictEqual(mockState.monetization.settlementHistory[0].stripeReference, 'cs_test_live_441');
console.log('✓ Test 6 Passed: Settlement ledger updates pending balances and records payments.');

console.log('\nAll 6 Monetization Tests Passed Successfully! 🚀');
