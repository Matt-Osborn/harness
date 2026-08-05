# cancel

During interactive mode, you can cancel an in-progress agent response
without exiting the application.

| Scenario | Result |
|---|---|
| **Ctrl+C** during streaming | Cancels immediately, returns to prompt |
| **Esc Esc** (double-Escape) during streaming | Cancels immediately, returns to prompt |
| **Ctrl+C** at prompt | Saves session and exits |
| Normal completion | Saves session (unchanged) |