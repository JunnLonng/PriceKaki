/**
 * PriceKaki Central Database
 * Contains Singapore board prices, EV charging rates, and credit card discount rules.
 * Last updated: June 2026
 */

// Current board prices in SGD per litre (before discounts)
const PUMP_PRICES = {
  shell: {
    name: "Shell",
    logoUrl: "https://www.motorist.sg/assets/shelllogo-111067bc33065d01148f06461db9342edf34f25f34ceb118ffcb14796321b76d.svg",
    ron92: null, // Shell does not sell RON 92 in Singapore
    ron95: 3.49,
    ron98: 4.01,
    premium: 4.23, // V-Power
    diesel: 4.45
  },
  spc: {
    name: "SPC",
    logoUrl: "https://www.motorist.sg/assets/spclogo-94a28a33043dc4acfebbfa864b1607d1eec56d5894d54a27ee8cdaa4ff125212.svg",
    ron92: 3.39,
    ron95: 3.42,
    ron98: 3.93,
    premium: null,
    diesel: 4.32
  },
  esso: {
    name: "Esso",
    logoUrl: "https://www.motorist.sg/assets/essologo-1c1228df36a3226673796b3ac0dc40ae2b6c14dabd173b70bb13c4f641cf4ab9.svg",
    ron92: 3.43,
    ron95: 3.46,
    ron98: 3.98,
    premium: null, // Esso Supreme is priced similarly to 98
    diesel: 4.48
  },
  caltex: {
    name: "Caltex",
    logoUrl: "https://www.motorist.sg/assets/caltexlogo-e199a0f165b3bc8126e8b657086d4053469d6d7df741377cbf1899cd2b95fcfd.svg",
    ron92: 3.43,
    ron95: 3.47,
    ron98: null,
    premium: 4.16, // Platinum 98
    diesel: 4.48
  },
  sinopec: {
    name: "Sinopec",
    logoUrl: "https://www.motorist.sg/assets/sinopeclogo-b72f44fa15419cb25038f0836824177e656ab440820fd9f96a1af497526ce7b0.svg",
    ron92: null,
    ron95: 3.46,
    ron98: 3.97,
    premium: 4.10, // Sino X Power
    diesel: 4.41
  }
};

// Current EV Charging rates in SGD per kWh
const EV_PROVIDERS = {
  spgroup: {
    name: "SP Group",
    logoUrl: "https://api.companyenrich.com/logo/spgroup.com.sg",
    ac: 0.65,
    dc: 0.77
  },
  cdgengie: {
    name: "CDG Engie",
    logoUrl: "https://api.companyenrich.com/logo/comfortdelgro.com",
    ac: 0.64,
    dc: 0.76
  },
  chargeplus: {
    name: "Charge+",
    logoUrl: "https://api.companyenrich.com/logo/chargeplus.com",
    ac: 0.63,
    dc: 0.75
  },
  shellrecharge: {
    name: "Shell Recharge",
    logoUrl: "https://www.motorist.sg/assets/shelllogo-111067bc33065d01148f06461db9342edf34f25f34ceb118ffcb14796321b76d.svg",
    ac: 0.68,
    dc: 0.80
  },
  tesla: {
    name: "Tesla",
    logoUrl: "https://api.companyenrich.com/logo/tesla.com",
    ac: 0.60,
    dc: 0.79
  },
  byd: {
    name: "BYD",
    logoUrl: "https://api.companyenrich.com/logo/byd.com",
    ac: 0.62,
    dc: 0.74
  }
};

