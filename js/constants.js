// Controlled values (Section 4). Each value has exactly one spelling.

export const FORMS = [
  "Novel",
  "Novella",
  "Short Story",
  "Short Story Collection",
  "Play",
  "Essay",
  "Treatise",
  "Diary",
  "Graphic Novel",
];

export const MODES = ["Prose", "Drama", "Poetry", "Sequential Art"];

export const CONTENTS = ["Fiction", "Non-fiction"];

export const STATUSES = ["Want to read", "Reading", "Paused", "Read", "Abandoned"];

export const PRIORITIES = ["Low", "Medium", "High"];

// What each status allows. yearRead: "required" | "optional" | "none".
export const STATUS_RULES = {
  "Want to read": { yearRead: "none", grade: false, priority: true },
  Reading: { yearRead: "none", grade: false, priority: false },
  Paused: { yearRead: "none", grade: false, priority: false },
  Read: { yearRead: "required", grade: true, priority: false },
  Abandoned: { yearRead: "optional", grade: true, priority: false },
};

export const GRADE_MIN = 0;
export const GRADE_MAX = 10;

export const MAX_TEXT = 200;
export const MAX_NOTES = 2000;
