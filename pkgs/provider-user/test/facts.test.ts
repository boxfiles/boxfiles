import { describe, expect, test } from "bun:test";
import { buildUserFactMap, createUserContext, type UserApi } from "../src/facts";

const posixUserApi: UserApi = {
    userInfo: () => ({
        username: "kin",
        uid: 1000,
        gid: 1000,
        homedir: "/home/kin",
        shell: "/bin/bash",
    }),
};

describe("buildUserFactMap", () => {
    test("builds POSIX user facts", () => {
        expect(buildUserFactMap({ os: posixUserApi })).toEqual({
            "user.username": "kin",
            "user.uid": 1000,
            "user.gid": 1000,
            "user.homedir": "/home/kin",
            "user.shell": "/bin/bash",
        });
    });

    test("omits unavailable and invalid user facts", () => {
        const os: UserApi = {
            userInfo: () => ({
                username: "",
                uid: -1,
                gid: Number.NaN,
                homedir: "",
                shell: null,
            }),
        };

        expect(buildUserFactMap({ os })).toEqual({});
    });

    test("omits all facts when userInfo fails", () => {
        const os: UserApi = {
            userInfo: () => {
                throw new Error("missing user info");
            },
        };

        expect(buildUserFactMap({ os })).toEqual({});
    });

    test("context resolvers reuse one snapshot", () => {
        let reads = 0;
        const context = createUserContext({
            os: {
                userInfo: () => {
                    reads += 1;
                    return posixUserApi.userInfo();
                },
            },
        });

        const usernameResolver = context["user.username"];
        const uidResolver = context["user.uid"];
        if (typeof usernameResolver !== "function") throw new Error("Expected user.username resolver");
        if (typeof uidResolver !== "function") throw new Error("Expected user.uid resolver");

        expect(usernameResolver({ rootDir: ".", pluginId: "user", facts: {} })).toBe("kin");
        expect(uidResolver({ rootDir: ".", pluginId: "user", facts: {} })).toBe(1000);
        expect(reads).toBe(1);
    });
});
