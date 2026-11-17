// Create / edit book form (FR-02), with the optional first reading section (FR-03).

import { t } from "../strings.js";
import { FORMS, MODES, CONTENTS } from "../constants.js";
import { el, field, openDialog, clearErrors, showErrors, textValue, numberValue, showError } from "../ui.js";
import { getAuthors, getThemes, getReadingsByBook, saveBook, saveTheme, saveReading, ApiError } from "../store.js";
import { validateBook, validateReading, currentYear } from "../validation.js";
import { createPicker } from "./picker.js";
import { createReadingFields } from "./reading-form.js";

const READING_PREFIX = "reading.";

/**
 * Opens the book form. For a new book, the user can also add its first reading,
 * so a wishlist entry or a book already read takes a single Save.
 * Options: prefillTitle fills the title; withReading opens the first reading section.
 * Resolves with { book, reading } (reading may be null), or null if cancelled.
 */
export async function openBookForm(book = null, { prefillTitle = null, withReading = false } = {}) {
  const [authors, themes, readings] = await Promise.all([
    getAuthors(),
    getThemes(),
    book ? getReadingsByBook(book.id) : Promise.resolve([]),
  ]);
  const isNew = !book;

  const authorPicker = createPicker({
    name: "authorIds",
    label: t("fields.authors"),
    hint: t("fields.addAuthorHint"),
    addLabel: t("fields.addAuthor"),
    emptyLabel: t("fields.noAuthorsSelected"),
    items: authors,
    selectedIds: book?.authorIds ?? [],
    unknownMessage: t("validation.authorUnknown"),
    duplicateMessage: t("validation.authorDuplicate"),
  });

  const themePicker = createPicker({
    name: "themeIds",
    label: t("fields.themes"),
    hint: t("fields.addThemeHint"),
    addLabel: t("fields.addTheme"),
    emptyLabel: t("fields.noThemesSelected"),
    items: themes,
    selectedIds: book?.themeIds ?? [],
    unknownMessage: t("validation.themeUnknown"),
    duplicateMessage: t("validation.themeDuplicate"),
    create: (name) => saveTheme({ name }),
  });

  let readingFields = null;
  let readingToggle = null;
  let readingSection = null;
  if (isNew) {
    readingFields = createReadingFields({ prefix: READING_PREFIX, defaultStatus: "Want to read" });
    readingToggle = el("input", { type: "checkbox", id: "first-reading-toggle" });
    readingSection = el(
      "fieldset",
      { className: "subsection" },
      el("legend", { text: t("forms.firstReading") }),
      el("div", { className: "check" }, readingToggle, el("label", { for: "first-reading-toggle", text: t("forms.firstReadingToggle") })),
      readingFields.element
    );
    readingFields.setEnabled(false);
    readingFields.element.hidden = true;
    readingToggle.addEventListener("change", () => {
      readingFields.element.hidden = !readingToggle.checked;
      readingFields.setEnabled(readingToggle.checked);
    });
  }

  const form = el(
    "form",
    { className: "form", novalidate: true },
    field({ name: "title", label: t("fields.title"), required: true }),
    authorPicker.element,
    field({
      name: "publicationYear",
      label: t("fields.publicationYear"),
      type: "number",
      step: 1,
      max: currentYear(),
      inputmode: "numeric",
      hint: t("fields.publicationYearHint"),
    }),
    el(
      "div",
      { className: "field-row three" },
      field({ name: "form", label: t("fields.form"), type: "select", choices: FORMS }),
      field({ name: "mode", label: t("fields.mode"), type: "select", choices: MODES }),
      field({ name: "content", label: t("fields.content"), type: "select", choices: CONTENTS })
    ),
    themePicker.element,
    readingSection,
    el("p", { className: "form-error", role: "alert" }),
    el(
      "div",
      { className: "form-actions" },
      el("button", { type: "button", className: "button", dataset: { action: "cancel" }, text: t("common.cancel") }),
      el("button", { type: "submit", className: "button primary", text: t("common.save") })
    )
  );

  const c = form.elements;
  if (book) {
    c.title.value = book.title ?? "";
    c.publicationYear.value = book.publicationYear ?? "";
    c.form.value = book.form ?? "";
    c.mode.value = book.mode ?? "";
    c.content.value = book.content ?? "";
  }

  if (isNew && prefillTitle) c.title.value = prefillTitle;
  if (isNew && withReading) {
    readingToggle.checked = true;
    readingToggle.dispatchEvent(new Event("change"));
  }

  const dialog = openDialog(isNew ? t("forms.newBook") : t("forms.editBook"), form, { wide: true });
  c.title.focus();

  return new Promise((resolve) => {
    let result = null;
    let savedBook = null;
    form.querySelector("[data-action=cancel]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => resolve(result ?? (savedBook ? { book: savedBook, reading: null } : null)));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors(form);
      // Text typed in a picker but not added yet is added now (or reported).
      if (authorPicker.hasPendingText()) await authorPicker.addPending();
      if (themePicker.hasPendingText()) await themePicker.addPending();
      if (form.querySelector(".picker.has-error")) {
        showErrors(form, []);
        return;
      }

      const bookData = {
        id: book?.id ?? null,
        title: textValue(c.title),
        authorIds: authorPicker.getIds(),
        publicationYear: numberValue(c.publicationYear),
        form: c.form.value || null,
        mode: c.mode.value || null,
        content: c.content.value || null,
        themeIds: themePicker.getIds(),
      };
      const withReading = isNew && readingToggle.checked;
      const readingData = withReading ? readingFields.getData() : null;

      // Validate book and first reading together, so nothing is saved if either is invalid.
      const latestThemes = await getThemes();
      const errors = validateBook(bookData, { authors, themes: latestThemes, readings });
      const readingErrors = withReading
        ? validateReading({ ...readingData, bookId: null }, { book: bookData, skipBookCheck: true })
        : [];
      if (errors.length || readingErrors.length) {
        showErrors(form, errors);
        showErrors(form, readingErrors, { prefix: READING_PREFIX });
        if (errors.length) form.querySelector(".field.has-error input, .field.has-error select")?.focus();
        return;
      }

      try {
        // If the book was saved but its reading failed, a retry only saves the reading.
        savedBook ??= await saveBook(bookData);
        let savedReading = null;
        if (withReading) savedReading = await saveReading({ ...readingData, bookId: savedBook.id });
        result = { book: savedBook, reading: savedReading };
        dialog.close();
      } catch (error) {
        if (error instanceof ApiError && error.errors.length) showErrors(form, error.errors);
        else showError(error);
      }
    });
  });
}
