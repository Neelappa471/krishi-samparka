/**
 * Configuration module for Krishi Samparka environment variables.
 * Safely accesses Vite environment variables using `import.meta.env`
 * without throwing runtime errors if any variable is undefined.
 */

export const env = {
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
};

// Helper function to check if Google Maps API key is configured
export const isGoogleMapsConfigured = () => Boolean(env.googleMapsApiKey.trim());

// Helper function to check if Supabase backend is configured
export const isSupabaseConfigured = () =>
  Boolean(env.supabaseUrl.trim() && env.supabaseAnonKey.trim());
