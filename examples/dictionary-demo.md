# Dictionary Detection Demo

This file demonstrates the dictionary-based implicit links feature. With the right configuration, the following terms should appear as virtual links in the InferredWikilinks sidebar:

## Note References

- I have some ideas for **My Note** that I want to explore
- The **Project Ideas** document contains many interesting concepts  
- We should look at **Machine Learning** techniques for this
- The **AI** field is rapidly evolving (this should link to Machine Learning.md via alias)

## What Should Be Detected

With dictionary mode enabled and basenames + aliases configured, these should create virtual links:

- **My Note** → links to `My Note.md`
- **Project Ideas** → links to `Project Ideas.md`  
- **Machine Learning** → links to `Machine Learning.md`
- **AI** → links to `Machine Learning.md` (via alias)
- **ML** → links to `Machine Learning.md` (via alias)
- **Ideas** → links to `Project Ideas.md` (via alias)
- **Projects** → links to `Project Ideas.md` (via alias)

## What Should NOT Be Detected

- `inline code` should not be detected
- ```code blocks``` should not be detected  
- [[existing wikilinks]] should not be detected
- [markdown links](url) should not be detected
- **MachineLearning** (no space) should not be detected if word boundaries are enabled
- **MyNote** (no space) should not be detected if word boundaries are enabled

## Configuration Example

To enable these dictionary-based implicit links:

1. Set **Detection Mode** to "Dictionary (Notes & Aliases)"
2. Configure **Dictionary Sources**:
   - ✅ Include Note Basenames
   - ✅ Include Frontmatter Aliases  
   - ❌ Include Note Headings (optional)
3. Set **Minimum Phrase Length** to 3
4. ✅ Enable **Require Word Boundaries**

## Test Files to Create

Create these files in your vault to test the feature:

### My Note.md
```yaml
---
aliases: [My Note, Note]
---

# My Note

This is a test note.
```

### Project Ideas.md
```yaml
---
aliases: [Ideas, Projects]
---

# Project Ideas

Some project ideas here.
```

### Machine Learning.md
```yaml
---
aliases: [ML, AI]
---

# Machine Learning

Machine learning concepts and techniques.
```

## Expected Behavior

- **Policy Integration**: Virtual links respect the same equivalence policies as regular wikilinks
- **Case Insensitive**: "machine learning" and "Machine Learning" both link to the same file
- **Conflict Resolution**: When multiple phrases overlap, the longest match wins
- **Word Boundaries**: Prevents partial matches (e.g., "Language" doesn't match inside "LanguageModel")
- **Performance**: Dictionary is built once and cached for efficient detection

## Advanced Features

- **Headings**: Enable "Include Note Headings" to also detect links to headings within notes
- **Custom Policies**: Dictionary detection works with all InferredWikilinks equivalence policies
- **Incremental Updates**: Dictionary rebuilds when files are created/renamed
- **Trie-based Matching**: Efficient character-based matching for large phrase sets
