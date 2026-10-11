/**
 * Crops / produce master data module for Krishi Samparka
 * Reusable across Market Map, Farmer Listings, Buyer Requirements, 
 * Opportunity Engine, and UI Filters.
 */

export const CROPS = [
  // Commercial & Plantation
  {
    id: "coconut",
    name: "Coconut",
    localName: "ತೆಂಗಿನಕಾಯಿ",
    unit: "kg",
    category: "Commercial / Plantation"
  },
  {
    id: "arecanut",
    name: "Arecanut (Adike)",
    localName: "ಅಡಿಕೆ",
    unit: "kg",
    category: "Commercial / Plantation"
  },
  {
    id: "cocoa",
    name: "Cocoa",
    localName: "ಕೊಕೋ",
    unit: "kg",
    category: "Commercial / Plantation"
  },
  {
    id: "rubber",
    name: "Natural Rubber",
    localName: "ರಬ್ಬರ್",
    unit: "kg",
    category: "Commercial / Plantation"
  },

  // Spices & Condiments
  {
    id: "pepper",
    name: "Black Pepper",
    localName: "ಕಾಳುಮೆಣಸು",
    unit: "kg",
    category: "Spices"
  },
  {
    id: "ginger",
    name: "Ginger",
    localName: "ಶುಂಠಿ",
    unit: "kg",
    category: "Spices"
  },
  {
    id: "turmeric",
    name: "Turmeric",
    localName: "ಅರಿಶಿನ",
    unit: "kg",
    category: "Spices"
  },
  {
    id: "cardamom",
    name: "Green Cardamom",
    localName: "ಏಲಕ್ಕಿ",
    unit: "kg",
    category: "Spices"
  },

  // Fruits
  {
    id: "banana",
    name: "Banana",
    localName: "ಬಾಳೆಹಣ್ಣು",
    unit: "kg",
    category: "Fruits"
  },
  {
    id: "mango",
    name: "Mango",
    localName: "ಮಾವು",
    unit: "kg",
    category: "Fruits"
  },
  {
    id: "dragon_fruit",
    name: "Dragon Fruit",
    localName: "ಡ್ರ್ಯಾಗನ್ ಫ್ರೂಟ್",
    unit: "kg",
    category: "Fruits / High Value"
  },
  {
    id: "jackfruit",
    name: "Jackfruit",
    localName: "ಹಲಸಿನ ಹಣ್ಣು",
    unit: "kg",
    category: "Fruits"
  },
  {
    id: "pineapple",
    name: "Pineapple",
    localName: "ಅನಾನಸ್",
    unit: "kg",
    category: "Fruits"
  },

  // Vegetables
  {
    id: "tomato",
    name: "Tomato",
    localName: "ಟೊಮೆಟೊ",
    unit: "kg",
    category: "Vegetables"
  },
  {
    id: "onion",
    name: "Onion",
    localName: "ಈರುಳ್ಳಿ",
    unit: "kg",
    category: "Vegetables"
  },
  {
    id: "green_chilli",
    name: "Green Chilli",
    localName: "ಹಸಿ ಮೆಣಸಿನಕಾಯಿ",
    unit: "kg",
    category: "Vegetables"
  },
  {
    id: "brinjal",
    name: "Brinjal (Mattu Gulla)",
    localName: "ಬದನೆಕಾಯಿ (ಮಟ್ಟು ಗುಳ್ಳ)",
    unit: "kg",
    category: "Vegetables"
  },

  // Grains, Pulses & Cereals
  {
    id: "paddy_rice",
    name: "Paddy / Rice (Paddy)",
    localName: "ನೆಲ್ಲು / ಭತ್ತ",
    unit: "quintal",
    category: "Grains & Cereals"
  },
  {
    id: "boiled_rice",
    name: "Boiled Rice (Kunchige Akki)",
    localName: "ಕುಂಚಿಗೆ ಅಕ್ಕಿ",
    unit: "kg",
    category: "Grains & Cereals"
  },

  // Floriculture
  {
    id: "jasmine",
    name: "Jasmine (Shankarapura Mallige)",
    localName: "ಶಂಕರಪುರ ಮಲ್ಲಿಗೆ",
    unit: "atte",
    category: "Floriculture"
  }
];

// Helper to look up a crop by its unique ID
export const getCropById = (id) => CROPS.find((crop) => crop.id === id);

// Helper to get crops grouped by category
export const getCropsByCategory = (category) =>
  CROPS.filter((crop) => crop.category.toLowerCase().includes(category.toLowerCase()));
