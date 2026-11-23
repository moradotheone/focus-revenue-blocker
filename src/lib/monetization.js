/**
 * Monetization Service for FocusRevenue
 * 
 * Handles platform fee collection (3% success fee) and voluntary proactive penalty / commitment contracts.
 * Connects directly to Jorge's official Stripe account via live Payment Links and Publishable Keys.
 */

const JORGE_STRIPE_CONFIG = {
  publishableKey: 'pk_live_51ROSkRHVYSsld6jc5I50FHvFKhb2XK7mW2HvZX78EoGEAXmDhCuMlwBNcd2nZifldUpjVWxyO7lo6KEDRh3RnmS100O1tRqOTI',
  paymentLinkUrl: 'https://buy.stripe.com/6oUcN50Xyfty6s83OVb3q05',
  defaultFeePercentage: 3.0,
  defaultDailyPenalty: 9.99,
  defaultWeeklyPenalty: 49.99,
  defaultPenaltyAmount: 9.99
};

const MonetizationService = {
  getConfig() {
    return { ...JORGE_STRIPE_CONFIG };
  },

  /**
   * Calculates the 3% success fee for a given revenue amount.
   * @param {number} revenue 
   * @param {number} [percentage=3.0] 
   * @returns {number}
   */
  calculateSuccessFee(revenue, percentage = 3.0) {
    if (typeof revenue !== 'number' || isNaN(revenue) || revenue <= 0) return 0;
    const fee = (revenue * percentage) / 100;
    return Math.round(fee * 100) / 100;
  },

  /**
   * Calculates date boundaries for a billing cycle ('daily', 'weekly', 'monthly').
   * @param {'daily'|'weekly'|'monthly'} cycle 
   * @param {Date} [referenceDate]
   * @returns {{ startDate: string, endDate: string }} ISO date strings (YYYY-MM-DD)
   */
  getCycleDates(cycle = 'daily', referenceDate = new Date()) {
    const d = new Date(referenceDate);
    const toYMD = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (cycle === 'daily') {
      const todayStr = toYMD(d);
      return { startDate: todayStr, endDate: todayStr };
    }

    if (cycle === 'weekly') {
      // Week starting Monday
      const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday
      const diffToMonday = d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: toYMD(monday), endDate: toYMD(sunday) };
    }

    if (cycle === 'monthly') {
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { startDate: toYMD(firstDay), endDate: toYMD(lastDay) };
    }

    const fallback = toYMD(d);
    return { startDate: fallback, endDate: fallback };
  },

  /**
   * Calculates confirmed revenue within a specific billing cycle.
   * @param {Array} transactions 
   * @param {'daily'|'weekly'|'monthly'} cycle 
   * @param {Date} [referenceDate]
   * @returns {number}
   */
  calculateCycleRevenue(transactions = [], cycle = 'daily', referenceDate = new Date()) {
    const { startDate, endDate } = this.getCycleDates(cycle, referenceDate);
    const cycleTxs = transactions.filter(t => {
      if (!t.isConfirmed && t.source === 'invoice_issued') return false;
      const tDate = t.date || (t.timestamp ? t.timestamp.split('T')[0] : '');
      return tDate >= startDate && tDate <= endDate;
    });

    const sum = cycleTxs.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    return Math.round(sum * 100) / 100;
  },

  /**
   * Constructs the full Stripe checkout redirect URL with tracking parameters.
   * @param {string} [baseUrl] 
   * @param {Object} [params] 
   * @returns {string}
   */
  buildCheckoutUrl(baseUrl = JORGE_STRIPE_CONFIG.paymentLinkUrl, params = {}) {
    try {
      const url = new URL(baseUrl);
      if (params.clientReferenceId) {
        url.searchParams.set('client_reference_id', params.clientReferenceId);
      }
      if (params.prefilledEmail) {
        url.searchParams.set('prefilled_email', params.prefilledEmail);
      }
      return url.toString();
    } catch (e) {
      return baseUrl;
    }
  },

  /**
   * Sets up a user commitment contract in a single call.
   * @param {Object} state 
   * @param {'daily'|'weekly'} cycle 
   * @param {number} [customAmount] 
   * @returns {Object} updated state
   */
  setCommitment(state, cycle = 'daily', customAmount = null) {
    if (!state.monetization) state.monetization = {};
    state.monetization.penaltyEnabled = true;
    state.monetization.penaltyAccepted = true;
    state.monetization.billingCycle = cycle;
    state.monetization.penaltyAmount = customAmount !== null 
      ? Number(customAmount) 
      : (cycle === 'weekly' ? JORGE_STRIPE_CONFIG.defaultWeeklyPenalty : JORGE_STRIPE_CONFIG.defaultDailyPenalty);
    state.monetization.commitmentStartDate = new Date().toISOString();
    return state;
  },

  /**
   * Checks if the upfront billing setup reminder should be displayed today.
   * @param {Object} state 
   * @param {string} todayStr 
   * @returns {boolean}
   */
  shouldShowBillingReminder(state, todayStr) {
    const providers = state.paymentProviders || {};
    const hasActiveGateway = (providers.stripe && providers.stripe.enabled) || 
                             (providers.paypal && providers.paypal.enabled);
    if (hasActiveGateway) return false;

    const reminders = state.reminders || {};
    return reminders.billingDismissedDate !== todayStr;
  },

  /**
   * Checks if the penalty commitment reminder should be displayed today.
   * @param {Object} state 
   * @param {string} todayStr 
   * @returns {boolean}
   */
  shouldShowPenaltyReminder(state, todayStr) {
    const mon = state.monetization || {};
    if (mon.penaltyEnabled && mon.penaltyAccepted) return false;

    const reminders = state.reminders || {};
    return reminders.penaltyDismissedDate !== todayStr;
  },

  /**
   * Dismisses a reminder for the rest of today.
   * @param {Object} state 
   * @param {'billing'|'penalty'} type 
   * @param {string} todayStr 
   * @returns {Object}
   */
  dismissReminder(state, type, todayStr) {
    if (!state.reminders) state.reminders = {};
    if (type === 'billing') state.reminders.billingDismissedDate = todayStr;
    if (type === 'penalty') state.reminders.penaltyDismissedDate = todayStr;
    return state;
  },

  /**
   * Evaluates if a penalty should be recorded for a completed day.
   * @param {Object} monetizationState 
   * @param {number} dailyGoal 
   * @param {number} achievedRevenue 
   * @param {boolean} wasEmergencyUsed 
   * @returns {{ isPenalized: boolean, penaltyAmount: number, reason: string }}
   */
  evaluatePenalty(monetizationState, dailyGoal, achievedRevenue, wasEmergencyUsed = false) {
    if (!monetizationState || !monetizationState.penaltyEnabled || !monetizationState.penaltyAccepted) {
      return { isPenalized: false, penaltyAmount: 0, reason: 'Compromiso voluntario desactivado' };
    }

    if (achievedRevenue >= dailyGoal) {
      return { isPenalized: false, penaltyAmount: 0, reason: 'Objetivo de facturación alcanzado con éxito' };
    }

    if (wasEmergencyUsed) {
      return { isPenalized: false, penaltyAmount: 0, reason: 'Anulación ética de emergencia justificada' };
    }

    const penaltyAmount = Number(monetizationState.penaltyAmount) || JORGE_STRIPE_CONFIG.defaultPenaltyAmount;
    return {
      isPenalized: true,
      penaltyAmount,
      reason: `Meta diaria no cumplida (${achievedRevenue.toFixed(2)}€ / ${dailyGoal.toFixed(2)}€)`
    };
  },

  /**
   * Records a settlement in history and updates pending settlement.
   * @param {Object} state 
   * @param {Object} paymentRecord 
   * @returns {Object} updated state
   */
  applySettlement(state, paymentRecord) {
    if (!state.monetization) {
      state.monetization = {};
    }
    if (!Array.isArray(state.monetization.settlementHistory)) {
      state.monetization.settlementHistory = [];
    }

    const record = {
      id: paymentRecord.id || `settle_${Date.now()}`,
      timestamp: paymentRecord.timestamp || new Date().toISOString(),
      amount: Number(paymentRecord.amount) || 0,
      currency: paymentRecord.currency || 'EUR',
      type: paymentRecord.type || 'success_fee', // 'success_fee' | 'penalty' | 'manual'
      cycle: paymentRecord.cycle || state.monetization.billingCycle || 'daily',
      stripeReference: paymentRecord.stripeReference || 'Stripe Checkout',
      status: paymentRecord.status || 'completed'
    };

    state.monetization.settlementHistory.unshift(record);

    // Recalculate pending settlement
    const currentPending = Number(state.monetization.pendingSettlement) || 0;
    state.monetization.pendingSettlement = Math.max(0, Math.round((currentPending - record.amount) * 100) / 100);
    state.monetization.lastSettlementDate = new Date().toISOString();

    return state;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MonetizationService, JORGE_STRIPE_CONFIG };
}
