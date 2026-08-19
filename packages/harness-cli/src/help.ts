import { CliTheme } from '@harness/shared';

export function showHelp(): void {
  const t = new CliTheme();
  console.log(`
${t.bold('harness-cli')} — Agentic Coding CLI

${t.bold('USAGE:')}
  harness [OPTIONS] [COMMAND]

${t.bold('OPTIONS:')}
  -p, --prompt <text>    Run a single prompt in print mode (must be last argument)
  -m, --model <name>     Specify which model to use
  --base-url <url>       Override the model's base URL (also works with unmatched --model for ephemeral models)
  -s, --search <provider> Search provider (tavily, duckduckgo, exa, searxng)
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
  --routing <mode>       OpenRouter routing mode: balanced, cost, speed, quality
  --free-tier            Appends :free to the model ID (use free models on OpenRouter)
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
  --remote <url>         Connect to a remote headless harness server
  -h, --help             Show this help message

${t.bold('COMMANDS:')}
  model                  List configured models
  sessions               List saved sessions
  config                 Show effective configuration
  default                View or set default model / search provider
  init                   Create default config at ~/.harness/config.toml
  launch <ollama|llama|sandbox>  Start local servers or sandboxed harness
  lsp <list|status>          Show LSP server info or list supported servers
  help                   Show this help message
  skill <sub> [name]    Manage skills (list|enable|disable)
  tui                    Launch the TUI (terminal UI, experimental) mode
  key                    Set or prompt for an API key (persists to ~/.harness/.env)
  providers              List known model providers
  provider add [name]    Set up a provider and optionally create a model
  model add              Add a new model interactively

${t.bold('EXAMPLES:')}
  harness                          Start in build mode (default)
  harness --plan                   Start in plan mode
  harness --search duckduckgo      Use DuckDuckGo search
  harness model list               List configured models
  harness key OPENROUTER_API_KEY   Securely set your API key
  harness providers                List known model providers
  harness provider add openrouter  Set up OpenRouter
  harness model add                Add a new model interactively
  harness default                  View current defaults
  harness default model deepseek   Set default model
  harness default search tavily    Set default search provider
  harness -w 100                          Set wrap width to 100
  harness -S 20250616-143021-a1b2         Resume a specific session
  harness -r                              Resume the most recent session
  harness --sessions                      List saved sessions
  harness init                     Set up default config
  ${t.warning('harness launch <ollama|llama|sandbox>')}   Start local servers or sandboxed harness
  ${t.warning('harness lsp')}                      Show LSP status or list supported servers

Run '${t.warning('harness --help v')}' for verbose help with all flags.
Run '${t.warning('harness help <topic>')}' for topic help (search, model, theme, etc.).
Run '${t.warning('harness help index')}' for a list of all help topics.
`);
}

export function showHelpVerbose(): void {
  const t = new CliTheme();
  console.log(`
${t.bold('harness-cli')} — Agentic Coding CLI

${t.bold('USAGE:')}
  harness [OPTIONS] [COMMAND]

${t.bold('MODEL SETTINGS:')}
  -m, --model <name>         Select a model by config key
  --base-url <url>           Override the model's base URL (ephemeral: works with unmatched --model)
  --temperature <0-2>        Override sampling temperature (omitted = model default)
  --top-p <0-1>              Override nucleus sampling (omitted = model default)
  --seed <int>               Override random seed for deterministic sampling
  --routing <mode>           OpenRouter routing mode: balanced, cost, speed, quality
  --free-tier                Appends :free to the model ID (free models on OpenRouter)
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
  --lsp / --no-lsp          Enable or disable LSP integration (overrides config)
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
  -s, --search <provider>    Set search provider (tavily, duckduckgo, exa, searxng)
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
  default                View or set default model / search provider
  init                   Create default config at ~/.harness/config.toml
  launch <ollama|llama|sandbox>  Start local servers or sandboxed harness
  lsp <list|status>          Show LSP server info or list supported servers
  help                   Show this help message
  skill <sub> [name]    Manage skills (list|enable|disable)
  tui                    Launch the TUI (terminal UI, experimental) mode
  key                    Set or prompt for an API key (persists to ~/.harness/.env)
  providers              List known model providers
  provider add [name]    Set up a provider and optionally create a model
  model add              Add a new model interactively

${t.bold('EXAMPLES:')}
  harness                          Start in build mode (default)
  harness --plan                   Start in plan mode
  harness -p "refactor this class" Run a single prompt
  harness -m deepseek -p "hello"   Use a specific model
  harness --search duckduckgo      Use DuckDuckGo search
  harness key OPENROUTER_API_KEY   Securely set your API key
  harness providers                List known model providers
  harness provider add openrouter  Set up OpenRouter
  harness model add                Add a new model interactively
  harness default                  View current defaults
  harness default model deepseek   Set default model
  harness default search tavily    Set default search provider
  harness -r                       Resume the most recent session
  harness -S 20250616-143021-a1b2  Resume a specific session
  harness --sessions               List saved sessions
  harness --drop-params            Strip unsupported params automatically
  harness --no-context-management  Disable context truncation
  harness init                     Set up default config

Run '${t.warning('harness help <topic>')}' for topic help (search, model, theme, etc.).
Run '${t.warning('harness help index')}' for a list of all help topics.
`);
}
