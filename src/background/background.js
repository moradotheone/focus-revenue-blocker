/**
 * Background Service Worker (Manifest V3)
 * Orchestrates blocking rules, timers, and automatic payment gateway synchronization.
 */

try {
  importScripts('../lib/storage.js', '../lib/billing.js', '../lib/rules.js', '../lib/payments.js');
} catch (e) {
  console.warn('importScripts failed or not supported in this context:', e);
}

// Extension installation or update lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] FocusRevenue Extension installed or updated:', details.reason);
  
  // Create periodic alarm every 1 minute for timer evaluation & payment sync
  chrome.alarms.create('focusRevenueMinuteTick', { periodInMinutes: 1 });
  chrome.alarms.create('focusRevenuePaymentSync', { periodInMinutes: 15 });

  const state = await StorageService.getState();
  const progress = BillingEngine.calculateDailyProgress(state);
  await RuleManager.syncRules(state, progress);

  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'src/dashboard/dashboard.html?welcome=1' });
  }
});

// Periodic alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusRevenueMinuteTick') {
    const state = await StorageService.getState();
    const progress = BillingEngine.calculateDailyProgress(state);
    
    // Check emergency exit expiration
    if (state.emergencyExit && state.emergencyExit.isActive && Date.now() >= state.emergencyExit.expiresAt) {
      state.emergencyExit.isActive = false;
      await StorageService.setState(state);
      await RuleManager.syncRules(state, progress);
      console.log('[Background] Emergency bypass expired. Blocks restored.');
    }
  }

  if (alarm.name === 'focusRevenuePaymentSync') {
    try {
      const state = await StorageService.getState();
      const providers = state.paymentProviders || {};
      const isAnyEnabled = (providers.stripe && providers.stripe.enabled) || 
                           (providers.paypal && providers.paypal.enabled);

      if (isAnyEnabled && typeof PaymentService !== 'undefined') {
        console.log('[Background] Running scheduled payment gateway synchronization...');
        const syncRes = await PaymentService.syncAllAccounts(state);
        if (syncRes.addedCount > 0) {
          await StorageService.setState(state);
          const progress = BillingEngine.calculateDailyProgress(state);
          await RuleManager.syncRules(state, progress);
          console.log(`[Background] Payment sync added ${syncRes.addedCount} new transactions. Rules updated.`);
        }
      }
    } catch (err) {
      console.warn('[Background] Auto payment sync error:', err);
    }
  }
});

// Message listener for communication between popup, dashboard, and blocked page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'GET_STATUS') {
        const state = await StorageService.getState();
        const progress = BillingEngine.calculateDailyProgress(state);
        sendResponse({ success: true, state, progress });
      } 
      else if (message.action === 'SYNC_RULES') {
        const state = await StorageService.getState();
        const progress = BillingEngine.calculateDailyProgress(state);
        await RuleManager.syncRules(state, progress);
        sendResponse({ success: true, progress });
      } 
      else if (message.action === 'SYNC_PAYMENTS_NOW') {
        const state = await StorageService.getState();
        if (typeof PaymentService !== 'undefined') {
          const syncRes = await PaymentService.syncAllAccounts(state);
          await StorageService.setState(state);
          const progress = BillingEngine.calculateDailyProgress(state);
          await RuleManager.syncRules(state, progress);
          sendResponse({ success: true, syncRes, progress });
        } else {
          sendResponse({ success: false, error: 'PaymentService not available' });
        }
      }
      else if (message.action === 'LOG_TRANSACTION') {
        const state = await StorageService.getState();
        const tx = message.transaction;
        
        tx.potentialDuplicate = BillingEngine.detectDuplicates(tx, state.transactions);
        state.transactions.unshift(tx);
        
        await StorageService.setState(state);
        const progress = BillingEngine.calculateDailyProgress(state);
        await RuleManager.syncRules(state, progress);

        sendResponse({ success: true, progress, tx });
      } 
      else if (message.action === 'TRIGGER_EMERGENCY_EXIT') {
        const state = await StorageService.getState();
        const minutes = Number(message.durationMinutes) || 10;
        const reason = message.reason || 'Sin motivo especificado';

        state.emergencyExit.isActive = true;
        state.emergencyExit.durationMinutes = minutes;
        state.emergencyExit.expiresAt = Date.now() + (minutes * 60 * 1000);
        state.emergencyExit.reason = reason;
        state.emergencyExit.history.unshift({
          timestamp: new Date().toISOString(),
          durationMinutes: minutes,
          reason
        });

        await StorageService.setState(state);
        const progress = BillingEngine.calculateDailyProgress(state);
        await RuleManager.syncRules(state, progress);

        sendResponse({ success: true, progress, expiresAt: state.emergencyExit.expiresAt });
      } 
      else if (message.action === 'CANCEL_EMERGENCY_EXIT') {
        const state = await StorageService.getState();
        state.emergencyExit.isActive = false;
        state.emergencyExit.expiresAt = 0;

        await StorageService.setState(state);
        const progress = BillingEngine.calculateDailyProgress(state);
        await RuleManager.syncRules(state, progress);

        sendResponse({ success: true, progress });
      }
    } catch (err) {
      console.error('[Background] Error processing message:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();

  return true;
});
