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

// Test 5: Proactive Penalty Evaluation (9.99€ daily, 49.99€ weekly)
const activeDailyMonetization = {
  penaltyEnabled: true,
  penaltyAccepted: true,
  penaltyAmount: 9.99
};

// 5.1 Goal achieved -> no penalty
const res1 = MonetizationService.evaluatePenalty(activeDailyMonetization, 200, 250, false);
assert.strictEqual(res1.isPenalized, false);

// 5.2 Goal missed but emergency used -> ethical exemption
const res2 = MonetizationService.evaluatePenalty(activeDailyMonetization, 200, 50, true);
assert.strictEqual(res2.isPenalized, false);

// 5.3 Goal missed without emergency -> penalty recorded (9.99€)
const res3 = MonetizationService.evaluatePenalty(activeDailyMonetization, 200, 50, false);
assert.strictEqual(res3.isPenalized, true);
assert.strictEqual(res3.penaltyAmount, 9.99);
console.log('✓ Test 5 Passed: Proactive commitment (9.99€ daily) and ethical exemption evaluated accurately.');

// Test 6: Commitment Quick Setter (Daily 9.99€ & Weekly 49.99€)
const testStateDaily = { monetization: {} };
MonetizationService.setCommitment(testStateDaily, 'daily');
assert.strictEqual(testStateDaily.monetization.penaltyEnabled, true);
assert.strictEqual(testStateDaily.monetization.billingCycle, 'daily');
assert.strictEqual(testStateDaily.monetization.penaltyAmount, 9.99);

const testStateWeekly = { monetization: {} };
MonetizationService.setCommitment(testStateWeekly, 'weekly');
assert.strictEqual(testStateWeekly.monetization.penaltyEnabled, true);
assert.strictEqual(testStateWeekly.monetization.billingCycle, 'weekly');
assert.strictEqual(testStateWeekly.monetization.penaltyAmount, 49.99);
console.log('✓ Test 6 Passed: Frictionless 1-click commitment setter for Daily (9.99€) and Weekly (49.99€).');

// Test 7: Daily Reminders Logic (Billing & Penalty)
const stateWithNoGateways = {
  paymentProviders: { stripe: { enabled: false }, paypal: { enabled: false } },
  monetization: { penaltyEnabled: false },
  reminders: {}
};

assert.strictEqual(MonetizationService.shouldShowBillingReminder(stateWithNoGateways, '2026-11-23'), true);
assert.strictEqual(MonetizationService.shouldShowPenaltyReminder(stateWithNoGateways, '2026-11-23'), true);

// Dismiss reminder for today
MonetizationService.dismissReminder(stateWithNoGateways, 'billing', '2026-11-23');
assert.strictEqual(MonetizationService.shouldShowBillingReminder(stateWithNoGateways, '2026-11-23'), false);
// Still shows for tomorrow
assert.strictEqual(MonetizationService.shouldShowBillingReminder(stateWithNoGateways, '2026-11-24'), true);
console.log('✓ Test 7 Passed: Daily reminder logic and dismiss persistence operates as specified.');

// Test 8: Settlement Application and History Ledger
const mockState = {
  monetization: {
    pendingSettlement: 49.99,
    settlementHistory: [],
    billingCycle: 'weekly'
  }
};

MonetizationService.applySettlement(mockState, {
  id: 'settle_test_1',
  amount: 49.99,
  stripeReference: 'cs_test_live_441'
});

assert.strictEqual(mockState.monetization.pendingSettlement, 0);
assert.strictEqual(mockState.monetization.settlementHistory.length, 1);
assert.strictEqual(mockState.monetization.settlementHistory[0].stripeReference, 'cs_test_live_441');
console.log('✓ Test 8 Passed: Settlement ledger updates pending balances and records payments.');

console.log('\nAll 8 Monetization Tests Passed Successfully! 🚀');
