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

export function createBackendLinksProvider(api: any, client: BackendClient) {
  // return an unregister() so main.ts can clean up
  return api.registerVirtualLinkProvider(async ({ file, makeLink, app }: ProviderCtx) => {
    // Get app from the API if not passed in the context
    const appInstance = app || api.plugin?.app;
    // Only call backend for the currently active file to avoid excessive API calls
    const activeFile = api.plugin?.app?.workspace?.getActiveFile();
    if (!activeFile || file.path !== activeFile.path) {
      log.debug("Backend provider: skipping non-active file:", file.path);
      return [];
    }
    
    // REMOVED: Skip if we're in minimal mode (backend-only mode)
    // if (api.plugin?.settings?.minimalMode) {
    //   log.debug("Backend provider: skipping in minimal mode");
    //   return [];
    // }
    
    log.debug("Backend provider called for active file:", file.path);
    
    try {
      // Read file content to convert spans to positions
      const fileContent = await appInstance.vault.read(file);
      
      // Use the new candidates endpoint to get keywords from the current file
      const res = await client.getKeywordCandidatesForFile(file.path);
      log.debug("Backend provider response:", (res.keywords ?? []).length, "keywords");
      
      if (res.keywords && res.keywords.length > 0) {
        log.debug("Backend provider: sample keyword:", res.keywords[0]);
      }
      
      // Convert keywords to virtual links with position information
      const allLinks = res.keywords.flatMap(kw => {
        // Convert each span to a position and create a link
        return kw.spans.map(span => {
          const pos = offsetRangeToPos(fileContent, span);
          const link = makeLink(`keyword:${kw.keyword}`, kw.keyword, pos);
          log.debug("Backend provider: created link for keyword:", kw.keyword, "at pos:", pos, "->", link);
          return { link, keyword: kw.keyword, line: pos.start.line, col: pos.start.col };
        });
      });

      // De-duplicate same (keyword, line, col) combinations
      const seen = new Set<string>();
      const virtualLinks = allLinks
        .filter(({ keyword, line, col }) => {
          const key = `${keyword}:${line}:${col}`;
          if (seen.has(key)) {
            log.debug("Backend provider: deduplicating duplicate position:", key);
            return false;
          }
          seen.add(key);
          return true;
        })
        .map(({ link }) => link);

      log.debug("Backend provider: converted to virtual links", virtualLinks.length, "(after deduplication)");
      if (virtualLinks.length > 0) {
        log.debug("Backend provider: sample virtual link:", virtualLinks[0]);
      }
      return virtualLinks;
    } catch (error) {
      log.error("Backend provider error:", error);
      return [];
    }
  });
}
