/**
 * Buyers master data module for Krishi Samparka
 * Contains realistic buyer profiles across hospitality, wholesale, processing, 
 * retail, and export sectors for testing marketplace matching and map overlays.
 */

export const BUYERS = [
  {
    id: "buyer-1",
    name: "Ocean Pearl Hospitality Group",
    type: "Hotel",
    location: "Mangaluru",
    regionId: "mangaluru",
    latitude: 12.8700,
    longitude: 74.8400,
    requiredCrops: ["Coconut", "Banana", "Tomato"],
    approximateQuantity: 800,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-2",
    name: "Sri Krishna Matha Bulk Kitchens",
    type: "Institutional / Restaurant",
    location: "Udupi",
    regionId: "udupi",
    latitude: 13.3500,
    longitude: 74.7500,
    requiredCrops: ["Coconut", "Boiled Rice (Kunchige Akki)", "Brinjal (Mattu Gulla)"],
    approximateQuantity: 2500,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-3",
    name: "CAMPCO Chocolate Factory",
    type: "Food processing company",
    location: "Puttur",
    regionId: "puttur",
    latitude: 12.7700,
    longitude: 75.2100,
    requiredCrops: ["Cocoa", "Arecanut (Adike)"],
    approximateQuantity: 10000,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-4",
    name: "Metro Cash & Carry Terminal",
    type: "Wholesale buyer",
    location: "Bengaluru",
    regionId: "bengaluru",
    latitude: 12.9600,
    longitude: 77.5800,
    requiredCrops: ["Coconut", "Mango", "Banana"],
    approximateQuantity: 15000,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-5",
    name: "Shankarapura Flower Trade Co-op",
    type: "Exporter",
    location: "Udupi",
    regionId: "udupi",
    latitude: 13.3100,
    longitude: 74.7800,
    requiredCrops: ["Jasmine (Shankarapura Mallige)"],
    approximateQuantity: 500,
    unit: "atte",
    status: "active"
  },
  {
    id: "buyer-6",
    name: "Malabar Spices & Extracts",
    type: "Food processing company",
    location: "Kasaragod",
    regionId: "kasaragod",
    latitude: 12.5150,
    longitude: 74.9800,
    requiredCrops: ["Black Pepper", "Ginger", "Turmeric"],
    approximateQuantity: 4000,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-7",
    name: "Coastal Supermarket Network",
    type: "Retailer",
    location: "Kundapura",
    regionId: "kundapura",
    latitude: 13.6200,
    longitude: 74.6950,
    requiredCrops: ["Banana", "Pineapple", "Onion"],
    approximateQuantity: 1200,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-8",
    name: "Karkala Areca Traders",
    type: "Wholesale buyer",
    location: "Karkala",
    regionId: "karkala",
    latitude: 13.2100,
    longitude: 74.9900,
    requiredCrops: ["Arecanut (Adike)", "Black Pepper"],
    approximateQuantity: 8000,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-9",
    name: "Royal Palace Hotel & Dining",
    type: "Hotel",
    location: "Mysuru",
    regionId: "mysuru",
    latitude: 12.3000,
    longitude: 76.6500,
    requiredCrops: ["Jasmine (Shankarapura Mallige)", "Banana", "Mango"],
    approximateQuantity: 1500,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-10",
    name: "Vrindavan Exotic Fruits & Juice Bar",
    type: "Retailer",
    location: "Mangaluru",
    regionId: "mangaluru",
    latitude: 12.8900,
    longitude: 74.8500,
    requiredCrops: ["Dragon Fruit", "Mango", "Pineapple"],
    approximateQuantity: 600,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-11",
    name: "Bombay Spice & Commodity Exporters",
    type: "Exporter",
    location: "Mumbai",
    regionId: "mumbai",
    latitude: 18.9500,
    longitude: 72.8300,
    requiredCrops: ["Black Pepper", "Arecanut (Adike)", "Green Cardamom"],
    approximateQuantity: 25000,
    unit: "kg",
    status: "active"
  },
  {
    id: "buyer-12",
    name: "Coastal Delights Seafood & Restaurant",
    type: "Restaurant",
    location: "Udupi",
    regionId: "udupi",
    latitude: 13.3300,
    longitude: 74.7300,
    requiredCrops: ["Coconut", "Green Chilli", "Tomato"],
    approximateQuantity: 400,
    unit: "kg",
    status: "active"
  }
];

// Helper to look up a buyer by ID
export const getBuyerById = (id) => BUYERS.find((buyer) => buyer.id === id);

// Helper to filter buyers by region
export const getBuyersByRegion = (regionId) =>
  BUYERS.filter((buyer) => buyer.regionId.toLowerCase() === regionId.toLowerCase());

// Helper to filter buyers by crop requirement
export const getBuyersByCrop = (cropName) =>
  BUYERS.filter((buyer) =>
    buyer.requiredCrops.some((crop) => crop.toLowerCase().includes(cropName.toLowerCase()))
  );
