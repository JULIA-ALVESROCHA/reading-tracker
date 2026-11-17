// Section 4 rules. Each function returns a list of { field, message },
// the same shape the API will send in a 400 response (Delivery 2).

import { FORMS, MODES, CONTENTS, PRIORITIES, STATUS_RULES, GRADE_MIN, GRADE_MAX, MAX_TEXT, MAX_NOTES } from "./constants.js";
import { t } from "./strings.js";

const v = (key, ...args) => t(`validation.${key}`, ...args);

export function currentYear() {
  return new Date().getFullYear();
}

export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Case-insensitive, trimmed comparison key for unique names. */
export function nameKey(name) {
  return String(name ?? "").trim().toLocaleLowerCase();
}

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function isValidIsoDate(value) {
  if (!/^-?\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function checkLength(errors, field, value, max) {
  if (value != null && String(value).length > max) errors.push({ field, message: v("textTooLong", max) });
}

/** Validates a year that must be an integer, not 0 and not in the future. */
function checkYear(errors, field, year) {
  if (year == null) return true;
  if (!Number.isInteger(year)) {
    errors.push({ field, message: v("yearInteger") });
    return false;
  }
  if (year === 0) {
    errors.push({ field, message: v("yearZero") });
    return false;
  }
  if (year > currentYear()) {
    errors.push({ field, message: v("yearFuture") });
    return false;
  }
  return true;
}

/**
 * @param author { id?, name, countryId, birthDate, deathDate }
 * @param ctx { authors, countries }
 */
export function validateAuthor(author, { authors = [], countries = [] } = {}) {
  const errors = [];
  if (isBlank(author.name)) {
    errors.push({ field: "name", message: v("nameRequired") });
  } else {
    checkLength(errors, "name", author.name, MAX_TEXT);
    const key = nameKey(author.name);
    if (authors.some((a) => a.id !== author.id && nameKey(a.name) === key)) {
      errors.push({ field: "name", message: v("nameDuplicate") });
    }
  }

  if (author.countryId != null && !countries.some((c) => c.id === author.countryId)) {
    errors.push({ field: "countryId", message: v("countryInvalid") });
  }

  const today = todayIso();
  let birthOk = false;
  if (author.birthDate != null) {
    if (!isValidIsoDate(author.birthDate)) errors.push({ field: "birthDate", message: v("dateInvalid") });
    else if (author.birthDate > today) errors.push({ field: "birthDate", message: v("birthFuture") });
    else birthOk = true;
  }
  if (author.deathDate != null) {
    if (!isValidIsoDate(author.deathDate)) errors.push({ field: "deathDate", message: v("dateInvalid") });
    else if (author.deathDate > today) errors.push({ field: "deathDate", message: v("deathFuture") });
    else if (birthOk && author.deathDate <= author.birthDate) {
      errors.push({ field: "deathDate", message: v("deathBeforeBirth") });
    }
  }
  return errors;
}

/** @param ctx { themes } */
export function validateTheme(theme, { themes = [] } = {}) {
  const errors = [];
  if (isBlank(theme.name)) {
    errors.push({ field: "name", message: v("themeNameRequired") });
  } else {
    checkLength(errors, "name", theme.name, MAX_TEXT);
    const key = nameKey(theme.name);
    if (themes.some((th) => th.id !== theme.id && nameKey(th.name) === key)) {
      errors.push({ field: "name", message: v("themeNameDuplicate") });
    }
  }
  return errors;
}

/**
 * @param book { id?, title, authorIds, publicationYear, form, mode, content, themeIds }
 * @param ctx { authors, themes, readings } readings = readings of this book (to keep yearRead >= publicationYear)
 */
export function validateBook(book, { authors = [], themes = [], readings = [] } = {}) {
  const errors = [];
  if (isBlank(book.title)) errors.push({ field: "title", message: v("titleRequired") });
  else checkLength(errors, "title", book.title, MAX_TEXT);

  const authorIds = book.authorIds ?? [];
  if (authorIds.some((id) => !authors.some((a) => a.id === id))) {
    errors.push({ field: "authorIds", message: v("authorUnknown") });
  } else if (new Set(authorIds).size !== authorIds.length) {
    errors.push({ field: "authorIds", message: v("authorDuplicate") });
  }

  if (checkYear(errors, "publicationYear", book.publicationYear) && book.publicationYear != null) {
    const earliest = readings
      .map((r) => r.yearRead)
      .filter((y) => y != null)
      .reduce((min, y) => Math.min(min, y), Infinity);
    if (earliest < book.publicationYear) {
      errors.push({ field: "publicationYear", message: v("pubAfterReading", earliest) });
    }
  }

  if (book.form != null && !FORMS.includes(book.form)) errors.push({ field: "form", message: v("formInvalid") });
  if (book.mode != null && !MODES.includes(book.mode)) errors.push({ field: "mode", message: v("modeInvalid") });
  if (book.content != null && !CONTENTS.includes(book.content)) {
    errors.push({ field: "content", message: v("contentInvalid") });
  }

  const themeIds = book.themeIds ?? [];
  if (themeIds.some((id) => !themes.some((th) => th.id === id))) {
    errors.push({ field: "themeIds", message: v("themeUnknown") });
  } else if (new Set(themeIds).size !== themeIds.length) {
    errors.push({ field: "themeIds", message: v("themeDuplicate") });
  }
  return errors;
}

/**
 * @param reading { id?, bookId, status, yearRead, grade, recommendedBy, priority, notes }
 * @param ctx { book } the book being read (null if it does not exist).
 *        Pass skipBookCheck: true when the book is about to be created in the same save.
 */
export function validateReading(reading, { book = null, skipBookCheck = false } = {}) {
  const errors = [];
  if (!skipBookCheck) {
    if (reading.bookId == null) errors.push({ field: "bookId", message: v("bookRequired") });
    else if (!book) errors.push({ field: "bookId", message: v("bookUnknown") });
  }

  const rules = STATUS_RULES[reading.status];
  if (isBlank(reading.status)) errors.push({ field: "status", message: v("statusRequired") });
  else if (!rules) errors.push({ field: "status", message: v("statusInvalid") });

  // Year read
  if (rules) {
    if (rules.yearRead === "required" && reading.yearRead == null) {
      errors.push({ field: "yearRead", message: v("yearReadRequired") });
    } else if (rules.yearRead === "none" && reading.yearRead != null) {
      errors.push({ field: "yearRead", message: v("yearReadNotAllowed", reading.status) });
    }
  }
  if (reading.yearRead != null && (!rules || rules.yearRead !== "none")) {
    if (checkYear(errors, "yearRead", reading.yearRead)) {
      const pub = book?.publicationYear;
      if (pub != null && reading.yearRead < pub) {
        errors.push({ field: "yearRead", message: v("yearReadBeforePub", pub) });
      }
    }
  }

  // Grade
  if (reading.grade != null) {
    if (rules && !rules.grade) {
      errors.push({ field: "grade", message: v("gradeNotAllowed") });
    } else if (typeof reading.grade !== "number" || Number.isNaN(reading.grade)) {
      errors.push({ field: "grade", message: v("gradeNumber") });
    } else if (
      reading.grade < GRADE_MIN ||
      reading.grade > GRADE_MAX ||
      !Number.isInteger(reading.grade * 2)
    ) {
      errors.push({ field: "grade", message: v("gradeRange") });
    }
  }

  // Priority
  if (reading.priority != null) {
    if (rules && !rules.priority) errors.push({ field: "priority", message: v("priorityNotAllowed") });
    else if (!PRIORITIES.includes(reading.priority)) {
      errors.push({ field: "priority", message: v("priorityInvalid") });
    }
  }

  checkLength(errors, "recommendedBy", reading.recommendedBy, MAX_TEXT);
  checkLength(errors, "notes", reading.notes, MAX_NOTES);
  return errors;
}
