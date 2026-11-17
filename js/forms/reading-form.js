// Reading fields and the status workflow (FR-03, FR-04).
// The same fields are used in the reading dialog and in the "first reading" section of the book form.

import { t } from "../strings.js";
import { STATUSES, PRIORITIES, STATUS_RULES, GRADE_MIN, GRADE_MAX } from "../constants.js";
import { el, field, openDialog, clearErrors, showErrors, textValue, numberValue, confirmDialog, showError } from "../ui.js";
import { saveReading, ApiError } from "../store.js";
import { validateReading, currentYear } from "../validation.js";

/**
 * Builds the reading fields.
 * @param prefix field-name prefix (e.g. "reading.") so they can live inside another form
 * @param reading existing reading to edit, or null
 * @param defaultStatus status selected for a new reading
 * @returns { element, getData(), setEnabled(bool) }
 */
export function createReadingFields({ prefix = "", reading = null, defaultStatus = "Want to read" } = {}) {
  const n = (name) => prefix + name;
  const element = el(
    "div",
    { className: "reading-fields" },
    el(
      "div",
      { className: "field-row" },
      field({ name: n("status"), label: t("fields.status"), type: "select", required: true, choices: STATUSES }),
      field({ name: n("priority"), label: t("fields.priority"), type: "select", choices: PRIORITIES })
    ),
    el(
      "div",
      { className: "field-row" },
      field({ name: n("yearRead"), label: t("fields.yearRead"), type: "number", step: 1, max: currentYear(), inputmode: "numeric" }),
      field({
        name: n("grade"),
        label: t("fields.grade"),
        type: "number",
        step: 0.5,
        min: GRADE_MIN,
        max: GRADE_MAX,
        inputmode: "decimal",
        hint: t("fields.gradeHint"),
      })
    ),
    field({ name: n("recommendedBy"), label: t("fields.recommendedBy") }),
    field({ name: n("notes"), label: t("fields.notes"), type: "textarea", rows: 3 })
  );

  const get = (name) => element.querySelector(`[name="${CSS.escape(n(name))}"]`);
  const status = get("status");
  const priority = get("priority");
  const yearRead = get("yearRead");
  const grade = get("grade");

  status.value = reading?.status ?? defaultStatus;
  priority.value = reading?.priority ?? "";
  yearRead.value = reading?.yearRead ?? "";
  grade.value = reading?.grade ?? "";
  get("recommendedBy").value = reading?.recommendedBy ?? "";
  get("notes").value = reading?.notes ?? "";

  let enabled = true;
  let previousStatus = status.value;

  /** Enables only the fields the current status allows. */
  function applyRules() {
    const rules = STATUS_RULES[status.value];
    const toggle = (control, allowed) => {
      control.disabled = !enabled || !allowed;
      const wrapper = control.closest(".field");
      wrapper.classList.toggle("is-disabled", !allowed);
      control.title = allowed ? "" : t("fields.notAllowed");
    };
    toggle(yearRead, rules && rules.yearRead !== "none");
    toggle(grade, rules?.grade);
    toggle(priority, rules?.priority);
    yearRead.required = rules?.yearRead === "required";
    const label = yearRead.closest(".field").querySelector("label");
    label.classList.toggle("is-required", rules?.yearRead === "required");
  }

  // FR-04: leaving Want to read clears priority; moving to a status that does not
  // allow year read or grade clears them after the user confirms.
  status.addEventListener("change", async () => {
    const next = status.value;
    const rules = STATUS_RULES[next];
    if (!rules) {
      applyRules();
      return;
    }
    const clear = [];
    if (rules.yearRead === "none" && yearRead.value !== "") clear.push(t("fields.yearRead").toLowerCase());
    if (!rules.grade && grade.value !== "") clear.push(t("fields.grade").toLowerCase());
    if (clear.length) {
      const ok = await confirmDialog(t("workflow.clearTitle"), t("workflow.clearMessage", next, clear.join(t("workflow.and"))));
      if (!ok) {
        status.value = previousStatus;
        return;
      }
      if (rules.yearRead === "none") yearRead.value = "";
      if (!rules.grade) grade.value = "";
    }
    if (!rules.priority) priority.value = "";
    previousStatus = next;
    applyRules();
  });

  applyRules();

  return {
    element,
    /** Reads the fields into a reading object (seed.json shape, without id/bookId). */
    getData() {
      const rules = STATUS_RULES[status.value];
      return {
        status: status.value || null,
        yearRead: rules && rules.yearRead === "none" ? null : numberValue(yearRead),
        grade: rules && !rules.grade ? null : numberValue(grade),
        recommendedBy: textValue(get("recommendedBy")),
        priority: rules && !rules.priority ? null : priority.value || null,
        notes: textValue(get("notes")),
      };
    },
    setEnabled(value) {
      enabled = value;
      element.querySelectorAll("input, select, textarea").forEach((c) => (c.disabled = !value));
      if (value) applyRules();
    },
  };
}

/**
 * Opens the add / edit reading dialog for a book.
 * Resolves with the saved reading, or null if cancelled.
 */
export function openReadingForm(book, reading = null) {
  const fields = createReadingFields({ reading });
  const form = el(
    "form",
    { className: "form", novalidate: true },
    el("p", { className: "form-context" }, el("strong", { text: book.title })),
    fields.element,
    el("p", { className: "form-error", role: "alert" }),
    el(
      "div",
      { className: "form-actions" },
      el("button", { type: "button", className: "button", dataset: { action: "cancel" }, text: t("common.cancel") }),
      el("button", { type: "submit", className: "button primary", text: t("common.save") })
    )
  );
  const dialog = openDialog(reading ? t("forms.editReading") : t("forms.newReading"), form);
  form.querySelector("select").focus();

  return new Promise((resolve) => {
    let saved = null;
    form.querySelector("[data-action=cancel]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => resolve(saved));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors(form);
      const data = { id: reading?.id ?? null, bookId: book.id, ...fields.getData() };
      const errors = validateReading(data, { book });
      if (errors.length) return showErrors(form, errors);
      try {
        saved = await saveReading(data);
        dialog.close();
      } catch (error) {
        if (error instanceof ApiError && error.errors.length) showErrors(form, error.errors);
        else showError(error);
      }
    });
  });
}
