// PriceKaki EV Application Front-end Controller

// Application State
const state = {
  evChargerType: 'ac', // 'ac' or 'dc'
  selectedBank: 'none', // 'none' is the default bank issuer
  selectedCardId: 'cash-no-discount', // 0% discount is the default
  calcMode: 'spend',
  calcAmount: 20,
  evPrices: JSON.parse(JSON.stringify(EV_PROVIDERS)),
  evUpdatedDate: '06 Jun 2026, 04:43 PM SGT'
};

// DOM Elements
const bankSelect = document.getElementById('bankSelect');
const cardSelect = document.getElementById('cardSelect');
const themeToggleBtn = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const modeSpend = document.getElementById('modeSpend');
const modeVolume = document.getElementById('modeVolume');
const modeDuration = document.getElementById('modeDuration');
const chargerAc = document.getElementById('chargerAc');
const chargerDc = document.getElementById('chargerDc');
const calcAmountInput = document.getElementById('calcAmount');
const amountLabel = document.getElementById('amountLabel');
const calcResultsList = document.getElementById('calcResultsList');

// Initialize App
async function init() {
  // Load Theme
  const savedTheme = localStorage.getItem('pricekaki_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);

  // 1. Populate Selectors
  populateBankSelector();
  populateCardSelector();

  // 2. Setup listeners
  setupChargerListeners();
  setupCalculatorListeners();
  setupThemeListener();
  setupModeListeners();

  // Render Page
  updateAll();
}

// Populate Bank Selector
function populateBankSelector() {
  bankSelect.innerHTML = '';
  for (const key in CARD_DATABASE) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = CARD_DATABASE[key].bankName;
    bankSelect.appendChild(option);
  }
  bankSelect.value = state.selectedBank;

  bankSelect.addEventListener('change', (e) => {
    state.selectedBank = e.target.value;
    populateCardSelector();
    updateAll();
  });
}

// Populate Card Selector based on selected Bank
function populateCardSelector() {
  cardSelect.innerHTML = '';
  const bankData = CARD_DATABASE[state.selectedBank];
  
  if (state.selectedBank === 'none') {
    cardSelect.disabled = true;
    const option = document.createElement('option');
    option.value = 'cash-no-discount';
    option.textContent = 'None';
    cardSelect.appendChild(option);
    state.selectedCardId = 'cash-no-discount';
    cardSelect.value = 'cash-no-discount';
  } else if (bankData && bankData.cards.length > 0) {
    cardSelect.disabled = false;
    bankData.cards.forEach(card => {
      const option = document.createElement('option');
      option.value = card.id;
      option.textContent = card.name;
      cardSelect.appendChild(option);
    });
    // Set default selected card
    state.selectedCardId = bankData.cards[0].id;
    cardSelect.value = state.selectedCardId;
  } else {
    cardSelect.disabled = true;
    const option = document.createElement('option');
    option.value = "";
    option.textContent = "No cards available";
    cardSelect.appendChild(option);
    state.selectedCardId = "";
  }

  cardSelect.addEventListener('change', (e) => {
    state.selectedCardId = e.target.value;
    updateAll();
  });
}

// Setup Charger Speed listeners
function setupChargerListeners() {
  chargerAc.addEventListener('click', () => {
    chargerAc.classList.add('active');
    chargerDc.classList.remove('active');
    state.evChargerType = 'ac';
    updateAll();
  });

  chargerDc.addEventListener('click', () => {
    chargerDc.classList.add('active');
    chargerAc.classList.remove('active');
    state.evChargerType = 'dc';
    updateAll();
  });
}

// Setup Calculator Mode Listeners
function setupModeListeners() {
  modeSpend.addEventListener('click', () => {
    modeSpend.classList.add('active');
    modeVolume.classList.remove('active');
    modeDuration.classList.remove('active');
    state.calcMode = 'spend';
    amountLabel.textContent = "Target Spend Amount (S$)";
    calcAmountInput.placeholder = "e.g. 20";
    updateAll();
  });

  modeVolume.addEventListener('click', () => {
    modeVolume.classList.add('active');
    modeSpend.classList.remove('active');
    modeDuration.classList.remove('active');
    state.calcMode = 'volume';
    amountLabel.textContent = "Target Energy (kWh)";
    calcAmountInput.placeholder = "e.g. 30";
    updateAll();
  });

  modeDuration.addEventListener('click', () => {
    modeDuration.classList.add('active');
    modeSpend.classList.remove('active');
    modeVolume.classList.remove('active');
    state.calcMode = 'duration';
    amountLabel.textContent = "Target Duration (Mins)";
    calcAmountInput.placeholder = "e.g. 45";
    updateAll();
  });
}

