// Book detail page: edit / delete the book (FR-02) and manage its readings (FR-03, FR-04).

import { t } from "../strings.js";
import { initPage, el, byId, confirmDialog, showError, toast } from "../ui.js";
import { getBook, getAuthors, getThemes, getReadingsByBook, deleteBook, deleteReading } from "../store.js";
import { renderBookDetails, renderBookReadings, bookCover } from "../render.js";
import { openBookForm } from "../forms/book-form.js";
import { openReadingForm } from "../forms/reading-form.js";

const bookId = Number(new URLSearchParams(location.search).get("id"));
const article = document.querySelector("#book");
const title = document.querySelector("#book-title");
const details = document.querySelector("#book-details");
const readingsContainer = document.querySelector("#book-readings");

let book = null;
let readings = [];

async function load() {
  const [loadedBook, authors, themes, loadedReadings] = await Promise.all([
    getBook(bookId),
    getAuthors(),
    getThemes(),
    getReadingsByBook(bookId),
  ]);
  book = loadedBook;
  readings = loadedReadings;
  const authorsById = byId(authors);
  const themesById = byId(themes);
  const names = book.authorIds.map((id) => authorsById.get(id)?.name).filter(Boolean);
  title.textContent = book.title;
  document.querySelector("#book-authors").textContent = names.join(", ") || t("books.unknownAuthor");
  document.querySelector("#book-cover").replaceChildren(bookCover(book.id, book.title, names.join(", "), { large: true }));
  document.title = `${book.title} · ${t("app.name")}`;
  renderBookDetails(details, book, {
    authors: names,
    themes: book.themeIds.map((id) => themesById.get(id)?.name).filter(Boolean),
  });
  renderBookReadings(readingsContainer, readings, { onEdit: editReading, onDelete: removeReading });
  article.setAttribute("aria-busy", "false");
}

async function editReading(id) {
  const reading = readings.find((r) => r.id === id);
  if (!reading) return;
  try {
    if (await openReadingForm(book, reading)) {
      toast(t("common.saved"));
      await load();
    }
  } catch (error) {
    showError(error);
  }
}

async function removeReading(id) {
  const ok = await confirmDialog(t("book.deleteReadingTitle"), t("book.deleteReadingMessage"), {
    confirmLabel: t("common.delete"),
    danger: true,
  });
  if (!ok) return;
  try {
    await deleteReading(id);
    toast(t("common.deleted"));
    await load();
  } catch (error) {
    showError(error);
  }
}

async function start() {
  initPage();

  document.querySelector("#edit-book").addEventListener("click", async () => {
    try {
      if (await openBookForm(book)) {
        toast(t("common.saved"));
        await load();
      }
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#delete-book").addEventListener("click", async () => {
    const count = (await getReadingsByBook(bookId)).length;
    const ok = await confirmDialog(t("book.deleteTitle"), t("book.deleteMessage", book.title, count), {
      confirmLabel: t("common.delete"),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBook(bookId);
      location.href = "books.html";
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#add-reading").addEventListener("click", async () => {
    try {
      if (await openReadingForm(book)) {
        toast(t("common.saved"));
        await load();
      }
    } catch (error) {
      showError(error);
    }
  });

  try {
    await load();
  } catch (error) {
    article.setAttribute("aria-busy", "false");
    article.replaceChildren(el("p", { className: "load-error", role: "alert", text: error.message || t("common.loadError") }));
  }
}

start();
