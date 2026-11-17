// Shared interface helpers: building elements, dialogs, field errors, formatting, page header.

import { t } from "./strings.js";
import { resetData } from "./store.js";

// ---------- elements ----------

/**
 * Creates an element. attrs: plain attributes, plus `text`, `className`, `dataset`, `on` (events).
 * Children may be nodes or strings.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key === "className") node.className = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "on") {
      for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Fills every [data-i18n] element with its text from strings.js. */
export function applyStrings(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nLabel));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.setAttribute("title", t(node.dataset.i18nTitle));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
}

// ---------- formatting ----------

export function show(value) {
  return value == null || value === "" ? t("common.missing") : String(value);
}

export function formatGrade(grade) {
  return grade == null ? t("common.missing") : Number(grade).toFixed(1);
}

export function formatYear(year) {
  if (year == null) return t("common.missing");
  return year < 0 ? `${-year} BC` : String(year);
}

/** Joins the names of the given author ids, in the book's order. */
export function authorNames(authorIds, authorsById) {
  return (authorIds ?? [])
    .map((id) => authorsById.get(id)?.name)
    .filter(Boolean)
    .join(", ");
}

export function byId(records) {
  return new Map(records.map((r) => [r.id, r]));
}

export function compareText(a, b) {
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

// ---------- form fields ----------

let fieldCounter = 0;

/**
 * Builds a labeled form field with an error slot next to it.
 * options: { name, label, type, required, hint, choices, placeholder, min, max, step, value, rows }
 * choices: array of strings or { value, label }.
 */
export function field(options) {
  const { name, label, type = "text", required = false, hint, choices, value } = options;
  const id = `f-${name.replace(/\W/g, "-")}-${++fieldCounter}`;
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");

  let control;
  if (type === "select") {
    control = el("select", { id, name, "aria-describedby": describedBy, required });
    control.append(el("option", { value: "", text: options.placeholder ?? t("fields.choose") }));
    for (const choice of choices ?? []) {
      const c = typeof choice === "object" ? choice : { value: choice, label: choice };
      control.append(el("option", { value: c.value, text: c.label }));
    }
  } else if (type === "textarea") {
    control = el("textarea", { id, name, rows: options.rows ?? 3, "aria-describedby": describedBy });
  } else {
    control = el("input", {
      id,
      name,
      type,
      required,
      min: options.min,
      max: options.max,
      step: options.step,
      inputmode: options.inputmode,
      list: options.list,
      autocomplete: "off",
      "aria-describedby": describedBy,
    });
  }
  if (value != null) control.value = value;

  return el(
    "div",
    { className: "field", dataset: { field: name } },
    el("label", { for: id }, label, required ? el("span", { className: "req", "aria-hidden": "true", text: " *" }) : null),
    control,
    hint ? el("p", { className: "hint", id: hintId, text: hint }) : null,
    el("p", { className: "field-error", id: errorId, "aria-live": "polite" })
  );
}

/** Clears all field and form-level errors inside a form. */
export function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach((p) => (p.textContent = ""));
  form.querySelectorAll("[aria-invalid]").forEach((c) => c.removeAttribute("aria-invalid"));
  form.querySelectorAll(".field.has-error").forEach((f) => f.classList.remove("has-error"));
  const summary = form.querySelector(".form-error");
  if (summary) summary.textContent = "";
}

/**
 * Shows each { field, message } next to its field (FR-06).
 * prefix: maps error fields to prefixed field names (e.g. "reading." in the book form).
 */
export function showErrors(form, errors, { prefix = "", summary = true } = {}) {
  let first = null;
  const orphan = [];
  for (const error of errors) {
    const wrapper = form.querySelector(`.field[data-field="${CSS.escape(prefix + error.field)}"]`);
    if (!wrapper) {
      orphan.push(error.message);
      continue;
    }
    wrapper.classList.add("has-error");
    const slot = wrapper.querySelector(".field-error");
    slot.textContent = slot.textContent ? `${slot.textContent} ${error.message}` : error.message;
    const control = wrapper.querySelector("input, select, textarea");
    control?.setAttribute("aria-invalid", "true");
    first ??= control;
  }
  const box = form.querySelector(".form-error");
  if (box && summary) box.textContent = [t("forms.fixErrors"), ...orphan].join(" ");
  first?.focus();
}

// ---------- value parsing (form -> data) ----------

