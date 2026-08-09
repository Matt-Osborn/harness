# undo / redo

Undo and redo the last conversation exchange in interactive mode.

| Command | Description |
|---|---|
| `/undo` | Remove the last user message and agent response |
| `/redo` | Restore the last undone exchange |

`/undo` removes the most recent user message and its corresponding
assistant response, restoring the conversation to the state before
that exchange. `/redo` reverses the last `/undo`.

The undo history is cleared when you send a new message.

| Scenario | Behavior |
|---|---|
| No conversation yet | "Nothing to undo." |
| After `/undo` | Exchange removed, conversation rolled back |
| After `/redo` | Exchange restored |
| Send new message | Undo stack cleared, `/redo` unavailable |
| Multiple `/undo`s | Removes multiple exchanges in reverse order |