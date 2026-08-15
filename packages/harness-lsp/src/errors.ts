export class ServerNotInstalledError extends Error {
  readonly language: string;
  readonly installHint: string;

  constructor(language: string, installHint: string) {
    super(`LSP server for ${language} is not installed.\n  Install: ${installHint}`);
    this.name = 'ServerNotInstalledError';
    this.language = language;
    this.installHint = installHint;
  }
}