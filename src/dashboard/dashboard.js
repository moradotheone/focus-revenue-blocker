/**
 * FocusRevenue Dashboard Controller (SpaceX / Starlink HUD Edition)
 */

let appState = null;
let appProgress = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupTabNavigation();
  await refreshDashboard();
  setupEventListeners();
});

async function refreshDashboard() {
  appState = await StorageService.getState();
  appProgress = BillingEngine.calculateDailyProgress(appState);

  // Sync blocking rules dynamically
  await RuleManager.syncRules(appState, appProgress);

  renderTopBar(appProgress);
  renderOverview(appState, appProgress);
  renderTransactions(appState, appProgress);
  renderSites(appState);
  renderEmergencyHistory(appState);
  renderMonetization(appState, appProgress);
}

function setupTabNavigation() {
  const navItems = document.querySelectorAll('.nav-btn');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.console-tab').forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add('active');

      const tabTitles = {
        'tab-overview': ['CONSOLE // TELEMETRY', 'TELEMETRÍA GENERAL'],
        'tab-billing': ['CONSOLE // LEDGER', 'FACTURACIÓN & COBROS'],
        'tab-sites': ['CONSOLE // SHIELD PROTOCOL', 'ESCUDO DE FOCO'],
        'tab-emergency': ['CONSOLE // OVERRIDE LOG', 'ANULACIÓN DE EMERGENCIA'],
        'tab-monetization': ['CONSOLE // COMMERCIAL MODEL', 'MODELO COMERCIAL & FEE']
      };

      if (tabTitles[tabId]) {
        document.getElementById('deckSectionTag').textContent = tabTitles[tabId][0];
        document.getElementById('pageTitle').textContent = tabTitles[tabId][1];
      }
    });
  });
}

function renderTopBar(p) {
  const indicator = document.getElementById('topStatusIndicator');
  const text = document.getElementById('topStatusText');

  indicator.className = 'hud-status';

  if (p.isEmergencyActive) {
    indicator.classList.add('override');
    text.textContent = `OVERRIDE ACTIVO (${p.emergencyMinutesLeft}M)`;
  } else if (p.isGoalMet) {
    indicator.classList.add('unlocked');
    text.textContent = 'ESCUDO DESACTIVADO';
  } else {
    text.textContent = 'ESCUDO ACTIVO';
  }
}

function renderOverview(state, p) {
  document.getElementById('targetAmountInput').value = state.dailyGoal.targetAmount;
  document.getElementById('currencySelect').value = state.dailyGoal.currency;

  document.getElementById('cardTotalRevenue').textContent = BillingEngine.formatCurrency(p.totalDailyRevenue, p.currency, p.symbol);
  document.getElementById('cardProgressPercent').textContent = `${p.progressPercent}% de meta alcanzada`;
  document.getElementById('cardConfirmedRevenue').textContent = BillingEngine.formatCurrency(p.confirmedTotal, p.currency, p.symbol);
  document.getElementById('cardIssuedRevenue').textContent = BillingEngine.formatCurrency(p.issuedTotal, p.currency, p.symbol);
  document.getElementById('cardFeeEstimated').textContent = BillingEngine.formatCurrency(p.estimatedFee, p.currency, p.symbol);

  const fillEl = document.getElementById('overviewProgressFill');
  const remainingEl = document.getElementById('overviewRemainingText');

  fillEl.style.width = `${Math.min(100, p.progressPercent)}%`;

  if (p.isGoalMet) {
    fillEl.style.background = '#00f59b';
    remainingEl.textContent = 'OBJETIVO CUMPLIDO // ESCUDO LIBERADO';
  } else {
    fillEl.style.background = 'linear-gradient(90deg, #00e5ff 0%, #00f59b 100%)';
    remainingEl.textContent = `DELTA: ${BillingEngine.formatCurrency(p.remainingToGoal, p.currency, p.symbol)}`;
  }

  // Active sites chips
  const chipsContainer = document.getElementById('overviewDomainsChips');
  chipsContainer.innerHTML = '';
  const enabledSites = (state.blockedSites || []).filter(s => s.enabled);
  if (enabledSites.length === 0) {
    chipsContainer.innerHTML = '<span class="card-explainer">No hay vectores bloqueados actualmente.</span>';
  } else {
    enabledSites.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'vector-chip';
      chip.textContent = `🛡️ ${s.domain.toUpperCase()}`;
      chipsContainer.appendChild(chip);
    });
  }
}

