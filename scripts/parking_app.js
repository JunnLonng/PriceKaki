// State Management
const state = {
  vehicleType: 'car', // 'car' or 'motorcycle'
  dayType: 'weekday', // 'weekday', 'saturday', 'sunday'
  entryTime: '12:00',
  duration: 120, // in minutes
  sortBy: 'cheapest', // 'cheapest' or 'nearest'
  carparksDB: [], // dynamic load sgcarmart parsed rates
  destination: null, // { name: '', lat: 0, lng: 0 }
  proximityRadius: 'none' // in km, or 'none'
};

// DOM Elements
const destinationInput = document.getElementById('destinationInput');
const destinationSuggestions = document.getElementById('destinationSuggestions');
const radiusGroup = document.getElementById('radiusGroup');
const radiusSelect = document.getElementById('radiusSelect');
const vehicleCarBtn = document.getElementById('vehicleCar');
const vehicleMotorcycleBtn = document.getElementById('vehicleMotorcycle');
const daySelect = document.getElementById('daySelect');
const entryTimeInput = document.getElementById('entryTime');
const durationInput = document.getElementById('duration');
const durationVal = document.getElementById('durationVal');
const sortCheapestBtn = document.getElementById('sortCheapest');
const sortNearestBtn = document.getElementById('sortNearest');
const carparkGrid = document.getElementById('carparkGrid');
const themeToggleBtn = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const bestDealBanner = document.getElementById('bestDealBanner');
const bestDealText = document.getElementById('bestDealText');

