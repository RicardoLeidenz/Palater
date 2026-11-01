// Menu types and constants shared by server code and client components.

export type Category = "starter" | "main" | "dessert" | "drink";

export const CATEGORIES: { key: Category | null; label: string; singular: string }[] = [
  { key: "starter", label: "Starters", singular: "Starter" },
  { key: "main", label: "Mains", singular: "Main" },
  { key: "dessert", label: "Desserts", singular: "Dessert" },
  { key: "drink", label: "Drinks", singular: "Drink" },
  { key: null, label: "Other", singular: "Other" },
];

export type MyRating = { score: number; note: string | null; createdAt: string };

export type MenuDish = {
  id: string;
  name: string;
  description: string | null;
  category: Category | null;
  hidden: boolean;
  myRating: MyRating | null;
};

export type DishSuggestion = {
  id: string;
  name: string;
  description: string | null;
  category: Category | null;
};

export type RatingEntry = { id: string; score: number; note: string | null; createdAt: string };

export const NOTE_MAX = 280;
