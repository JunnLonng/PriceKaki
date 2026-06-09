/**
 * PriceKaki Carpark Pricing Calculator Engine
 * Simulates session transitions and computes total parking cost.
 */

/**
 * Parses time string (HH:MM) to minutes from midnight.
 * @param {string} timeStr - Time string, e.g., "14:30"
 * @returns {number} Minutes from midnight
 */
function parseTimeToMins(timeStr) {
  if (!timeStr) return 0;
  
  // Clean and normalize input
  const cleanStr = timeStr.trim().toLowerCase();
  
  // 1. Match standard time with colon like 11:18 PM or 23:18
  const match12 = cleanStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const ampm = match12[3];
    
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  }
  
  // 2. Match time without colon like 1118PM, 2318
  const matchNoColon = cleanStr.match(/^(\d{1,2})(\d{2})\s*(am|pm)?$/);
  if (matchNoColon) {
    let hours = parseInt(matchNoColon[1], 10);
    const minutes = parseInt(matchNoColon[2], 10);
    const ampm = matchNoColon[3];
    
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  }
  
  // 3. Fallback to simple colon split
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Formats minutes from midnight to time string (HH:MM).
 * @param {number} mins - Minutes from midnight
 * @returns {string} HH:MM string
 */
function formatMinsToTime(mins) {
  const h = Math.floor((mins % 1440) / 60);
  const m = Math.floor((mins % 1440) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Finds the active rate window for a given time (in minutes from midnight).
 * 
 * @param {array} sessionRates - Array of rate windows for a specific day and vehicle type
 * @param {number} timeMins - Current time in minutes from midnight
 * @returns {object|null} The active rate window object
 */
function findActiveSession(sessionRates, timeMins) {
  if (!sessionRates || sessionRates.length === 0) return null;
  const normalizedMins = timeMins % 1440;
  
  return sessionRates.find(r => {
    const startMins = parseTimeToMins(r.start);
    const endMins = parseTimeToMins(r.end);
    
    if (startMins < endMins) {
      return normalizedMins >= startMins && normalizedMins <= endMins;
    } else {
      // Overnight session (e.g., 17:00 to 07:59) OR 24-hour session (start === end)
      return normalizedMins >= startMins || normalizedMins <= endMins;
    }
  });
}

/**
 * Calculates the total parking cost and session breakdown for a carpark.
 * 
 * @param {object} carpark - Carpark object from PARKING_DATABASE
 * @param {string} vehicleType - "car" or "motorcycle"
 * @param {string} dayType - "weekday", "saturday", or "sunday"
 * @param {string} entryTimeStr - HH:MM time, e.g. "14:30"
 * @param {number} durationMins - Parking duration in minutes
 * @returns {object} { totalCost, breakdown: [...] }
 */
function calculateParkingCost(carpark, vehicleType, dayType, entryTimeStr, durationMins) {
  const duration = Number(durationMins);
  if (!carpark || !carpark.rates || isNaN(duration) || duration <= 0) {
    return { totalCost: 0, breakdown: [] };
  }

  const vRates = carpark.rates[vehicleType];
  if (!vRates) {
    return { totalCost: 0, breakdown: [] };
  }

  let dayRates = vRates[dayType];
  if (!dayRates || dayRates.length === 0) {
    dayRates = vRates["weekday"];
  }
  if (!dayRates || dayRates.length === 0) {
    return { totalCost: 0, breakdown: [] };
  }

  let currentMins = parseTimeToMins(entryTimeStr);
  let remainingMins = duration;
  let totalCost = 0;
  const breakdown = [];

  // To prevent infinite loops in case of misconfigured database sessions
  let loopCount = 0;
  const maxLoops = 20;

  while (remainingMins > 0 && loopCount < maxLoops) {
    loopCount++;
    const session = findActiveSession(dayRates, currentMins);
    if (!session) {
      // If no session covers this time, skip to next minute or break
      breakdown.push({
        sessionName: "N/A",
        duration: remainingMins,
        cost: 0,
        rateDesc: "No rate data for this time."
      });
      break;
    }

    const startMins = parseTimeToMins(session.start);
    const endMins = parseTimeToMins(session.end);
    const normalizedMins = currentMins % 1440;

    // Calculate how many minutes are available in the current session window
    let minsAvailableInSession = 0;
    if (startMins < endMins) {
      minsAvailableInSession = endMins - normalizedMins + 1;
    } else {
      // Overnight session (e.g. 17:00 to 07:59) OR 24-hour session (start === end)
      if (normalizedMins >= startMins) {
        minsAvailableInSession = 1440 - normalizedMins + endMins + 1;
      } else {
        minsAvailableInSession = endMins - normalizedMins + 1;
      }
    }

    const minsSpent = Math.min(remainingMins, minsAvailableInSession);
    let sessionCost = 0;
    let rateDesc = "";

    if (session.type === "flat") {
      sessionCost = session.first_rate;
      rateDesc = `S$ ${session.first_rate.toFixed(2)} flat entry rate`;
    } else {
      // Hourly rate calculation
      const firstUnit = session.first_unit || 60;
      const firstRate = session.first_rate || 0;
      const subseqUnit = session.subseq_unit || 30;
      const subseqRate = session.subseq_rate || 0;

      if (minsSpent <= firstUnit) {
        sessionCost = firstRate;
      } else {
        sessionCost = firstRate + Math.ceil((minsSpent - firstUnit) / subseqUnit) * subseqRate;
      }
      rateDesc = `S$ ${firstRate.toFixed(2)} for 1st ${firstUnit}m, then S$ ${subseqRate.toFixed(2)} per ${subseqUnit}m`;
    }

    totalCost += sessionCost;
    breakdown.push({
      sessionName: `${session.start} - ${session.end}`,
      duration: minsSpent,
      cost: sessionCost,
      rateDesc: rateDesc
    });

    currentMins += minsSpent;
    remainingMins -= minsSpent;
  }

  return {
    totalCost: parseFloat(totalCost.toFixed(2)),
    breakdown: breakdown
  };
}

/**
 * Gets a clean text summary of rate rules for a specific day type.
 * @param {object} carpark - Carpark object
 * @param {string} vehicleType - "car" or "motorcycle"
 * @param {string} dayType - "weekday", "saturday", or "sunday"
 * @returns {string} Text summary
 */
function getRateSummary(carpark, vehicleType, dayType) {
  if (!carpark || !carpark.rates) return "Rates not available";
  const vRates = carpark.rates[vehicleType];
  if (!vRates) return "Vehicle type not supported";
  let dayRates = vRates[dayType];
  if (!dayRates || dayRates.length === 0) {
    dayRates = vRates["weekday"];
  }
  if (!dayRates || dayRates.length === 0) return "Rates not available";

  return dayRates.map(r => {
    const timePrefix = (r.start === "00:00" && r.end === "23:59") ? "" : `${r.start}-${r.end}: `;
    if (r.type === "flat") {
      const priceStr = r.first_rate === 0 ? "Free" : `S$ ${r.first_rate.toFixed(2)}`;
      return `${timePrefix}${priceStr} per entry`;
    } else {
      const priceStr = r.first_rate === 0 ? "Free" : `S$ ${r.first_rate.toFixed(2)}`;
      const subseqPriceStr = r.subseq_rate === 0 ? "Free" : `S$ ${r.subseq_rate.toFixed(2)}`;
      
      if (r.first_rate === 0 && r.subseq_rate === 0) {
        return `${timePrefix}Free`;
      }
      
      const firstPart = r.first_rate === 0 ? `Free for 1st ${r.first_unit}m` : `${priceStr}/1st ${r.first_unit}m`;
      const subseqPart = r.subseq_rate === 0 ? `then Free` : `then ${subseqPriceStr}/${r.subseq_unit}m`;
      return `${timePrefix}${firstPart}, ${subseqPart}`;
    }
  }).join(" | ");
}

/**
 * Calculates straight-line distance in kilometers between two lat/lng coordinates using the Haversine formula.
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
