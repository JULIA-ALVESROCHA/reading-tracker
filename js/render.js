// Rendering of tables and detail views. No data access here: pages pass the data in.

import { t } from "./strings.js";
import { el, show, formatGrade, formatYear, sortHeader } from "./ui.js";

export function statusBadge(status) {
  const slug = String(status ?? "").toLowerCase().replace(/\s+/g, "-");
  return el("span", { className: `badge status-${slug}`, text: show(status) });
}

function cell(label, ...content) {
  return el("td", { dataset: { label } }, ...content);
}

function bookLink(bookId, title) {
  return el("a", { href: `book.html?id=${encodeURIComponent(bookId)}`, text: title });
}

function emptyRow(colspan, message) {
  return el("tr", { className: "empty-row" }, el("td", { colspan, text: message }));
}

/**
 * Reading log table (FR-05).
 * rows: [{ id, bookId, title, authors, status, yearRead, grade }]
 */
export function renderLogTable(container, rows, sort, onSort) {
  const columns = [
    ["title", t("fields.title")],
    ["authors", t("fields.authors")],
    ["status", t("fields.status")],
    ["yearRead", t("fields.yearRead")],
    ["grade", t("fields.grade")],
  ];
  const table = el(
    "table",
    { className: "data-table log-table" },
    el("caption", { className: "visually-hidden", text: t("log.caption") }),
    el("thead", {}, el("tr", {}, columns.map(([key, label]) => sortHeader(label, key, sort, onSort)))),
    el(
      "tbody",
      {},
      rows.length
        ? rows.map((r) =>
            el(
              "tr",
              {},
              cell(t("fields.title"), bookLink(r.bookId, r.title)),
              cell(t("fields.authors"), show(r.authors)),
              cell(t("fields.status"), statusBadge(r.status)),
              cell(t("fields.yearRead"), show(r.yearRead)),
              cell(t("fields.grade"), formatGrade(r.grade))
            )
          )
        : emptyRow(columns.length, t("log.empty"))
    )
  );
  container.replaceChildren(table);
}

/**
 * Authors table with edit / delete actions.
 * rows: [{ id, name, country, birthDate, deathDate, bookCount }]
 */
export function renderAuthorsTable(container, rows, sort, onSort, { onEdit, onDelete }) {
  const columns = [
    ["name", t("fields.name")],
    ["country", t("fields.nationality")],
    ["birthDate", t("fields.birthDate")],
    ["deathDate", t("fields.deathDate")],
    ["bookCount", t("authors.books")],
  ];
  const table = el(
    "table",
    { className: "data-table" },
    el("caption", { className: "visually-hidden", text: t("authors.caption") }),
    el(
      "thead",
      {},
      el("tr", {}, columns.map(([key, label]) => sortHeader(label, key, sort, onSort)), el("th", { scope: "col", text: t("common.actions") }))
    ),
    el(
      "tbody",
      {},
      rows.length
        ? rows.map((r) =>
            el(
              "tr",
              {},
              cell(t("fields.name"), el("strong", { text: r.name })),
              cell(t("fields.nationality"), show(r.country)),
              cell(t("fields.birthDate"), show(r.birthDate)),
              cell(t("fields.deathDate"), show(r.deathDate)),
              cell(t("authors.books"), String(r.bookCount)),
              cell(
                t("common.actions"),
                el(
                  "div",
                  { className: "row-actions" },
                  el("button", { type: "button", className: "button small", text: t("common.edit"), "aria-label": `${t("common.edit")} ${r.name}`, on: { click: () => onEdit(r.id) } }),
                  el("button", { type: "button", className: "button small danger-outline", text: t("common.delete"), "aria-label": `${t("common.delete")} ${r.name}`, on: { click: () => onDelete(r.id) } })
                )
              )
            )
          )
        : emptyRow(columns.length + 1, t("authors.empty"))
    )
  );
  container.replaceChildren(table);
}

/** Book details as a description list. */
export function renderBookDetails(container, book, { authors, themes }) {
  const item = (label, value) => [el("dt", { text: label }), el("dd", {}, value)];
  const list = (names) =>
    names.length ? el("ul", { className: "inline-list" }, names.map((n) => el("li", { text: n }))) : t("common.missing");
  container.replaceChildren(
    el(
      "dl",
      { className: "details" },
      item(t("fields.authors"), list(authors)),
      item(t("fields.publicationYear"), formatYear(book.publicationYear)),
      item(t("fields.form"), show(book.form)),
      item(t("fields.mode"), show(book.mode)),
      item(t("fields.content"), show(book.content)),
      item(t("fields.themes"), list(themes))
    )
  );
}

