# width

The `--width` / `-w` flag controls output line wrapping.

By default the harness auto-detects your terminal width
(`process.stdout.columns`) and wraps output to fit. When running
non-interactively (piped output) it falls back to 80 columns.

| Scenario              |  Result       | Description                            |
|-----------------------|---------------|----------------------------------------|
| No flag, TTY (120)    | wrap at 120   | Auto-detect terminal width             |
| No flag, piped output | wrap at 80    | Fallback when no TTY                   |
| `-w 0`                | no wrap       | Passthrough, agent controls formatting |
| `-w 100`              | wrap at 100   | Explicit width                         |
| `-w 10`               | wrap at 20    | Clamped to minimum                     |