// Illustrative values for demonstrating the Market Prices table when neither
// live Mandi API nor stored Supabase records match a search. These are not
// verified market rates. Edit or remove entries as needed.
const FALLBACK_CROP_PRICES = [
  { id: "demo-pineapple-udupi", crop: "Pineapple", cropKn: "ಅನಾನಸ್", aliases: ["pine apples", "ananas", "ಅನಾನಸ್"], market: "Udupi", marketKn: "ಉಡುಪಿ", district: "Udupi", districtKn: "ಉಡುಪಿ", min: 1800, max: 2600, modal: 2200, unit: "quintal" },
  { id: "demo-bottle-gourd-mangaluru", crop: "Bottle gourd", cropKn: "ಸೋರೆಕಾಯಿ", aliases: ["gourd", "gourds", "bottle gourd", "bottle gourds", "lauki", "ಸೋರೆಕಾಯಿ"], market: "Mangaluru", marketKn: "ಮಂಗಳೂರು", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 900, max: 1500, modal: 1200, unit: "quintal" },
  { id: "demo-bitter-gourd-udupi", crop: "Bitter gourd", cropKn: "ಹಾಗಲಕಾಯಿ", aliases: ["gourd", "gourds", "bitter gourd", "bitter gourds", "bitter melon", "ಹಾಗಲಕಾಯಿ"], market: "Kundapura", marketKn: "ಕುಂದಾಪುರ", district: "Udupi", districtKn: "ಉಡುಪಿ", min: 2200, max: 3400, modal: 2800, unit: "quintal" },
  { id: "demo-brinjal-udupi", crop: "Brinjal", cropKn: "ಬದನೆಕಾಯಿ", aliases: ["brinjal", "eggplant", "aubergine", "ಬದನೆಕಾಯಿ"], market: "Udupi", marketKn: "ಉಡುಪಿ", district: "Udupi", districtKn: "ಉಡುಪಿ", min: 1600, max: 2500, modal: 2050, unit: "quintal" },
  { id: "demo-black-pepper-puttur", crop: "Black pepper", cropKn: "ಕಾಳುಮೆಣಸು", aliases: ["black pepper", "peppercorn", "pepper", "ಕಾಳುಮೆಣಸು"], market: "Puttur", marketKn: "ಪುತ್ತೂರು", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 42000, max: 56000, modal: 49000, unit: "quintal" },
  { id: "demo-ginger-shivamogga", crop: "Ginger", cropKn: "ಶುಂಠಿ", aliases: ["ginger", "ಶುಂಠಿ"], market: "Shivamogga", marketKn: "ಶಿವಮೊಗ್ಗ", district: "Shivamogga", districtKn: "ಶಿವಮೊಗ್ಗ", min: 5000, max: 8000, modal: 6500, unit: "quintal" },
  { id: "demo-rubber-sullia", crop: "Rubber", cropKn: "ರಬ್ಬರ್", aliases: ["rubber", "natural rubber", "ರಬ್ಬರ್"], market: "Sullia", marketKn: "ಸುಳ್ಯ", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 14000, max: 19000, modal: 16500, unit: "quintal" },
  { id: "demo-cocoa-puttur", crop: "Cocoa", cropKn: "ಕೋಕೋ", aliases: ["cocoa", "cacao", "ಕೋಕೋ"], market: "Puttur", marketKn: "ಪುತ್ತೂರು", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 18000, max: 26000, modal: 22000, unit: "quintal" },
  { id: "demo-cashew-mangaluru", crop: "Cashew nut", cropKn: "ಗೋಡಂಬಿ", aliases: ["cashew", "cashews", "cashew nut", "cashew nuts", "ಗೋಡಂಬಿ"], market: "Mangaluru", marketKn: "ಮಂಗಳೂರು", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 7000, max: 11000, modal: 9000, unit: "quintal" },
  { id: "demo-banana-kundapura", crop: "Banana", cropKn: "ಬಾಳೆಹಣ್ಣು", aliases: ["banana", "bananas", "ಬಾಳೆಹಣ್ಣು", "ಬಾಳೆಕಾಯಿ"], market: "Kundapura", marketKn: "ಕುಂದಾಪುರ", district: "Udupi", districtKn: "ಉಡುಪಿ", min: 1800, max: 2800, modal: 2300, unit: "quintal" },
  { id: "demo-papaya-mysuru", crop: "Papaya", cropKn: "ಪಪ್ಪಾಯಿ", aliases: ["papaya", "papaw", "ಪಪ್ಪಾಯಿ"], market: "Mysuru", marketKn: "ಮೈಸೂರು", district: "Mysuru", districtKn: "ಮೈಸೂರು", min: 1200, max: 2000, modal: 1600, unit: "quintal" },
  { id: "demo-sapota-udupi", crop: "Sapota", cropKn: "ಸಪೋಟ", aliases: ["sapota", "chikoo", "chiku", "ಸಪೋಟ", "ಚಿಕ್ಕು"], market: "Udupi", marketKn: "ಉಡುಪಿ", district: "Udupi", districtKn: "ಉಡುಪಿ", min: 2400, max: 3600, modal: 3000, unit: "quintal" },
  { id: "demo-green-chilli-hassan", crop: "Green chilli", cropKn: "ಹಸಿಮೆಣಸಿನಕಾಯಿ", aliases: ["green chilli", "green chili", "chillies", "ಹಸಿಮೆಣಸಿನಕಾಯಿ"], market: "Hassan", marketKn: "ಹಾಸನ", district: "Hassan", districtKn: "ಹಾಸನ", min: 2800, max: 4500, modal: 3600, unit: "quintal" },
  { id: "demo-orchids-bengaluru", crop: "Orchids", cropKn: "ಆರ್ಕಿಡ್ ಹೂವುಗಳು", aliases: ["orchid", "orchids", "ಆರ್ಕಿಡ್"], market: "Bengaluru", marketKn: "ಬೆಂಗಳೂರು", district: "Bengaluru", districtKn: "ಬೆಂಗಳೂರು", min: 8000, max: 14000, modal: 11000, unit: "bundle" },
  { id: "demo-vanilla-chikkamagaluru", crop: "Vanilla", cropKn: "ವನಿಲ್ಲಾ", aliases: ["vanilla", "ವನಿಲ್ಲಾ"], market: "Chikkamagaluru", marketKn: "ಚಿಕ್ಕಮಗಳೂರು", district: "Chikkamagaluru", districtKn: "ಚಿಕ್ಕಮಗಳೂರು", min: 45000, max: 70000, modal: 57500, unit: "quintal" },
  { id: "demo-cowpea-mangaluru", crop: "Cowpea", cropKn: "ಅಲಸಂದೆ", aliases: ["cowpea", "cow peas", "black eyed pea", "ಅಲಸಂದೆ"], market: "Mangaluru", marketKn: "ಮಂಗಳೂರು", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 5000, max: 7500, modal: 6200, unit: "quintal" },
  { id: "demo-rice-udupi", crop: "Rice", cropKn: "ಅಕ್ಕಿ", aliases: ["rice", "paddy", "ಅಕ್ಕಿ", "ಭತ್ತ"], market: "Udupi", marketKn: "ಉಡುಪಿ", district: "Udupi", districtKn: "ಉಡುಪಿ", min: 2200, max: 3100, modal: 2650, unit: "quintal" },
  { id: "demo-pulses-davanagere", crop: "Pulses", cropKn: "ಬೇಳೆಕಾಳುಗಳು", aliases: ["pulse", "pulses", "dal", "ಬೇಳೆ", "ಬೇಳೆಕಾಳುಗಳು"], market: "Davanagere", marketKn: "ದಾವಣಗೆರೆ", district: "Davanagere", districtKn: "ದಾವಣಗೆರೆ", min: 5200, max: 8200, modal: 6700, unit: "quintal" },
  { id: "demo-beans-bengaluru", crop: "Beans", cropKn: "ಬೀನ್ಸ್", aliases: ["bean", "beans", "green beans", "ಬೀನ್ಸ್"], market: "Bengaluru", marketKn: "ಬೆಂಗಳೂರು", district: "Bengaluru", districtKn: "ಬೆಂಗಳೂರು", min: 2600, max: 4100, modal: 3300, unit: "quintal" },
  { id: "demo-cucumber-mangaluru", crop: "Cucumber", cropKn: "ಸೌತೆಕಾಯಿ", aliases: ["cucumber", "cucumbers", "ಸೌತೆಕಾಯಿ"], market: "Mangaluru", marketKn: "ಮಂಗಳೂರು", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 1200, max: 2100, modal: 1650, unit: "quintal" },
  { id: "demo-jasmine-mangaluru", crop: "Jasmine flower", cropKn: "ಮಲ್ಲಿಗೆ ಹೂವು", aliases: ["jasmine", "jasmine flower", "jasmine flowers", "mallige", "ಮಲ್ಲಿಗೆ", "ಮಲ್ಲಿಗೆ ಹೂವು"], market: "Mangaluru", marketKn: "ಮಂಗಳೂರು", district: "Dakshina Kannada", districtKn: "ದಕ್ಷಿಣ ಕನ್ನಡ", min: 9000, max: 15000, modal: 12000, unit: "quintal" },
];

