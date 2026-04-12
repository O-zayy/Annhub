# Annhub Frontend

A single-page anime showcase app using HTML, CSS, and vanilla JavaScript with API-backed content.

## Implemented Enhancements
- Debounced search input for smoother filtering updates.
- Throttled infinite scroll auto-load for anime list expansion.
- Local storage persistence for discover search/filter/sort preferences.
- Beginner-friendly UI logic for filters, modal playback, and load more behavior.

## Development Standards

### 1. Make Regular Commits
- Commit in small, logical chunks.
- Use clear, action-based commit messages.
- Examples:
  - `feat: add anime search and filter controls`
  - `feat: implement sorting by score and title`
  - `fix: handle API fallback errors in anime loader`
  - `refactor: split anime render and query logic`

### 2. Follow Clean Code Practices
- Keep functions short and focused on one responsibility.
- Use consistent indentation and spacing.
- Prefer early returns to reduce nesting.
- Remove dead/commented code before merging.

### 3. Use Meaningful Names
- Prefer descriptive identifiers over abbreviations.
- Good examples:
  - `loadedAnimeList`
  - `updateGenreFilterOptions`
  - `renderNoResultsState`
- Avoid vague names like `data2`, `temp`, `x`.

### 4. Avoid Code Repetition (DRY)
- Reuse helper functions for shared behavior.
- Centralize repeated logic (normalization, sorting, filtering, rendering).
- If a pattern appears 2+ times, extract it.

### 5. Maintain Proper Structure
Separate concerns inside `script.js` using clear sections:
- API fetching and fallback logic
- State management
- UI rendering
- Event wiring

If complexity grows, split into files:
- `api.js` for API/fallback functions
- `anime-state.js` for query and pagination state
- `anime-render.js` for DOM rendering
- `anime-events.js` for listeners and interactions

### 6. Handle Errors Gracefully
- Wrap API calls in `try/catch`.
- Show user-friendly fallback UI on failures.
- Handle empty API payloads safely.
- Avoid crashes on missing fields by validating data.

### 7. Ensure Responsiveness
- Test commonly used breakpoints before commit:
  - Mobile: 360px-480px
  - Tablet: 768px
  - Laptop/Desktop: 1024px+
- Confirm discover controls, cards, and modal layout are usable on small screens.

### 8. Keep README Updated
Update this file when you change:
- Features
- Setup/run steps
- Project structure
- Known limitations and future improvements

### 9. Write Modular Code
- Break large logic into reusable, pure helper functions where possible.
- Keep DOM manipulation functions separate from data transformation functions.
- Prefer passing data into functions instead of relying on hidden globals.

## Current Project Structure
- `index.html`: page structure and UI sections
- `style.css`: custom styles
- `script.js`: app logic (animation, API integration, rendering, controls)
- `api_fallbacks.js`: backup API chain logic

## Lightweight Pre-Commit Checklist
- [ ] Feature works end-to-end
- [ ] No console errors
- [ ] API errors handled safely
- [ ] UI checked on mobile + desktop
- [ ] Names are descriptive
- [ ] No duplicated logic introduced
- [ ] README updated (if behavior/structure changed)
