import { describe, expect, test } from "bun:test";
import { buildOsFactMap, createOsContext, parseOsRelease, type OsApi } from "../src/facts";

const linuxOs: OsApi = {
    platform: () => "linux",
    type: () => "Linux",
    release: () => "6.1.0",
    version: () => "#1 SMP",
    arch: () => "x64",
    machine: () => "x86_64",
    hostname: () => "forge",
    tmpdir: () => "/tmp",
    totalmem: () => 1024,
    freemem: () => 512,
};

describe("parseOsRelease", () => {
    test("parses quoted and unquoted Linux OS release fields", () => {
        expect(parseOsRelease(`
ID=ubuntu
VERSION_ID="24.04"
PRETTY_NAME="Ubuntu 24.04 LTS"
ID_LIKE="debian ubuntu"
`)).toEqual({
            id: "ubuntu",
            versionId: "24.04",
            prettyName: "Ubuntu 24.04 LTS",
            idLike: ["debian", "ubuntu"],
        });
    });

    test("ignores malformed lines and omits unavailable fields", () => {
        expect(parseOsRelease(`
# comment
MALFORMED
ID=
PRETTY_NAME=Alpine Linux
ID_LIKE=
`)).toEqual({
            id: undefined,
            versionId: undefined,
            prettyName: "Alpine Linux",
            idLike: undefined,
        });
    });
});

describe("buildOsFactMap", () => {
    test("builds flat OS and distro facts", async () => {
        const facts = await buildOsFactMap({
            os: linuxOs,
            readFile: async () => `ID=fedora\nVERSION_ID=40\nPRETTY_NAME="Fedora Linux 40"\nID_LIKE="rhel fedora"\n`,
        });

        expect(facts).toMatchObject({
            "os.platform": "linux",
            "os.type": "Linux",
            "os.release": "6.1.0",
            "os.version": "#1 SMP",
            "os.arch": "x64",
            "os.machine": "x86_64",
            "os.hostname": "forge",
            "os.tmpdir": "/tmp",
            "os.memory.total": 1024,
            "os.memory.free": 512,
            "os.distro.id": "fedora",
            "os.distro.versionId": "40",
            "os.distro.prettyName": "Fedora Linux 40",
            "os.distro.idLike": ["rhel", "fedora"],
        });
    });

    test("omits unavailable fields and keeps other probes", async () => {
        const os: OsApi = {
            ...linuxOs,
            hostname: () => "",
            machine: () => {
                throw new Error("missing machine");
            },
        };
        const facts = await buildOsFactMap({
            os,
            readFile: async () => {
                throw new Error("missing os-release");
            },
        });

        expect(facts["os.platform"]).toBe("linux");
        expect("os.hostname" in facts).toBe(false);
        expect("os.machine" in facts).toBe(false);
        expect("os.distro.id" in facts).toBe(false);
        expect(Object.values(facts)).not.toContain("unknown");
        expect(Object.values(facts)).not.toContain(null);
    });

    test("context resolvers reuse one snapshot", async () => {
        let reads = 0;
        const context = createOsContext({
            os: linuxOs,
            readFile: async () => {
                reads += 1;
                return "ID=ubuntu\n";
            },
        });

        const platformResolver = context["os.platform"];
        const distroResolver = context["os.distro.id"];
        if (typeof platformResolver !== "function") throw new Error("Expected os.platform resolver");
        if (typeof distroResolver !== "function") throw new Error("Expected os.distro.id resolver");

        expect(await platformResolver({ rootDir: ".", pluginId: "os", facts: {} })).toBe("linux");
        expect(await distroResolver({ rootDir: ".", pluginId: "os", facts: {} })).toBe("ubuntu");
        expect(reads).toBe(1);
    });
});
