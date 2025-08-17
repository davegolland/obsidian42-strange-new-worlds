import type { WikilinkEquivalencePolicy } from './base/WikilinkEquivalencePolicy';
import { CaseInsensitivePolicy } from './policies/CaseInsensitivePolicy';
import { CaseSensitivePolicy } from './policies/CaseSensitivePolicy';
import { PrefixOverlapPolicy } from './policies/PrefixOverlapPolicy';
import { SameFilePolicy } from './policies/SameFilePolicy';
import { WordFormPolicy } from './policies/WordFormPolicy';
import { BaseNamePolicy } from './policies/BaseNamePolicy';
import { UniqueFilesPolicy } from './policies/UniqueFilesPolicy';
// Optional: comment in/out to enable service-backed policy
// import { ExternalServicePolicy } from './policies/ExternalServicePolicy';
import { WikilinkEquivalencePolicyType } from '../settings';

/**
 * Registry of all available wikilink equivalence policies
 * Maps policy type strings to their respective policy class instances
 */
interface PolicyRegistry {
    [key: string]: WikilinkEquivalencePolicy;
}

/**
 * Toggle policies simply by commenting import lines above and the entries below.
 * This keeps "configuration = set of files present/imported".
 */
export const POLICY_REGISTRY: PolicyRegistry = {
  "case-insensitive": new CaseInsensitivePolicy(),
  "case-sensitive":   new CaseSensitivePolicy(),
  "prefix-overlap":   new PrefixOverlapPolicy(),
  "same-file":        new SameFilePolicy(),
  "word-form":        new WordFormPolicy(),
  "base-name":        new BaseNamePolicy(),
  "unique-files":     new UniqueFilesPolicy(),
  // "external-service": new ExternalServicePolicy({ endpoint: "http://localhost:8787/snw/key", apiKey: "env:SNW_KEY" }),
};

/**
 * Get a policy instance by its type
 * @param policyType The policy type identifier
 * @returns The policy instance or the default policy if not found
 */
export function getPolicyByType(policyType: WikilinkEquivalencePolicyType): WikilinkEquivalencePolicy {
    return POLICY_REGISTRY[policyType] || POLICY_REGISTRY['case-insensitive'];
}

/**
 * Get all available policy types
 * @returns Array of policy type identifiers
 */
export function getAllPolicyTypes(): string[] {
    return Object.keys(POLICY_REGISTRY);
}

/**
 * Get all available policy names for display
 * @returns Array of policy names
 */
export function getAllPolicyNames(): string[] {
    return Object.values(POLICY_REGISTRY).map(policy => policy.name);
}

/**
 * Get all policy options formatted for dropdown display
 * @returns Array of objects with value and name properties
 */
export function getPolicyOptions(): { value: string, name: string }[] {
    return Object.entries(POLICY_REGISTRY).map(([type, policy]) => ({
        value: type,
        name: policy.name
    }));
} 