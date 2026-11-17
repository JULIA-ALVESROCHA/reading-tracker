# Reading Tracker (Delivery 1: Frontend)

Semester assignment for Full Stack Web Development (UNIFAL-MG).
A web application that replaces a Word reading log with structured data: authors, books and readings (including the wishlist), with consistent input and validation.

Delivery 1 is a vanilla HTML, CSS and JavaScript frontend. Data lives in the browser (`localStorage`).

## Team

| Name | Student ID |
| --- | --- |
| Julia Alves Rocha | `TODO` |

## How to run

No installation or build step is needed. Java is not used in Delivery 1.

1. Clone the repository.
   ```bash
   git clone <repository-url>
   cd reading-tracker
   ```
2. Make sure `data/seed.json` is present (the instructor's seed file).
3. Serve the folder with a static server. `fetch` does not work from `file://`.
   - **VS Code:** install the Live Server extension, open the folder, right-click `index.html` and choose *Open with Live Server*.
   - **Or Python 3:** `python3 -m http.server 8000` and open http://localhost:8000.
4. On the first visit, the app loads `data/seed.json` into `localStorage`. Later visits read only from `localStorage`.
5. To start over, click **Reset data** in the header.

Tested in Chrome (desktop and a 390 px phone viewport).

## Pages

| Page | File | What it does |
| --- | --- | --- |
| Home / Reading log | `index.html` | Search, status chips, a shelf of recently read books, a summary banner, the full reading log (sortable by title, authors, status, year read and grade) and a Wishlist side panel with a quick "add to wishlist" box. |
| Books | `books.html` | All books as drawn covers, with search and sorting. Create a book (with an optional first reading). |
| Book | `book.html?id=…` | Cover, details, edit and delete the book, add / edit / delete its readings. |
| Authors | `authors.html` | Create, edit and delete authors. |

The covers are drawn with CSS (no images). Each book gets one of six colors from its ID. On phones the sidebar becomes a bottom bar, tables become cards, and the side panel moves below the log.

## Project structure

```
reading-tracker/
├── index.html, books.html, book.html, authors.html
├── css/style.css
├── data/seed.json
└── js/
    ├── store.js          data access (the only file that touches localStorage)
    ├── validation.js     Section 4 rules
    ├── constants.js      controlled values (forms, modes, statuses, priorities) and status rules
    ├── strings.js        all interface text, in one place
    ├── ui.js             DOM helpers, dialogs, field errors, formatting, header and Reset data
    ├── render.js         tables and detail views
    ├── sort.js           sorting (missing values last, then ID)
    ├── forms/
    │   ├── author-form.js
    │   ├── book-form.js   includes the optional first reading section
    │   ├── reading-form.js  reading fields and the status workflow
    │   └── picker.js      multi-select for authors and themes
    └── pages/            one entry module per page
        ├── log.js, books.js, book.js, authors.js
```

The JavaScript uses **ES modules**. Each page loads one entry file with `<script type="module">`.
There are no inline `onclick` or `style` attributes and no `<style>` blocks; events use `addEventListener`.
Interface text lives in `js/strings.js`. HTML elements use `data-i18n` keys that are filled at load time.

### Preparing for Delivery 2

All data access is in `js/store.js`. Every function is `async` and returns the same shapes as `seed.json`:

`getCountries`, `getThemes`, `saveTheme`, `getAuthors`, `getAuthor`, `saveAuthor`, `deleteAuthor`, `getBooks`, `getBook`, `saveBook`, `deleteBook`, `getReadings`, `getReadingsByBook`, `getReading`, `saveReading`, `deleteReading`, `resetData`.

When saving fails, the store throws an `ApiError` with the same body the API will send:

```json
{ "status": 400, "message": "Validation failed",
  "errors": [{ "field": "yearRead", "message": "Year read is required when status is Read" }] }
```

Deleting an author linked to books throws status `409` with a message naming the books, and an unknown ID throws `404`.
In Delivery 2 only `store.js` changes, to call `/api/...` with `fetch`.

New records get the next integer ID after the highest existing one.

## Requirement checklist

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| FR-01 | Manage authors | Implemented | Create, view, edit, delete. Name unique ignoring case. Nationality from the seed's country list. A linked author cannot be deleted; the message names the linked books. |
| FR-02 | Manage books | Implemented | Create, view, edit, delete. Authors are picked from existing records only. Themes are picked from existing ones or created on the spot (no duplicates, case-insensitive). |
| FR-03 | Manage readings | Implemented | Add one or more readings to a book, edit and delete them. The new book form has an optional first reading section, so one Save creates the book and its reading (wishlist or already read). Deleting a book deletes its readings after a confirmation that states how many. |
| FR-04 | Status workflow | Implemented | Want to read, Reading, Paused, Read, Abandoned. Read requires a year read. Leaving Want to read keeps recommendation and notes and clears priority. Moving to a status that does not allow year read or grade asks for confirmation before clearing them (Cancel reverts the status). Fields not allowed by the current status are disabled. |
| FR-05 | Reading log | Implemented | Title, authors, status, year read, grade. Every column sortable (ascending / descending). Missing values show "-" and always sort last. Default: year read (most recent first), then ID ascending. |
| FR-06 | Validation | Implemented | Every Section 4 rule is checked in the form, with the message next to the field. The store checks the same rules again before saving, so invalid data is never saved. |
| FR-07 | Seed data and reset | Implemented | Seed loaded with `fetch` only on first use. Changes survive a reload. Reset data (with confirmation) clears the app's `localStorage` keys and loads the seed again. |
| FR-08 | Filters and search | Partially implemented (optional) | Reading log: search by title or author (partial, case-insensitive) and status chips. Books and authors pages have search. |
| FR-09 | Wishlist | Implemented (optional) | Side panel on the home page lists Want to read readings sorted by priority (High, Medium, Low), with who recommended each book. |

### Validation rules covered (FR-06)

- **Author:** name required and unique (ignoring case); nationality from the fixed list; birth date valid and not in the future; death date valid, not in the future, and after the birth date.
- **Book:** title required; authors only from existing records, no duplicates; publication year an integer, not 0, not in the future, negative for BC, and not later than any year read of its readings; form, mode and content from their lists; themes from existing records, no duplicates.
- **Reading:** book required; status required and from the list; year read required for Read, optional for Abandoned, empty otherwise, not in the future and not earlier than the publication year; grade only for Read or Abandoned, 0.0 to 10.0 in steps of 0.5; priority only for Want to read.

