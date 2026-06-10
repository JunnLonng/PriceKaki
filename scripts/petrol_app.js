// PriceKaki Petrol Application Front-end Controller

// Application State
const state = {
  selectedBank: 'none', // 'none' is the default bank issuer
  selectedCardId: 'cash-no-discount', // 0% discount is the default
  loyaltyToggles: {
    essoSmiles: false,
    shellGo: false,
    spcAndU: false,
    linkRewards: false,
    sinopecX: false
  },
  selectedGrade: 'ron95',
  calcMode: 'spend',
  calcAmount: 80,
  prices: JSON.parse(JSON.stringify(PUMP_PRICES)),
  petrolUpdatedDate: '05 Jun 2026, 11:10 PM SGT'
};

// DOM Elements
const bankSelect = document.getElementById('bankSelect');
const cardSelect = document.getElementById('cardSelect');
const themeToggleBtn = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const fuelTabs = document.getElementById('fuelTabs');
const pricingGrid = document.getElementById('pricingGrid');
const bestDealBanner = document.getElementById('bestDealBanner');
const bestDealText = document.getElementById('bestDealText');
const modeSpend = document.getElementById('modeSpend');
const modeVolume = document.getElementById('modeVolume');
const calcAmountInput = document.getElementById('calcAmount');
const amountLabel = document.getElementById('amountLabel');
const calcResultsList = document.getElementById('calcResultsList');

