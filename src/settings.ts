export interface Settings {
  backendUrl: string;              // e.g., "http://localhost:8000"
  requireModifierForHover: boolean;// if true, require Cmd/Ctrl to open hover
  minimalMode: boolean;            // default true (we're making slim the default)
}

export const DEFAULT_SETTINGS: Settings = {
  backendUrl: "http://localhost:8000",
  requireModifierForHover: false,
  minimalMode: true,
};

// Migration function for loading settings with backward compatibility
export async function loadSettings(plugin: any): Promise<void> {
  const raw = await plugin.loadData() ?? {};
  // Keep only fields we care about
  plugin.settings = {
    backendUrl: typeof raw.backendUrl === "string" ? raw.backendUrl : DEFAULT_SETTINGS.backendUrl,
    requireModifierForHover: !!raw.requireModifierForHover,
    minimalMode: raw.minimalMode !== false, // default to true
  };
}

export async function saveSettings(plugin: any): Promise<void> {
  await plugin.saveData(plugin.settings);
}
