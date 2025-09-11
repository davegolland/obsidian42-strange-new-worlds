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
    log.debug("Backend provider called for file:", file.path);
    const res = await client.related(file.path, 10);
    log.debug("Backend provider response:", (res.items ?? []).length, "items");
    return res.items
      .filter(x => x?.path)
      .map(x => makeLink(x.path, x.reason ? `🤝 ${x.reason}` : undefined));
  });
}
