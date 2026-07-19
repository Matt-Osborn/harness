import { CliTheme } from '@harness/shared';

export function showHelp(): void {
  const t = new CliTheme();
  console.log(`
${t.bold('AI Harness')} — Agentic Coding CLI

${t.bold('USAGE:')}
  harness [OPTIONS] [COMMAND]

${t.bold('OPTIONS:')}
  -p, --prompt <text>    Run a single prompt in print mode
  -m, --model <name>     Specify which model to use
  -s, --search <provider> Search provider (tavily, duckduckgo, openrouter)
  -w, --width <cols>     Wrap output at column width (default: 80)
  -S, --session <id>     Resume a specific session
  -r, --resume           Resume the most recent session
  --styled               Enable styled markdown output (buffers response, renders on completion)
  --no-styled            Disable styled markdown output
  --temperature <0-2>    Set temperature for this session (default: 0.1)
  --sessions             List saved sessions
  --context-management   Enable context management (default)
  --no-context-management Disable context management (no truncation/compaction)
  --status-line          Show progress status bar (default)
  --no-status-line       Hide progress status bar
  -h, --help             Show this help message

${t.bold('COMMANDS:')}
  model                  List configured models
  sessions               List saved sessions
  config                 Show effective configuration
  init                   Create default config at ~/.harness/config.toml
  skill <sub> [name]    Manage skills (list|enable|disable)
  tui                    Launch the TUI (terminal UI) mode

${t.bold('EXAMPLES:')}
  harness                          Start interactive mode
  harness -p "refactor this class" Run a single prompt
  harness -m deepseek -p "hello"   Use a specific model
  harness --search duckduckgo      Use DuckDuckGo search
  harness model list               List configured models
  harness -w 100                          Set wrap width to 100
  harness -S 20250616-143021-a1b2         Resume a specific session
  harness -r                              Resume the most recent session
  harness --sessions                      List saved sessions
  harness init                     Set up default config
`);
}
