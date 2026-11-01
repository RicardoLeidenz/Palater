export const REPORT_REASONS = [
  { key: "duplicate", label: "Duplicate of another dish" },
  { key: "misspelled", label: "Misspelled or wrong name" },
  { key: "not_on_menu", label: "Not on this menu" },
  { key: "offensive", label: "Offensive or spam" },
  { key: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];
