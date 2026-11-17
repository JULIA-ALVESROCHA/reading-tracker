// Create / edit author form (FR-01).

import { t } from "../strings.js";
import { el, field, openDialog, clearErrors, showErrors, textValue, showError } from "../ui.js";
import { getAuthors, getCountries, saveAuthor, ApiError } from "../store.js";
import { validateAuthor, todayIso } from "../validation.js";
import { compareText } from "../ui.js";

/** Opens the author form. Resolves with the saved author, or null if cancelled. */
export async function openAuthorForm(author = null) {
  const [countries, authors] = await Promise.all([getCountries(), getAuthors()]);
  const sorted = [...countries].sort((a, b) => compareText(a.name, b.name));
  const today = todayIso();

  const form = el(
    "form",
    { className: "form", novalidate: true },
    field({ name: "name", label: t("fields.name"), required: true }),
    field({
      name: "countryId",
      label: t("fields.nationality"),
      type: "select",
      placeholder: t("fields.chooseCountry"),
      choices: sorted.map((c) => ({ value: String(c.id), label: c.name })),
    }),
    el(
      "div",
      { className: "field-row" },
      field({ name: "birthDate", label: t("fields.birthDate"), type: "date", max: today }),
      field({ name: "deathDate", label: t("fields.deathDate"), type: "date", max: today })
    ),
    el("p", { className: "form-error", role: "alert" }),
    el(
      "div",
      { className: "form-actions" },
      el("button", { type: "button", className: "button", dataset: { action: "cancel" }, text: t("common.cancel") }),
      el("button", { type: "submit", className: "button primary", text: t("common.save") })
    )
  );

  const c = form.elements;
  if (author) {
    c.name.value = author.name ?? "";
    c.countryId.value = author.countryId == null ? "" : String(author.countryId);
    c.birthDate.value = author.birthDate ?? "";
    c.deathDate.value = author.deathDate ?? "";
  }

  const dialog = openDialog(author ? t("forms.editAuthor") : t("forms.newAuthor"), form);
  c.name.focus();

  return new Promise((resolve) => {
    let saved = null;
    form.querySelector("[data-action=cancel]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => resolve(saved));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearErrors(form);
      const data = {
        id: author?.id ?? null,
        name: textValue(c.name),
        countryId: c.countryId.value === "" ? null : Number(c.countryId.value),
        birthDate: c.birthDate.validity.badInput ? "invalid" : textValue(c.birthDate),
        deathDate: c.deathDate.validity.badInput ? "invalid" : textValue(c.deathDate),
      };
      const errors = validateAuthor(data, { authors, countries });
      if (errors.length) return showErrors(form, errors);
      try {
        saved = await saveAuthor(data);
        dialog.close();
      } catch (error) {
        if (error instanceof ApiError && error.errors.length) showErrors(form, error.errors);
        else showError(error);
      }
    });
  });
}
