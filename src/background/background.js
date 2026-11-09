/**
 * Background Service Worker (Manifest V3)
 * Orchestrates blocking rules, timers, and storage synchronization.
 */

try {
  importScripts('../lib/storage.js', '../lib/billing.js', '../lib/rules.js');
} catch (e) {
  console.warn('importScripts failed or not supported in this context:', e);
}

// Ensure alarm for periodic checks (emergency exit countdown and midnight rollover)
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] FocusRevenue Extension installed or updated:', details.reason);
  
  // Create periodic alarm every 1 minute for timer evaluation
  chrome.alarms.create('focusRevenueMinuteTick', { periodInMinutes: 1 });

  // Initialize or fetch state
  const state = await StorageService.getState();
  const progress = BillingEngine.calculateDailyProgress(state);
  await RuleManager.syncRules(state, progress);

  // If first install, open the dashboard to guide the user through onboarding
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'src/dashboard/dashboard.html?onboarding=1' });
  }
});

// Periodic alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusRevenueMinuteTick') {
    const state = await StorageService.getState();
    const progress = BillingEngine.calculateDailyProgress(state);
    
    // If emergency exit just expired, refresh rules
    if (state.emergencyExit && state.emergencyExit.isActive && Date.now() >= state.emergencyExit.expiresAt) {
      state.emergencyExit.isActive = false;
      await StorageService.setState(state);
      await RuleManager.syncRules(state, progress);
      console.log('[Background] Emergency bypass expired. Blocks restored.');
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
      else if (message.action === 'LOG_TRANSACTION') {
        const state = await StorageService.getState();
        const tx = message.transaction;
        
        // Detect duplicates
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

  // Keep channel open for async response
  return true;
});