/** Readings of one book, with edit / delete actions. */
export function renderBookReadings(container, readings, { onEdit, onDelete }) {
  if (!readings.length) {
    container.replaceChildren(el("p", { className: "empty", text: t("book.noReadings") }));
    return;
  }
  const columns = [
    t("fields.status"),
    t("fields.yearRead"),
    t("fields.grade"),
    t("fields.priority"),
    t("fields.recommendedBy"),
    t("fields.notes"),
    t("common.actions"),
  ];
  const table = el(
    "table",
    { className: "data-table" },
    el("caption", { className: "visually-hidden", text: t("book.readingsCaption") }),
    el("thead", {}, el("tr", {}, columns.map((label) => el("th", { scope: "col", text: label })))),
    el(
      "tbody",
      {},
      readings.map((r) =>
        el(
          "tr",
          {},
          cell(t("fields.status"), statusBadge(r.status)),
          cell(t("fields.yearRead"), show(r.yearRead)),
          cell(t("fields.grade"), formatGrade(r.grade)),
          cell(t("fields.priority"), show(r.priority)),
          cell(t("fields.recommendedBy"), show(r.recommendedBy)),
          cell(t("fields.notes"), el("span", { className: "notes", text: show(r.notes) })),
          cell(
            t("common.actions"),
            el(
              "div",
              { className: "row-actions" },
              el("button", { type: "button", className: "button small", text: t("common.edit"), on: { click: () => onEdit(r.id) } }),
              el("button", { type: "button", className: "button small danger-outline", text: t("common.delete"), on: { click: () => onDelete(r.id) } })
            )
          )
        )
      )
    )
  );
  container.replaceChildren(table);
}

// ---------- covers and panels (visual layer) ----------

const COVER_COLORS = 6;

/** Picks one of the cover color classes from the book ID, so each book keeps its color. */
export function coverClass(bookId) {
  return `cover-${Math.abs(Number(bookId) || 0) % COVER_COLORS}`;
}

/** A drawn book cover (no images): title, author and a bookmark ribbon. */
export function bookCover(bookId, title, authorText, { large = false } = {}) {
  return el(
    "span",
    { className: `cover ${coverClass(bookId)}${large ? " cover-large" : ""}`, "aria-hidden": "true" },
    el("span", { className: "cover-title", text: title }),
    el("span", { className: "cover-author", text: authorText }),
    el("span", { className: "ribbon" })
  );
}

/** Cover card that links to the book page. items: [{ bookId, title, authors, meta }] */
function coverCard(item) {
  return el(
    "li",
    { className: "cover-item" },
    el(
      "a",
      { className: "cover-link", href: `book.html?id=${encodeURIComponent(item.bookId)}` },
      bookCover(item.bookId, item.title, item.authors),
      el(
        "span",
        { className: "cover-caption" },
        el("strong", { text: item.title }),
        el("span", { className: "cover-by", text: item.authors || t("books.unknownAuthor") }),
        item.meta ? el("span", { className: "cover-meta", text: item.meta }) : null
      )
    )
  );
}

export function renderCoverList(container, items, emptyMessage) {
  container.replaceChildren(
    ...(items.length ? items.map(coverCard) : [el("li", { className: "empty", text: emptyMessage })])
  );
}

/** Small drawn book used as an icon in the status chips. */
export function miniBook(index) {
  return el("span", { className: `mini-book ${coverClass(index)}`, "aria-hidden": "true" });
}

/** Status filter chips. Calls onSelect(status) with "" for All. */
export function renderStatusChips(container, statuses, selected, onSelect) {
  const options = [{ value: "", label: t("log.all") }, ...statuses.map((s) => ({ value: s, label: s }))];
  container.replaceChildren(
    ...options.map((option, i) =>
      el(
        "button",
        {
          type: "button",
          className: "status-chip",
          "aria-pressed": String(option.value === selected),
          dataset: { status: option.value },
          on: { click: () => onSelect(option.value) },
        },
        miniBook(i + 1),
        el("span", { text: option.label })
      )
    )
  );
}

/** Banner cards. cards: [{ title, text, status, icon }] */
export function renderBannerCards(container, cards, onSelect) {
  container.replaceChildren(
    ...cards.map((card, i) =>
      el(
        "li",
        {},
        el(
          "button",
          { type: "button", className: "mini-card", on: { click: () => onSelect(card.status) } },
          el("span", { className: `mini-card-icon icon-${i}`, "aria-hidden": "true" }, el("span"), el("span"), el("span")),
          el("span", {}, el("strong", { text: card.title }), el("span", { text: card.text }))
        )
      )
    )
  );
}

/** Wishlist side panel, styled as conversation bubbles. items: [{ bookId, title, authors, recommendedBy, priority }] */
export function renderWishlist(container, items) {
  if (!items.length) {
    container.replaceChildren(el("li", { className: "bubble", text: t("wishlist.empty") }));
    return;
  }
  container.replaceChildren(
    ...items.map((item, i) =>
      el(
        "li",
        { className: `bubble ${i % 2 ? "bubble-left" : "bubble-right"}` },
        el("a", { href: `book.html?id=${encodeURIComponent(item.bookId)}`, text: item.title }),
        item.authors ? el("span", { className: "bubble-author", text: item.authors }) : null,
        el(
          "span",
          { className: "bubble-meta" },
          [
            item.priority ? t("wishlist.priority", item.priority) : null,
            item.recommendedBy ? t("wishlist.recommended", item.recommendedBy) : null,
          ]
            .filter(Boolean)
            .join(" · ")
        )
      )
    )
  );
}
