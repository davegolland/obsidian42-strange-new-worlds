# Inferred Wikilinks - Comprehensive Documentation

## Overview

Inferred Wikilinks is an Obsidian plugin that reveals the interconnected nature of your vault by providing visual indicators for wikilinks, block references, and embeds. The plugin shows reference counts and allows you to explore connections between different parts of your vault through hover popovers and inline decorations.

## Architecture

### Core Components

#### 1\. Main Plugin (`src/main.ts`)

The central plugin class that orchestrates all functionality:

*   **InferredWikilinksPlugin**: Main plugin class extending Obsidian's Plugin
*   **Settings Management**: Handles plugin configuration
*   **API Initialization**: Sets up the InferredWikilinks API for external access
*   **Backend Integration**: Manages connection to external backend services
*   **Minimal Surface**: Initializes UI components for rendering inferred links

#### 2\. Reference Counting System (`src/policies/reference-counting.ts`)

The heart of the plugin's link analysis:

*   **ReferenceCountingPolicy**: Manages link indexing and reference counting
*   **Policy System**: Modular approach to determining link equivalence
*   **Virtual Link Providers**: Support for dynamic link generation
*   **Cache Management**: Optimized caching for performance

#### 3\. Backend Integration (`src/backend/`)

External service integration for AI-powered suggestions:

*   **BackendClient**: HTTP client for backend communication
*   **Provider**: Virtual link provider that converts backend responses to links
*   **Types**: TypeScript interfaces for backend communication

#### 4\. UI Components (`src/ui/`)

User interface elements and interactions:

*   **SettingsTab**: Plugin settings configuration
*   **Hover Components**: Interactive popover system
*   **Inline Decorations**: CodeMirror 6 extensions for inline reference counts

#### 5\. View Extensions (`src/view-extensions/`)

CodeMirror 6 extensions for editor integration:

*   **references-cm6.ts**: Inline reference count decorations
*   **register.ts**: Extension registration factory

## Key Features

### 1\. Visual Reference Indicators

*   **Inline Counts**: Shows reference counts next to wikilinks, embeds, and block references
*   **Hover Popovers**: Detailed information about references on hover
*   **Real-time Updates**: Counts update as you navigate and edit

### 2\. Backend Integration

*   **AI-Powered Suggestions**: Connect to external services for intelligent link recommendations
*   **Zero-Config Setup**: Automatic vault registration with backend
*   **Graceful Fallback**: Works without backend when unavailable

### 3\. Virtual Links System

*   **Dynamic Link Providers**: Other plugins can register custom link sources
*   **Flexible Integration**: Support for various data sources (frontmatter, computed relationships)
*   **API Access**: Simple registration system for external providers

### 4\. Policy System

*   **Modular Design**: Self-contained policies for link equivalence
*   **Case Insensitive**: Built-in case-insensitive matching
*   **Extensible**: Easy to add new policy types

## Technical Implementation

### Link Processing Pipeline

1.  **File Scanning**: Plugin scans all markdown files in the vault
2.  **Link Extraction**: Extracts wikilinks, embeds, block references, and frontmatter links
3.  **Policy Application**: Applies active policy to determine link equivalence
4.  **Index Building**: Creates indexed map of all references
5.  **Cache Management**: Maintains optimized cache for UI components
6.  **Virtual Link Integration**: Applies registered virtual link providers

### CodeMirror 6 Integration

The plugin uses CodeMirror 6 for editor integration:

*   **MatchDecorator**: Finds and decorates link patterns
*   **Widget System**: Renders inline reference counts
*   **ViewPlugin**: Manages decoration updates
*   **Transaction Handling**: Responds to document changes

### Backend Communication

Backend integration follows a RESTful API pattern:

*   **Registration**: Vault registration with backend service
*   **Candidates API**: Retrieves keyword candidates for files
*   **References API**: Gets detailed reference information
*   **Error Handling**: Graceful degradation when backend unavailable

## Configuration

### Settings

*   **Backend URL**: Base URI for backend service (default: `http://localhost:8000`)
*   **Require Modifier for Hover**: Toggle for Cmd/Ctrl requirement on hover

### Frontmatter Controls

*   **snw-index-exclude**: Exclude file from indexing
*   **snw-file-exclude**: Exclude file from display
*   **snw-canvas-exclude-edit**: Exclude from canvas editing

## API Reference

### InferredWikilinks API (`src/inferredWikilinksApi.ts`)

Public API for external access:

```typescript
// Get metadata for current file
getMetaInfoByCurrentFile(): Promise<MetadataInfo>

// Get metadata for specific file
getMetaInfoByFileName(fileName: string): Promise<MetadataInfo>

// Parse link text to full path
parseLinkTextToFullPath(linkText: string): string

// Register virtual link provider
registerVirtualLinkProvider(provider: VirtualLinkProvider): () => void

// Get virtual link providers
get virtualLinkProviders(): VirtualLinkProvider[]
```