// Initialize App
async function init() {
  // Load Theme
  const savedTheme = localStorage.getItem('pricekaki_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);

  // 1. Load live prices from scraped data file (if available)
  try {
    const response = await fetch('../data/petrol_data.json');
    if (response.ok) {
      const livePricesObj = await response.json();
      
      // Update last updated date from scraper metadata
      if (livePricesObj.metadata && livePricesObj.metadata.lastUpdated) {
        state.petrolUpdatedDate = livePricesObj.metadata.lastUpdated;
      }
      
      const livePrices = livePricesObj.prices;
      if (livePrices) {
        for (const station in livePrices) {
          if (state.prices[station]) {
            for (const grade in livePrices[station]) {
              if (grade !== 'name' && livePrices[station][grade] !== undefined) {
                state.prices[station][grade] = livePrices[station][grade];
              }
            }
          }
        }
        console.log("Loaded live prices from ../data/petrol_data.json");
      }
    }
  } catch (err) {
    console.warn("Could not fetch ../data/petrol_data.json, using default base prices instead.", err);
  }

  // 2. Load Custom Board Prices from LocalStorage if present
  const savedPrices = localStorage.getItem('pricekaki_board_prices');
  if (savedPrices) {
    try {
      const parsed = JSON.parse(savedPrices);
      for (const station in parsed) {
        if (state.prices[station]) {
          for (const grade in parsed[station]) {
            if (grade !== 'name' && parsed[station][grade] !== undefined) {
              state.prices[station][grade] = parsed[station][grade];
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse custom local board prices", e);
    }
  }

  // Populate Selectors
  populateBankSelector();
  populateCardSelector();

  // Set initial loyalty toggles
  setupLoyaltyListeners();

  // Setup listeners
  setupTabListeners();
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

// Setup Loyalty Listeners
function setupLoyaltyListeners() {
  const loyaltyCheckboxes = [
    { id: 'essoSmiles', stateKey: 'essoSmiles' },
    { id: 'shellGo', stateKey: 'shellGo' },
    { id: 'spcAndU', stateKey: 'spcAndU' },
    { id: 'linkRewards', stateKey: 'linkRewards' },
    { id: 'sinopecX', stateKey: 'sinopecX' }
  ];

  loyaltyCheckboxes.forEach(cb => {
    const el = document.getElementById(cb.id);
    if (el) {
      el.checked = state.loyaltyToggles[cb.stateKey];
      el.addEventListener('change', (e) => {
        state.loyaltyToggles[cb.stateKey] = e.target.checked;
        updateAll();
      });
    }
  });
}

// Setup Fuel Grade Tab Listeners
function setupTabListeners() {
  const tabs = fuelTabs.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedGrade = tab.getAttribute('data-grade');
      updateAll();
    });
  });
}

// Setup Calculator Mode Listeners
function setupModeListeners() {
  modeSpend.addEventListener('click', () => {
    modeSpend.classList.add('active');
    modeVolume.classList.remove('active');
    state.calcMode = 'spend';
    amountLabel.textContent = "Target Spend Amount (S$)";
    calcAmountInput.placeholder = "e.g. 80";
    updateAll();
  });

  modeVolume.addEventListener('click', () => {
    modeVolume.classList.add('active');
    modeSpend.classList.remove('active');
    state.calcMode = 'volume';
    amountLabel.textContent = "Target Volume (L)";
    calcAmountInput.placeholder = "e.g. 40";
    updateAll();
  });
}

// Setup general listeners
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
    lastUpdatedDateEl.textContent = state.petrolUpdatedDate;
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

  // Calculate pricing grid stats
  const calculatedStations = {};
  let cheapestStation = null;
  let cheapestPrice = Infinity;

  for (const station in state.prices) {
    const basePrice = state.prices[station][state.selectedGrade];
    
    if (basePrice) {
      const cardDiscount = (selectedCard && selectedCard.discounts[station]) 
                            ? selectedCard.discounts[station] 
                            : CARD_DATABASE.none.cards[0].discounts[station];

      const calcs = calculatePrices(basePrice, cardDiscount, state.loyaltyToggles, station);
      calculatedStations[station] = {
        name: state.prices[station].name,
        logoUrl: state.prices[station].logoUrl,
        basePrice,
        ...calcs,
        description: cardDiscount ? cardDiscount.description : "No discounts applied."
      };

      if (calcs.discountedPrice < cheapestPrice) {
        cheapestPrice = calcs.discountedPrice;
        cheapestStation = station;
      }
    } else {
      calculatedStations[station] = {
        name: state.prices[station].name,
        logoUrl: state.prices[station].logoUrl,
        basePrice: null,
        discountPercent: 0,
        discountedPrice: null,
        description: "Grade not offered."
      };
    }
  }

  // Render Price Grid
  renderPriceGrid(calculatedStations, cheapestStation);

  // Refueling stats for all petrol stations (only showing those that offer this grade)
  const stationIds = Object.keys(calculatedStations).filter(id => calculatedStations[id].basePrice !== null);
  const stationStatsList = stationIds.map(stationId => {
    const station = calculatedStations[stationId];
    const stats = calculateRefuelingStats(
      station.basePrice,
      station.discountedPrice,
      state.calcMode,
      state.calcAmount
    );
    return {
      id: stationId,
      name: station.name,
      logoUrl: station.logoUrl,
      discountedPrice: station.discountedPrice,
      isCheapest: stationId === cheapestStation,
      ...stats
    };
  });

  // Sort by cheapest discountedPrice (best deal first)
  stationStatsList.sort((a, b) => a.discountedPrice - b.discountedPrice);

  // Render comparison list rows
  if (calcResultsListEl) {
    stationStatsList.forEach(item => {
      const row = document.createElement('div');
      row.className = `calc-result-row ${item.isCheapest ? 'best-deal' : ''}`;
      
      let primaryText = '';
      let secondaryText = '';
      let outlayText = '';

      if (state.calcMode === 'spend') {
        primaryText = `${item.litres.toFixed(2)} L`;
        secondaryText = `Board value: S$ ${item.boardValue.toFixed(2)}`;
        outlayText = `Outlay: S$ ${item.cashOutlay.toFixed(2)}`;
      } else {
        primaryText = `S$ ${item.cashOutlay.toFixed(2)}`;
        secondaryText = `Board value: S$ ${item.boardValue.toFixed(2)}`;
        outlayText = `Volume: ${item.litres.toFixed(2)} L`;
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
          <span class="primary-val">${primaryText}</span>
          <span class="secondary-val">${secondaryText}</span>
        </div>
        <div class="right-savings">
          <span class="savings-amt">Saved S$ ${item.totalSavings.toFixed(2)}</span>
          <span class="outlay-amt">${outlayText}</span>
        </div>
      `;
      calcResultsListEl.appendChild(row);
    });
  }

  // Render Best Deal Banner
  if (cheapestStation && cheapestPrice !== Infinity) {
    bestDealBanner.style.display = 'flex';
    const best = calculatedStations[cheapestStation];
    bestDealText.innerHTML = `<strong>${best.name}</strong> is the cheapest station at <strong>S$ ${best.discountedPrice.toFixed(2)}/L</strong> with <strong>${best.discountPercent.toFixed(1)}%</strong> discount!`;
  } else {
    bestDealBanner.style.display = 'none';
  }
}

// Render Price Grid Cards
function renderPriceGrid(stations, cheapestStationId) {
  pricingGrid.innerHTML = '';

  for (const stationId in stations) {
    const station = stations[stationId];
    const isCheapest = stationId === cheapestStationId;
    const hasPrice = station.basePrice !== null && station.discountedPrice !== null;

    const card = document.createElement('div');
    card.className = `station-card ${isCheapest ? 'cheapest' : ''}`;
    
    if (isCheapest) {
      const badge = document.createElement('div');
      badge.className = 'cheapest-badge';
      badge.textContent = 'Best Deal';
      card.appendChild(badge);
    }

    if (hasPrice) {
      card.innerHTML += `
        <div>
          <div class="station-header" style="align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <img src="${station.logoUrl}" alt="${station.name} Logo" style="height: 24px; max-width: 65px; object-fit: contain;" onerror="this.style.display='none';">
              <span class="station-name">${station.name}</span>
            </div>
          </div>
          
          <div class="price-main">
            S$ ${station.discountedPrice.toFixed(2)}
            <span class="price-unit">/ L</span>
          </div>
          <div style="font-size: 0.95rem; color: var(--accent); font-weight: 600; margin-top: 0.1rem; margin-bottom: 0.8rem;">
            (${station.discountPercent.toFixed(1)}% off)
          </div>

          <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
            <div class="station-row">
              <span>Before Discount</span>
              <span>S$ ${station.basePrice.toFixed(2)}</span>
            </div>
            <div class="station-row">
              <span>After Discount</span>
              <span>S$ ${station.discountedPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;

      // Add math details panel
      const detailsBtn = document.createElement('button');
      detailsBtn.className = 'details-btn';
      detailsBtn.innerHTML = `<i data-lucide="info" style="width: 14px; height: 14px;"></i> Show Discount Breakdown`;
      
      const mathDetails = document.createElement('div');
      mathDetails.className = 'math-details';
      
      mathDetails.innerHTML = `
        <strong>Rule:</strong> ${station.description}<br>
        <strong>Calculation:</strong><br>
        1. Before Discount: S$ ${station.basePrice.toFixed(3)}<br>
        2. After Discount: S$ ${station.basePrice.toFixed(3)} × (1 - ${station.discountPercent}%) = S$ ${station.discountedPrice.toFixed(3)}
      `;

      detailsBtn.addEventListener('click', () => {
        mathDetails.classList.toggle('show');
        if (mathDetails.classList.contains('show')) {
          detailsBtn.innerHTML = `<i data-lucide="info" style="width: 14px; height: 14px;"></i> Hide Discount Breakdown`;
        } else {
          detailsBtn.innerHTML = `<i data-lucide="info" style="width: 14px; height: 14px;"></i> Show Discount Breakdown`;
        }
        lucide.createIcons();
      });

      card.appendChild(detailsBtn);
      card.appendChild(mathDetails);
    } else {
      card.style.opacity = '0.55';
      const badge = document.createElement('div');
      badge.className = 'unavailable-badge';
      badge.textContent = 'Unavailable';
      card.appendChild(badge);

      card.innerHTML += `
        <div>
          <div class="station-header" style="align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <img src="${station.logoUrl}" alt="${station.name} Logo" style="height: 24px; max-width: 65px; object-fit: contain;" onerror="this.style.display='none';">
              <span class="station-name">${station.name}</span>
            </div>
          </div>
          
          <div class="price-main" style="color: var(--text-muted);">
            S$ -
            <span class="price-unit">/ L</span>
          </div>
          <div style="font-size: 0.95rem; color: var(--text-muted); font-weight: 600; margin-top: 0.1rem; margin-bottom: 0.8rem;">
            (N/A)
          </div>

          <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
            <div class="station-row" style="color: var(--text-muted);">
              <span>Before Discount</span>
              <span>-</span>
            </div>
            <div class="station-row" style="color: var(--text-muted);">
              <span>After Discount</span>
              <span>-</span>
            </div>
          </div>
        </div>
      `;
    }

    pricingGrid.appendChild(card);
  }
}

// Start application
document.addEventListener('DOMContentLoaded', init);
