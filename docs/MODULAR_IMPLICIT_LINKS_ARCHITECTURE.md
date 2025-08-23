# Modular Implicit Links Architecture

## Overview

The Modular Implicit Links system provides a pluggable, extensible architecture for detecting and creating virtual links in Obsidian documents. This clean, modular design makes it easy to add new detection methods without modifying core code.

## Key Benefits

### 1. **Pluggable Architecture**
- Detectors can be registered and unregistered dynamically
- No need to modify core code to add new detection methods
- Clean separation of concerns

### 2. **User-Friendly Configuration**
- Dynamic UI that adapts to available detectors
- Each detector manages its own configuration
- Intuitive settings interface

### 3. **Extensible Design**
- Easy to create custom detectors
- Support for multiple active detectors simultaneously
- Rich metadata and configuration schemas

### 4. **Clean Implementation**
- No legacy code or backward compatibility layers
- Simple, focused components
- Clear API boundaries

## Architecture Components

### 1. DetectorRegistry
The central registry that manages all available detectors.

```typescript
export class DetectorRegistry {
  register(detector: ImplicitLinkDetector, metadata: DetectorMetadata, config: DetectorConfig): void
  unregister(id: string): boolean
  detect(file: TFile, text: string): Promise<DetectedLink[]>
  getAllDetectors(): RegisteredDetector[]
  getEnabledDetectors(): RegisteredDetector[]
}
```

### 2. ModularDetectionManager
High-level manager that coordinates the registry and provides a clean API.

```typescript
export class ModularDetectionManager {
  registerDetector(detector: ImplicitLinkDetector, metadata: DetectorMetadata, config: DetectorConfig): void
  detect(file: TFile, text: string): Promise<DetectedLink[]>
  updateConfig(config: Partial<ModularDetectionConfig>): void
  getDetectorMetadata(): DetectorMetadata[]
}
```

### 3. ImplicitLinkDetector Interface
The contract that all detectors must implement.

```typescript
export interface ImplicitLinkDetector {
  name: string;
  detect(file: TFile, text: string): Promise<DetectedLink[]>;
  rebuild?(): Promise<void>;
  unload?(): void;
}
```

### 4. Modular Settings UI
Dynamic settings interface that adapts to available detectors.

```typescript
export class ModularImplicitLinksSettings {
  render(): void
  renderDetectorSettings(): void
  renderDetectorSpecificSettings(container: HTMLElement, detector: any, metadata: DetectorMetadata, config: any): void
}
```

## Built-in Detectors

### RegexDetector
Detects links using configurable regex patterns with template substitution.

**Configuration:**
```typescript
interface RegexDetectorConfig {
  enabled: boolean;
  rules: Array<{
    pattern: string;
    flags: string;
    targetTemplate: string;
    displayTemplate?: string;
  }>;
}
```

**Example:**
```typescript
{
  enabled: true,
  rules: [
    {
      pattern: "\\bAPI\\b",
      flags: "gi",
      targetTemplate: "APIs/${0}.md",
      displayTemplate: "🔌 ${0}"
    }
  ]
}
```

### DictionaryDetector
Detects links based on note names, aliases, headings, and custom phrases.

**Configuration:**
```typescript
interface DictionaryDetectorConfig {
  enabled: boolean;
  sources: {
    basenames: boolean;
    aliases: boolean;
    headings: boolean;
    customList: boolean;
  };
  minPhraseLength: number;
  requireWordBoundaries: boolean;
  customPhrases: string[];
}
```

## Creating Custom Detectors

### Step 1: Implement the Interface

```typescript
export class MyCustomDetector implements ImplicitLinkDetector {
  name = "my-custom-detector";
  private config: MyDetectorConfig;

  constructor(config: Partial<MyDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    if (!this.config.enabled) return [];

    const results: DetectedLink[] = [];
    // Your detection logic here
    return results;
  }

  updateConfig(config: Partial<MyDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MyDetectorConfig {
    return { ...this.config };
  }

  unload(): void {
    // Clean up resources
  }
}
```

