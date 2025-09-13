# Implicit Links Demo

This file demonstrates the implicit links feature. With the right configuration, the following terms should appear as virtual links in the InferredWikilinks sidebar:

## Technology Terms

- Natural Language Programming techniques are becoming more popular
- Machine Learning applications are everywhere
- Artificial Intelligence is transforming industries
- Deep Learning models are getting larger

## Code References

- The `main.ts` file contains the plugin logic
- The `settings.ts` file defines the configuration
- The `types.ts` file contains type definitions

## Date References

- 2024-01-15 was when this feature was implemented
- 2024-01-20 is the planned release date

## Custom Terms

- Obsidian42 Strange New Worlds is the plugin name
- Virtual Link Provider is the core concept
- Policy-driven equivalence is the approach

## What Should NOT Be Detected

- `inline code` should not be detected
- ```code blocks``` should not be detected
- [[existing wikilinks]] should not be detected
- [markdown links](url) should not be detected

## Configuration Example

To enable these implicit links, you would configure:

```json
{
  "detectionMode": "regex",
  "regexRules": [
    {
      "pattern": "\\bNatural Language Programming\\b",
      "flags": "gi",
      "targetTemplate": "Encyclopedia/${0}.md"
    },
    {
      "pattern": "\\bMachine Learning\\b",
      "flags": "gi", 
      "targetTemplate": "AI/${0}.md",
      "displayTemplate": "ML: ${0}"
    },
    {
      "pattern": "\\bArtificial Intelligence\\b",
      "flags": "gi",
      "targetTemplate": "AI/${0}.md"
    },
    {
      "pattern": "\\bDeep Learning\\b",
      "flags": "gi",
      "targetTemplate": "AI/${0}.md"
    },
    {
      "pattern": "`([^`]+)`",
      "flags": "g",
      "targetTemplate": "Code/${1}",
      "displayTemplate": "📄 ${1}"
    },
    {
      "pattern": "\\b(\\d{4}-\\d{2}-\\d{2})\\b",
      "flags": "g",
      "targetTemplate": "Daily/${1}.md",
      "displayTemplate": "📅 ${1}"
    },
    {
      "pattern": "\\bObsidian42 Strange New Worlds\\b",
      "flags": "gi",
      "targetTemplate": "Projects/${0}.md"
    },
    {
      "pattern": "\\bVirtual Link Provider\\b",
      "flags": "gi",
      "targetTemplate": "Concepts/${0}.md"
    }
  ]
}
```

This configuration would create virtual links for:
- Technology terms → Encyclopedia/AI folders
- Code references → Code folder  
- Dates → Daily folder
- Project names → Projects folder
- Concepts → Concepts folder
