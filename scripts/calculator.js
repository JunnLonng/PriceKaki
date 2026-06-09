/**
 * PriceKaki Calculator Engine
 * Handles upfront discount calculations and refueling cost conversions.
 */

/**
 * Calculates the upfront discounted price for a specific brand and fuel grade.
 * 
 * @param {number} boardPrice - The base price per litre
 * @param {object} cardDiscount - The discount object for the brand from CARD_DATABASE (can be undefined)
 * @param {object} loyaltyToggles - Object containing active loyalty cards { essoSmiles: true, ... }
 * @param {string} brand - The brand ID (shell, esso, spc, caltex, sinopec)
 * @returns {object} { discountPercent, discountedPrice }
 */
function calculatePrices(boardPrice, cardDiscount, loyaltyToggles, brand) {
  if (!boardPrice) {
    return {
      discountPercent: 0,
      discountedPrice: null
    };
  }

  let discountPercent = 0;

  if (brand === 'esso') {
    let essoDiscount = cardDiscount ? (cardDiscount.instant || 0) : 0;
    if (loyaltyToggles.essoSmiles) {
      if (essoDiscount === 0) {
        essoDiscount = 14.0; // Standard Smiles loyalty baseline
      }
      discountPercent = essoDiscount;
    } else {
      // Smiles card is required to maintain the baseline Smiles discount
      discountPercent = Math.max(0, essoDiscount - 4.0);
    }
  } else if (brand === 'spc') {
    let spcDiscount = cardDiscount ? (cardDiscount.instant || 0) : 0;
    if (loyaltyToggles.spcAndU) {
      if (spcDiscount === 0) {
        spcDiscount = 10.0; // Standard SPC baseline
      }
      discountPercent = spcDiscount + 5.0; // SPC&U adds 5% instant discount
    } else {
      discountPercent = spcDiscount;
    }
  } else if (brand === 'shell') {
    let shellDiscount = cardDiscount ? (cardDiscount.instant || 0) : 0;
    if (loyaltyToggles.shellGo) {
      if (shellDiscount === 0) {
        shellDiscount = 10.0; // Standard Shell GO+ loyalty baseline
      }
      discountPercent = shellDiscount;
    } else {
      if (shellDiscount > 14.0) {
        discountPercent = 14.0; // UOB One requires Shell GO+ for the extra 3%
      } else {
        discountPercent = shellDiscount;
      }
    }
  } else if (brand === 'caltex') {
    let caltexDiscount = cardDiscount ? ((cardDiscount.instant || 0) + (cardDiscount.appBonus || 0)) : 0;
    if (loyaltyToggles.linkRewards) {
      if (caltexDiscount === 0) {
        caltexDiscount = 14.0; // Standard Caltex loyalty baseline
      }
      discountPercent = caltexDiscount;
    } else {
      discountPercent = caltexDiscount;
    }
  } else if (brand === 'sinopec') {
    let sinopecDiscount = cardDiscount ? (cardDiscount.instant || 0) : 0;
    if (loyaltyToggles.sinopecX) {
      if (sinopecDiscount === 0) {
        sinopecDiscount = 18.0; // Standard Sinopec loyalty baseline
      }
      discountPercent = sinopecDiscount;
    } else {
      discountPercent = sinopecDiscount;
    }
  }

  // Calculate upfront price (what the user pays at the pump/cashier)
  const discountedPrice = boardPrice * (1 - discountPercent / 100);

  return {
    discountPercent: parseFloat(discountPercent.toFixed(2)),
    discountedPrice: parseFloat(discountedPrice.toFixed(3))
  };
}

/**
 * Calculates refueling statistics (litres, cash outlay, total savings).
 * 
 * @param {number} boardPrice - Base price per litre
 * @param {number} discountedPrice - Discounted price per litre (what user pays upfront)
 * @param {string} mode - 'spend' (S$) or 'volume' (L)
 * @param {number} amount - The user input target value
 * @returns {object} { litres, cashOutlay, totalSavings, boardValue }
 */
