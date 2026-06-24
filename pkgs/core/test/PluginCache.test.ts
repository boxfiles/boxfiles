import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  getPluginCacheEntry,
  parsePluginSource,
  resolvePluginCacheRoot,
  type PluginCacheEntry,
} from "../../plugin/src/index";

describe("resolvePluginCacheRoot", () => {
  test("uses nonblank XDG_CACHE_HOME override", () => {
    expect(resolvePluginCacheRoot({ env: { XDG_CACHE_HOME: "/tmp/xdg-cache" }, homedir: "/home/alice" }))
      .toBe(join("/tmp/xdg-cache", "boxfiles", "plugins"));
  });

  test("falls back to homedir .cache when XDG_CACHE_HOME is blank", () => {
    expect(resolvePluginCacheRoot({ env: { XDG_CACHE_HOME: "  " }, homedir: "/home/alice" }))
      .toBe(join("/home/alice", ".cache", "boxfiles", "plugins"));
  });
});

describe("getPluginCacheEntry", () => {
  test("derives deterministic npm cache paths", () => {
    const source = parsePluginSource("npm:@boxfiles/provider-copy@1.2.3");
    const first = expectCacheEntry(getPluginCacheEntry(source, testCacheOptions));
    const second = expectCacheEntry(getPluginCacheEntry(source, testCacheOptions));

    expect(first).toEqual(second);
    expect(first.transport).toBe("npm");
    expect(first.directoryName).toMatch(/^@boxfiles__provider-copy__[a-f0-9]{16}$/u);
    expect(first.path).toBe(join(cacheRoot, "npm", first.directoryName));
  });

  test("derives deterministic git cache paths", () => {
    const source = parsePluginSource("git:https://example.com/boxfiles/workstation.git#main");
    const first = expectCacheEntry(getPluginCacheEntry(source, testCacheOptions));
    const second = expectCacheEntry(getPluginCacheEntry(source, testCacheOptions));

    expect(first).toEqual(second);
    expect(first.transport).toBe("git");
    expect(first.directoryName).toMatch(/^workstation__[a-f0-9]{16}$/u);
    expect(first.path).toBe(join(cacheRoot, "git", first.directoryName));
  });

  test("does not create cache entries for file sources", () => {
    expect(getPluginCacheEntry(parsePluginSource("file:./plugins/local"), testCacheOptions)).toBeNull();
  });

  test("does not leak unsafe path separators into entry directory names", () => {
    const npmEntry = expectCacheEntry(
      getPluginCacheEntry(parsePluginSource("npm:@boxfiles/provider-copy@^1.0.0"), testCacheOptions),
    );
    const gitEntry = expectCacheEntry(
      getPluginCacheEntry(parsePluginSource("git:git@github.com:boxfiles/provider-copy.git#feature/name"), testCacheOptions),
    );

    expect(npmEntry.directoryName).not.toContain("/");
    expect(npmEntry.directoryName).not.toContain("\\");
    expect(gitEntry.directoryName).not.toContain("/");
    expect(gitEntry.directoryName).not.toContain("\\");
  });
});

const testCacheOptions = { env: { XDG_CACHE_HOME: "/tmp/boxfiles-cache" }, homedir: "/home/alice" } as const;
const cacheRoot = join("/tmp/boxfiles-cache", "boxfiles", "plugins");

function expectCacheEntry(entry: PluginCacheEntry | null): PluginCacheEntry {
  if (entry === null) throw new Error("Expected plugin cache entry");
  return entry;
}
