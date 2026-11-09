/**
 * Blocked Interstitial Controller
 */

let appState = null;
let appProgress = null;
let targetDomain = '';

const MOTIVATIONAL_QUOTES = [
  "«Factura primero, scrollea después. Tu atención es el activo más caro de tu negocio.»",
  "«El scroll pasivo no paga tus servidores ni tus facturas. El valor para tus clientes sí.»",
  "«Cada venta confirmada hoy es libertad y foco para mañana.»",
  "«Cierra la siguiente llamada, emite la siguiente propuesta. Las redes seguirán ahí cuando termines.»",
  "«La fricción no es tu enemiga: es el guardián de tus ingresos.»"
];

document.addEventListener('DOMContentLoaded', async () => {
  parseTargetDomain();
  selectRandomQuote();
  await refreshData();
  setupEventListeners();
});

function parseTargetDomain() {
  const urlParams = new URLSearchParams(window.location.search);
  targetDomain = urlParams.get('blocked') || 'sitio-web-restringido';
  document.getElementById('blockedDomainTag').textContent = targetDomain;
}

function selectRandomQuote() {
  const quoteEl = document.getElementById('quoteText');
  const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  quoteEl.textContent = MOTIVATIONAL_QUOTES[randomIndex];
}

async function refreshData() {
  appState = await StorageService.getState();
  appProgress = BillingEngine.calculateDailyProgress(appState);

  // If goal is already met or emergency is active, reveal success / unlock immediately
  if (appProgress.isUnlocked) {
    showUnlockedState();
    return;
  }

  renderProgress(appProgress);
}

function renderProgress(p) {
  const currentEl = document.getElementById('currentRevText');
  const targetEl = document.getElementById('targetRevText');
  const percentText = document.getElementById('progressPercentText');
  const fillEl = document.getElementById('meterFill');
  const calloutEl = document.getElementById('remainingCallout');

  currentEl.textContent = BillingEngine.formatCurrency(p.totalDailyRevenue, p.currency, p.symbol);
  targetEl.textContent = BillingEngine.formatCurrency(p.target, p.currency, p.symbol);
  percentText.textContent = `${p.progressPercent}%`;
  fillEl.style.width = `${Math.min(100, p.progressPercent)}%`;

  calloutEl.innerHTML = `Te faltan <strong>${BillingEngine.formatCurrency(p.remainingToGoal, p.currency, p.symbol)}</strong> para desbloquear las distracciones hoy.`;
}

function showUnlockedState() {
  document.getElementById('meterFill').style.width = '100%';
  document.getElementById('meterFill').style.background = '#10b981';
  document.getElementById('quickLogCard').classList.add('hidden');
  document.getElementById('successBox').classList.remove('hidden');

  const btnContinue = document.getElementById('btnContinueToSite');
  btnContinue.textContent = `Continuar a ${targetDomain}`;
  btnContinue.onclick = () => {
    let destination = targetDomain.startsWith('http') ? targetDomain : `https://${targetDomain}`;
    window.location.href = destination;
  };
}

function setupEventListeners() {
  // Quick pills
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const type = e.target.getAttribute('data-type');
      const amount = Number(e.target.getAttribute('data-amount'));
      await addIncome(type, amount);
    });
  });

  // Inline income form
  const inlineForm = document.getElementById('inlineIncomeForm');
  inlineForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('inlineAmount').value);
    const type = document.getElementById('inlineType').value;
    if (amount > 0) {
      await addIncome(type, amount);
      document.getElementById('inlineAmount').value = '';
    }
  });

  // Emergency Modal
  const modal = document.getElementById('emergencyModal');
  const btnTrigger = document.getElementById('btnEmergencyTrigger');
  const btnCancel = document.getElementById('btnCancelModal');
  const btnConfirm = document.getElementById('btnConfirmEmergency');

  btnTrigger.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  btnCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  btnConfirm.addEventListener('click', async () => {
    const duration = Number(document.getElementById('emergencyDuration').value) || 10;
    const reason = document.getElementById('emergencyReason').value.trim() || 'Acceso urgente';

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
    const p = BillingEngine.calculateDailyProgress(appState);
    await RuleManager.syncRules(appState, p);

    modal.classList.add('hidden');

    // Immediately redirect to the requested destination
    let destination = targetDomain.startsWith('http') ? targetDomain : `https://${targetDomain}`;
    window.location.href = destination;
  });
}

async function addIncome(type, amount) {
  const newTx = BillingEngine.generateMockTransaction(type, amount);
  newTx.potentialDuplicate = BillingEngine.detectDuplicates(newTx, appState.transactions);

  appState.transactions.unshift(newTx);
  await StorageService.setState(appState);

  appProgress = BillingEngine.calculateDailyProgress(appState);
  await RuleManager.syncRules(appState, appProgress);

  if (appProgress.isGoalMet) {
    showUnlockedState();
  } else {
    renderProgress(appProgress);
  }
}
