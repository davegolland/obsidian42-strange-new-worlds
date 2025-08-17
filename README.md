# Strange New Worlds of networked thought

This plugin helps you to see the connections between the different parts of your vault.

The basic idea is we want to see when links, block references and embeds have associations with other files in the vault. The problem is you have to search, open backlinks, and so on to find out what is going on. But there are so many strange new worlds of networked thought to discover in our vault. This plugin attempts to resurface those connections and not be too intrusive (or not too intrusive) in doing so.

## 🔧 Modular Policy System

Strange New Worlds features a **modular policy system** that determines how wikilinks should be considered equivalent. Each policy is self-contained and can be easily enabled/disabled or extended:

- **Built-in Policies**: Case insensitive, word form unification, prefix overlap, and more
- **External Service Integration**: Connect to backend services for advanced link normalization
- **Easy Configuration**: Toggle policies by commenting/uncommenting lines
- **Async Support**: Policies can perform external API calls for real-time normalization

See [Policy System Documentation](docs/POLICY_SYSTEM.md) for detailed information on creating and configuring policies.

![](media/SNW.gif)

## 🆕 Virtual Links

Strange New Worlds now supports **Virtual Links** - a powerful feature that allows other plugins and snippets to register dynamic link providers. These virtual links are indexed just like regular wikilinks and appear in reference counts, gutters, and the sidebar.

### Quick Example

```typescript
// Register a provider that treats frontmatter 'related' property as links
const unregister = window.snwAPI!.registerVirtualLinkProvider(({ file, cache, makeLink }) => {
    const links = [];
    if (cache?.frontmatter?.related) {
        cache.frontmatter.related.forEach(noteName => {
            links.push(makeLink(noteName, `Related: ${noteName}`));
        });
    }
    return links;
});
```

See [Virtual Links Documentation](docs/VIRTUAL_LINKS_EXAMPLE.md) for detailed examples and API reference.

Documentation for this plugin can be found at: https://tfthacker.com/SNW

See videos on how to use Strange New Worlds: https://tfthacker.com/SNW-videos

You might also be interested in a few products I have made for Obsidian:


- [JournalCraft](https://tfthacker.com/jco) - A curated collection of 10 powerful journaling templates designed to enhance your journaling experience. Whether new to journaling or looking to step up your game, JournalCraft has something for you.
- [Cornell Notes Learning Vault](https://tfthacker.com/cornell-notes) - This vault teaches you how to use the Cornell Note-Taking System in your Obsidian vault. It includes learning material, samples, and Obsidian configuration files to enable Cornell Notes in your vault.
