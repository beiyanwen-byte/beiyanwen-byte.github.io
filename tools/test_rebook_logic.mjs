// 提取 rebook-runner.html 中的 searchOffers 核心逻辑进行测试
const state = {
  order: {
    tspId: "TSP-TEST", traceId: "TRACE-TEST",
    bounds: [
      { index: 0, boundId: "1", departureDate: "2026-12-06" },
      { index: 1, boundId: "2", departureDate: "2026-12-14" },
    ],
  },
  changedBounds: [],
};

function cartesian(lists) { return lists.reduce((acc, l) => acc.flatMap(a => l.map(b => a.concat([b]))), [[]]); }

// 核心逻辑（与页面中 searchOffers 一致）
function buildItineraries(changed, selected, cb) {
  const idx = cb.index;
  const onlyChanged = changed.map(c => ({ departureDate: c.date, boundId: c.boundId }));
  const itineraries = onlyChanged.map(b => ({ departureDate: b.date, boundId: b.boundId }));
  for (const [previousIndex, selectedId] of selected) {
    const pos = itineraries.findIndex(x => x.boundId === changed[previousIndex].boundId);
    if (pos >= 0) itineraries[pos].selectedBoundId = selectedId;
  }
  const curPos = itineraries.findIndex(x => x.boundId === cb.boundId);
  itineraries[curPos].departureDate = cb.date;
  itineraries[curPos].isRequestedBound = true;
  return itineraries;
}

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); process.exitCode = 1; }
}

// ============ Test 1: 只改 Bound 1，Bound 2 勾选「不更改」============
console.log("\n=== Test 1: 只改 Bound 1 ===");
state.changedBounds = [{ index: 0, boundId: "1", original: "2026-12-06", date: "2026-12-06" }];
const cb1 = state.changedBounds[0];
const itin1 = buildItineraries(state.changedBounds, [], cb1);
assert(itin1.length === 1, "itineraries 长度应为 1");
assert(itin1[0].boundId === "1", "boundId 应该是 '1'");
assert(itin1[0].isRequestedBound === true, "Bound1 应该有 isRequestedBound=true");
assert(!itin1.some(i => i.boundId === "2"), "不应该包含 boundId=2");
console.log("  Request:", JSON.stringify(itin1));

// ============ Test 2: 只改 Bound 2，Bound 1 勾选「不更改」============
console.log("\n=== Test 2: 只改 Bound 2 ===");
state.changedBounds = [{ index: 1, boundId: "2", original: "2026-12-14", date: "2026-12-14" }];
const cb2 = state.changedBounds[0];
const itin2 = buildItineraries(state.changedBounds, [], cb2);
assert(itin2.length === 1, "itineraries 长度应为 1");
assert(itin2[0].boundId === "2", "boundId 应该是 '2'");
assert(itin2[0].isRequestedBound === true, "Bound2 应该有 isRequestedBound=true");
assert(!itin2.some(i => i.boundId === "1"), "不应该包含 boundId=1");
console.log("  Request:", JSON.stringify(itin2));

// ============ Test 3: 两班都改，验证链式 selectedBoundId ============
console.log("\n=== Test 3: 两班都改 ===");
state.changedBounds = [
  { index: 0, boundId: "1", original: "2026-12-06", date: "2026-12-06" },
  { index: 1, boundId: "2", original: "2026-12-14", date: "2026-12-14" },
];

// 第一次查询：Bound 1
const cb3a = state.changedBounds[0];
const itin3a = buildItineraries(state.changedBounds, [], cb3a);
assert(itin3a.length === 2, "第一次请求应该包含 2 个改动的 bound");
assert(itin3a[0].boundId === "1" && itin3a[0].isRequestedBound === true, "第一个 bound 应该有 isRequestedBound=true");
assert(itin3a[1].boundId === "2" && !itin3a[1].isRequestedBound, "第二个 bound 不应该有 isRequestedBound");
console.log("  First request:", JSON.stringify(itin3a));

// 模拟第一次查询返回的 selectedBoundId
const mockSelectedBoundId = "SYD,HKG,2026-12-06,CX100,ECONLIGHT";

// 第二次查询：Bound 2，Bound 1 应该带 selectedBoundId
const selected = [[0, mockSelectedBoundId]];
const cb3b = state.changedBounds[1];
const itin3b = buildItineraries(state.changedBounds, selected, cb3b);
assert(itin3b.length === 2, "第二次请求应该包含 2 个改动的 bound");
assert(itin3b[0].boundId === "1" && itin3b[0].selectedBoundId === mockSelectedBoundId, "第一个 bound 应该带 selectedBoundId");
assert(itin3b[1].boundId === "2" && itin3b[1].isRequestedBound === true, "第二个 bound 应该有 isRequestedBound=true");
assert(!itin3b.some(i => i.boundId === "99"), "不应该包含不存在的 bound");
console.log("  Second request:", JSON.stringify(itin3b));

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
