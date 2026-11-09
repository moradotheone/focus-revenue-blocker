/**
 * Blocked Interstitial Controller (SpaceX / Starlink HUD Edition)
 */

let appState = null;
let appProgress = null;
let targetDomain = '';

const TACTICAL_QUOTES = [
  "«Factura primero, scrollea después. Tu atención es el activo más costoso de tu empresa.»",
  "«El consumo pasivo no financia tu infraestructura ni tus proyectos. La tracción real sí.»",
  "«Cada cobro confirmado hoy es autonomía y foco asegurado para mañana.»",
  "«Cierra la siguiente propuesta o llamada de cliente. Las redes seguirán ahí al alcanzar la meta.»",
  "«La barrera no te detiene: protege tu capacidad de generar ingresos.»"
];

document.addEventListener('DOMContentLoaded', async () => {
  parseTargetDomain();
  selectRandomQuote();
  await refreshData();
  setupEventListeners();
});

function parseTargetDomain() {
  const urlParams = new URLSearchParams(window.location.search);
  targetDomain = urlParams.get('blocked') || 'DOMINIO_RESTRINGIDO';
  document.getElementById('blockedDomainTag').textContent = `VECTOR // ${targetDomain.toUpperCase()}`;
}

function selectRandomQuote() {
  const quoteEl = document.getElementById('quoteText');
  const randomIndex = Math.floor(Math.random() * TACTICAL_QUOTES.length);
  quoteEl.textContent = TACTICAL_QUOTES[randomIndex];
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

  calloutEl.innerHTML = `DELTA: <strong>${BillingEngine.formatCurrency(p.remainingToGoal, p.currency, p.symbol)}</strong> PARA DESBLOQUEAR`;
}

function showUnlockedState() {
  document.getElementById('meterFill').style.width = '100%';
  document.getElementById('meterFill').style.background = '#00f59b';
  document.getElementById('quickLogCard').classList.add('hidden');
  document.getElementById('successBox').classList.remove('hidden');

  const btnContinue = document.getElementById('btnContinueToSite');
  btnContinue.textContent = `CONTINUAR A ${targetDomain.toUpperCase()}`;
  btnContinue.onclick = () => {
    let destination = targetDomain.startsWith('http') ? targetDomain : `https://${targetDomain}`;
    window.location.href = destination;
  };
}

function setupEventListeners() {
  // Quick pills
  document.querySelectorAll('.btn-chip, .pill-btn').forEach(btn => {
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
