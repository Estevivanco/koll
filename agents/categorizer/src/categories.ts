// The only answers the AI is allowed to give
export const CATEGORIES = [
  "Mat", "Restaurang", "Transport", "Prenumeration", "Boende",
  "Shopping", "Nöje", "Hälsa", "Lön", "Studiemedel", "Tobak", "Överföring", "Övrigt",
] as const;

export type Category = (typeof CATEGORIES)[number];