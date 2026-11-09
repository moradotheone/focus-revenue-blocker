const assert = require('assert');
const { BillingEngine } = require('../src/lib/billing.js');
const { DEFAULT_STATE, StorageService } = require('../src/lib/storage.js');

console.log('Running FocusRevenue MVP Unit Tests...\n');

// Test 1: Daily progress calculation
const state = JSON.parse(JSON.stringify(DEFAULT_STATE));
state.dailyGoal.targetAmount = 200;
state.dailyGoal.currency = 'EUR';
state.dailyGoal.date = '2026-11-09';
state.transactions = [
  {
    id: 'tx_1',
    date: '2026-11-09',
    source: 'stripe',
    amount: 50.0,
    isConfirmed: true,
    potentialDuplicate: false
  },
  {
    id: 'tx_2',
    date: '2026-11-09',
    source: 'invoice_issued',
    amount: 100.0,
    isConfirmed: false,
    potentialDuplicate: false
  }
];

const progress = BillingEngine.calculateDailyProgress(state);
assert.strictEqual(progress.confirmedTotal, 50.0, 'Confirmed total should be 50.0');
assert.strictEqual(progress.issuedTotal, 100.0, 'Issued total should be 100.0');
assert.strictEqual(progress.totalDailyRevenue, 150.0, 'Total daily revenue should be 150.0');
assert.strictEqual(progress.remainingToGoal, 50.0, 'Remaining to goal should be 50.0');
assert.strictEqual(progress.progressPercent, 75, 'Progress percent should be 75%');
assert.strictEqual(progress.isGoalMet, false, 'Goal should not be met yet');
assert.strictEqual(progress.estimatedFee, 4.5, 'Estimated fee should be 3% of 150 = 4.5');
console.log('✓ Test 1 Passed: Daily progress and 3% fee calculations accurate.');

// Test 2: Goal achieved
state.transactions.push({
  id: 'tx_3',
  date: '2026-11-09',
  source: 'paypal',
  amount: 60.0,
  isConfirmed: true,
  potentialDuplicate: false
});
const progressAchieved = BillingEngine.calculateDailyProgress(state);
assert.strictEqual(progressAchieved.totalDailyRevenue, 210.0);
assert.strictEqual(progressAchieved.remainingToGoal, 0);
assert.strictEqual(progressAchieved.isGoalMet, true);
assert.strictEqual(progressAchieved.isUnlocked, true);
console.log('✓ Test 2 Passed: Goal achievement unlocks distraction sites.');

// Test 3: Emergency exit active
state.dailyGoal.targetAmount = 500; // not reached
state.emergencyExit = {
  isActive: true,
  expiresAt: Date.now() + 600000, // 10 min in future
  reason: 'Urgencia cliente'
};
const progressEmergency = BillingEngine.calculateDailyProgress(state);
assert.strictEqual(progressEmergency.isGoalMet, false);
assert.strictEqual(progressEmergency.isEmergencyActive, true);
assert.strictEqual(progressEmergency.isUnlocked, true, 'Emergency bypass must unlock sites');
console.log('✓ Test 3 Passed: Emergency bypass provides non-coercive unlock.');

// Test 4: Duplicate detection
const existingTxs = [
  { id: '1', date: '2026-11-09', amount: 150.0, isConfirmed: true }
];
const duplicateCandidate = { id: '2', date: '2026-11-09', amount: 150.0, isConfirmed: false };
const isDup = BillingEngine.detectDuplicates(duplicateCandidate, existingTxs);
assert.strictEqual(isDup, true, 'Matching amount between issued and confirmed must trigger duplicate warning');
console.log('✓ Test 4 Passed: Risk of double counting detected properly.');

// Test 5: Active user verification criteria
const activeUser = StorageService.evaluateActiveUser(state);
assert.strictEqual(activeUser, true, 'User with configured goal, sessions and transactions must evaluate as active user');
console.log('✓ Test 5 Passed: Active user validation metric complies with Jorge\'s criteria.');

console.log('\nAll 5 Unit Tests Passed Successfully! 🚀');
