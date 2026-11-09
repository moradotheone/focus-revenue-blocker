/**
 * Dynamic Rule Management for declarativeNetRequest (Manifest V3)
 * Redirects distracting websites to the FocusRevenue block page
 * when daily revenue target is not yet achieved.
 */

const RuleManager = {
  /**
   * Updates declarativeNetRequest rules according to current state.
   */
  async syncRules(state, progress) {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
      console.log('[RuleManager] declarativeNetRequest not available in this environment.');
      return;
    }

    try {
      // Get existing dynamic rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map(r => r.id);

      // If unlocked (goal achieved or emergency exit active), remove all blocking rules
      if (progress.isUnlocked) {
        if (existingRuleIds.length > 0) {
          await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: []
          });
          console.log('[RuleManager] All blocks cleared: Target reached or Emergency Exit active.');
        }
        return;
      }

      // Generate rules for all enabled blocked domains
      const blockedSites = (state.blockedSites || []).filter(site => site.enabled);
      const newRules = blockedSites.map((site, index) => {
        // Clean domain format (e.g. 'twitter.com')
        const cleanDomain = site.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
        return {
          id: index + 100,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              extensionPath: `/src/blocked/blocked.html?blocked=${encodeURIComponent(cleanDomain)}`
            }
          },
          condition: {
            urlFilter: `||${cleanDomain}/`,
            resourceTypes: ['main_frame']
          }
        };
      });

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: newRules
      });

      console.log(`[RuleManager] Applied ${newRules.length} dynamic blocking rules.`);
    } catch (err) {
      console.error('[RuleManager] Failed to sync declarativeNetRequest rules:', err);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RuleManager };
}
