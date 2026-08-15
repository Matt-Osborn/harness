import which from 'which';
import { LspClient } from './client.js';
import { LANGUAGE_SERVERS } from './language-servers.js';
import { ServerNotInstalledError } from './errors.js';
import { findProjectRoot, detectLanguage } from './detect.js';

class LspServerManager {
  private servers = new Map<string, LspClient>();

  async getClient(file: string): Promise<LspClient> {
    const language = detectLanguage(file);
    if (!language) throw new Error(`No LSP server available for ${file}`);

    const projectRoot = findProjectRoot(file);
    const key = `${language}@${projectRoot}`;

    const existing = this.servers.get(key);
    if (existing) return existing;

    const def = LANGUAGE_SERVERS[language];
    if (!which.sync(def.binary, { nothrow: true })) {
      throw new ServerNotInstalledError(language, def.installHint);
    }

    const client = new LspClient(def.binary, def.args, projectRoot);
    await client.initialize();
    this.servers.set(key, client);
    return client;
  }

  shutdownAll(): void {
    for (const [key, client] of this.servers) {
      client.shutdown().catch(() => client.kill());
      this.servers.delete(key);
    }
  }
}

export const lspServerManager = new LspServerManager();

export { ServerNotInstalledError } from './errors.js';
export { findProjectRoot, detectLanguage } from './detect.js';
export { LANGUAGE_SERVERS } from './language-servers.js';