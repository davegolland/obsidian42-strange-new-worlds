export { RegexDetector } from "./RegexDetector";
export { DictionaryDetector } from "./DictionaryDetector";
export { DetectionManager } from "./DetectionManager";
export { ImplicitLinksManager } from "./ImplicitLinksManager";
export { offsetRangeToPos, stripCodeBlocksAndLinks } from "./utils";

// New flicker-free implementation
export { createInferredLinksExtension } from "./manager";
export { inferredCacheField, setInferredCache, type InferredCache, type PhraseInfo } from "./cache";
export { buildPhraseRegexChunks, type PhraseRegexOpts } from "./regex";
export { makeChunkPlugin } from "./decorators";
