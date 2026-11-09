/**
 * Storage Abstraction Layer for FocusRevenue MVP
 * Works seamlessly in Chrome Extension (chrome.storage.local)
 * and in standard web preview mode (window.localStorage).
 */

const DEFAULT_BLOCKED_DOMAINS = [
  { domain: 'twitter.com', enabled: true, category: 'Redes sociales' },
  { domain: 'x.com', enabled: true, category: 'Redes sociales' },
  { domain: 'youtube.com', enabled: true, category: 'Video y Streaming' },
  { domain: 'instagram.com', enabled: true, category: 'Redes sociales' },
  { domain: 'reddit.com', enabled: true, category: 'Foros y agregadores' },
  { domain: 'tiktok.com', enabled: true, category: 'Redes sociales' },
  { domain: 'linkedin.com', enabled: false, category: 'Profesional (opcional)' },
  { domain: 'facebook.com', enabled: true, category: 'Redes sociales' },
  { domain: 'twitch.tv', enabled: true, category: 'Video y Streaming' }
];

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_STATE = {
  dailyGoal: {
    targetAmount: 200,
    currency: 'EUR',
    symbol: '€',
    date: getTodayString()
  },
  transactions: [
    // Pre-loaded realistic sample transaction for first impression / onboarding
    {
      id: 'tx_init_1',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      date: getTodayString(),
      source: 'stripe', // 'stripe' | 'paypal' | 'invoice_issued' | 'manual'
      amount: 75.00,
      currency: 'EUR',
      description: 'Stripe: Cobro consultoría estrategia #41',
      isConfirmed: true,
      potentialDuplicate: false
    }
  ],
  blockedSites: DEFAULT_BLOCKED_DOMAINS,
  emergencyExit: {
    isActive: false,
    expiresAt: 0,
    reason: '',
    durationMinutes: 0,
    history: []
  },
  monetization: {
    feePercentage: 3.0, // 3% fee decided by Jorge as commercial base
    penaltyEnabled: false,
    penaltyAmount: 15.00,
    penaltyAccepted: false
  },
  pilotTelemetry: {
    userId: 'usr_' + Math.random().toString(36).substring(2, 10),
    installedAt: new Date().toISOString(),
    hasConfiguredGoal: true,
    totalSessions: 1,
    lastSessionDate: getTodayString(),
    activeUserVerified: false, // will evaluate based on Jorge's definition
    nonClinicalAccepted: true
  }
};

const StorageService = {
  isExtensionEnv() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  async getState() {
    return new Promise((resolve) => {
      if (this.isExtensionEnv()) {
        chrome.storage.local.get(['focusRevenueState'], (result) => {
          if (result && result.focusRevenueState) {
            resolve(this.ensureDateRoll(result.focusRevenueState));
          } else {
            const initial = { ...DEFAULT_STATE };
            this.setState(initial).then(() => resolve(initial));
          }
        });
      } else {
        const stored = localStorage.getItem('focusRevenueState');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            resolve(this.ensureDateRoll(parsed));
          } catch (e) {
            resolve(DEFAULT_STATE);
          }
        } else {
          localStorage.setItem('focusRevenueState', JSON.stringify(DEFAULT_STATE));
          resolve(DEFAULT_STATE);
        }
      }
    });
  },

  async setState(newState) {
    // Check active user definition
    newState.pilotTelemetry.activeUserVerified = this.evaluateActiveUser(newState);

    return new Promise((resolve) => {
      if (this.isExtensionEnv()) {
        chrome.storage.local.set({ focusRevenueState: newState }, () => {
          resolve(newState);
        });
      } else {
        localStorage.setItem('focusRevenueState', JSON.stringify(newState));
        resolve(newState);
      }
    });
  },

  // If a new day arrives, rollover daily goal date and clean emergency exit
  ensureDateRoll(state) {
    const today = getTodayString();
    let modified = false;

    if (state.dailyGoal.date !== today) {
      state.dailyGoal.date = today;
      state.emergencyExit.isActive = false;
      state.emergencyExit.expiresAt = 0;
      modified = true;
    }

    // Check emergency exit expiration
    if (state.emergencyExit.isActive && Date.now() >= state.emergencyExit.expiresAt) {
      state.emergencyExit.isActive = false;
      modified = true;
    }

    if (modified) {
      this.setState(state);
    }
    return state;
  },

  // Criteria according to Jorge's validation doc:
  // "activo = usuario único que instala la extensión disponible, configura un objetivo y registra una sesión de uso verificable"
  evaluateActiveUser(state) {
    const goalConfigured = state.dailyGoal && state.dailyGoal.targetAmount > 0;
    const sessionRecorded = state.pilotTelemetry && state.pilotTelemetry.totalSessions >= 1;
    const hasTransactions = state.transactions && state.transactions.length > 0;
    return !!(goalConfigured && sessionRecorded && hasTransactions);
  },

  async recordSession() {
    const state = await this.getState();
    const today = getTodayString();
    if (state.pilotTelemetry.lastSessionDate !== today) {
      state.pilotTelemetry.totalSessions = (state.pilotTelemetry.totalSessions || 0) + 1;
      state.pilotTelemetry.lastSessionDate = today;
      await this.setState(state);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageService, DEFAULT_STATE, DEFAULT_BLOCKED_DOMAINS, getTodayString };
}
