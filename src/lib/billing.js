/**
 * Billing & Revenue Calculation Engine
 * Aligned with specifications in:
 * "Idea A — Ficha de hipótesis y validación" & "Estrategia de go-to-market"
 */

const BillingEngine = {
  /**
   * Calculates progress summary for the current day
   */
  calculateDailyProgress(state) {
    const today = state.dailyGoal.date;
    const target = state.dailyGoal.targetAmount || 1;
    const currency = state.dailyGoal.currency || 'EUR';
    const symbol = state.dailyGoal.symbol || '€';

    // Filter today's transactions
    const todayTxs = (state.transactions || []).filter(tx => tx.date === today);

    let confirmedTotal = 0;
    let issuedTotal = 0;
    let flaggedDuplicatesCount = 0;

    // Check potential duplicate entries (e.g. an issued invoice that was also paid via Stripe)
    todayTxs.forEach(tx => {
      if (tx.isConfirmed) {
        confirmedTotal += Number(tx.amount || 0);
      } else {
        issuedTotal += Number(tx.amount || 0);
      }
      if (tx.potentialDuplicate) {
        flaggedDuplicatesCount++;
      }
    });

    // Combined total includes both confirmed and issued (as per Jorge's directive)
    // with transparent sub-totals
    const totalDailyRevenue = confirmedTotal + issuedTotal;
    const remainingToGoal = Math.max(0, target - totalDailyRevenue);
    const progressPercent = Math.min(100, Math.round((totalDailyRevenue / target) * 100));
    const isGoalMet = totalDailyRevenue >= target;

    // Calculate 3% platform fee based on Jorge's commercial base model
    const feeRate = (state.monetization && state.monetization.feePercentage) ? state.monetization.feePercentage / 100 : 0.03;
    const estimatedFee = totalDailyRevenue * feeRate;

    // Emergency bypass check
    const isEmergencyActive = !!(state.emergencyExit && 
                                state.emergencyExit.isActive && 
                                Date.now() < state.emergencyExit.expiresAt);

    // Unlocked if goal is met OR emergency exit is active
    const isUnlocked = isGoalMet || isEmergencyActive;

    return {
      today,
      target,
      currency,
      symbol,
      confirmedTotal: Math.round(confirmedTotal * 100) / 100,
      issuedTotal: Math.round(issuedTotal * 100) / 100,
      totalDailyRevenue: Math.round(totalDailyRevenue * 100) / 100,
      remainingToGoal: Math.round(remainingToGoal * 100) / 100,
      progressPercent,
      isGoalMet,
      isEmergencyActive,
      isUnlocked,
      emergencyMinutesLeft: isEmergencyActive 
        ? Math.max(1, Math.ceil((state.emergencyExit.expiresAt - Date.now()) / 60000))
        : 0,
      estimatedFee: Math.round(estimatedFee * 100) / 100,
      todayTxs,
      flaggedDuplicatesCount
    };
  },

  /**
   * Identifies potential double-counting across Stripe/PayPal and Invoices
   */
  detectDuplicates(newTx, existingTxs) {
    // If an issued invoice has the exact same amount as a confirmed payment on the same date
    const sameDayTxs = existingTxs.filter(t => t.date === newTx.date && t.id !== newTx.id);
    for (const tx of sameDayTxs) {
      if (Math.abs(tx.amount - newTx.amount) < 0.01 && tx.isConfirmed !== newTx.isConfirmed) {
        return true;
      }
    }
    return false;
  },

  /**
   * Helper to format currency values cleanly
   */
  formatCurrency(amount, currency = 'EUR', symbol = '€') {
    const num = Number(amount || 0).toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${num} ${symbol}`;
  },

  /**
   * Creates a mock Stripe/PayPal or Invoice transaction for fast testing / pilot demo
   */
  generateMockTransaction(type = 'stripe', customAmount = null) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const id = 'tx_' + type + '_' + Math.random().toString(36).substring(2, 9);
    
    const sampleAmounts = [35.00, 50.00, 85.00, 120.00, 150.00, 250.00];
    const amount = customAmount !== null 
      ? Number(customAmount) 
      : sampleAmounts[Math.floor(Math.random() * sampleAmounts.length)];

    let description = '';
    let isConfirmed = true;

    if (type === 'stripe') {
      description = `Stripe: Cobro con tarjeta (Pago #${Math.floor(1000 + Math.random() * 9000)})`;
      isConfirmed = true;
    } else if (type === 'paypal') {
      description = `PayPal: Transferencia recibida (ID: PP-${Math.floor(100000 + Math.random() * 900000)})`;
      isConfirmed = true;
    } else if (type === 'invoice_issued') {
      description = `Factura Emitida #FAC-${now.getFullYear()}-${Math.floor(10 + Math.random() * 90)}`;
      isConfirmed = false; // Issued, pending payment
    } else {
      description = `Ingreso manual verificado`;
      isConfirmed = true;
    }

    return {
      id,
      timestamp: now.toISOString(),
      date: today,
      source: type,
      amount,
      currency: 'EUR',
      description,
      isConfirmed,
      potentialDuplicate: false
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BillingEngine };
}
