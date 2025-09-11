import type { TFile } from "obsidian";
import { log } from "../diag";
import type { BackendClient } from "./client";

type ProviderCtx = {
  file: TFile;
  cache?: any;
  makeLink: (path: string, label?: string) => any;
};

export function createBackendLinksProvider(api: any, client: BackendClient) {
  // return an unregister() so main.ts can clean up
  return api.registerVirtualLinkProvider(async ({ file, makeLink }: ProviderCtx) => {
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
      // Use the new candidates endpoint to get keywords from the current file
      const res = await client.getKeywordCandidatesForFile(file.path);
      log.debug("Backend provider response:", (res.keywords ?? []).length, "keywords");
      
      if (res.keywords && res.keywords.length > 0) {
        log.debug("Backend provider: sample keyword:", res.keywords[0]);
      }
      
      // Convert keywords to virtual links for the implicit links system
      const virtualLinks = res.keywords.map(kw => {
        const link = makeLink(`keyword:${kw.keyword}`, kw.keyword);
        log.debug("Backend provider: created link for keyword:", kw.keyword, "->", link);
        return link;
      });

      log.debug("Backend provider: converted to virtual links", virtualLinks.length);
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
