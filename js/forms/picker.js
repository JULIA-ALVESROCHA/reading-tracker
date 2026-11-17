// Multi-select "chip" picker used for a book's authors and themes.
// Values are always chosen from existing records; themes can also be created on the spot.

import { t } from "../strings.js";
import { el, compareText } from "../ui.js";
import { nameKey } from "../validation.js";

let pickerCounter = 0;

/**
 * @param name field name used for error messages (e.g. "authorIds")
 * @param items existing records [{ id, name }]
 * @param selectedIds initially selected ids
 * @param unknownMessage message when the typed text matches no record
 * @param duplicateMessage message when the record is already selected
 * @param create optional async (name) => record, to create a new record on the spot
 * @returns { element, getIds() }
 */
export function createPicker({ name, label, hint, addLabel, emptyLabel, items, selectedIds = [], unknownMessage, duplicateMessage, create = null }) {
  const id = `picker-${name}-${++pickerCounter}`;
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  let records = [...items];
  let selected = [...selectedIds];

  const datalist = el("datalist", { id: listId });
  const input = el("input", { id, type: "text", list: listId, autocomplete: "off", "aria-describedby": `${hintId} ${errorId}` });
  const addButton = el("button", { type: "button", className: "button", text: addLabel });
  const chips = el("ul", { className: "chips", "aria-label": t("fields.selected", label) });
  const error = el("p", { className: "field-error", id: errorId, "aria-live": "polite" });

  const element = el(
    "div",
    { className: "field picker", dataset: { field: name } },
    el("label", { for: id, text: label }),
    el("div", { className: "picker-input" }, input, addButton),
    datalist,
    el("p", { className: "hint", id: hintId, text: hint }),
    chips,
    error
  );

  function refreshOptions() {
    datalist.replaceChildren(
      ...records
        .filter((r) => !selected.includes(r.id))
        .sort((a, b) => compareText(a.name, b.name))
        .map((r) => el("option", { value: r.name }))
    );
  }

  function renderChips() {
    if (!selected.length) {
      chips.replaceChildren(el("li", { className: "chip-empty", text: emptyLabel }));
    } else {
      chips.replaceChildren(
        ...selected.map((selectedId) => {
          const record = records.find((r) => r.id === selectedId);
          const label = record?.name ?? `#${selectedId}`;
          return el(
            "li",
            { className: "chip" },
            el("span", { text: label }),
            el("button", {
              type: "button",
              className: "chip-remove",
              "aria-label": t("fields.removeItem", label),
              text: "×",
              on: {
                click: () => {
                  selected = selected.filter((x) => x !== selectedId);
                  render();
                  input.focus();
                },
              },
            })
          );
        })
      );
    }
  }

  function render() {
    refreshOptions();
    renderChips();
  }

  function setError(message) {
    error.textContent = message ?? "";
    element.classList.toggle("has-error", Boolean(message));
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  async function add() {
    const text = input.value.trim();
    setError(null);
    if (!text) return;
    let record = records.find((r) => nameKey(r.name) === nameKey(text));
    if (!record && create) {
      try {
        record = await create(text);
        records.push(record);
      } catch (err) {
        setError(err?.errors?.[0]?.message ?? err?.message);
        return;
      }
    }
    if (!record) return setError(unknownMessage);
    if (selected.includes(record.id)) return setError(duplicateMessage);
    selected.push(record.id);
    input.value = "";
    render();
    input.focus();
  }

  addButton.addEventListener("click", add);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  });

  render();

  return {
    element,
    getIds: () => [...selected],
    /** True if the user typed something but did not press Add. */
    hasPendingText: () => input.value.trim() !== "",
    addPending: add,
  };
}
