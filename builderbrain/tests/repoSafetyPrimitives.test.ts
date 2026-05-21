import { describe, expect, it } from 'vitest';
import { parseGithubRepoUrl, buildRepoId } from '../src/repos/url.js';
import { resolveSafeLibraryMarkdownPath } from '../src/security/safePath.js';
import { join } from 'path';

describe('repo/url and safe path primitives', () => {
  it('validates github https urls and generates stable repo id', () => {
    const parsed = parseGithubRepoUrl('https://github.com/modelcontextprotocol/typescript-sdk.git');
    expect(parsed?.owner).toBe('modelcontextprotocol');
    expect(parsed?.repo).toBe('typescript-sdk');
    expect(parsed?.repoId).toBe('modelcontextprotocol__typescript-sdk');
    expect(buildRepoId('a', 'b')).toBe('a__b');
  });

  it('rejects malformed or unsafe repo urls', () => {
    expect(parseGithubRepoUrl('http://evil.com/owner/repo')).toBeNull();
    expect(parseGithubRepoUrl('https://github.com/owner')).toBeNull();
    expect(parseGithubRepoUrl('git@github.com:owner/repo.git')).toBeNull();
    expect(parseGithubRepoUrl('file:///etc/passwd')).toBeNull();
  });

  it('allows safe library markdown paths and blocks traversal/absolute', () => {
    const root = join('/tmp', 'bb-lib-root');
    expect(resolveSafeLibraryMarkdownPath(root, 'mini-book/testing.md')).toContain('/mini-book/testing.md');
    expect(resolveSafeLibraryMarkdownPath(root, '../config.json')).toBeNull();
    expect(resolveSafeLibraryMarkdownPath(root, '/etc/passwd')).toBeNull();
    expect(resolveSafeLibraryMarkdownPath(root, 'mini-book/%2e%2e%2fsecurity.md')).toBeNull();
  });
});
