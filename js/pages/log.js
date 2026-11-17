// Home page: reading log (FR-05) with search and status chips, plus a shelf of
// recently read books, a summary banner and the wishlist side panel.

import { t } from "../strings.js";
import { STATUSES } from "../constants.js";
import { initPage, el, byId, authorNames, formatGrade, showError, toast } from "../ui.js";
import { getReadings, getBooks, getAuthors } from "../store.js";
import { renderLogTable, renderCoverList, renderStatusChips, renderBannerCards, renderWishlist } from "../render.js";
import { sortRows, nextSort } from "../sort.js";
import { openBookForm } from "../forms/book-form.js";
import { currentYear } from "../validation.js";

const DEFAULT_SORT = { key: "yearRead", dir: "desc" }; // most recent first, then ID ascending
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const statusRank = (status) => STATUSES.indexOf(status);

let rows = [];
let sort = { ...DEFAULT_SORT };
let statusFilter = "";

const search = document.querySelector("#log-search");
const chips = document.querySelector("#log-status");
const tableContainer = document.querySelector("#log-table");
const count = document.querySelector("#log-count");
const shelf = document.querySelector("#recent-covers");

async function load() {
  const [readings, books, authors] = await Promise.all([getReadings(), getBooks(), getAuthors()]);
  const booksById = byId(books);
  const authorsById = byId(authors);
  rows = readings.map((r) => {
    const book = booksById.get(r.bookId);
    return {
      id: r.id,
      bookId: r.bookId,
      title: book?.title ?? "",
      authors: authorNames(book?.authorIds, authorsById),
      status: r.status,
      yearRead: r.yearRead,
      grade: r.grade,
      priority: r.priority,
      recommendedBy: r.recommendedBy,
    };
  });
  renderSummary();
}

/** Shelf, banner and wishlist panel: computed from the readings, never typed. */
function renderSummary() {
  const read = rows.filter((r) => r.status === "Read");
  const recent = sortRows(read, "yearRead", "desc").slice(0, 12);
  renderCoverList(
    shelf,
    recent.map((r) => ({ ...r, meta: [r.yearRead, r.grade == null ? null : formatGrade(r.grade)].filter((x) => x != null).join(" · ") })),
    t("log.noRecent")
  );

  const year = currentYear();
  const graded = read.filter((r) => r.grade != null);
  const avg = graded.length ? formatGrade(graded.reduce((sum, r) => sum + r.grade, 0) / graded.length) : t("common.missing");
  document.querySelector("#banner-heading").textContent = t("log.bannerTitle", year);
  document.querySelector("#banner-lead").textContent = t("log.bannerLead", read.filter((r) => r.yearRead === year).length, read.length, avg);

  const wishlist = rows.filter((r) => r.status === "Want to read");
  renderBannerCards(
    document.querySelector("#banner-cards"),
    [
      { title: t("log.cardWishlist"), text: t("log.cardWishlistText", wishlist.length), status: "Want to read" },
      { title: t("log.cardUngraded"), text: t("log.cardUngradedText", read.length - graded.length), status: "Read" },
      { title: t("log.cardPaused"), text: t("log.cardPausedText", rows.filter((r) => r.status === "Paused").length), status: "Paused" },
    ],
    (status) => {
      setStatus(status);
      document.querySelector("#log-section").scrollIntoView({ behavior: "smooth" });
    }
  );

  const ordered = [...wishlist].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || a.id - b.id
  );
  renderWishlist(document.querySelector("#wishlist"), ordered);

  const current = rows.find((r) => r.status === "Reading") ?? rows.find((r) => r.status === "Paused");
  const link = document.querySelector("#now-reading");
  document.querySelector("#now-reading-title").textContent = current ? current.title : t("wishlist.nothingReading");
  link.href = current ? `book.html?id=${encodeURIComponent(current.bookId)}` : "books.html";
}

function renderChips() {
  renderStatusChips(chips, STATUSES, statusFilter, setStatus);
}

function setStatus(status) {
  statusFilter = status;
  renderChips();
  render();
}

function render() {
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = rows.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!query || r.title.toLocaleLowerCase().includes(query) || r.authors.toLocaleLowerCase().includes(query))
  );
  const sorted = sortRows(filtered, sort.key, sort.dir, sort.key === "status" ? statusRank : null);
  renderLogTable(tableContainer, sorted, sort, (key) => {
    sort = nextSort(sort, key);
    render();
  });
  count.textContent = t("log.count", sorted.length);
}

async function refreshAfter(promise) {
  try {
    const result = await promise;
    if (!result) return;
    toast(t("common.saved"));
    await load();
    render();
  } catch (error) {
    showError(error);
  }
}

async function start() {
  initPage();
  renderChips();
  search.addEventListener("input", render);
  document.querySelector("#log-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    render();
    document.querySelector("#log-section").scrollIntoView({ behavior: "smooth" });
  });
  document.querySelector("#new-book").addEventListener("click", () => refreshAfter(openBookForm()));

  // Quick add: opens the book form with the title filled and a "Want to read" reading.
  const quickAdd = document.querySelector("#quick-add");
  quickAdd.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = quickAdd.querySelector("input");
    const title = input.value.trim();
    input.value = "";
    refreshAfter(openBookForm(null, { prefillTitle: title, withReading: true }));
  });

  const step = () => shelf.clientWidth * 0.8;
  document.querySelector("#shelf-prev").addEventListener("click", () => shelf.scrollBy({ left: -step(), behavior: "smooth" }));
  document.querySelector("#shelf-next").addEventListener("click", () => shelf.scrollBy({ left: step(), behavior: "smooth" }));

  try {
    await load();
    render();
  } catch (error) {
    tableContainer.replaceChildren(el("p", { className: "load-error", role: "alert", text: error.message || t("common.loadError") }));
  }
}

start();
