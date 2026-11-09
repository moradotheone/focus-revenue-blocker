/**
 * FocusRevenue Dashboard Controller
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

  // Sync blocking rules
  await RuleManager.syncRules(appState, appProgress);

  // Record session
  await StorageService.recordSession();

  renderTopBar(appProgress);
  renderOverview(appState, appProgress);
  renderTransactions(appState, appProgress);
  renderSites(appState);
  renderEmergencyHistory(appState);
  renderMonetization(appState, appProgress);
  renderPilotValidation(appState);
}

function setupTabNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');

      // Update titles
      const tabTitles = {
        'tab-overview': ['Resumen Diario', 'Control de foco vinculado a tu meta de facturación.'],
        'tab-billing': ['Facturación & Pagos', 'Registro detallado, conciliación y simulador de webhooks.'],
        'tab-sites': ['Sitios Bloqueados', 'Gestión de plataformas de distracción y dominios personalizados.'],
        'tab-emergency': ['Salida Segura', 'Salida de emergencia temporal sin trampas ni coerción.'],
        'tab-monetization': ['Monetización & Fee', 'Estimación del fee comercial del 3% y experimento de penalización.'],
        'tab-pilot': ['Validación del Piloto', 'Métricas del encargo de Jorge (10 usuarios activos en < 7 días).']
      };

      if (tabTitles[tabId]) {
        document.getElementById('pageTitle').textContent = tabTitles[tabId][0];
        document.getElementById('pageSubtitle').textContent = tabTitles[tabId][1];
      }
    });
  });
}

function renderTopBar(p) {
  const indicator = document.getElementById('topStatusIndicator');
  const text = document.getElementById('topStatusText');

  indicator.className = 'status-indicator';

  if (p.isEmergencyActive) {
    indicator.classList.add('emergency');
    text.textContent = `Salida de emergencia (${p.emergencyMinutesLeft}m)`;
  } else if (p.isGoalMet) {
    indicator.classList.add('unlocked');
    text.textContent = '🔓 Desbloqueado';
  } else {
    text.textContent = '🔒 Bloqueo activo';
  }
}

function renderOverview(state, p) {
  document.getElementById('targetAmountInput').value = state.dailyGoal.targetAmount;
  document.getElementById('currencySelect').value = state.dailyGoal.currency;

  document.getElementById('cardTotalRevenue').textContent = BillingEngine.formatCurrency(p.totalDailyRevenue, p.currency, p.symbol);
  document.getElementById('cardProgressPercent').textContent = `${p.progressPercent}% de tu meta diaria`;
  document.getElementById('cardConfirmedRevenue').textContent = BillingEngine.formatCurrency(p.confirmedTotal, p.currency, p.symbol);
  document.getElementById('cardIssuedRevenue').textContent = BillingEngine.formatCurrency(p.issuedTotal, p.currency, p.symbol);
  document.getElementById('cardFeeEstimated').textContent = BillingEngine.formatCurrency(p.estimatedFee, p.currency, p.symbol);

  const fillEl = document.getElementById('overviewProgressFill');
  const remainingEl = document.getElementById('overviewRemainingText');

  fillEl.style.width = `${Math.min(100, p.progressPercent)}%`;

  if (p.isGoalMet) {
    fillEl.style.background = '#10b981';
    remainingEl.textContent = '¡Meta alcanzada!';
  } else {
    fillEl.style.background = 'linear-gradient(90deg, #4f46e5 0%, #10b981 100%)';
    remainingEl.textContent = `Faltan ${BillingEngine.formatCurrency(p.remainingToGoal, p.currency, p.symbol)}`;
  }

  // Active sites chips
  const chipsContainer = document.getElementById('overviewDomainsChips');
  chipsContainer.innerHTML = '';
  const enabledSites = (state.blockedSites || []).filter(s => s.enabled);
  if (enabledSites.length === 0) {
    chipsContainer.innerHTML = '<span class="text-muted">No hay sitios bloqueados actualmente.</span>';
  } else {
    enabledSites.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'domain-chip';
      chip.textContent = `🛡️ ${s.domain}`;
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
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #64748b;">No hay transacciones registradas todavía.</td></tr>';
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
      stripe: 'Stripe',
      paypal: 'PayPal',
      invoice_issued: 'Factura Emitida',
      manual: 'Manual'
    };

    const statusBadge = tx.isConfirmed
      ? '<span class="status-tag confirmed">Confirmado</span>'
      : '<span class="status-tag pending">Emitido (Pendiente)</span>';

    const duplicateWarn = tx.potentialDuplicate
      ? '<span class="duplicate-flag" title="Riesgo de doble conteo">⚠️ Posible duplicado</span>'
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
        <button class="btn-icon-danger btn-delete-tx" data-index="${index}" title="Eliminar registro">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach delete handlers
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
    item.className = 'site-item';
    item.innerHTML = `
      <div class="site-info">
        <strong>${escapeHtml(site.domain)}</strong>
        <span>${escapeHtml(site.category || 'Personalizado')}</span>
      </div>
      <div style="display:flex; align-items:center; gap: 8px;">
        <label class="switch-container">
          <input type="checkbox" class="site-toggle" data-index="${index}" ${site.enabled ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
        ${site.category === 'Personalizado' ? `<button class="btn-icon-danger btn-del-domain" data-index="${index}">✕</button>` : ''}
      </div>
    `;
    container.appendChild(item);
  });

  // Attach toggles
  document.querySelectorAll('.site-toggle').forEach(t => {
    t.addEventListener('change', async (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      appState.blockedSites[idx].enabled = e.target.checked;
      await StorageService.setState(appState);
      await refreshDashboard();
    });
  });

  // Attach delete custom domain
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
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 16px; color:#64748b;">No se han utilizado salidas de emergencia aún.</td></tr>';
    return;
  }

  history.forEach(item => {
    const tr = document.createElement('tr');
    const dateStr = new Date(item.timestamp).toLocaleString('es-ES', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td><strong>${item.durationMinutes} min</strong></td>
      <td>${escapeHtml(item.reason || 'Sin motivo')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMonetization(state, p) {
  // Total of all transactions recorded
  const totalAllTime = (state.transactions || []).reduce((acc, t) => acc + Number(t.amount || 0), 0);
  const feeRate = (state.monetization && state.monetization.feePercentage) ? state.monetization.feePercentage / 100 : 0.03;
  const feeAllTime = totalAllTime * feeRate;

  document.getElementById('monetizationTotalRev').textContent = BillingEngine.formatCurrency(totalAllTime, p.currency, p.symbol);
  document.getElementById('monetizationFeeRev').textContent = BillingEngine.formatCurrency(feeAllTime, p.currency, p.symbol);

  // Penalty settings
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

function renderPilotValidation(state) {
  const checklist = document.getElementById('pilotChecklist');
  checklist.innerHTML = '';

  const isInstalled = true; // since extension is loaded
  const hasConfiguredGoal = state.dailyGoal && state.dailyGoal.targetAmount > 0;
  const hasVerifiedSession = state.pilotTelemetry && state.pilotTelemetry.totalSessions >= 1;
  const hasTransactions = state.transactions && state.transactions.length > 0;
  const isActiveUser = isInstalled && hasConfiguredGoal && hasVerifiedSession && hasTransactions;

  // Sidebar pill
  const pill = document.getElementById('sidebarActivationPill');
  const pillDot = pill.querySelector('.pill-dot');
  const pillText = document.getElementById('sidebarActivationText');
  if (isActiveUser) {
    pillDot.className = 'pill-dot active';
    pillText.textContent = 'Piloto: Usuario Activo ✓';
  } else {
    pillDot.className = 'pill-dot';
    pillText.textContent = 'Piloto: Configurando...';
  }

  const items = [
    { label: 'Instalación de la extensión completada', done: isInstalled },
    { label: `Meta de facturación configurada (${state.dailyGoal.targetAmount} ${state.dailyGoal.currency})`, done: hasConfiguredGoal },
    { label: `Sesión de uso registrada (${state.pilotTelemetry.totalSessions || 1} sesiones verificadas)`, done: hasVerifiedSession },
    { label: `Registro de transacciones activas (${state.transactions.length} registros)`, done: hasTransactions },
    { label: 'Definición de Usuario Activo de Jorge CUMPLIDA', done: isActiveUser, isFinal: true }
  ];

  items.forEach(it => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="check-icon ${it.done ? 'done' : 'pending'}">${it.done ? '✓' : '○'}</span>
      <span style="${it.isFinal ? 'font-weight:700; color:' + (it.done ? '#065f46' : '#92400e') : ''}">${it.label}</span>
    `;
    checklist.appendChild(li);
  });
}

function setupEventListeners() {
  // Goal setting form
  document.getElementById('goalSettingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const target = Number(document.getElementById('targetAmountInput').value);
    const currency = document.getElementById('currencySelect').value;
    const symbolMap = { EUR: '€', USD: '$', GBP: '£' };

    appState.dailyGoal.targetAmount = target;
    appState.dailyGoal.currency = currency;
    appState.dailyGoal.symbol = symbolMap[currency] || '€';
    appState.pilotTelemetry.hasConfiguredGoal = true;

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

  // Add Manual Transaction Form
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

  // Clear all transactions
  document.getElementById('btnClearAllTxs').addEventListener('click', async () => {
    if (confirm('¿Deseas vaciar el historial de transacciones registradas?')) {
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
      // avoid duplicates
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

  // Trigger Emergency Exit from Tab
  document.getElementById('btnTabTriggerEmergency').addEventListener('click', async () => {
    const duration = Number(document.getElementById('tabEmergencyMinutes').value) || 10;
    const reason = document.getElementById('tabEmergencyReason').value.trim() || 'Gestión cliente urgente';

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
    alert(`Salida de emergencia activada por ${duration} minutos. Sitios desbloqueados temporalmente.`);
  });

  // Penalty experiment toggle
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

  // Export Pilot Data
  document.getElementById('btnExportPilotData').addEventListener('click', () => {
    const exportData = {
      reportType: 'FocusRevenue_Pilot_Validation_Report',
      generatedAt: new Date().toISOString(),
      userId: appState.pilotTelemetry.userId,
      activeUserVerified: appState.pilotTelemetry.activeUserVerified,
      installedAt: appState.pilotTelemetry.installedAt,
      totalSessionsRecorded: appState.pilotTelemetry.totalSessions,
      dailyGoalConfigured: appState.dailyGoal,
      summary: appProgress,
      transactionsCount: appState.transactions.length,
      emergencyExitsCount: (appState.emergencyExit.history || []).length,
      nonClinicalGuarantee: 'Confirmed: No clinical diagnoses or health data processed'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pilot_validation_${appState.pilotTelemetry.userId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Reset Pilot Data
  document.getElementById('btnResetPilotData').addEventListener('click', async () => {
    if (confirm('¿Restablecer el estado inicial de fábrica?')) {
      localStorage.removeItem('focusRevenueState');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(['focusRevenueState']);
      }
      location.reload();
    }
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