// Initialize
async function init() {
  // Load Theme
  const savedTheme = localStorage.getItem('pricekaki_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);

  // Set default day of week and time based on current local time
  setDefaultDateTime();

  // Load carpark rate database from global constant
  if (typeof PARKING_RATES_DATA !== 'undefined') {
    state.carparksDB = JSON.parse(JSON.stringify(PARKING_RATES_DATA));
    console.log(`Loaded ${state.carparksDB.length} carpark rate records from static JS`);
  } else {
    console.error("PARKING_RATES_DATA is undefined!");
  }

  // Set up event listeners
  setupEventListeners();

  // Initial update
  updateUI();
}

// Set default Day and Time
function setDefaultDateTime() {
  const now = new Date();
  
  // Set day
  const day = now.getDay(); // 0 = Sun, 6 = Sat, 1-5 = Weekday
  if (day === 0) {
    state.dayType = 'sunday';
  } else if (day === 6) {
    state.dayType = 'saturday';
  } else {
    state.dayType = 'weekday';
  }
  daySelect.value = state.dayType;

  // Set time (HH:MM)
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  state.entryTime = `${hh}:${mm}`;
  entryTimeInput.value = state.entryTime;

  // Set default duration value in DOM
  durationInput.value = state.duration;
  durationVal.textContent = formatDurationLabel(state.duration);
}

// Helper to format duration labels
function formatDurationLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Retrieve raw text rates depending on dayType
function getRawTextRateSummary(cp, vehicleType, dayType) {
  if (vehicleType === 'motorcycle') {
    const summary = getRateSummary(cp, 'motorcycle', dayType);
    return `<strong>Motorcycle Rate</strong>: ${summary}`;
  }
  if (!cp.textRates) {
    return getRateSummary(cp, vehicleType, dayType);
  }
  
  const textRates = cp.textRates;
  let summary = "";
  if (dayType === 'weekday') {
    summary += textRates.wd1 ? `<strong>Day</strong>: ${textRates.wd1}` : "";
    summary += textRates.wd2 ? `<br><strong>Night</strong>: ${textRates.wd2}` : "";
  } else if (dayType === 'saturday') {
    const sat1 = textRates.sat1 || textRates.wd1;
    const sat2 = textRates.sat2 || textRates.wd2;
    summary += sat1 ? `<strong>Day</strong>: ${sat1}` : "";
    summary += sat2 ? `<br><strong>Night</strong>: ${sat2}` : "";
  } else {
    const sun1 = textRates.sun1 || textRates.wd1;
    const sun2 = textRates.sun2 || textRates.wd2;
    summary += sun1 ? `<strong>Day</strong>: ${sun1}` : "";
    summary += sun2 ? `<br><strong>Night</strong>: ${sun2}` : "";
  }
  
  if (textRates.remarks) {
    summary += `<br><span style="color: var(--primary); font-size: 0.75rem;"><strong>Remarks</strong>: ${textRates.remarks}</span>`;
  }
  
  return summary || "Rates not available";
}

// Event Listeners setup
function setupEventListeners() {

  // Destination (Proximity Search) Autocomplete via OneMap
  let searchTimeout = null;
  
  // Enter key press selects the first suggestion automatically
  destinationInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = destinationInput.value.trim();
      if (query.length >= 3) {
        if (searchTimeout) clearTimeout(searchTimeout);
        try {
          const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y`);
          if (res.ok) {
            const data = await res.json();
            const results = data.results || [];
            if (results.length > 0) {
              const first = results[0];
              const name = first.BUILDING || first.ROAD_NAME || first.ADDRESS || "Location";
              destinationInput.value = name;
              destinationSuggestions.style.display = 'none';
              
              const latVal = parseFloat(first.LATITUDE || first.latitude || 0);
              const lngVal = parseFloat(first.LONGITUDE || first.longitude || 0);
              
              if (latVal && lngVal) {
                state.destination = { name, lat: latVal, lng: lngVal };
                sortNearestBtn.classList.add('active');
                sortCheapestBtn.classList.remove('active');
                state.sortBy = 'nearest';
                updateUI();
              }
            }
          }
        } catch (err) {
          console.error("Error on Enter search", err);
        }
      }
    }
  });

  destinationInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (query === '') {
      clearDestination();
      return;
    }
    
    if (query.length < 3) {
      destinationSuggestions.style.display = 'none';
      return;
    }
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y`);
        if (res.ok) {
          const data = await res.json();
          const results = data.results || [];
          showSuggestions(results);
        }
      } catch (err) {
        console.error("Error geocoding via OneMap", err);
      }
    }, 300);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== destinationInput && e.target !== destinationSuggestions) {
      destinationSuggestions.style.display = 'none';
    }
  });

  // Vehicle Type Segment Controls
  vehicleCarBtn.addEventListener('click', () => {
    vehicleCarBtn.classList.add('active');
    vehicleMotorcycleBtn.classList.remove('active');
    state.vehicleType = 'car';
    updateUI();
  });

  vehicleMotorcycleBtn.addEventListener('click', () => {
    vehicleMotorcycleBtn.classList.add('active');
    vehicleCarBtn.classList.remove('active');
    state.vehicleType = 'motorcycle';
    updateUI();
  });

  // Day Selector
  daySelect.addEventListener('change', (e) => {
    state.dayType = e.target.value;
    updateUI();
  });

  // Entry Time
  const handleEntryTimeChange = (e) => {
    state.entryTime = e.target.value;
    updateUI();
  };
  entryTimeInput.addEventListener('input', handleEntryTimeChange);
  entryTimeInput.addEventListener('change', handleEntryTimeChange);
  entryTimeInput.addEventListener('blur', handleEntryTimeChange);
  entryTimeInput.addEventListener('keyup', handleEntryTimeChange);

  // Duration Slider
  const handleDurationChange = (e) => {
    state.duration = parseInt(e.target.value, 10);
    durationVal.textContent = formatDurationLabel(state.duration);
    updateUI();
  };
  durationInput.addEventListener('input', handleDurationChange);
  durationInput.addEventListener('change', handleDurationChange);

  // Sorting Controls
  sortCheapestBtn.addEventListener('click', () => {
    sortCheapestBtn.classList.add('active');
    sortNearestBtn.classList.remove('active');
    state.sortBy = 'cheapest';
    updateUI();
  });

  sortNearestBtn.addEventListener('click', () => {
    if (!state.destination) {
      destinationInput.focus();
      return;
    }
    sortNearestBtn.classList.add('active');
    sortCheapestBtn.classList.remove('active');
    state.sortBy = 'nearest';
    updateUI();
  });

  // Proximity Radius Selector
  radiusSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    state.proximityRadius = (val === 'all' || val === 'none') ? val : parseFloat(val);
    updateUI();
  });

  // Theme Switcher
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pricekaki_theme', newTheme);
    updateThemeIcons(newTheme);
  });
}

function clearDestination() {
  state.destination = null;
  if (state.sortBy === 'nearest') {
    state.sortBy = 'cheapest';
    sortCheapestBtn.classList.add('active');
    sortNearestBtn.classList.remove('active');
  }
  updateUI();
}

