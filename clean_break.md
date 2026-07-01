# Clean Break Fix — Separate Tool Results from LLM Response Text

## The Problem

In `interactive.ts`, when the LLM's text response follows a tool result, the text starts on the same line as the `✓`:

```
⚡ web_fetch https://www.thewrap.com/... ✓ ✓Let me get a bit more detail...
```

## The Fix

Track a `justHadResult` flag. When the first `text` event arrives after a `tool_result`, insert a `\n` before it. Consecutive tool calls still work normally because `tool_call` already starts with `\n`.

### Change 1: Add tracking variable

In `interactive.ts`, after the existing tracking variables:

```typescript
let justHadResult = false;
```

### Change 2: Set flag in `tool_result`

In the `case 'tool_result'` handler, add `justHadResult = true;` before each `break`:

```typescript
case 'tool_result': {
  if (suppressPair) {
    suppressPair = false;
    break;
  }
  const r = event.data as { name: string; result: string; denied?: boolean };
  if (r.denied) {
    process.stdout.write(` \x1b[33m⛔ denied\x1b[0m`);
    lastErrorMsg = '';
  } else if (r.result.startsWith('Error') || r.result.startsWith('Search failed:')) {
    const msg = r.result.split('\n')[0].replace(/^Error( fetching URL)?:\s*/, '').trim();
    if (msg === lastErrorMsg) {
      process.stdout.write(` \x1b[31mx\x1b[0m`);
    } else {
      process.stdout.write(` \x1b[31m✗ ${msg}\x1b[0m`);
      lastErrorMsg = msg;
    }
  } else {
    process.stdout.write(` \x1b[32m✓\x1b[0m`);
    lastErrorMsg = '';
  }
  justHadResult = true;   // ← add this
  break;
}
```

### Change 3: Consume flag in `text` handler (non-styled branch)

Only the non-styled path needs this — styled mode buffers text and only renders on `done`, which starts fresh naturally:

```typescript
case 'text': {
  const chunk = event.data as string;
  if (styled) {
    streamBuf += chunk;
  } else {
    if (justHadResult) {
      process.stdout.write('\n');
      justHadResult = false;
    }
    const out = (textWrap as TextWrapper).push(chunk);
    if (out) process.stdout.write(out);
  }
  break;
}
```

## Result

```
⚡ web_fetch https://www.thewrap.com/... ✓ ✓
Let me get a bit more detail on the 2026 film's opening weekend breakdown
```

Clean break between tool results and LLM response.
