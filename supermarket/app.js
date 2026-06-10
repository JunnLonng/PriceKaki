// PriceKaki Supermarket Price Comparator Controller

// App State
const state = {
  products: [],
  metadata: {},
  basket: [], // Array of product IDs in basket
  filters: {
    search: '',
    category: 'all',
    sort: 'name_asc'
  }
};

// DOM Elements
const productGrid = document.getElementById('productGrid');
const productSearch = document.getElementById('productSearch');
const sortSelect = document.getElementById('sortSelect');
const categoryPills = document.getElementById('categoryPills');
const lastUpdatedDateEl = document.getElementById('lastUpdatedDate');
const warningBanner = document.getElementById('warningBanner');
const failedSourcesEl = document.getElementById('failedSources');
const basketPanel = document.getElementById('basketPanel');
const basketItemList = document.getElementById('basketItemList');
const totalFairPriceEl = document.getElementById('totalFairPrice');
const totalShengSiongEl = document.getElementById('totalShengSiong');
const totalCardFairPrice = document.getElementById('totalCardFairPrice');
const totalCardShengSiong = document.getElementById('totalCardShengSiong');
const basketSummaryWinner = document.getElementById('basketSummaryWinner');
const themeToggleBtn = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

// Initialize App
async function init() {
  // Setup Theme System
  initTheme();
  setupThemeListener();
  
  // Load Supermarket Data
  try {
    const response = await fetch('../data/supermarket_data.json');
    if (response.ok) {
      const db = await response.json();
      state.products = db.products || [];
      state.metadata = db.metadata || {};
      
      // Update UI components
      updateMetadataUI();
      updateCategoryCounts();
      renderProducts();
    } else {
      console.error("Failed to load supermarket database", response.status);
    }
  } catch (err) {
    console.error("Error fetching data/supermarket_data.json", err);
  }

  // Setup Event Listeners
  setupEventListeners();
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('pricekaki_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);
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

function setupThemeListener() {
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pricekaki_theme', newTheme);
    updateThemeIcons(newTheme);
  });
}

// Update Scrape Metadata (Timestamp & Warnings)
function updateMetadataUI() {
  if (state.metadata.lastUpdated) {
    lastUpdatedDateEl.textContent = state.metadata.lastUpdated;
  }
  
  // Check for failed sources (fault-tolerance feedback)
  const failedSources = [];
  if (state.metadata.sources) {
    for (const source in state.metadata.sources) {
      if (state.metadata.sources[source].status === 'failed') {
        const sourceDisplayName = source === 'fairprice' ? 'NTUC FairPrice' : 'Sheng Siong';
        failedSources.push(sourceDisplayName);
      }
    }
  }
  
  if (failedSources.length > 0) {
    warningBanner.style.display = 'flex';
    failedSourcesEl.textContent = failedSources.join(', ');
  } else {
    warningBanner.style.display = 'none';
  }
}

// Update Category Item Counts on sidebar badges
function updateCategoryCounts() {
  const counts = {
    all: state.products.length,
    dairy_eggs: 0,
    bakery_bread: 0,
    cooking_essentials: 0,
    fresh_produce: 0,
    beverages: 0,
    household_personal: 0
  };
  
  state.products.forEach(p => {
    if (counts[p.category] !== undefined) {
      counts[p.category]++;
    }
  });
  
  for (const cat in counts) {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = counts[cat];
  }
}

// Filter and Sort Products
function getFilteredAndSortedProducts() {
  // 1. Text Search Filter
  let result = state.products.filter(p => {
    const q = state.filters.search.toLowerCase().trim();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });
  
  // 2. Category Filter
  if (state.filters.category !== 'all') {
    result = result.filter(p => p.category === state.filters.category);
  }
  
  // 3. Sorting
  if (state.filters.sort === 'name_asc') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.filters.sort === 'name_desc') {
    result.sort((a, b) => b.name.localeCompare(a.name));
  } else if (state.filters.sort === 'price_diff_desc') {
    result.sort((a, b) => {
      const diffA = Math.abs((a.prices.fairprice?.price || 0) - (a.prices.shengsiong?.price || 0));
      const diffB = Math.abs((b.prices.fairprice?.price || 0) - (b.prices.shengsiong?.price || 0));
      return diffB - diffA;
    });
  }
  
  return result;
}