### Step 2: Register the Detector

```typescript
// In your plugin's onload() method
const myDetector = new MyCustomDetector({
  // Your configuration
});

this.detectionManager.registerDetector(
  myDetector,
  {
    id: "my-custom-detector",
    name: "My Custom Detector",
    description: "Detects custom patterns in your documents",
    version: "1.0.0",
    author: "Your Name"
  },
  {
    enabled: false,
    // Your detector-specific configuration
  }
);
```

### Step 3: Add Settings UI (Optional)

The modular settings UI will automatically generate basic settings for your detector. For custom UI, you can extend the `ModularImplicitLinksSettings` class:

```typescript
private renderMyDetectorSettings(container: HTMLElement, detector: any, config: any): void {
  // Your custom settings UI
  new Setting(container)
    .setName("Custom Setting")
    .addText((text) => {
      text
        .setValue(config.customSetting || "")
        .onChange(async (value) => {
          this.detectionManager.updateDetectorConfig("my-custom-detector", { 
            customSetting: value 
          });
          await this.onSettingsChange();
        });
    });
}
```

## Advanced Features

### Multiple Active Detectors

The system supports multiple active detectors simultaneously:

```typescript
// Enable multiple detectors
detectionManager.setDetectorEnabled("regex", true);
detectionManager.setDetectorEnabled("dictionary", true);
detectionManager.setDetectorEnabled("my-custom", true);

// All enabled detectors will run during detection
const results = await detectionManager.detect(file, text);
```

### Conflict Resolution

When multiple detectors find overlapping matches, the system uses a "longest span wins" rule:

1. Sort by match length (longest first)
2. Sort by position (earliest first)
3. Remove overlapping matches

### Performance Optimization

Detectors can implement caching and optimization:

```typescript
export class CachedDetector extends BaseDetector {
  private cache = new Map<string, DetectedLink[]>();

  async detect(file: TFile, text: string): Promise<DetectedLink[]> {
    const cacheKey = `${file.path}-${text.length}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const results = await super.detect(file, text);
    this.cache.set(cacheKey, results);
    return results;
  }
}
```

## Configuration Schema

Each detector can provide a JSON Schema for its configuration:

```typescript
export const DETECTOR_SETTINGS_SCHEMA = {
  type: "object",
  properties: {
    enabled: {
      type: "boolean",
      title: "Enable Detector",
      description: "Enable this detection method"
    },
    // Detector-specific properties
  },
  required: ["enabled"]
};
```

## Best Practices

### 1. **Detector Design**
- Keep detectors focused on a single responsibility
- Provide clear, descriptive names and descriptions
- Include proper error handling and logging

### 2. **Configuration Management**
- Use TypeScript interfaces for configuration
- Provide sensible defaults
- Validate configuration values

### 3. **Performance**
- Implement caching where appropriate
- Use efficient algorithms for text processing
- Clean up resources in the `unload()` method

### 4. **User Experience**
- Provide clear, helpful descriptions
- Include examples in documentation
- Make settings intuitive and discoverable

## Future Enhancements

### Planned Features

1. **Plugin API**: Allow third-party plugins to register detectors
2. **Advanced UI**: Drag-and-drop detector ordering
3. **Conditional Detection**: Context-aware detection rules
4. **Machine Learning**: AI-powered link detection
5. **Batch Processing**: Efficient processing of large vaults

### Extension Points

The architecture is designed to support future enhancements:

- **Detector Chaining**: Pipeline multiple detectors
- **Context Providers**: Share context between detectors
- **Event System**: React to vault changes
- **Analytics**: Track detection performance and usage

## Conclusion

The Modular Implicit Links architecture provides a clean, extensible foundation for link detection while maintaining excellent user experience. The pluggable design makes it easy to add new detection methods and customize the system for specific use cases.

For more information, see the examples in the `examples/` directory and the API documentation in the source code.
