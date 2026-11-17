// Books page (FR-02): all books as covers, with search, sorting and create.

import { t } from "../strings.js";
import { initPage, el, byId, authorNames, formatYear, showError, toast } from "../ui.js";
import { getBooks, getAuthors, getReadings } from "../store.js";
import { renderCoverList } from "../render.js";
import { sortRows, nextSort } from "../sort.js";
import { openBookForm } from "../forms/book-form.js";

const SORTS = [
  ["title", "fields.title"],
  ["authors", "fields.authors"],
  ["publicationYear", "fields.publicationYear"],
  ["readingCount", "books.readings"],
];

let rows = [];
let sort = { key: "title", dir: "asc" };

const search = document.querySelector("#books-search");
const grid = document.querySelector("#books-grid");
const sortBar = document.querySelector("#books-sort");
const count = document.querySelector("#books-count");

async function load() {
  const [books, authors, readings] = await Promise.all([getBooks(), getAuthors(), getReadings()]);
  const authorsById = byId(authors);
  rows = books.map((b) => ({
    id: b.id,
    bookId: b.id,
    title: b.title,
    authors: authorNames(b.authorIds, authorsById),
    publicationYear: b.publicationYear,
    readingCount: readings.filter((r) => r.bookId === b.id).length,
  }));
}

function renderSortBar() {
  sortBar.replaceChildren(
    el("span", { className: "sort-label", text: t("books.sortBy") }),
    ...SORTS.map(([key, labelKey]) => {
      const active = sort.key === key;
      return el(
        "button",
        {
          type: "button",
          className: "status-chip",
          "aria-pressed": String(active),
          on: {
            click: () => {
              sort = nextSort(sort, key);
              render();
            },
          },
        },
        t(labelKey),
        active ? el("span", { className: "sort-icon", "aria-hidden": "true", text: sort.dir === "asc" ? " ▲" : " ▼" }) : null
      );
    })
  );
}

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = rows.filter(
    (r) => !query || r.title.toLocaleLowerCase().includes(query) || r.authors.toLocaleLowerCase().includes(query)
  );
  const sorted = sortRows(filtered, sort.key, sort.dir);
  renderSortBar();
  renderCoverList(
    grid,
    sorted.map((r) => ({ ...r, meta: `${formatYear(r.publicationYear)} · ${t("books.readingCount", r.readingCount)}` })),
    t("books.empty")
  );
  count.textContent = t("books.count", sorted.length);
}

async function start() {
  initPage();
  search.addEventListener("input", render);
  document.querySelector("#books-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  document.querySelector("#new-book").addEventListener("click", async () => {
    try {
      const result = await openBookForm();
      if (!result) return;
      toast(t("common.saved"));
      await load();
      render();
    } catch (error) {
      showError(error);
    }
  });
  try {
    await load();
    render();
  } catch (error) {
    grid.replaceChildren(el("li", { className: "load-error", role: "alert", text: error.message || t("common.loadError") }));
  }
}

start();
