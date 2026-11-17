// Data access layer. This is the ONLY file that touches localStorage.
// Every function is async so that, in Delivery 2, this module can be rewritten
// to call the REST API (fetch("/api/...")) without changing the rest of the code.
// Data shapes are the same as seed.json. Errors have the same shape as API errors:
//   { status: 400, message: "Validation failed", errors: [{ field, message }] }

import { validateAuthor, validateBook, validateReading, validateTheme } from "./validation.js";
import { t } from "./strings.js";

const SEED_URL = "data/seed.json";
const PREFIX = "readingTracker.";
const KEYS = {
  seeded: `${PREFIX}seeded`,
  countries: `${PREFIX}countries`,
  authors: `${PREFIX}authors`,
  themes: `${PREFIX}themes`,
  books: `${PREFIX}books`,
  readings: `${PREFIX}readings`,
};
const COLLECTIONS = ["countries", "authors", "themes", "books", "readings"];

/** Error thrown by store functions, mirroring the API error body. */
export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

// ---------- internal helpers ----------

let loading = null;

/** Loads the seed into localStorage on first use only (FR-07). */
async function ensureLoaded() {
  if (localStorage.getItem(KEYS.seeded) === "true") return;
  if (!loading) {
    loading = loadSeed().finally(() => {
      loading = null;
    });
  }
  await loading;
}

async function loadSeed() {
  const response = await fetch(SEED_URL, { cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status, t("common.loadError"));
  const seed = await response.json();
  for (const name of COLLECTIONS) {
    write(name, Array.isArray(seed[name]) ? seed[name] : []);
  }
  localStorage.setItem(KEYS.seeded, "true");
}

function read(name) {
  const raw = localStorage.getItem(KEYS[name]);
  return raw ? JSON.parse(raw) : [];
}

function write(name, records) {
  localStorage.setItem(KEYS[name], JSON.stringify(records));
}

function nextId(records) {
  return records.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

function copy(value) {
  return structuredClone(value);
}

function notFound() {
  return new ApiError(404, t("common.notFound"));
}

function throwIfInvalid(errors) {
  if (errors.length) throw new ApiError(400, t("validation.failed"), errors);
}

function cleanText(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** Inserts a new record (no id) or replaces an existing one (with id). */
function upsert(name, record) {
  const records = read(name);
  if (record.id == null) {
    record.id = nextId(records);
    records.push(record);
  } else {
    const index = records.findIndex((r) => r.id === record.id);
    if (index === -1) throw notFound();
    records[index] = record;
  }
  write(name, records);
  return copy(record);
}

function findById(name, id) {
  const record = read(name).find((r) => r.id === Number(id));
  if (!record) throw notFound();
  return copy(record);
}

// ---------- countries (fixed list) ----------

export async function getCountries() {
  await ensureLoaded();
  return read("countries");
}

// ---------- themes ----------

export async function getThemes() {
  await ensureLoaded();
  return read("themes");
}

/** Creates a theme. Names are unique ignoring case (409 if it already exists). */
export async function saveTheme(theme) {
  await ensureLoaded();
  const record = { id: theme.id ?? null, name: cleanText(theme.name) };
  const themes = read("themes");
  const errors = validateTheme(record, { themes });
  if (errors.some((e) => e.message === t("validation.themeNameDuplicate"))) {
    throw new ApiError(409, t("validation.themeNameDuplicate"), errors);
  }
  throwIfInvalid(errors);
  return upsert("themes", record);
}

// ---------- authors ----------

export async function getAuthors() {
  await ensureLoaded();
  return read("authors");
}

export async function getAuthor(id) {
  await ensureLoaded();
  return findById("authors", id);
}

export async function saveAuthor(author) {
  await ensureLoaded();
  const record = {
    id: author.id ?? null,
    name: cleanText(author.name),
    countryId: author.countryId ?? null,
    birthDate: cleanText(author.birthDate),
    deathDate: cleanText(author.deathDate),
  };
  throwIfInvalid(validateAuthor(record, { authors: read("authors"), countries: read("countries") }));
  return upsert("authors", record);
}

/** Deletes an author. 409 if the author is linked to any book (FR-01). */
export async function deleteAuthor(id) {
  await ensureLoaded();
  const authorId = Number(id);
  findById("authors", authorId);
  const linked = read("books").filter((b) => (b.authorIds ?? []).includes(authorId));
  if (linked.length) {
    const titles = linked.map((b) => b.title).join(", ");
    throw new ApiError(409, t("validation.linkedAuthor", linked.length, titles));
  }
  write("authors", read("authors").filter((a) => a.id !== authorId));
}

// ---------- books ----------

export async function getBooks() {
  await ensureLoaded();
  return read("books");
}

export async function getBook(id) {
  await ensureLoaded();
  return findById("books", id);
}

export async function saveBook(book) {
  await ensureLoaded();
  const record = {
    id: book.id ?? null,
    title: cleanText(book.title),
    authorIds: [...(book.authorIds ?? [])],
    publicationYear: book.publicationYear ?? null,
    form: book.form ?? null,
    mode: book.mode ?? null,
    content: book.content ?? null,
    themeIds: [...(book.themeIds ?? [])],
  };
  const readings = record.id == null ? [] : read("readings").filter((r) => r.bookId === record.id);
  throwIfInvalid(validateBook(record, { authors: read("authors"), themes: read("themes"), readings }));
  return upsert("books", record);
}

/** Deletes a book and all of its readings (cascade). */
export async function deleteBook(id) {
  await ensureLoaded();
  const bookId = Number(id);
  findById("books", bookId);
  write("readings", read("readings").filter((r) => r.bookId !== bookId));
  write("books", read("books").filter((b) => b.id !== bookId));
}

// ---------- readings ----------

export async function getReadings() {
  await ensureLoaded();
  return read("readings");
}

export async function getReadingsByBook(bookId) {
  await ensureLoaded();
  return read("readings").filter((r) => r.bookId === Number(bookId));
}

export async function getReading(id) {
  await ensureLoaded();
  return findById("readings", id);
}

export async function saveReading(reading) {
  await ensureLoaded();
  const record = {
    id: reading.id ?? null,
    bookId: reading.bookId == null ? null : Number(reading.bookId),
    status: reading.status ?? null,
    yearRead: reading.yearRead ?? null,
    grade: reading.grade ?? null,
    recommendedBy: cleanText(reading.recommendedBy),
    priority: reading.priority ?? null,
    notes: cleanText(reading.notes),
  };
  const book = read("books").find((b) => b.id === record.bookId) ?? null;
  throwIfInvalid(validateReading(record, { book }));
  return upsert("readings", record);
}

export async function deleteReading(id) {
  await ensureLoaded();
  const readingId = Number(id);
  findById("readings", readingId);
  write("readings", read("readings").filter((r) => r.id !== readingId));
}

// ---------- reset (FR-07) ----------

/** Deletes all data and loads the seed again. */
export async function resetData() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  await ensureLoaded();
}
