export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'http_client_error'
  | 'http_server_error'
  | 'invalid_response';

export interface HealthResponse {
  status: string;
}

/** Energy and macros per 100 g, as the API sends them (plain numbers). */
export interface Per100g {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** GET /foods?q= — one food from the database. */
export interface FoodSearchResult {
  id: number;
  name: string;
  per_100g: Per100g;
}

/** How much of one nutrient 100 g contains, e.g. { key: 'vitamin_c', unit: 'mg', amount: 8.7 }. */
export interface NutrientAmount {
  key: string;
  unit: 'g' | 'mg' | 'ug';
  amount: number;
}

/**
 * GET /foods/{id} — a food's full nutrient profile, per 100 g. `per_100g` is null when the food
 * lacks calories or a macro; `nutrients` leaves out anything without data.
 */
export interface FoodDetail {
  id: number;
  name: string;
  per_100g: Per100g | null;
  nutrients: NutrientAmount[];
}

export type MealSlug = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export type FoodLogSource = 'database' | 'custom' | 'barcode' | 'photo' | 'recipe';

/** One logged food, as returned by /meals/entries. */
export interface FoodLogEntry {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  meal: MealSlug;
  food_id: number | null;
  source: FoodLogSource;
  name: string;
  per_100g: Per100g;
  amount: number;
  unit: string;
  grams: number;
  /** When it was eaten — ISO 8601 with a UTC offset. */
  logged_at: string;
}

/**
 * POST /meals/entries. Either `food_id` (a database food — the server copies its name and
 * values), or `name` + `per_100g` for foods not in the database.
 *
 * `logged_at` is when it was eaten; the server files the entry under that day, and under the
 * meal for that hour unless `meal` is sent.
 */
export type FoodLogEntryCreate = {
  logged_at: string;
  meal?: MealSlug;
  amount: number;
  unit: string;
  grams: number;
} & (
  | { food_id: number; source?: 'database' }
  | { name: string; per_100g: Per100g; source: Exclude<FoodLogSource, 'database'> }
);

/** PATCH /meals/entries/{id} — omitted fields are left unchanged. */
export interface FoodLogEntryUpdate {
  /** Moves the entry to that time (and day). */
  logged_at?: string;
  meal?: MealSlug;
  amount?: number;
  unit?: string;
  grams?: number;
}
