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
    {
      id: 'tx_init_1',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      date: getTodayString(),
      source: 'stripe',
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
  paymentProviders: {
    stripe: {
      enabled: false,
      apiKey: '',
      lastSync: null,
      lastError: null
    },
    paypal: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      isSandbox: false,
      lastSync: null,
      lastError: null
    },
    autoSyncMinutes: 15
  },
  monetization: {
    feePercentage: 3.0,
    penaltyEnabled: false,
    penaltyAmount: 15.00,
    penaltyAccepted: false
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
            const initial = JSON.parse(JSON.stringify(DEFAULT_STATE));
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

  ensureDateRoll(state) {
    const today = getTodayString();
    let modified = false;

    // Ensure paymentProviders structure exists
    if (!state.paymentProviders) {
      state.paymentProviders = JSON.parse(JSON.stringify(DEFAULT_STATE.paymentProviders));
      modified = true;
    }

    if (state.dailyGoal.date !== today) {
      state.dailyGoal.date = today;
      state.emergencyExit.isActive = false;
      state.emergencyExit.expiresAt = 0;
      modified = true;
    }

    if (state.emergencyExit.isActive && Date.now() >= state.emergencyExit.expiresAt) {
      state.emergencyExit.isActive = false;
      modified = true;
    }

    if (modified) {
      this.setState(state);
    }
    return state;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageService, DEFAULT_STATE, DEFAULT_BLOCKED_DOMAINS, getTodayString };
}