function renderTransactions(state, p) {
  const tbody = document.getElementById('txTableBody');
  tbody.innerHTML = '';

  const alertBanner = document.getElementById('duplicateAlertBanner');
  if (p.flaggedDuplicatesCount > 0) {
    alertBanner.classList.remove('hidden');
  } else {
    alertBanner.classList.add('hidden');
  }

  if (!state.transactions || state.transactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: #4e5b6e;">NO HAY TRANSACCIONES REGISTRADAS</td></tr>';
    return;
  }

  state.transactions.forEach((tx, index) => {
    const tr = document.createElement('tr');

    const sourceClassMap = {
      stripe: 'source-stripe',
      paypal: 'source-paypal',
      invoice_issued: 'source-invoice',
      manual: 'source-manual'
    };

    const sourceLabelMap = {
      stripe: 'STRIPE',
      paypal: 'PAYPAL',
      invoice_issued: 'FACTURA',
      manual: 'MANUAL'
    };

    const statusBadge = tx.isConfirmed
      ? '<span class="status-tag confirmed">CONFIRMADO</span>'
      : '<span class="status-tag pending">PENDIENTE</span>';

    const duplicateWarn = tx.potentialDuplicate
      ? '<span class="duplicate-flag">⚠️ POSIBLE DUPLICADO</span>'
      : '';

    const dateFormatted = new Date(tx.timestamp).toLocaleString('es-ES', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    tr.innerHTML = `
      <td>${dateFormatted}</td>
      <td><span class="source-badge ${sourceClassMap[tx.source] || 'source-manual'}">${sourceLabelMap[tx.source] || tx.source}</span></td>
      <td>${escapeHtml(tx.description)} ${duplicateWarn}</td>
      <td><strong>${BillingEngine.formatCurrency(tx.amount, tx.currency || 'EUR')}</strong></td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn-del-icon btn-delete-tx" data-index="${index}" title="Eliminar registro">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.btn-delete-tx').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = Number(e.currentTarget.getAttribute('data-index'));
      appState.transactions.splice(idx, 1);
      await StorageService.setState(appState);
      await refreshDashboard();
    });
  });
}

function renderSites(state) {
  const container = document.getElementById('sitesPresetsList');
  container.innerHTML = '';

  (state.blockedSites || []).forEach((site, index) => {
    const item = document.createElement('div');
    item.className = 'vector-item';
    item.innerHTML = `
      <div class="vector-info">
        <strong>${escapeHtml(site.domain.toUpperCase())}</strong>
        <span>${escapeHtml(site.category || 'PERSONALIZADO')}</span>
      </div>
      <div style="display:flex; align-items:center; gap: 8px;">
        <label class="hud-switch-row">
          <input type="checkbox" class="site-toggle" data-index="${index}" ${site.enabled ? 'checked' : ''}>
          <span class="hud-slider"></span>
        </label>
        ${site.category === 'Personalizado' ? `<button class="btn-del-icon btn-del-domain" data-index="${index}">✕</button>` : ''}
      </div>
    `;
    container.appendChild(item);
  });

  document.querySelectorAll('.site-toggle').forEach(t => {
    t.addEventListener('change', async (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      appState.blockedSites[idx].enabled = e.target.checked;
      await StorageService.setState(appState);
      await refreshDashboard();
    });
  });

  document.querySelectorAll('.btn-del-domain').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = Number(e.currentTarget.getAttribute('data-index'));
      appState.blockedSites.splice(idx, 1);
      await StorageService.setState(appState);
      await refreshDashboard();
    });
  });
}

function renderEmergencyHistory(state) {
  const tbody = document.getElementById('emergencyTableBody');
  tbody.innerHTML = '';

  const history = (state.emergencyExit && state.emergencyExit.history) || [];
  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color:#4e5b6e;">NO SE HAN EJECUTADO ANULACIONES DE EMERGENCIA</td></tr>';
    return;
  }

  history.forEach(item => {
    const tr = document.createElement('tr');
    const dateStr = new Date(item.timestamp).toLocaleString('es-ES', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td><strong>${item.durationMinutes} MIN</strong></td>
      <td>${escapeHtml(item.reason || 'DIRECT OVERRIDE')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMonetization(state, p) {
  const totalAllTime = (state.transactions || []).reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const feeRate = (state.monetization && state.monetization.feePercentage) ? state.monetization.feePercentage / 100 : 0.03;
  const feeAllTime = totalAllTime * feeRate;

  document.getElementById('monetizationTotalRev').textContent = BillingEngine.formatCurrency(totalAllTime, p.currency, p.symbol);
  document.getElementById('monetizationFeeRev').textContent = BillingEngine.formatCurrency(feeAllTime, p.currency, p.symbol);

  const penaltyToggle = document.getElementById('penaltyToggle');
  const penaltyDetails = document.getElementById('penaltyDetails');
  const penaltyAmount = document.getElementById('penaltyAmountInput');

  penaltyToggle.checked = !!(state.monetization && state.monetization.penaltyEnabled);
  if (penaltyToggle.checked) {
    penaltyDetails.classList.remove('hidden');
  } else {
    penaltyDetails.classList.add('hidden');
  }

  if (state.monetization && state.monetization.penaltyAmount) {
    penaltyAmount.value = state.monetization.penaltyAmount;
  }
}

function setupEventListeners() {
  // Goal setting
  document.getElementById('goalSettingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = Number(document.getElementById('targetAmountInput').value);
    const currency = document.getElementById('currencySelect').value;
    const symbolMap = { EUR: '€', USD: '$', GBP: '£' };

    appState.dailyGoal.targetAmount = target;
    appState.dailyGoal.currency = currency;
    appState.dailyGoal.symbol = symbolMap[currency] || '€';

    await StorageService.setState(appState);
    await refreshDashboard();
  });

  // Simulator Buttons
  document.getElementById('btnSimStripe').addEventListener('click', async () => {
    await simulateAndAdd('stripe', 85.00);
  });
  document.getElementById('btnSimPaypal').addEventListener('click', async () => {
    await simulateAndAdd('paypal', 50.00);
  });
  document.getElementById('btnSimInvoice').addEventListener('click', async () => {
    await simulateAndAdd('invoice_issued', 150.00);
  });

  // Add Manual Transaction
  document.getElementById('addTxForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('txType').value;
    const amount = Number(document.getElementById('txAmount').value);
    const desc = document.getElementById('txDescription').value.trim();

    const isConfirmed = type !== 'invoice_issued';
    const newTx = {
      id: 'tx_man_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      date: appState.dailyGoal.date,
      source: type,
      amount,
      currency: appState.dailyGoal.currency,
      description: desc,
      isConfirmed,
      potentialDuplicate: false
    };

    newTx.potentialDuplicate = BillingEngine.detectDuplicates(newTx, appState.transactions);
    appState.transactions.unshift(newTx);
    await StorageService.setState(appState);

    document.getElementById('txAmount').value = '';
    document.getElementById('txDescription').value = '';
    await refreshDashboard();
  });

  // Clear all
  document.getElementById('btnClearAllTxs').addEventListener('click', async () => {
    if (confirm('¿Vaciar el historial de transacciones registradas?')) {
      appState.transactions = [];
      await StorageService.setState(appState);
      await refreshDashboard();
    }
  });

  // Add Custom Domain
  document.getElementById('addCustomDomainForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let domain = document.getElementById('customDomainInput').value.trim();
    domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

    if (domain) {
      if (!appState.blockedSites) appState.blockedSites = [];
      if (!appState.blockedSites.some(s => s.domain === domain)) {
        appState.blockedSites.push({
          domain,
          enabled: true,
          category: 'Personalizado'
        });
        await StorageService.setState(appState);
        document.getElementById('customDomainInput').value = '';
        await refreshDashboard();
      }
    }
  });

  // Trigger Emergency Exit
  document.getElementById('btnTabTriggerEmergency').addEventListener('click', async () => {
    const duration = Number(document.getElementById('tabEmergencyMinutes').value) || 10;
    const reason = document.getElementById('tabEmergencyReason').value.trim() || 'Atención cliente urgente';

    appState.emergencyExit.isActive = true;
    appState.emergencyExit.durationMinutes = duration;
    appState.emergencyExit.expiresAt = Date.now() + (duration * 60 * 1000);
    appState.emergencyExit.reason = reason;
    appState.emergencyExit.history.unshift({
      timestamp: new Date().toISOString(),
      durationMinutes: duration,
      reason
    });

    await StorageService.setState(appState);
    document.getElementById('tabEmergencyReason').value = '';
    await refreshDashboard();
  });

  // Penalty Toggle
  document.getElementById('penaltyToggle').addEventListener('change', async (e) => {
    if (!appState.monetization) appState.monetization = {};
    appState.monetization.penaltyEnabled = e.target.checked;
    appState.monetization.penaltyAccepted = e.target.checked;
    await StorageService.setState(appState);
    await refreshDashboard();
  });

  document.getElementById('penaltyAmountInput').addEventListener('change', async (e) => {
    if (!appState.monetization) appState.monetization = {};
    appState.monetization.penaltyAmount = Number(e.target.value) || 15;
    await StorageService.setState(appState);
  });

  // Quick Add Top
  document.getElementById('btnQuickAddTop').addEventListener('click', () => {
    document.querySelector('[data-tab="tab-billing"]').click();
    document.getElementById('txAmount').focus();
  });
}

async function simulateAndAdd(type, amount) {
  const newTx = BillingEngine.generateMockTransaction(type, amount);
  newTx.potentialDuplicate = BillingEngine.detectDuplicates(newTx, appState.transactions);
  appState.transactions.unshift(newTx);
  await StorageService.setState(appState);
  await refreshDashboard();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
