// Authors page (FR-01): list, create, edit, delete.

import { t } from "../strings.js";
import { initPage, el, byId, confirmDialog, alertDialog, showError, toast } from "../ui.js";
import { getAuthors, getCountries, getBooks, deleteAuthor, ApiError } from "../store.js";
import { renderAuthorsTable } from "../render.js";
import { sortRows, nextSort } from "../sort.js";
import { openAuthorForm } from "../forms/author-form.js";

let authors = [];
let rows = [];
let sort = { key: "name", dir: "asc" };

const search = document.querySelector("#authors-search");
const tableContainer = document.querySelector("#authors-table");
const count = document.querySelector("#authors-count");

async function load() {
  const [loadedAuthors, countries, books] = await Promise.all([getAuthors(), getCountries(), getBooks()]);
  authors = loadedAuthors;
  const countriesById = byId(countries);
  rows = authors.map((a) => ({
    id: a.id,
    name: a.name,
    country: countriesById.get(a.countryId)?.name ?? null,
    birthDate: a.birthDate,
    deathDate: a.deathDate,
    bookCount: books.filter((b) => b.authorIds.includes(a.id)).length,
  }));
}

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = rows.filter((r) => !query || r.name.toLocaleLowerCase().includes(query));
  const sorted = sortRows(filtered, sort.key, sort.dir);
  renderAuthorsTable(
    tableContainer,
    sorted,
    sort,
    (key) => {
      sort = nextSort(sort, key);
      render();
    },
    { onEdit: edit, onDelete: remove }
  );
  count.textContent = t("authors.count", sorted.length);
}

async function edit(id) {
  try {
    const author = authors.find((a) => a.id === id) ?? null;
    if (await openAuthorForm(author)) {
      toast(t("common.saved"));
      await load();
      render();
    }
  } catch (error) {
    showError(error);
  }
}

async function remove(id) {
  const author = authors.find((a) => a.id === id);
  if (!author) return;
  const ok = await confirmDialog(t("authors.deleteTitle"), t("authors.deleteMessage", author.name), {
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!ok) return;
  try {
    await deleteAuthor(id);
    toast(t("common.deleted"));
    await load();
    render();
  } catch (error) {
    // 409: the author is linked to books; the message names them.
    if (error instanceof ApiError && error.status === 409) await alertDialog(t("authors.cannotDeleteTitle"), error.message);
    else showError(error);
  }
}

async function start() {
  initPage();
  search.addEventListener("input", render);
  document.querySelector("#authors-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  document.querySelector("#new-author").addEventListener("click", () => edit(null));
  try {
    await load();
    render();
  } catch (error) {
    tableContainer.replaceChildren(el("p", { className: "load-error", role: "alert", text: error.message || t("common.loadError") }));
  }
}

start();
