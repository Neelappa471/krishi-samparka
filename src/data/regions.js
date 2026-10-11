/**
 * Regions master data module for Krishi Samparka
 * Contains geographic reference points for supported regions and nearby cities.
 * These are not verified APMC-yard coordinates and must not be used as such.
 */

export const REGIONS = [
  // Coastal Karnataka - Udupi District (Local Hubs)
  {
    id: "udupi",
    name: "Udupi",
    state: "Karnataka",
    latitude: 13.3409,
    longitude: 74.7421,
    type: "local"
  },
  {
    id: "kundapura",
    name: "Kundapura",
    state: "Karnataka",
    latitude: 13.6268,
    longitude: 74.6908,
    type: "local"
  },
  {
    id: "karkala",
    name: "Karkala",
    state: "Karnataka",
    latitude: 13.2163,
    longitude: 74.9961,
    type: "local"
  },
  {
    id: "byndoor",
    name: "Byndoor",
    state: "Karnataka",
    latitude: 13.8680,
    longitude: 74.6288,
    type: "local"
  },

  // Coastal Karnataka - Dakshina Kannada District (Local Hubs)
  {
    id: "mangaluru",
    name: "Mangaluru",
    state: "Karnataka",
    latitude: 12.9141,
    longitude: 74.8560,
    type: "local"
  },
  {
    id: "puttur",
    name: "Puttur",
    state: "Karnataka",
    latitude: 12.7667,
    longitude: 75.2000,
    type: "local"
  },
  {
    id: "belthangady",
    name: "Belthangady",
    state: "Karnataka",
    latitude: 12.9833,
    longitude: 75.2500,
    type: "local"
  },
  {
    id: "sullia",
    name: "Sullia",
    state: "Karnataka",
    latitude: 12.5600,
    longitude: 75.3900,
    type: "local"
  },
  {
    id: "moodabidri",
    name: "Moodabidri",
    state: "Karnataka",
    latitude: 13.0690,
    longitude: 74.9960,
    type: "local"
  },
  {
    id: "bantwal",
    name: "Bantwal",
    state: "Karnataka",
    latitude: 12.8931,
    longitude: 75.0347,
    type: "local"
  },

  // Major Internal Karnataka Consumption Hubs
  {
    id: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    latitude: 12.9716,
    longitude: 77.5946,
    type: "demand_market"
  },
  {
    id: "mysuru",
    name: "Mysuru",
    state: "Karnataka",
    latitude: 12.2958,
    longitude: 76.6394,
    type: "demand_market"
  },
  {
    id: "hassan",
    name: "Hassan",
    state: "Karnataka",
    latitude: 13.0033,
    longitude: 76.1004,
    type: "demand_market"
  },
  {
    id: "hubballi",
    name: "Hubballi",
    state: "Karnataka",
    latitude: 15.3647,
    longitude: 75.1240,
    type: "demand_market"
  },

  // Neighboring & Major External Interstate Trade Hubs
  {
    id: "kasaragod",
    name: "Kasaragod",
    state: "Kerala",
    latitude: 12.5102,
    longitude: 74.9852,
    type: "external_market"
  },
  {
    id: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    latitude: 19.0760,
    longitude: 72.8777,
    type: "external_market"
  },
  {
    id: "goa",
    name: "Goa (Panaji)",
    state: "Goa",
    latitude: 15.4989,
    longitude: 73.8278,
    type: "external_market"
  }
];

// Helper to find a region by ID
export const getRegionById = (id) => REGIONS.find((region) => region.id === id);

// Helper to get regions by type ('local', 'demand_market', 'external_market')
export const getRegionsByType = (type) =>
  REGIONS.filter((region) => region.type === type);
