import test from "node:test";
import assert from "node:assert/strict";

import { normalizeConfig } from "./config-normalize.js";

test("normalizeConfig derives one effective module enablement snapshot", () => {
  const cfg = normalizeConfig({
    modules: {
      stabilizer: false,
      reduction: true,
      eviction: true,
    },
    eviction: {
      enabled: true,
    },
  });

  assert.deepEqual(cfg.moduleEnablement, {
    stabilizer: false,
    reduction: true,
    eviction: true,
  });
});

test("normalizeConfig requires both legacy eviction switches for compatibility", () => {
  const cases = [
    { modules: { eviction: false }, eviction: { enabled: false }, expected: false },
    { modules: { eviction: false }, eviction: { enabled: true }, expected: false },
    { modules: { eviction: true }, eviction: { enabled: false }, expected: false },
    { modules: { eviction: true }, eviction: { enabled: true }, expected: true },
  ];

  for (const item of cases) {
    const cfg = normalizeConfig({ modules: item.modules, eviction: item.eviction });
    assert.equal(cfg.moduleEnablement.eviction, item.expected);
  }
});
