/**
 * FocusRevenue — Payment Gateway Integration Engine (Stripe & PayPal)
 * Compliant with Jorge's shared payment architecture specifications:
 * - Direct integration via official APIs
 * - Minimal read-only permissions
 * - Zero buyer PII retention (no card numbers, emails or personal data)
 * - Safe credential storage in chrome.storage.local
 */

const PaymentService = {
  /**
   * Tests a Stripe Restricted or Secret Key by requesting account balance
   */
  async testStripeConnection(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return { success: false, error: 'API Key de Stripe requerida.' };
    }

    const cleanKey = apiKey.trim();
    try {
      const response = await fetch('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanKey}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return { 
          success: false, 
          error: data.error ? data.error.message : `Error de conexión Stripe HTTP ${response.status}` 
        };
      }

      return { 
        success: true, 
        livemode: data.livemode,
        currencies: (data.available || []).map(b => b.currency.toUpperCase())
      };
    } catch (err) {
      return { success: false, error: `Fallo de red al contactar con Stripe: ${err.message}` };
    }
  },

  /**
   * Fetches Stripe charges and succeeded payment intents created since midnight of the target date
   */
  async fetchStripeDailyRevenue(apiKey, targetDateStr = null) {
    if (!apiKey || apiKey.trim() === '') return { success: false, error: 'Clave no configurada' };

    const cleanKey = apiKey.trim();
    const targetDate = targetDateStr ? new Date(`${targetDateStr}T00:00:00`) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const startTimestamp = Math.floor(targetDate.getTime() / 1000);

    try {
      // Query charges created today
      const url = `https://api.stripe.com/v1/charges?created[gte]=${startTimestamp}&limit=100`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${cleanKey}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error ? data.error.message : 'Error al consultar cargos de Stripe' };
      }

      const charges = data.data || [];
      const normalizedTxs = [];

      for (const ch of charges) {
        // Only count succeeded / paid charges
        if (ch.status === 'succeeded' && ch.paid === true) {
          const amount = ch.amount / 100;
          const currency = (ch.currency || 'eur').toUpperCase();
          const txDate = new Date(ch.created * 1000).toISOString().split('T')[0];

          normalizedTxs.push({
            id: `stripe_${ch.id}`,
            timestamp: new Date(ch.created * 1000).toISOString(),
            date: txDate,
            source: 'stripe',
            amount: Math.round(amount * 100) / 100,
            currency,
            description: ch.description || `Cobro Stripe (${ch.id.slice(-6)})`,
            isConfirmed: true,
            externalId: ch.id,
            potentialDuplicate: false
          });
        }
      }

      return { success: true, transactions: normalizedTxs };
    } catch (err) {
      return { success: false, error: `Excepción de red Stripe: ${err.message}` };
    }
  },

  /**
   * Obtains a PayPal OAuth2 Access Token using Client ID & Secret
   */
  async getPayPalAccessToken(clientId, clientSecret, isSandbox = false) {
    const baseUrl = isSandbox 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    const auth = btoa(`${clientId.trim()}:${clientSecret.trim()}`);
    try {
      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      const data = await response.json();
      if (!response.ok) {
        return { 
          success: false, 
          error: data.error_description || data.message || `Error PayPal HTTP ${response.status}` 
        };
      }

      return { 
        success: true, 
        accessToken: data.access_token, 
        expiresIn: data.expires_in,
        baseUrl
      };
    } catch (err) {
      return { success: false, error: `Fallo de red PayPal OAuth: ${err.message}` };
    }
  },

  /**
   * Tests PayPal connection
   */
  async testPayPalConnection(clientId, clientSecret, isSandbox = false) {
    const tokenResult = await this.getPayPalAccessToken(clientId, clientSecret, isSandbox);
    if (!tokenResult.success) {
      return { success: false, error: tokenResult.error };
    }
    return { success: true, mode: isSandbox ? 'SANDBOX' : 'LIVE' };
  },

  /**
   * Fetches PayPal transactions for the current date
   */
  async fetchPayPalDailyRevenue(clientId, clientSecret, isSandbox = false, targetDateStr = null) {
    const tokenResult = await this.getPayPalAccessToken(clientId, clientSecret, isSandbox);
    if (!tokenResult.success) {
      return { success: false, error: tokenResult.error };
    }

    const { accessToken, baseUrl } = tokenResult;
    const now = new Date();
    const startDate = targetDateStr ? new Date(`${targetDateStr}T00:00:00.000Z`) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    const endDate = new Date(startDate.getTime() + 86399000); // end of that UTC day

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    try {
      const url = `${baseUrl}/v1/reporting/transactions?start_date=${encodeURIComponent(startIso)}&end_date=${encodeURIComponent(endIso)}&fields=transaction_info&page_size=100`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Error al obtener transacciones de PayPal' };
      }

      const txDetails = data.transaction_details || [];
      const normalizedTxs = [];

      for (const item of txDetails) {
        const info = item.transaction_info;
        if (!info) continue;

        // Only count completed incoming payments
        if (info.transaction_status === 'S' && info.transaction_amount && Number(info.transaction_amount.value) > 0) {
          const amount = Number(info.transaction_amount.value);
          const currency = (info.transaction_amount.currency_code || 'EUR').toUpperCase();
          const txTimestamp = info.transaction_initiation_date || new Date().toISOString();
          const txDate = txTimestamp.split('T')[0];

          normalizedTxs.push({
            id: `paypal_${info.transaction_id}`,
            timestamp: txTimestamp,
            date: txDate,
            source: 'paypal',
            amount: Math.round(amount * 100) / 100,
            currency,
            description: info.transaction_subject || `Cobro PayPal (${info.transaction_id.slice(-6)})`,
            isConfirmed: true,
            externalId: info.transaction_id,
            potentialDuplicate: false
          });
        }
      }

      return { success: true, transactions: normalizedTxs };
    } catch (err) {
      return { success: false, error: `Excepción de red PayPal: ${err.message}` };
    }
  },

  /**
   * Synchronizes all active payment accounts and merges transactions into state
   */
  async syncAllAccounts(state) {
    const providers = state.paymentProviders || {};
    const today = state.dailyGoal.date;
    const newTransactions = [];
    const log = [];

    // 1. Stripe sync
    if (providers.stripe && providers.stripe.enabled && providers.stripe.apiKey) {
      log.push('Consultando Stripe API...');
      const stripeRes = await this.fetchStripeDailyRevenue(providers.stripe.apiKey, today);
      if (stripeRes.success) {
        providers.stripe.lastSync = new Date().toISOString();
        providers.stripe.lastError = null;
        newTransactions.push(...stripeRes.transactions);
        log.push(`Stripe: ${stripeRes.transactions.length} transacciones procesadas.`);
      } else {
        providers.stripe.lastError = stripeRes.error;
        log.push(`Stripe error: ${stripeRes.error}`);
      }
    }

    // 2. PayPal sync
    if (providers.paypal && providers.paypal.enabled && providers.paypal.clientId && providers.paypal.clientSecret) {
      log.push('Consultando PayPal REST API...');
      const paypalRes = await this.fetchPayPalDailyRevenue(
        providers.paypal.clientId,
        providers.paypal.clientSecret,
        providers.paypal.isSandbox,
        today
      );
      if (paypalRes.success) {
        providers.paypal.lastSync = new Date().toISOString();
        providers.paypal.lastError = null;
        newTransactions.push(...paypalRes.transactions);
        log.push(`PayPal: ${paypalRes.transactions.length} transacciones procesadas.`);
      } else {
        providers.paypal.lastError = paypalRes.error;
        log.push(`PayPal error: ${paypalRes.error}`);
      }
    }

    // Merge transactions into state.transactions without duplicates
    if (!state.transactions) state.transactions = [];
    const existingIds = new Set(state.transactions.map(t => t.id));
    let addedCount = 0;

    for (const tx of newTransactions) {
      if (!existingIds.has(tx.id)) {
        // Detect potential double counting against invoices
        tx.potentialDuplicate = BillingEngine.detectDuplicates(tx, state.transactions);
        state.transactions.unshift(tx);
        existingIds.add(tx.id);
        addedCount++;
      }
    }

    state.paymentProviders = providers;
    return { addedCount, totalFound: newTransactions.length, log };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PaymentService };
}