function showSuggestions(results) {
  destinationSuggestions.innerHTML = '';
  
  if (results.length === 0) {
    destinationSuggestions.style.display = 'none';
    return;
  }
  
  results.slice(0, 5).forEach(res => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    
    const name = res.BUILDING || res.ROAD_NAME || res.ADDRESS || "Unknown Location";
    const address = res.ADDRESS || "";
    
    item.innerHTML = `
      <div style="font-weight: 600;">${name}</div>
      <div class="address-desc">${address}</div>
    `;
    
    item.addEventListener('click', () => {
      destinationInput.value = name;
      destinationSuggestions.style.display = 'none';
      
      // Update state coordinates with robust casing fallbacks
      const latVal = parseFloat(res.LATITUDE || res.latitude || 0);
      const lngVal = parseFloat(res.LONGITUDE || res.longitude || 0);
      state.destination = {
        name: name,
        lat: latVal,
        lng: lngVal
      };
      
      // Show proximity sort button and set active
      sortNearestBtn.classList.add('active');
      sortCheapestBtn.classList.remove('active');
      state.sortBy = 'nearest';
      
      // Re-calculate UI
      updateUI();
    });
    
    destinationSuggestions.appendChild(item);
  });
  
  destinationSuggestions.style.display = 'block';
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

// Check if a carpark is permanently closed/demolished
function isPermanentlyClosed(cp) {
  if (cp.isClosedText) return true;
  const textRates = cp.textRates || {};
  const remarks = (textRates.remarks || cp.remarks || "").toLowerCase();
  const wd1 = (textRates.wd1 || cp.wd1 || "").toLowerCase();
  
  return (
    remarks.includes("demolished") || 
    remarks.includes("permanently closed") || 
    remarks.includes("closed permanently") ||
    remarks === "closed" ||
    remarks === "carpark closed" ||
    remarks === "carpark is closed" ||
    wd1 === "carpark closed" ||
    wd1 === "car park closed"
  );
}

// Check if a carpark is private
function isPrivateCarpark(cp) {
  if (cp.isPrivate) return true;
  const textRates = cp.textRates || {};
  const remarks = (textRates.remarks || cp.remarks || "").toLowerCase();
  const wd1 = (textRates.wd1 || cp.wd1 || "").toLowerCase();
  
  return (
    wd1 === "private car park" ||
    wd1 === "private carpark" ||
    wd1 === "private parking" ||
    remarks.includes("private carpark") ||
    remarks.includes("private car park") ||
    remarks.includes("private parking only") ||
    remarks.includes("no public parking") ||
    remarks.includes("not open to public") ||
    remarks.includes("staff parking only") ||
    remarks.includes("tenants only") ||
    remarks.includes("for tenants only") ||
    remarks.includes("staff only")
  );
}

// Check if a carpark is season-only
function isSeasonOnlyCarpark(cp) {
  if (cp.isSeasonOnly) return true;
  const name = (cp.name || cp.development || "").toLowerCase();
  const textRates = cp.textRates || {};
  const wd1 = (textRates.wd1 || cp.wd1 || "").toLowerCase();
  
  return (
    wd1 === "season parking only" || 
    wd1 === "season only" ||
    name.includes("season parking only")
  );
}

// Check if a carpark is the destination itself
function isDestinationCarpark(cp, destination) {
  if (!destination) return false;
  
  const getTokens = (name) => {
    if (!name) return [];
    // Replace punctuation with space
    const cleaned = name.toLowerCase().replace(/[-/() ,.&_]/g, " ");
    const words = cleaned.split(/\s+/);
    const ignored = new Set(["carpark", "parking", "basement", "multistorey"]);
    const tokens = [];
    for (const w of words) {
      const cw = w.replace(/[^a-z0-9]/g, "");
      if (cw && !ignored.has(cw)) {
        tokens.push(cw);
      }
    }
    return tokens;
  };
  
  const cpTokens = getTokens(cp.name || cp.development);
  const destTokens = getTokens(destination.name);
  
  if (cpTokens.length > 0 && destTokens.length > 0) {
    const cpTokenSet = new Set(cpTokens);
    const destTokenSet = new Set(destTokens);
    
    // Check if cpTokens is a subset of destTokens
    let cpSubsetOfDest = true;
    for (const cpt of cpTokens) {
      if (!destTokenSet.has(cpt)) {
        cpSubsetOfDest = false;
        break;
      }
    }
    
    // Check if destTokens is a subset of cpTokens
    let destSubsetOfCp = true;
    for (const dt of destTokens) {
      if (!cpTokenSet.has(dt)) {
        destSubsetOfCp = false;
        break;
      }
    }
    
    if (cpSubsetOfDest || destSubsetOfCp) {
      return true;
    }
  }
  
  // 2. Check if coordinates are extremely close (e.g. within 80 meters, i.e., 0.08 km)
  if (cp.location && cp.location.lat && cp.location.lng) {
    const dist = calculateHaversineDistance(destination.lat, destination.lng, cp.location.lat, cp.location.lng);
    if (dist !== null && dist <= 0.08) {
      return true;
    }
  }
  
  return false;
}