// Setup general input listeners
function setupCalculatorListeners() {
  calcAmountInput.addEventListener('input', (e) => {
    state.calcAmount = parseFloat(e.target.value) || 0;
    updateAll();
  });
}

// Theme management
function setupThemeListener() {
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pricekaki_theme', newTheme);
    updateThemeIcons(newTheme);
  });
}

function updateThemeIcons(theme) {
  if (theme === 'dark') {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  } else {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  }
}

// Perform calculations and update all elements
function updateAll() {
  // Update last updated date
  const lastUpdatedDateEl = document.getElementById('lastUpdatedDate');
  if (lastUpdatedDateEl) {
    lastUpdatedDateEl.textContent = state.evUpdatedDate;
  }

  // Find currently selected card discounts
  let selectedCard = null;
  const bankData = CARD_DATABASE[state.selectedBank];
  if (bankData && state.selectedCardId) {
    selectedCard = bankData.cards.find(c => c.id === state.selectedCardId);
  }

  const calcResultsListEl = document.getElementById('calcResultsList');
  if (calcResultsListEl) {
    calcResultsListEl.innerHTML = '';
  }

  // Find card rebate percentage
  const cardEvRebate = selectedCard ? (selectedCard.evRebate || 0.0) : 0.0;

  // Calculate pricing for all providers
  const calculatedAc = {};
  const calculatedDc = {};
  let cheapestAcId = null;
  let cheapestDcId = null;
  let cheapestAcPrice = Infinity;
  let cheapestDcPrice = Infinity;

  for (const providerId in state.evPrices) {
    const provider = state.evPrices[providerId];
    
    // AC Charging Calcs
    const acCalcs = calculateEvPrices(provider.ac, cardEvRebate);
    calculatedAc[providerId] = {
      name: provider.name,
      logoUrl: provider.logoUrl,
      baseRate: provider.ac,
      ...acCalcs
    };
    if (acCalcs.discountedRate < cheapestAcPrice) {
      cheapestAcPrice = acCalcs.discountedRate;
      cheapestAcId = providerId;
    }

    // DC Charging Calcs
    const dcCalcs = calculateEvPrices(provider.dc, cardEvRebate);
    calculatedDc[providerId] = {
      name: provider.name,
      logoUrl: provider.logoUrl,
      baseRate: provider.dc,
      ...dcCalcs
    };
    if (dcCalcs.discountedRate < cheapestDcPrice) {
      cheapestDcPrice = dcCalcs.discountedRate;
      cheapestDcId = providerId;
    }
  }

  // Render Dashboard
  renderEvPriceGrids(calculatedAc, calculatedDc, cheapestAcId, cheapestDcId);

  // EV Calculator calculations
  const evProvidersList = state.evChargerType === 'ac' ? calculatedAc : calculatedDc;
  const cheapestEvId = state.evChargerType === 'ac' ? cheapestAcId : cheapestDcId;

  const evStatsList = Object.keys(evProvidersList).map(providerId => {
    const provider = evProvidersList[providerId];
    const stats = calculateEvChargingStats(
      provider.baseRate,
      provider.discountedRate,
      state.calcMode,
      state.calcAmount,
      state.evChargerType
    );
    return {
      id: providerId,
      name: provider.name,
      logoUrl: provider.logoUrl,
      discountedRate: provider.discountedRate,
      isCheapest: providerId === cheapestEvId,
      ...stats
    };
  });

  // Sort EV stats by discountedRate (low to high)
  evStatsList.sort((a, b) => a.discountedRate - b.discountedRate);

  // Render list
  if (calcResultsListEl) {
    evStatsList.forEach(item => {
      const row = document.createElement('div');
      row.className = `calc-result-row ${item.isCheapest ? 'best-deal' : ''}`;
      
      let primaryValText = '';
      let secondaryValText = '';
      let outlayText = '';

      if (state.calcMode === 'spend') {
        primaryValText = `+${item.energyKwh.toFixed(1)} kWh`;
        secondaryValText = `${item.hours}h ${item.minutes}m charge`;
        outlayText = `Cost: S$ ${item.cashOutlay.toFixed(2)}`;
      } else if (state.calcMode === 'duration') {
        primaryValText = `S$ ${item.cashOutlay.toFixed(2)}`;
        secondaryValText = `+${item.energyKwh.toFixed(1)} kWh energy`;
        outlayText = `Duration: ${state.calcAmount} mins`;
      } else {
        primaryValText = `S$ ${item.cashOutlay.toFixed(2)}`;
        secondaryValText = `${item.hours}h ${item.minutes}m charge`;
        outlayText = `Energy: ${item.energyKwh.toFixed(1)} kWh`;
      }

      row.innerHTML = `
        <div class="left-info">
          <img src="${item.logoUrl}" alt="${item.name} Logo" onerror="this.style.display='none';">
          <div class="station-title-group">
            <span class="station-name-small">${item.name}</span>
            ${item.isCheapest ? '<span class="best-deal-tag">Best Deal</span>' : ''}
          </div>
        </div>
        <div class="center-math">
          <span class="primary-val">${primaryValText}</span>
          <span class="secondary-val">${secondaryValText}</span>
        </div>
        <div class="right-savings">
          <span class="savings-amt">+${item.rangeKm.toFixed(0)} km range</span>
          <span class="outlay-amt">${outlayText}</span>
        </div>
      `;
      calcResultsListEl.appendChild(row);
    });
  }

  // Update calculator panel info note
  const calcInfoNote = document.getElementById('calcInfoNote');
  if (calcInfoNote && cheapestEvId && evProvidersList[cheapestEvId]) {
    calcInfoNote.style.display = 'block';
    document.getElementById('calcStationName').textContent = evProvidersList[cheapestEvId].name;
  }
}