export function textValue(control) {
  const value = control.value.trim();
  return value === "" ? null : value;
}

/** Empty -> null; otherwise a Number (NaN if not numeric, so validation reports it). */
export function numberValue(control) {
  const raw = control.value.trim().replace(",", ".");
  if (raw === "") return control.validity?.badInput ? Number.NaN : null;
  return Number(raw);
}

// ---------- dialogs ----------

/** Opens a modal <dialog> that holds `content`. Returns the dialog; it is removed when closed. */
export function openDialog(title, content, { wide = false } = {}) {
  const headingId = `dlg-${++fieldCounter}`;
  const closeButton = el("button", {
    type: "button",
    className: "icon-button",
    "aria-label": t("common.close"),
    text: "×",
  });
  const dialog = el(
    "dialog",
    { className: wide ? "dialog dialog-wide" : "dialog", "aria-labelledby": headingId },
    el("header", { className: "dialog-header" }, el("h2", { id: headingId, text: title }), closeButton),
    el("div", { className: "dialog-body" }, content)
  );
  closeButton.addEventListener("click", () => dialog.close("cancel"));
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/** Confirmation dialog. Resolves true if the user confirms. */
export function confirmDialog(title, message, { confirmLabel = t("common.confirm"), danger = false } = {}) {
  return new Promise((resolve) => {
    const ok = el("button", { type: "button", className: danger ? "button danger" : "button primary", text: confirmLabel });
    const cancel = el("button", { type: "button", className: "button", text: t("common.cancel") });
    const dialog = openDialog(title, [el("p", { text: message }), el("div", { className: "form-actions" }, cancel, ok)]);
    dialog.classList.add("dialog-small");
    let answer = false;
    ok.addEventListener("click", () => {
      answer = true;
      dialog.close("ok");
    });
    cancel.addEventListener("click", () => dialog.close("cancel"));
    dialog.addEventListener("close", () => resolve(answer));
    cancel.focus();
  });
}

/** Message dialog with a single OK button. */
export function alertDialog(title, message) {
  return new Promise((resolve) => {
    const ok = el("button", { type: "button", className: "button primary", text: t("common.ok") });
    const dialog = openDialog(title, [el("p", { text: message }), el("div", { className: "form-actions" }, ok)]);
    dialog.classList.add("dialog-small");
    ok.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => resolve());
    ok.focus();
  });
}

/** Short status message at the bottom of the screen. */
export function toast(message) {
  let region = document.querySelector(".toast-region");
  if (!region) {
    region = el("div", { className: "toast-region", role: "status", "aria-live": "polite" });
    document.body.append(region);
  }
  const item = el("p", { className: "toast", text: message });
  region.append(item);
  setTimeout(() => item.remove(), 3000);
}

/** Shows an unexpected error (anything that is not a field validation error). */
export function showError(error) {
  console.error(error);
  alertDialog(t("app.name"), error?.message || t("common.unexpectedError"));
}

// ---------- page setup ----------

/** Applies strings, marks the current nav link and wires the Reset data button. */
export function initPage() {
  document.querySelector("#boot-notice")?.remove();
  applyStrings();
  const page = document.body.dataset.page;
  document.querySelectorAll("a[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) link.setAttribute("aria-current", "page");
  });
  document.querySelector("#reset-data")?.addEventListener("click", async () => {
    const ok = await confirmDialog(t("reset.title"), t("reset.message"), { confirmLabel: t("nav.reset"), danger: true });
    if (!ok) return;
    try {
      await resetData();
      sessionStorage.setItem("readingTracker.flash", t("reset.done"));
      location.reload();
    } catch (error) {
      showError(error);
    }
  });
  const flash = sessionStorage.getItem("readingTracker.flash");
  if (flash) {
    sessionStorage.removeItem("readingTracker.flash");
    toast(flash);
  }
}

/** Builds a sortable column header button. */
export function sortHeader(label, key, sort, onSort) {
  const active = sort.key === key;
  const th = el("th", { scope: "col", "aria-sort": active ? (sort.dir === "asc" ? "ascending" : "descending") : "none" });
  const button = el(
    "button",
    { type: "button", className: "sort-button", on: { click: () => onSort(key) } },
    label,
    el("span", { className: "sort-icon", "aria-hidden": "true", text: active ? (sort.dir === "asc" ? "▲" : "▼") : "↕" })
  );
  th.append(button);
  return th;
}
