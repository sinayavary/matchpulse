import test from "node:test";
import assert from "node:assert/strict";
import { scopeForRoute } from "./free-access-contract.js";
test("external scope mapping is centralized and default deny", () => { assert.equal(scopeForRoute("GET", "/api/matches"), "matches:read"); assert.equal(scopeForRoute("POST", "/api/matches"), undefined); assert.equal(scopeForRoute("GET", "/api/internal/foo"), undefined); assert.equal(scopeForRoute("GET", "/api/unknown"), undefined); });