function normalizeCropSearch(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Match English/Kannada crop names and common spellings; demo records only. */
export function searchFallbackCropPrices(query, { state = "", district = "", market = "" } = {}) {
  const term = normalizeCropSearch(query);
  if (!term) return [];
  const stateTerm = normalizeCropSearch(state);
  const districtTerm = normalizeCropSearch(district);
  const marketTerm = normalizeCropSearch(market);

  return FALLBACK_CROP_PRICES.filter((entry) => {
    const cropTerms = [entry.crop, entry.cropKn, ...entry.aliases].map(normalizeCropSearch);
    const cropMatches = cropTerms.some((name) =>
      name === term || (term.length >= 3 && name.includes(term)) || (name.length >= 3 && term.includes(name))
    );
    return cropMatches &&
      (!stateTerm || stateTerm === "karnataka") &&
      (!districtTerm || normalizeCropSearch(entry.district).includes(districtTerm)) &&
      (!marketTerm || normalizeCropSearch(entry.market).includes(marketTerm));
  }).map((entry) => ({
    id: entry.id,
    commodity: entry.crop,
    commodity_kn: entry.cropKn,
    state: "Karnataka",
    state_kn: "ಕರ್ನಾಟಕ",
    district: entry.district,
    district_kn: entry.districtKn,
    market: entry.market,
    market_kn: entry.marketKn,
    variety: entry.variety || "",
    variety_kn: entry.variety_kn || "",
    min_price: entry.min,
    max_price: entry.max,
    modal_price: entry.modal,
    unit: entry.unit,
    sourceType: "demo",
  }));
}

export const FALLBACK_CROP_PRICE_COUNT = FALLBACK_CROP_PRICES.length;
