/**
 * FocusRevenue Popup Controller (SpaceX / Starlink HUD Edition)
 */

let appState = null;
let appProgress = null;
let countdownTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await refreshUI();
  setupEventListeners();
  startCountdownTicker();
});

async function refreshUI() {
  appState = await StorageService.getState();
  appProgress = BillingEngine.calculateDailyProgress(appState);

  // Sync rules dynamically
  await RuleManager.syncRules(appState, appProgress);

  renderProgress(appProgress);
  renderStatusBadge(appProgress);
  renderEmergencyBanner(appProgress, appState);
}

function renderProgress(p) {
  const currentEl = document.getElementById('currentRevenue');
  const targetEl = document.getElementById('targetRevenue');
  const percentBadge = document.getElementById('percentBadge');
  const fillEl = document.getElementById('progressBarFill');
  const subtextEl = document.getElementById('progressSubtext');
  const confirmedEl = document.getElementById('confirmedVal');
  const issuedEl = document.getElementById('issuedVal');
  const feeEl = document.getElementById('feeVal');
  const dateEl = document.getElementById('currentDateLabel');

  dateEl.textContent = `SYS.DATE: ${p.today}`;
  currentEl.textContent = BillingEngine.formatCurrency(p.totalDailyRevenue, p.currency, p.symbol);
  targetEl.textContent = BillingEngine.formatCurrency(p.target, p.currency, p.symbol);
  percentBadge.textContent = `${p.progressPercent}%`;
  fillEl.style.width = `${Math.min(100, p.progressPercent)}%`;

  if (p.isGoalMet) {
    subtextEl.innerHTML = `TARGET ACHIEVED // ALL VECTORS CLEARED`;
    fillEl.style.background = '#00f59b';
    fillEl.style.boxShadow = '0 0 10px rgba(0, 245, 155, 0.4)';
  } else {
    subtextEl.innerHTML = `DELTA: <strong>${BillingEngine.formatCurrency(p.remainingToGoal, p.currency, p.symbol)}</strong> TO CLEAR SHIELD`;
    fillEl.style.background = 'linear-gradient(90deg, #00e5ff 0%, #00f59b 100%)';
    fillEl.style.boxShadow = '0 0 10px rgba(0, 229, 255, 0.4)';
  }

  confirmedEl.textContent = BillingEngine.formatCurrency(p.confirmedTotal, p.currency, p.symbol);
  issuedEl.textContent = BillingEngine.formatCurrency(p.issuedTotal, p.currency, p.symbol);
  feeEl.textContent = BillingEngine.formatCurrency(p.estimatedFee, p.currency, p.symbol);
}

function renderStatusBadge(p) {
  const badge = document.getElementById('statusBadge');
  const text = document.getElementById('statusText');

  badge.className = 'hud-status-badge';

  if (p.isEmergencyActive) {
    badge.classList.add('status-override');
    text.textContent = 'OVERRIDE ACTIVE';
  } else if (p.isGoalMet) {
    badge.classList.add('status-unlocked');
    text.textContent = 'CLEARED';
  } else {
    badge.classList.add('status-locked');
    text.textContent = 'LOCK ACTIVE';
  }
}

function renderEmergencyBanner(p, state) {
  const banner = document.getElementById('emergencyBanner');
  const countdown = document.getElementById('emergencyCountdown');

  if (p.isEmergencyActive && state.emergencyExit.expiresAt > Date.now()) {
    banner.classList.remove('hidden');
    const remainingSec = Math.max(0, Math.floor((state.emergencyExit.expiresAt - Date.now()) / 1000));
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    countdown.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs} REMAINING (${state.emergencyExit.reason || 'DIRECT OVERRIDE'})`;
  } else {
    banner.classList.add('hidden');
  }
}

function startCountdownTicker() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(async () => {
    if (appProgress && appProgress.isEmergencyActive) {
      if (Date.now() >= appState.emergencyExit.expiresAt) {
        await refreshUI();
      } else {
        renderEmergencyBanner(appProgress, appState);
      }
    }
  }, 1000);
}

function setupEventListeners() {
  // Quick injection buttons
  document.querySelectorAll('.btn-hud-chip').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const type = e.target.getAttribute('data-type');
      const amount = Number(e.target.getAttribute('data-amount'));
      await addIncome(type, amount);
    });
  });

  // Custom injection form
  const form = document.getElementById('customIncomeForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('inputAmount').value);
    const type = document.getElementById('inputType').value;
    if (amount > 0) {
      await addIncome(type, amount);
      document.getElementById('inputAmount').value = '';
    }
  });

  // Emergency Modal
  const emergencyModal = document.getElementById('emergencyModal');
  const btnTrigger = document.getElementById('btnEmergencyTrigger');
  const btnClose = document.getElementById('btnCloseModal');
  const btnConfirm = document.getElementById('btnConfirmEmergency');
  const btnCancelEmergency = document.getElementById('btnCancelEmergency');

  btnTrigger.addEventListener('click', () => {
    emergencyModal.classList.remove('hidden');
  });

  btnClose.addEventListener('click', () => {
    emergencyModal.classList.add('hidden');
  });

  btnConfirm.addEventListener('click', async () => {
    const duration = Number(document.getElementById('emergencyDuration').value) || 10;
    const reason = document.getElementById('emergencyReason').value.trim() || 'Gestión cliente urgente';

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
    emergencyModal.classList.add('hidden');
    document.getElementById('emergencyReason').value = '';
    await refreshUI();
  });

  btnCancelEmergency.addEventListener('click', async () => {
    appState.emergencyExit.isActive = false;
    appState.emergencyExit.expiresAt = 0;
    await StorageService.setState(appState);
    await refreshUI();
  });

  // Open Mission Control (Dashboard)
  document.getElementById('btnOpenDashboard').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../dashboard/dashboard.html', '_blank');
    }
  });
}

async function addIncome(type, amount) {
  const newTx = BillingEngine.generateMockTransaction(type, amount);
  newTx.potentialDuplicate = BillingEngine.detectDuplicates(newTx, appState.transactions);

  appState.transactions.unshift(newTx);
  await StorageService.setState(appState);
  await refreshUI();
}