// Loyalty card rules (instant discounts added when toggled)
const LOYALTY_RULES = {
  essoSmiles: {
    id: "essoSmiles",
    name: "Esso Smiles Card",
    brand: "esso",
    instant: 0.0,
    description: "Earn Smiles Points to redeem fuel vouchers."
  },
  shellGo: {
    id: "shellGo",
    name: "Shell GO+",
    brand: "shell",
    instant: 0.0,
    description: "Earn Shell GO+ points to redeem fuel vouchers."
  },
  spcAndU: {
    id: "spcAndU",
    name: "SPC&U Card",
    brand: "spc",
    instant: 5.0,
    description: "Get 5% instant discount at the pump."
  },
  linkRewards: {
    id: "linkRewards",
    name: "Link Rewards (Caltex)",
    brand: "caltex",
    instant: 0.0,
    description: "Earn Linkpoints to offset future fuel purchases."
  },
  sinopecX: {
    id: "sinopecX",
    name: "Sinopec X Card",
    brand: "sinopec",
    instant: 0.0,
    description: "Earn Sinopec points to redeem fuel vouchers."
  }
};

// Credit/Debit Cards database grouped by Bank
const CARD_DATABASE = {
  none: {
    bankName: "None",
    cards: [
      {
        id: "cash-no-discount",
        name: "Cash / NETS (0% discount)",
        evRebate: 0.0,
        discounts: {
          shell: { instant: 0.0, appBonus: 0.0, description: "No discount applied." },
          esso: { instant: 0.0, appBonus: 0.0, description: "No discount applied." },
          caltex: { instant: 0.0, appBonus: 0.0, description: "No discount applied." },
          spc: { instant: 0.0, appBonus: 0.0, description: "No discount applied." },
          sinopec: { instant: 0.0, appBonus: 0.0, description: "No discount applied." }
        }
      },
      {
        id: "no-card",
        name: "Other Bank Cards (Baseline)",
        evRebate: 0.0,
        discounts: {
          shell: { instant: 10.0, appBonus: 0.0, description: "Standard 10% instant card discount." },
          esso: { instant: 14.0, appBonus: 0.0, description: "Standard 14% Smiles card discount." },
          caltex: { instant: 14.0, appBonus: 0.0, description: "Standard 14% instant discount." },
          spc: { instant: 10.0, appBonus: 0.0, description: "Standard 10% instant discount." },
          sinopec: { instant: 18.0, appBonus: 0.0, description: "Standard 18% instant discount." }
        }
      }
    ]
  },
  dbs: {
    bankName: "DBS / POSB",
    cards: [
      {
        id: "dbs-esso",
        name: "DBS Esso Card",
        evRebate: 0.0,
        discounts: {
          esso: { instant: 18.0, appBonus: 0.0, description: "18% instant fuel savings (includes Smiles card discount)." }
        }
      },
      {
        id: "posb-everyday",
        name: "POSB Everyday Card",
        evRebate: 5.0,
        discounts: {
          spc: { instant: 10.0, appBonus: 0.0, description: "10% instant card discount (plus SPC&U member = 15% upfront) + 6% POSB cash rebate." },
          esso: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." }
        }
      },
      {
        id: "dbs-generic",
        name: "Other DBS/POSB Cards",
        evRebate: 0.0,
        discounts: {
          esso: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." },
          spc: { instant: 10.0, appBonus: 0.0, description: "10% instant discount." }
        }
      }
    ]
  },
  uob: {
    bankName: "UOB",
    cards: [
      {
        id: "uob-one",
        name: "UOB One Credit Card",
        evRebate: 5.0,
        discounts: {
          shell: { instant: 17.0, appBonus: 0.0, description: "17% instant discount (includes UOB card and Shell GO+ discounts) + up to 5% UOB One cashback." },
          spc: { instant: 15.0, appBonus: 0.0, description: "15% instant card discount + up to 5% UOB One cashback." },
          caltex: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." }
        }
      },
      {
        id: "uob-reserve",
        name: "UOB Reserve Card",
        evRebate: 0.0,
        discounts: {
          shell: { instant: 17.0, appBonus: 0.0, description: "17% instant discount (10% Shell GO+ + 7% Reserve card discount)." },
          spc: { instant: 15.0, appBonus: 0.0, description: "15% instant card discount." },
          caltex: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." }
        }
      },
      {
        id: "uob-generic",
        name: "Other UOB Credit/Debit Cards",
        evRebate: 0.0,
        discounts: {
          shell: { instant: 14.0, appBonus: 0.0, description: "14% instant discount (10% Shell GO+ + 4% upfront discount)." },
          spc: { instant: 15.0, appBonus: 0.0, description: "15% instant card discount." },
          caltex: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." }
        }
      }
    ]
  },
  ocbc: {
    bankName: "OCBC",
    cards: [
      {
        id: "ocbc-365",
        name: "OCBC 365 Credit Card",
        evRebate: 5.0,
        discounts: {
          caltex: { instant: 16.0, appBonus: 2.0, description: "16% instant + 2% CaltexGO payment bonus (18% total upfront discount) + 6% fuel cashback." },
          esso: { instant: 14.0, appBonus: 0.0, description: "14% instant discount + 6% fuel cashback." },
          sinopec: { instant: 26.8, appBonus: 0.0, description: "26.8% instant discount at Sinopec." }
        }
      },
      {
        id: "ocbc-generic",
        name: "Other OCBC Cards",
        evRebate: 0.0,
        discounts: {
          caltex: { instant: 16.0, appBonus: 2.0, description: "16% instant + 2% CaltexGO payment bonus (18% total upfront discount)." },
          esso: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." },
          sinopec: { instant: 20.0, appBonus: 0.0, description: "20% instant discount." }
        }
      }
    ]
  },
  citi: {
    bankName: "Citibank",
    cards: [
      {
        id: "citi-cashback",
        name: "Citi Cash Back Card",
        evRebate: 0.0,
        discounts: {
          esso: { instant: 14.0, appBonus: 0.0, description: "14% instant discount + 8% fuel cashback." },
          shell: { instant: 14.0, appBonus: 0.0, description: "14% instant discount + 8% fuel cashback." },
          caltex: { instant: 14.0, appBonus: 3.0, description: "14% instant + 3% CaltexGO payment bonus (17% total upfront discount) + 8% fuel cashback." }
        }
      },
      {
        id: "citi-generic",
        name: "Other Citi Cards",
        evRebate: 0.0,
        discounts: {
          esso: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." },
          shell: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." },
          caltex: { instant: 14.0, appBonus: 3.0, description: "14% instant + 3% CaltexGO payment bonus (17% total upfront discount)." }
        }
      }
    ]
  },
  sc: {
    bankName: "Standard Chartered",
    cards: [
      {
        id: "sc-simply",
        name: "SC Simply Cash Card",
        evRebate: 0.0,
        discounts: {
          caltex: { instant: 16.0, appBonus: 3.0, description: "16% instant + 3% CaltexGO payment bonus (19% total upfront discount)." }
        }
      },
      {
        id: "sc-generic",
        name: "Other SC Cards",
        evRebate: 0.0,
        discounts: {
          caltex: { instant: 16.0, appBonus: 3.0, description: "16% instant + 3% CaltexGO payment bonus (19% total upfront discount)." }
        }
      }
    ]
  },
  trust: {
    bankName: "Trust Bank",
    cards: [
      {
        id: "trust-link",
        name: "Trust Link Card",
        evRebate: 0.0,
        discounts: {
          caltex: { instant: 14.0, appBonus: 3.0, description: "14% instant + 3% CaltexGO / Trust bonus (17% total upfront discount) + up to 5% Linkpoints rebate." }
        }
      }
    ]
  },
  hsbc: {
    bankName: "HSBC",
    cards: [
      {
        id: "hsbc-liveplus",
        name: "HSBC Live+ / Platinum Card",
        evRebate: 5.0,
        discounts: {
          shell: { instant: 14.0, appBonus: 0.0, description: "14% instant discount + 5% cash rebate." },
          caltex: { instant: 14.0, appBonus: 0.0, description: "14% instant discount + 5% cash rebate." }
        }
      },
      {
        id: "hsbc-generic",
        name: "Other HSBC Cards",
        evRebate: 0.0,
        discounts: {
          shell: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." },
          caltex: { instant: 14.0, appBonus: 0.0, description: "14% instant discount." }
        }
      }
    ]
  }
};