function calculateRefuelingStats(boardPrice, discountedPrice, mode, amount) {
  if (!boardPrice || !discountedPrice || !amount || amount <= 0) {
    return {
      litres: 0,
      cashOutlay: 0,
      totalSavings: 0,
      boardValue: 0
    };
  }

  let litres = 0;
  let cashOutlay = 0;
  let boardValue = 0;

  if (mode === 'spend') {
    // Amount represents the target cash outlay at the station (e.g. S$100 to pay)
    cashOutlay = amount;
    litres = cashOutlay / discountedPrice;
    boardValue = litres * boardPrice;
  } else {
    // Amount represents the target volume in Litres (e.g. 40L)
    litres = amount;
    cashOutlay = litres * discountedPrice;
    boardValue = litres * boardPrice;
  }

  const totalSavings = boardValue - cashOutlay;

  return {
    litres: parseFloat(litres.toFixed(2)),
    cashOutlay: parseFloat(cashOutlay.toFixed(2)),
    totalSavings: parseFloat(totalSavings.toFixed(2)),
    boardValue: parseFloat(boardValue.toFixed(2))
  };
}

/**
 * Calculates the effective discounted rate per kWh for an EV provider.
 * 
 * @param {number} baseRate - The baseline S$/kWh charge rate
 * @param {number} cardRebate - Card cashback percentage
 * @returns {object} { rebatePercent, discountedRate }
 */
function calculateEvPrices(baseRate, cardRebate) {
  if (!baseRate) {
    return {
      rebatePercent: 0,
      discountedRate: null
    };
  }
  const rebatePercent = cardRebate || 0;
  const discountedRate = baseRate * (1 - rebatePercent / 100);
  return {
    rebatePercent: parseFloat(rebatePercent.toFixed(1)),
    discountedRate: parseFloat(discountedRate.toFixed(3))
  };
}

/**
 * Estimates EV charging duration based on average charger speeds.
 * AC average: 11 kW, DC average: 50 kW.
 * 
 * @param {number} kwh - Energy required
 * @param {string} chargerType - 'ac' or 'dc'
 * @returns {string} Estimated time duration
 */
function estimateChargingTime(kwh, chargerType) {
  if (!kwh || kwh <= 0) return "0 mins";
  const rate = chargerType === 'ac' ? 11 : 50; // kW average speed
  const hours = kwh / rate;
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} mins`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Calculates EV charging stats (kWh, cost before/after rebate, savings, charging time).
 * 
 * @param {number} baseRate - Base price per kWh
 * @param {number} discountedRate - Rebated price per kWh
 * @param {string} mode - 'spend' (S$) or 'volume' (kWh)
 * @param {number} amount - The user input target
 * @param {string} chargerType - 'ac' or 'dc'
 * @returns {object} Charging statistics
 */
function calculateEvChargingStats(baseRate, discountedRate, mode, amount, chargerType) {
  if (!baseRate || !discountedRate || !amount || amount <= 0) {
    return {
      kwh: 0,
      cashOutlay: 0,
      totalSavings: 0,
      boardValue: 0,
      timeString: "0 mins",
      rangeKm: 0
    };
  }

  let kwh = 0;
  let cashOutlay = 0;
  let boardValue = 0;
  let timeString = "0 mins";

  if (mode === 'spend') {
    cashOutlay = amount;
    kwh = cashOutlay / discountedRate;
    boardValue = kwh * baseRate;
    timeString = estimateChargingTime(kwh, chargerType);
  } else if (mode === 'duration') {
    // Mode duration: amount is in minutes
    const kwSpeed = chargerType === 'ac' ? 11 : 50; // kW speed
    kwh = (amount / 60) * kwSpeed;
    cashOutlay = kwh * discountedRate;
    boardValue = kwh * baseRate;
    
    // Format duration string
    const totalMinutes = Math.round(amount);
    if (totalMinutes < 60) {
      timeString = `${totalMinutes} mins`;
    } else {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      timeString = m === 0 ? `${h}h` : `${h}h ${m}m`;
    }
  } else {
    kwh = amount;
    cashOutlay = kwh * discountedRate;
    boardValue = kwh * baseRate;
    timeString = estimateChargingTime(kwh, chargerType);
  }

  const totalSavings = boardValue - cashOutlay;
  const rangeKm = kwh * 6.0; // 6 km per kWh is average efficiency (16.6 kWh/100km)

  return {
    kwh: parseFloat(kwh.toFixed(2)),
    cashOutlay: parseFloat(cashOutlay.toFixed(2)),
    totalSavings: parseFloat(totalSavings.toFixed(2)),
    boardValue: parseFloat(boardValue.toFixed(2)),
    timeString,
    rangeKm: parseFloat(rangeKm.toFixed(1))
  };
}
