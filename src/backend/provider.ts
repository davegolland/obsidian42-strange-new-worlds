import type { TFile } from "obsidian";
import { log } from "../diag";
import type { BackendClient } from "./client";
import { offsetRangeToPos } from "../implicit-links/utils";

type ProviderCtx = {
  file: TFile;
  cache?: any;
  makeLink: (path: string, label?: string, pos?: any) => any;
  app?: any; // Obsidian app instance for reading file content
};

export function createBackendLinksProvider(api: any, client: BackendClient): () => void {
  const unregister = api.registerVirtualLinkProvider(
    async ({ file, makeLink, app }: { file: any; makeLink: any; app?: any }) => {
      try {
        const appInstance = app || api.plugin?.app;

        // Only compute for the active file to avoid noise and extra calls
        const activeFile = api.plugin?.app?.workspace?.getActiveFile();
        if (!activeFile || file.path !== activeFile.path) return [];

        // Read content so we can turn byte offsets into editor positions
        const fileContent = await appInstance.vault.read(file);

        // ✅ Correct client call (was: client.getCandidates(file) → doesn't exist)
        const res = await client.getKeywordCandidatesForFile(file.path);
        const keywords = res?.keywords ?? [];
        if (!keywords.length) return [];

        // Map spans → positions → virtual links
        const all = keywords.flatMap(kw =>
          (kw.spans ?? []).map(span => {
            const pos = offsetRangeToPos(fileContent, span);
            const link = makeLink(`keyword:${kw.keyword}`, kw.keyword, pos);
            // Add badge information to the link if present
            if (kw.badge) {
              (link as any).badge = kw.badge;
            }
            return { key: `${kw.keyword}:${pos.start.line}:${pos.start.col}`, link };
          })
        );

        // Dedupe by (keyword, line, col)
        const seen = new Set<string>();
        const virtualLinks = [];
        for (const { key, link } of all) {
          if (seen.has(key)) continue;
          seen.add(key);
          virtualLinks.push(link);
        }
        return virtualLinks;
      } catch (e) {
        log.error("Backend provider error:", e);
        return [];
      }
    }
  );

  log.debug("SNW: backend virtual provider registered");
  return unregister;
}
