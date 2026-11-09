const assert = require('assert');
const { PaymentService } = require('../src/lib/payments.js');
const { BillingEngine } = require('../src/lib/billing.js');

console.log('Running Payment Integration Tests...\n');

// Test 1: Empty or invalid Stripe key handling
PaymentService.testStripeConnection('').then(res => {
  assert.strictEqual(res.success, false);
  console.log('✓ Test 1 Passed: Empty Stripe API Key properly rejected.');
});

// Test 2: Duplicate detection between Stripe transaction and Invoice
const existingTransactions = [
  {
    id: 'inv_101',
    date: '2026-11-09',
    amount: 120.00,
    isConfirmed: false,
    source: 'invoice_issued'
  }
];

const newStripeTx = {
  id: 'stripe_ch_3Mtest',
  date: '2026-11-09',
  amount: 120.00,
  isConfirmed: true,
  source: 'stripe'
};

const isPotentialDuplicate = BillingEngine.detectDuplicates(newStripeTx, existingTransactions);
assert.strictEqual(isPotentialDuplicate, true, 'Matching amount on same day should trigger duplicate warning');
console.log('✓ Test 2 Passed: Cross-provider duplicate detection operates as specified.');

// Test 3: Daily progress with Stripe and PayPal transactions
const sampleState = {
  dailyGoal: { targetAmount: 300, currency: 'EUR', symbol: '€', date: '2026-11-09' },
  transactions: [
    { id: 'tx_s1', date: '2026-11-09', amount: 150.00, isConfirmed: true, source: 'stripe' },
    { id: 'tx_p1', date: '2026-11-09', amount: 100.00, isConfirmed: true, source: 'paypal' },
    { id: 'tx_i1', date: '2026-11-09', amount: 50.00, isConfirmed: false, source: 'invoice_issued' }
  ],
  monetization: { feePercentage: 3.0 }
};

const progress = BillingEngine.calculateDailyProgress(sampleState);
assert.strictEqual(progress.confirmedTotal, 250.00);
assert.strictEqual(progress.issuedTotal, 50.00);
assert.strictEqual(progress.totalDailyRevenue, 300.00);
assert.strictEqual(progress.isGoalMet, true);
assert.strictEqual(progress.isUnlocked, true);
assert.strictEqual(progress.estimatedFee, 9.00);
console.log('✓ Test 3 Passed: Multi-gateway revenue calculation and automatic shield release verified.');

console.log('\nAll Payment Integration Tests Passed Successfully! 🚀');