### Virtual Link Provider Interface

```typescript
type VirtualLinkProvider = (args: {
  file: TFile;
  cache: CachedMetadata;
  makeLink: (linkText: string, displayText?: string, pos?: Pos) => Link;
  app?: any;
}) => Link[] | Promise<Link[]>;
```

### Backend API Types

```typescript
// Vault registration
interface VaultCreate {
  vault: string;
  path: string;
}

// Keyword candidates response
interface CandidatesResponse {
  vault: string;
  path: string;
  keywords: KeywordCandidate[];
}

// References response
interface ReferencesResponse {
  linkId: string;
  references: Reference[];
  total: number;
}
```

## File Structure

```
src/
├── main.ts                    # Main plugin class
├── settings.ts               # Settings management
├── snwApi.ts                 # Public API
├── types.ts                  # TypeScript interfaces
├── diag.ts                   # Logging utilities
├── backend/                  # Backend integration
│   ├── client.ts            # HTTP client
│   ├── provider.ts          # Virtual link provider
│   └── types.ts             # Backend types
├── policies/                 # Policy system
│   └── reference-counting.ts # Reference counting policy
├── implicit-links/           # Implicit links system
│   ├── ImplicitLinksManager.ts
│   ├── manager.ts
│   ├── cache.ts
│   ├── decorators.ts
│   ├── shared-utils.ts
│   └── utils.ts
├── ui/                       # UI components
│   ├── SettingsTab.ts       # Settings interface
│   ├── attr.ts              # HTML attributes
│   ├── modifier.ts          # Modifier key handling
│   ├── ui-inits.ts          # UI initialization
│   └── components/          # React components
│       ├── hover-content.tsx
│       ├── uic-ref-area.tsx
│       ├── uic-ref-item.tsx
│       └── uic-ref-title.tsx
├── view-extensions/          # CodeMirror extensions
│   ├── register.ts          # Extension registration
│   ├── references-cm6.ts    # Inline decorations
│   └── text-guards.ts       # Text processing
└── utils/                    # Utility functions
    └── index.ts
```

## Development

### Building

```
npm run build          # Production build
npm run dev            # Development build
npm run check-build    # Verify build
npm run lint           # Lint code
```

### Testing

The plugin includes several test scripts in the `scripts/` directory:

*   Backend integration tests
*   Virtual links tests
*   Custom phrases tests
*   Dictionary detector tests

### Key Dependencies

*   **Obsidian**: Core plugin framework
*   **CodeMirror 6**: Editor integration
*   **Preact**: UI components
*   **Tippy.js**: Tooltip system

## Performance Considerations

### Caching Strategy

*   **File-level Caching**: Cached metadata per file
*   **Reference Index**: In-memory map of all references
*   **Lazy Loading**: UI components load data on demand
*   **Debounced Updates**: Prevents excessive re-rendering

### Memory Management

*   **Provider Cleanup**: Proper unregistration of virtual link providers
*   **Cache Invalidation**: Smart cache invalidation on file changes
*   **Progress Tracking**: UI yields during large operations

## Troubleshooting

### Common Issues

1.  **Missing Reference Counts**: Check if file is excluded via frontmatter
2.  **Backend Not Working**: Verify backend URL and service availability
3.  **Performance Issues**: Check for large vaults and consider excluding folders
4.  **UI Not Updating**: Ensure proper plugin initialization order

### Debug Mode

Enable debug mode in the reference counting policy for detailed logging:

```typescript
referenceCountingPolicy.setDebugMode(true);
```

## Extension Points

### Custom Virtual Link Providers

```typescript
const unregister = window.snwAPI.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
  const links = [];
  // Your custom logic here
  return links;
});
```

### Custom Policies

Extend the policy system by implementing the policy interface:

```typescript
class CustomPolicy {
  name = "custom-policy";
  generateKey(link: Link): string { /* ... */ }
  countReferences(references: Link[]): number { /* ... */ }
  // ... other methods
}
```

## Version History

*   **v2.3.2**: Current version with virtual links and backend integration
*   **v2.0+**: Major rewrite with CodeMirror 6 and modular architecture
*   **v1.x**: Original implementation with basic reference counting

## Contributing

When contributing to this plugin:

1.  Follow the existing code patterns and architecture
2.  Maintain backward compatibility where possible
3.  Add comprehensive tests for new features
4.  Update documentation for API changes
5.  Consider performance implications of changes

## License

MIT License - see LICENSE.md for details.