// Render EV Dashboard Rows (AC and DC grids)
function renderEvPriceGrids(acProviders, dcProviders, cheapestAcId, cheapestDcId) {
  const evGridAc = document.getElementById('evGridAc');
  const evGridDc = document.getElementById('evGridDc');
  evGridAc.innerHTML = '';
  evGridDc.innerHTML = '';

  // Render AC
  for (const id in acProviders) {
    const provider = acProviders[id];
    const isCheapest = id === cheapestAcId;
    const card = document.createElement('div');
    card.className = `station-card ${isCheapest ? 'cheapest' : ''}`;
    if (isCheapest) {
      const badge = document.createElement('div');
      badge.className = 'cheapest-badge';
      badge.textContent = 'Best AC Deal';
      card.appendChild(badge);
    }
    card.innerHTML += `
      <div>
        <div class="station-header" style="align-items: center; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <img src="${provider.logoUrl}" alt="${provider.name} Logo" style="height: 24px; max-width: 65px; object-fit: contain;" onerror="this.style.display='none';">
            <span class="station-name">${provider.name}</span>
          </div>
        </div>
        
        <div class="price-main">
          S$ ${provider.discountedRate.toFixed(3)}
          <span class="price-unit">/ kWh</span>
        </div>
        <div style="font-size: 0.95rem; color: var(--accent); font-weight: 600; margin-top: 0.1rem; margin-bottom: 0.8rem;">
          (${provider.rebatePercent.toFixed(1)}% card rebate)
        </div>

        <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
          <div class="station-row">
            <span>Base Rate</span>
            <span>S$ ${provider.baseRate.toFixed(3)}</span>
          </div>
          <div class="station-row">
            <span>Net Price</span>
            <span>S$ ${provider.discountedRate.toFixed(3)}</span>
          </div>
        </div>
      </div>
    `;
    evGridAc.appendChild(card);
  }

  // Render DC
  for (const id in dcProviders) {
    const provider = dcProviders[id];
    const isCheapest = id === cheapestDcId;
    const card = document.createElement('div');
    card.className = `station-card ${isCheapest ? 'cheapest' : ''}`;
    if (isCheapest) {
      const badge = document.createElement('div');
      badge.className = 'cheapest-badge';
      badge.textContent = 'Best DC Deal';
      card.appendChild(badge);
    }
    card.innerHTML += `
      <div>
        <div class="station-header" style="align-items: center; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <img src="${provider.logoUrl}" alt="${provider.name} Logo" style="height: 24px; max-width: 65px; object-fit: contain;" onerror="this.style.display='none';">
            <span class="station-name">${provider.name}</span>
          </div>
        </div>
        
        <div class="price-main">
          S$ ${provider.discountedRate.toFixed(3)}
          <span class="price-unit">/ kWh</span>
        </div>
        <div style="font-size: 0.95rem; color: var(--accent); font-weight: 600; margin-top: 0.1rem; margin-bottom: 0.8rem;">
          (${provider.rebatePercent.toFixed(1)}% card rebate)
        </div>

        <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
          <div class="station-row">
            <span>Base Rate</span>
            <span>S$ ${provider.baseRate.toFixed(3)}</span>
          </div>
          <div class="station-row">
            <span>Net Price</span>
            <span>S$ ${provider.discountedRate.toFixed(3)}</span>
          </div>
        </div>
      </div>
    `;
    evGridDc.appendChild(card);
  }
}

// Start Application
document.addEventListener('DOMContentLoaded', init);