// Render Products Grid
function renderProducts() {
  productGrid.innerHTML = '';
  const list = getFilteredAndSortedProducts();
  
  if (list.length === 0) {
    productGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i data-lucide="shopping-bag" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
        <p style="font-size: 1.1rem; font-weight: 600;">No products match your search/filters.</p>
        <p style="font-size: 0.9rem; margin-top: 0.25rem;">Try typing another keyword or selecting a different category.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Resolve prices
    const fpPrice = p.prices.fairprice?.price;
    const ssPrice = p.prices.shengsiong?.price;
    
    // Determine cheapest
    const hasBoth = fpPrice !== undefined && ssPrice !== undefined;
    const isFpCheaper = hasBoth && fpPrice < ssPrice;
    const isSsCheaper = hasBoth && ssPrice < fpPrice;
    
    const fpClass = isFpCheaper ? 'cheapest-store' : '';
    const ssClass = isSsCheaper ? 'cheapest-store' : '';
    
    // Check if item is already in basket
    const isInBasket = state.basket.includes(p.id);
    const basketBtnText = isInBasket ? 'Added to Basket' : 'Add to Basket';
    const basketBtnClass = isInBasket ? 'basket-add-btn added' : 'basket-add-btn';
    const basketIcon = isInBasket ? 'check' : 'shopping-cart';
    
    const fpBadge = isFpCheaper ? '<span style="background: var(--accent); color: white; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 0.25rem; margin-left: 0.4rem; vertical-align: middle;">Cheapest</span>' : '';
    const ssBadge = isSsCheaper ? '<span style="background: var(--accent); color: white; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 0.25rem; margin-left: 0.4rem; vertical-align: middle;">Cheapest</span>' : '';

    card.innerHTML = `
      <div>
        <div class="product-image-container">
          <img src="${p.image}" alt="${p.name}" onerror="this.src='https://placehold.co/120?text=Product';">
        </div>
        <div class="product-category-tag">${p.category.replace('_', ' & ')}</div>
        <div class="product-title" title="${p.name}">${p.name}</div>
        
        <table class="price-compare-table">
          <tr class="price-compare-row ${fpClass}">
            <td class="store-name" style="display: flex; align-items: center; gap: 0.4rem; height: 1.8rem;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></span>
              <span>FairPrice</span>
            </td>
            <td class="store-val">
              ${fpPrice ? `S$ ${fpPrice.toFixed(2)}` : 'N/A'}${fpBadge}
            </td>
          </tr>
          <tr class="price-compare-row ${ssClass}">
            <td class="store-name" style="display: flex; align-items: center; gap: 0.4rem; height: 1.8rem;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
              <span>Sheng Siong</span>
            </td>
            <td class="store-val">
              ${ssPrice ? `S$ ${ssPrice.toFixed(2)}` : 'N/A'}${ssBadge}
            </td>
          </tr>
        </table>
      </div>
      
      <div>
        <button class="${basketBtnClass}" data-id="${p.id}">
          <i data-lucide="${basketIcon}" style="width: 15px; height: 15px;"></i>
          <span>${basketBtnText}</span>
        </button>
      </div>
    `;
    
    // Setup add-to-basket button listener
    const addBtn = card.querySelector('.basket-add-btn');
    addBtn.addEventListener('click', () => {
      toggleBasketItem(p.id);
    });
    
    productGrid.appendChild(card);
  });
  
  lucide.createIcons();
}

// Setup Event Listeners
function setupEventListeners() {
  // Search input change
  productSearch.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderProducts();
  });
  
  // Sort selector change
  sortSelect.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderProducts();
  });
  
  // Category Pill toggling
  const pills = categoryPills.querySelectorAll('.category-pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      state.filters.category = pill.getAttribute('data-category');
      renderProducts();
    });
  });
}

// Toggle Basket Item
function toggleBasketItem(productId) {
  const idx = state.basket.indexOf(productId);
  if (idx > -1) {
    state.basket.splice(idx, 1);
  } else {
    state.basket.push(productId);
  }
  
  // Update UI lists and calculations
  updateBasketUI();
  renderProducts(); // Refresh add/added states on grids
}

// Update Basket Calculator UI panel
function updateBasketUI() {
  if (state.basket.length === 0) {
    basketPanel.style.display = 'none';
    return;
  }
  
  basketPanel.style.display = 'block';
  basketItemList.innerHTML = '';
  
  let totalFP = 0;
  let totalSS = 0;
  let hasFpMissing = false;
  let hasSsMissing = false;
  
  state.basket.forEach(pId => {
    const product = state.products.find(p => p.id === pId);
    if (!product) return;
    
    const fpPrice = product.prices.fairprice?.price;
    const ssPrice = product.prices.shengsiong?.price;
    
    if (fpPrice !== undefined) totalFP += fpPrice; else hasFpMissing = true;
    if (ssPrice !== undefined) totalSS += ssPrice; else hasSsMissing = true;
    
    // Create list row in calculator
    const row = document.createElement('div');
    row.className = 'basket-item';
    row.innerHTML = `
      <span style="font-weight: 550; display: inline-block; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.name}</span>
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <span style="font-size: 0.8rem; color: var(--text-muted);">
          FP: ${fpPrice ? `S$${fpPrice.toFixed(2)}` : '-'} | SS: ${ssPrice ? `S$${ssPrice.toFixed(2)}` : '-'}
        </span>
        <button class="remove-btn" title="Remove Item">
          <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
        </button>
      </div>
    `;
    
    row.querySelector('.remove-btn').addEventListener('click', () => {
      toggleBasketItem(pId);
    });
    
    basketItemList.appendChild(row);
  });
  
  // Display totals
  totalFairPriceEl.textContent = hasFpMissing ? 'N/A (Missing rates)' : `S$ ${totalFP.toFixed(2)}`;
  totalShengSiongEl.textContent = hasSsMissing ? 'N/A (Missing rates)' : `S$ ${totalSS.toFixed(2)}`;
  
  // Highlight winner store card
  totalCardFairPrice.classList.remove('winner');
  totalCardShengSiong.classList.remove('winner');
  basketSummaryWinner.style.display = 'none';
  
  if (!hasFpMissing && !hasSsMissing) {
    if (totalFP < totalSS) {
      totalCardFairPrice.classList.add('winner');
      basketSummaryWinner.style.display = 'block';
      const saving = totalSS - totalFP;
      basketSummaryWinner.textContent = `FairPrice is S$ ${saving.toFixed(2)} cheaper for this basket!`;
    } else if (totalSS < totalFP) {
      totalCardShengSiong.classList.add('winner');
      basketSummaryWinner.style.display = 'block';
      const saving = totalFP - totalSS;
      basketSummaryWinner.textContent = `Sheng Siong is S$ ${saving.toFixed(2)} cheaper for this basket!`;
    } else {
      basketSummaryWinner.style.display = 'block';
      basketSummaryWinner.textContent = `Both stores have the exact same total price!`;
    }
  }
  
  lucide.createIcons();
}

// Start application on page load
document.addEventListener('DOMContentLoaded', init);