// Calculate and update the UI
function updateUI() {


  // 0. When destination is empty, comparisons list should be empty
  if (!state.destination) {
    renderGrid([]);
    return;
  }

  const results = [];

  // 1. Calculate costs for all carparks in comparison database
  state.carparksDB.forEach(cp => {
    const cpName = cp.name || cp.development || "";
    
    // Filter out permanently closed/demolished carparks
    if (isPermanentlyClosed(cp)) {
      return;
    }

    // Calculate straight-line distance if destination exists
    let distance = null;
    if (state.destination && cp.location && cp.location.lat && cp.location.lng) {
      distance = calculateHaversineDistance(
        state.destination.lat,
        state.destination.lng,
        cp.location.lat,
        cp.location.lng
      );
    }

    // Filter out if destination exists but distance is not computable
    if (state.destination && distance === null) {
      return;
    }

    // Filter by proximity radius if destination is active
    if (state.destination && distance !== null) {
      if (state.proximityRadius === 'none') {
        if (!isDestinationCarpark(cp, state.destination)) {
          return;
        }
      } else if (state.proximityRadius !== 'all' && distance > state.proximityRadius) {
        return;
      }
    }

    // Determine restricted/private flags and rate presence
    const isPrivate = isPrivateCarpark(cp);
    const isSeasonOnly = isSeasonOnlyCarpark(cp);
    
    // Check if there are no rates at all for the selected vehicle type
    const vRates = cp.rates ? cp.rates[state.vehicleType] : null;
    let hasNoRates = !vRates;
    if (vRates) {
      const hasAnyRates = (vRates.weekday && vRates.weekday.length > 0) || 
                          (vRates.saturday && vRates.saturday.length > 0) || 
                          (vRates.sunday && vRates.sunday.length > 0);
      if (!hasAnyRates) {
        hasNoRates = true;
      }
    }

    // Calculate cost
    const costResult = calculateParkingCost(cp, state.vehicleType, state.dayType, state.entryTime, state.duration);
    
    // Check if closed at selected entry time (only if we have rates)
    let isClosed = false;
    if (!hasNoRates) {
      let dayRates = vRates[state.dayType];
      if (!dayRates || dayRates.length === 0) {
        dayRates = vRates["weekday"];
      }
      const entryMins = parseTimeToMins(state.entryTime);
      const hasSessionAtEntry = dayRates ? findActiveSession(dayRates, entryMins) : null;
      isClosed = !hasSessionAtEntry;
    }

    // Raw text rate description
    const rateText = getRawTextRateSummary(cp, state.vehicleType, state.dayType);

    results.push({
      ...cp,
      development: cpName,
      locationString: cp.address || "",
      totalCost: costResult.totalCost,
      breakdown: costResult.breakdown,
      rateSummary: rateText,
      distance: distance,
      isClosed: isClosed,
      isPrivate: isPrivate,
      isSeasonOnly: isSeasonOnly,
      hasNoRates: hasNoRates
    });
  });

  // Helper to determine if a carpark is inactive/restricted for sorting
  const isInactive = (cp) => cp.isClosed || cp.isPrivate || cp.isSeasonOnly;

  // 2. Sort results (always push closed or restricted carparks to the bottom of the list)
  if (state.sortBy === 'cheapest') {
    results.sort((a, b) => {
      const aInactive = isInactive(a);
      const bInactive = isInactive(b);
      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;
      
      const aCost = a.hasNoRates ? 999999 : a.totalCost;
      const bCost = b.hasNoRates ? 999999 : b.totalCost;
      return aCost - bCost;
    });
  } else if (state.sortBy === 'nearest') {
    results.sort((a, b) => {
      const aInactive = isInactive(a);
      const bInactive = isInactive(b);
      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
  }

  // 3. Render Best Deal Banner if we have results (do not recommend closed or restricted/private carparks)
  if (results.length > 0 && state.sortBy === 'cheapest' && !isInactive(results[0])) {
    bestDealBanner.style.display = 'flex';
    const best = results[0];
    bestDealText.innerHTML = `<strong>${best.development}</strong> is the cheapest option in this area at <strong>S$ ${best.totalCost.toFixed(2)}</strong>!`;
  } else {
    bestDealBanner.style.display = 'none';
  }

  // 4. Render Grid
  renderGrid(results);
}

// Render the carpark list rows
function renderGrid(carparks) {
  carparkGrid.innerHTML = '';
  
  if (carparks.length === 0) {
    let msg = "No matching carparks found.";
    let icon = "info";
    if (!state.destination) {
      msg = "Enter a destination above to compare parking rates.";
      icon = "search";
    }
    carparkGrid.innerHTML = `
      <div style="width: 100%; text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
        <i data-lucide="${icon}" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5; color: var(--primary);"></i>
        <p style="font-size: 1.15rem; font-weight: 500; max-width: 400px; margin: 0 auto; line-height: 1.5;">${msg}</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Cap visible items to first 80 for rendering performance
  const displayList = carparks.slice(0, 80);

  displayList.forEach((cp, idx) => {
    const isInactiveVal = cp.isClosed || cp.isPrivate || cp.isSeasonOnly;
    const isCheapest = state.sortBy === 'cheapest' && idx === 0 && !isInactiveVal;
    const row = document.createElement('div');
    
    // Add classes for row styling: closed or restricted
    let extraClass = '';
    if (cp.isClosed) {
      extraClass = 'closed';
    } else if (cp.isPrivate || cp.isSeasonOnly) {
      extraClass = 'restricted';
    }
    
    row.className = `station-row-item ${isCheapest ? 'cheapest' : ''} ${extraClass}`.trim();

    // Cheapest Badge (Best Deal)
    let bestDealBadgeHtml = '';
    if (isCheapest) {
      bestDealBadgeHtml = `<span class="cheapest-badge">Best Deal</span>`;
    }

    // Distance badge
    let distanceBadgeHtml = '';
    if (cp.distance !== null) {
      distanceBadgeHtml = `<span class="lot-badge" style="background: rgba(99, 102, 241, 0.15); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.3);"><i data-lucide="map-pin" style="width: 12px; height: 12px; margin-right: 0.2rem;"></i> ${cp.distance.toFixed(2)} km</span>`;
    }

    // Warning Badge HTML
    let warningBadgeHtml = '';
    if (cp.isPrivate) {
      warningBadgeHtml = `
        <div style="font-size: 0.75rem; color: #f59e0b; font-weight: 600; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
          <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> Private Parking (Staff / Tenants Only)
        </div>
      `;
    } else if (cp.isSeasonOnly) {
      warningBadgeHtml = `
        <div style="font-size: 0.75rem; color: #f59e0b; font-weight: 600; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
          <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> Season Parking Only (No Hourly Public)
        </div>
      `;
    }

    // Breakdown HTML
    let breakdownHtml = '';
    if (cp.isClosed) {
      breakdownHtml = `
        <div class="station-row" style="font-size: 0.8rem; border-bottom: 1px dashed rgba(255,255,255,0.05); padding: 0.3rem 0; color: var(--danger); justify-content: flex-start; gap: 0.4rem;">
          <i data-lucide="info" style="width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px;"></i>
          <span>This carpark is closed at the selected entry time (${state.entryTime}). No rate data is available for this period.</span>
        </div>
      `;
    } else if (cp.hasNoRates) {
      const warnMsg = cp.isSeasonOnly 
        ? "This carpark is restricted to season parking holders only. No hourly rate data is available."
        : "This is a private carpark and may not be open to the general public. No rate data is available.";
      breakdownHtml = `
        <div class="station-row" style="font-size: 0.8rem; border-bottom: 1px dashed rgba(255,255,255,0.05); padding: 0.3rem 0; color: #f59e0b; justify-content: flex-start; gap: 0.4rem;">
          <i data-lucide="alert-triangle" style="width: 14px; height: 14px; flex-shrink: 0; margin-top: 1px;"></i>
          <span>${warnMsg}</span>
        </div>
      `;
    } else {
      cp.breakdown.forEach(b => {
        breakdownHtml += `
          <div class="station-row" style="font-size: 0.8rem; border-bottom: 1px dashed rgba(255,255,255,0.05); padding: 0.2rem 0;">
            <span>${b.sessionName} (${b.duration}m)</span>
            <span>S$ ${b.cost.toFixed(2)}</span>
          </div>
        `;
      });
    }

    // Pricing HTML
    let pricingHtml = `<div class="station-price-display">S$ ${cp.totalCost.toFixed(2)}</div>`;
    if (cp.isClosed) {
      pricingHtml = `
        <div class="station-price-display" style="color: var(--danger); font-size: 1.35rem; display: flex; align-items: center; justify-content: flex-end;">
          <span style="font-weight: 800; letter-spacing: 0.05em;">CLOSED</span>
        </div>
      `;
    } else if (cp.hasNoRates) {
      const labelText = cp.isSeasonOnly ? "SEASON ONLY" : "RESTRICTED";
      pricingHtml = `
        <div class="station-price-display" style="color: #f59e0b; font-size: 1.1rem; display: flex; align-items: center; justify-content: flex-end;">
          <span style="font-weight: 800; letter-spacing: 0.05em;">${labelText}</span>
        </div>
      `;
    }

    row.innerHTML = `
      ${bestDealBadgeHtml}
      <div class="station-row-main">
        <!-- Info: Name & Address -->
        <div class="station-info">
          <span class="station-name">${cp.development}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${cp.locationString}</span>
          ${warningBadgeHtml}
        </div>

        <!-- Rates Description Summary -->
        <div class="station-rates-summary">
          ${cp.rateSummary}
        </div>

        <!-- Pricing & Badges -->
        <div class="station-pricing-badges">
          ${pricingHtml}
          <div style="display: flex; gap: 0.4rem; align-items: center; margin-top: 0.2rem;">
            ${distanceBadgeHtml}
          </div>
        </div>
      </div>
    `;

    // Breakdown section toggle inside actions column
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'station-actions';

    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'details-btn';
    detailsBtn.style.margin = '0';
    detailsBtn.innerHTML = `<i data-lucide="info" style="width: 14px; height: 14px;"></i> Details`;

    const mathDetails = document.createElement('div');
    mathDetails.className = 'math-details';
    if (cp.isClosed) {
      mathDetails.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.4rem; color: var(--danger); display: flex; align-items: center; gap: 0.3rem;"><i data-lucide="info" style="width: 14px; height: 14px;"></i> Carpark Closure Info:</div>
        ${breakdownHtml}
      `;
    } else if (cp.hasNoRates) {
      mathDetails.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.4rem; color: #f59e0b; display: flex; align-items: center; gap: 0.3rem;"><i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Restricted Parking Info:</div>
        ${breakdownHtml}
      `;
    } else {
      mathDetails.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.4rem; color: var(--text);">Session Cost Breakdown:</div>
        ${breakdownHtml}
        <div style="font-weight: 600; margin-top: 0.4rem; border-top: 1px solid var(--surface-border); padding-top: 0.4rem; display: flex; justify-content: space-between; color: var(--text);">
          <span>Total Calculated:</span>
          <span>S$ ${cp.totalCost.toFixed(2)}</span>
        </div>
      `;
    }

    detailsBtn.addEventListener('click', () => {
      mathDetails.classList.toggle('show');
      if (mathDetails.classList.contains('show')) {
        detailsBtn.innerHTML = `<i data-lucide="info" style="width: 14px; height: 14px;"></i> Hide`;
      } else {
        detailsBtn.innerHTML = `<i data-lucide="info" style="width: 14px; height: 14px;"></i> Details`;
      }
      lucide.createIcons();
    });

    actionsDiv.appendChild(detailsBtn);
    row.appendChild(actionsDiv);
    row.appendChild(mathDetails);
    
    carparkGrid.appendChild(row);
  });

  lucide.createIcons();
}

// Run init
window.addEventListener('DOMContentLoaded', init);
