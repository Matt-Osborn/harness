import { CliTheme } from '@harness/shared';

export function showHelp(): void {
  const t = new CliTheme();
  console.log(`
${t.bold('AI Harness')} — Agentic Coding CLI

${t.bold('USAGE:')}
  harness [OPTIONS] [COMMAND]

${t.bold('OPTIONS:')}
  -p, --prompt <text>    Run a single prompt in print mode (must be last argument)
  -m, --model <name>     Specify which model to use
  -s, --search <provider> Search provider (tavily, duckduckgo, exa)
  -w, --width <cols>     Wrap output at column width (default: auto, fallback 80)
  -S, --session <id>     Resume a specific session
  -r, --resume           Resume the most recent session
  --sessions             List saved sessions
  --purge-empty-sessions Remove sessions with no messages
  --dry-run              Preview purge without deleting (use with --purge-empty-sessions)
  --styled               Enable styled markdown output\n                           (buffers response, renders on completion)
  --no-styled            Disable styled markdown output
  --temperature <0-2>    Set temperature for this session
  --top-p <0-1>          Set top_p (nucleus sampling) for this session
  --seed <int>           Set seed for deterministic sampling
  --theme <name>         Apply a bundled theme (dracula, tokyonight, monokai,
                           github, carbonfox, catppuccin, and 8 more)
  --list-themes          List available bundled themes
  --hide-thinking        Suppress thinking text display
  --hide-tools           Suppress tool call indicator lines
  --ansi-256             Force ANSI 256-color mode (disable truecolor)
  --plan                 Start in plan mode (read-only, no modifications)
  --build                Start in build mode (default, modifications allowed)
  --max-iterations <n>   Override max agent iterations (0 = unlimited, default 25)
  --agent <name>         Use a named agent or pipeline
                           (from .harness/agents/ or .harness/pipelines/)
  -h, --help             Show this help message

${t.bold('COMMANDS:')}
  model                  List configured models
  sessions               List saved sessions
  config                 Show effective configuration
  init                   Create default config at ~/.harness/config.toml
  help                   Show this help message
  skill <sub> [name]    Manage skills (list|enable|disable)
  tui                    Launch the TUI (terminal UI) mode
  key                    Set or prompt for an API key (persists to ~/.harness/.env)

${t.bold('EXAMPLES:')}
  harness                          Start in build mode (default)
  harness --plan                   Start in plan mode
  harness --search duckduckgo      Use DuckDuckGo search
  harness model list               List configured models
  harness key OPENROUTER_API_KEY   Securely set your API key
  harness -w 100                          Set wrap width to 100
  harness -S 20250616-143021-a1b2         Resume a specific session
  harness -r                              Resume the most recent session
  harness --sessions                      List saved sessions
  harness init                     Set up default config

Run '${t.warning('harness --help v')}' for verbose help with all flags.
`);
}

export function showHelpVerbose(): void {
  const t = new CliTheme();
  console.log(`
${t.bold('AI Harness')} — Agentic Coding CLI

${t.bold('USAGE:')}
  harness [OPTIONS] [COMMAND]

${t.bold('MODEL SETTINGS:')}
  -m, --model <name>         Select a model by config key
  --temperature <0-2>        Override sampling temperature (omitted = model default)
  --top-p <0-1>              Override nucleus sampling (omitted = model default)
  --seed <int>               Override random seed for deterministic sampling
  --drop-params              Strip unsupported parameters automatically
  --no-drop-params           Disable automatic parameter stripping

${t.bold('OUTPUT AND DISPLAY:')}
  -w, --width <cols>         Set output wrap width in columns (default: auto, fallback 80)
  --styled                   Enable styled Markdown rendering\n                             (buffers response, renders on completion)
  --no-styled                Disable styled Markdown rendering\n                             (streams tokens as they arrive)
  --status-line              Show progress spinner during model thinking
  --no-status-line           Hide progress spinner
  --hide-thinking            Suppress thinking text display (show spinner only)
  --hide-tools               Suppress tool call indicator lines (⚡ lines)
  --ansi-256                 Force ANSI 256-color mode (disable truecolor)
  --plan                     Start in plan mode (read-only, no modifications)
  --build                    Start in build mode (default, modifications allowed)

${t.bold('SESSION MANAGEMENT:')}
  -S, --session <id>         Resume a specific session by ID
  -r, --resume               Resume the most recent session
  --sessions                 List saved sessions
  --purge-empty-sessions     Remove sessions with no messages
  --dry-run                  Preview purge without deleting (use with --purge-empty-sessions)

${t.bold('CONTEXT MANAGEMENT:')}
  --context-management       Enable context truncation and compaction (default)
  --no-context-management    Disable context management

${t.bold('AGENT & PIPELINE:')}
  --agent <name>             Load an agent definition or pipeline
                                from .harness/agents/<name>.toml or
                                .harness/pipelines/<name>.toml
  --max-iterations <n>       Override max agent iterations
                                (0 = unlimited, default 25)

${t.bold('MISCELLANEOUS:')}
  -p, --prompt <text>        Run a single prompt in print mode (must be last argument)
  -s, --search <provider>    Set search provider (tavily, duckduckgo, exa)
  -h, --help                 Show compact help message
  --help v                   Show this verbose help message

${t.bold('THEMES:')}
  --theme <name>             Apply a bundled color theme
                               Available: github, matrix, opencode, dracula,
                               tokyonight, monokai, nightowl, flexoki,
                               carbonfox, aura, vesper, vercel, catppuccin,
                               synthwave84
  --list-themes              List available bundled themes

${t.bold('COMMANDS:')}
  model                  List configured models
  sessions               List saved sessions
  config                 Show effective configuration
  init                   Create default config at ~/.harness/config.toml
  help                   Show this help message
  skill <sub> [name]    Manage skills (list|enable|disable)
  tui                    Launch the TUI (terminal UI) mode
  key                    Set or prompt for an API key (persists to ~/.harness/.env)

${t.bold('EXAMPLES:')}
  harness                          Start in build mode (default)
  harness --plan                   Start in plan mode
  harness -p "refactor this class" Run a single prompt
  harness -m deepseek -p "hello"   Use a specific model
  harness --search duckduckgo      Use DuckDuckGo search
  harness key OPENROUTER_API_KEY   Securely set your API key
  harness -r                       Resume the most recent session
  harness -S 20250616-143021-a1b2  Resume a specific session
  harness --sessions               List saved sessions
  harness --drop-params            Strip unsupported params automatically
  harness --no-context-management  Disable context truncation
  harness init                     Set up default config
`);
}
