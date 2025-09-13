# Custom Phrases Demo

This file demonstrates the custom phrases feature. With the right configuration, the following terms should appear as virtual links in the InferredWikilinks sidebar:

## Custom Terms

- **Natural Language Processing** is becoming more important
- **Machine Learning** techniques are everywhere
- **Artificial Intelligence** is transforming industries
- **Deep Learning** models are getting larger
- **Neural Networks** are the foundation of modern AI

## What Should Be Detected

With custom phrases enabled, these should create virtual links:

- **Natural Language Processing** → links to your configured target
- **Machine Learning** → links to your configured target
- **Artificial Intelligence** → links to your configured target
- **Deep Learning** → links to your configured target
- **Neural Networks** → links to your configured target

## What Should NOT Be Detected

- `inline code` should not be detected
- ```code blocks``` should not be detected
- [[existing wikilinks]] should not be detected
- [markdown links](url) should not be detected
- **NaturalLanguageProcessing** (no spaces) should not be detected if word boundaries are enabled
- **MachineLearning** (no spaces) should not be detected if word boundaries are enabled

## Configuration Example

To enable these custom phrases:

1. Set **Detection Mode** to "Dictionary (Notes & Aliases)"
2. Configure **Dictionary Sources**:
   - ❌ Include Note Basenames (disable for custom phrases only)
   - ❌ Include Frontmatter Aliases (disable for custom phrases only)
   - ❌ Include Note Headings (disable for custom phrases only)
   - ✅ **Include Custom Phrases** (enable this)
3. Set **Minimum Phrase Length** to 3
4. ✅ Enable **Require Word Boundaries**
5. Add these **Custom Phrases**:
   - Natural Language Processing
   - Machine Learning
   - Artificial Intelligence
   - Deep Learning
   - Neural Networks

## How Custom Phrases Work

### **Advantages**
- **Complete Control**: You decide exactly which phrases to detect
- **No Vault Dependencies**: Works independently of your note structure
- **Consistent Targeting**: All phrases can point to the same target file
- **Easy Management**: Add/remove phrases through the settings UI

### **Use Cases**
- **Glossary Terms**: Define important concepts that should always be linked
- **External References**: Link to external documentation or resources
- **Consistent Terminology**: Ensure specific terms are always detected
- **Testing**: Create predictable test cases for the detection system

### **Behavior**
- **Case Insensitive**: "machine learning" and "Machine Learning" both match
- **Word Boundaries**: Prevents partial matches (e.g., "Learning" doesn't match inside "MachineLearning")
- **Policy Integration**: Respects the same equivalence policies as other links
- **Conflict Resolution**: When phrases overlap, longest match wins

## Advanced Configuration

### **Mixed Sources**
You can combine custom phrases with other sources:

```json
{
  "detectionMode": "dictionary",
  "dictionary": {
    "sources": {
      "basenames": true,      // Detect note filenames
      "aliases": true,        // Detect frontmatter aliases
      "headings": false,      // Don't detect headings
      "customList": true      // Also detect custom phrases
    },
    "customPhrases": [
      "Natural Language Processing",
      "Machine Learning",
      "Artificial Intelligence"
    ]
  }
}
```

### **Target Configuration**
In the current implementation, custom phrases are added to each file's dictionary, so they'll link to whatever file contains them. For more specific targeting, you could:

1. **Create a dedicated glossary file** and add custom phrases there
2. **Use regex mode** for more complex targeting patterns
3. **Extend the implementation** to support phrase-to-target mapping

## Management Tips

### **Adding Phrases**
1. Go to InferredWikilinks settings → Implicit Links → Dictionary Configuration
2. Enable "Include Custom Phrases"
3. Click "Add Phrase" for each new phrase
4. Enter the exact phrase text
5. Save settings

### **Removing Phrases**
1. Find the phrase in the Custom Phrases section
2. Click the "Delete" button next to it
3. Save settings

### **Editing Phrases**
1. Click in the phrase text field
2. Modify the text
3. Save settings (auto-saves on change)

### **Bulk Management**
For large lists, you can:
1. Export your settings (they're stored in JSON)
2. Edit the `customPhrases` array directly
3. Import the modified settings back

## Performance Considerations

- **Phrase Count**: Large lists may impact performance
- **Phrase Length**: Very long phrases are less efficient
- **Rebuilding**: Dictionary rebuilds when settings change
- **Caching**: Phrases are cached for efficient detection

The custom phrases feature gives you complete control over which terms are detected, making it perfect for creating consistent, predictable implicit links in your vault!
