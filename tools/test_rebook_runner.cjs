// Run with: node --test myKnowledge\tools\test_rebook_runner.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, 'rebook-runner.html'), 'utf8');
const script = html.match(/<script>\s*("use strict";[\s\S]*?)<\/script>/)[1];

function harness(type, { retry = false, status = 'SUCCESS', http = 200 } = {}) {
  const calls = [];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, disabled: false, dataset: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, setAttribute() {}, appendChild(child) { this.child = child; }, textContent: '', innerHTML: '',
    });
    return elements.get(id);
  }
  const context = vm.createContext({
    document: { getElementById: element, createElement: () => element(Symbol()) },
    localStorage: { getItem: () => null }, console, AbortController, DOMException,
    setTimeout: fn => setTimeout(fn, 0), clearTimeout,
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body);
      calls.push({ url, body, headers: opts.headers, method: opts.method });
      let data;
      let responseStatus = 200;
      if (url.endsWith('check-rebook-eligible')) data = {};
      else if (url.endsWith('retrieve-rebook-order')) {
        data = { tspId: 'NEW-TSP', itineraryType: type, air: { bounds: [1, 2, 3, 4].map(id => ({
          airBoundId: String(id), flights: [{ flightInfo: {
            departure: { dateTime: '2026-12-01T10:00:00', airportCode: 'AAA' },
            arrival: { airportCode: 'BBB' },
          } }],
        })) } };
      } else if (url.endsWith('air-bound')) {
        const it = body.body.itineraries;
        const current = it.find(i => i.isRequestedBound) || it[0];
        data = { flightList: retry && current.departureDate === '2026-12-01' ? [] : [{
          flightDetails: { flightSegments: [{ flightId: 'SEG', flightInfo: {
            departure: { airportCode: 'AAA', dateTime: current.departureDate + 'T10:00:00' },
            arrival: { airportCode: 'BBB' }, marketingAirlineCode: 'CX', marketingFlightNumber: current.boundId,
          } }] },
          flightOffers: ['ECONLIGHT', 'ECONFLEX'].map(brand => ({
            airBoundId: `OPAQUE-${current.boundId}-${brand}`, fareFamilyName: brand,
            fareInfos: [{ brandCode: brand, flightIds: ['SEG'] }],
          })),
        }] };
      } else if (url.endsWith('order-change-start')) {
        responseStatus = http; data = { type: 'CREATE_ORDER_CHANGE' };
      } else if (url.endsWith('order-change-polling')) {
        data = { status };
      } else data = { exchangePrices: { additionalCollection: { value: 0 }, refund: { value: 10 } } };
      return {
        status: responseStatus, headers: new Map([['x-trace-id', 'NEW-TRACE']]),
        text: async () => JSON.stringify({ data }),
      };
    },
  });
  vm.runInContext(script, context);
  return {
    calls, element,
    run: code => vm.runInContext(code, context),
    async load() {
      await this.run(`globalThis.p = {baseUrl:'https://test',rloc:'TEST',lastName:'tan',channel:'WEB',
        dateRetries:2,maxPolls:2,pollInterval:0.2,startWrapped:false};
        fetchOrder(p)`);
    },
    select(ids) {
      this.run(`state.changedBounds = ${JSON.stringify(ids.map(id => ({
        index: id - 1, boundId: String(id), date: '2026-12-01',
      })))};`);
    },
  };
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const type of ['RT', 'CI']) {
  for (const ids of [[1], [2], [1, 2]]) {
    test(`${type}: selection ${ids}, session, offers, start, polling and price`, async () => {
      const h = harness(type);
      await h.load();
      assert.equal(h.run('state.order.itineraryType'), type);
      h.select(ids);
      const result = await h.run('searchOffers(p)');
      assert.equal(result.combos.length, ids.length === 2 ? 4 : 2);
      assert.deepEqual(plain(result.changedOrder), ids.map(id => id - 1));
      const prefix = type === 'RT' ? 'rebook-' : 'rebook-complex-';
      const searches = h.calls.slice(2);
      assert.equal(searches.length, type === 'CI' && ids.length === 2 ? 3 : ids.length);
      searches.forEach(c => {
        assert.equal(c.url, 'https://test/' + prefix + 'air-bound');
        assert.deepEqual(c.body.body.itineraries.map(i => i.boundId), ids.map(String));
      });
      if (ids.length === 1 && type === 'RT') {
        assert.deepEqual(searches[0].body.body.itineraries, [{ departureDate: '2026-12-01', boundId: String(ids[0]) }]);
        assert.equal(searches[0].body.body.selectedBoundId, undefined);
      }
      if (ids.length === 2) {
        const b = searches[1].body.body;
        if (type === 'RT') {
          assert.equal(b.selectedBoundId, 'OPAQUE-1-ECONLIGHT');
          assert.equal(b.itineraries[0].selectedBoundId, undefined);
        } else {
          assert.equal(b.selectedBoundId, undefined);
          assert.equal(b.itineraries[0].selectedBoundId, 'AAA,BBB,2026-12-01,CX1,ECONLIGHT');
        }
      }
      const expected = ids.map(id => type === 'RT'
        ? `OPAQUE-${id}-ECONLIGHT` : `AAA,BBB,2026-12-01,CX${id},ECONLIGHT`);
      assert.deepEqual(plain(result.combos[0].map(o => o.airBoundId)), expected);
      h.run(`globalThis.options = ${JSON.stringify(result.combos[0])}; p.tspId = state.order.tspId`);
      assert.equal((await h.run('runCombination(p, options)')).result, 'success');
      const start = h.calls.at(-2);
      assert.equal(start.url, 'https://test/' + prefix + 'order-change-start');
      const payload = type === 'RT' ? start.body.body : start.body;
      assert.deepEqual(payload.airBoundIds, expected);
      assert.equal(payload.tspId, 'NEW-TSP');
      assert.equal(h.calls.at(-1).url, 'https://test/' + prefix + 'order-change-polling');
      assert.deepEqual(h.calls.at(-1).body, { body: { tspId: 'NEW-TSP', rloc: 'TEST', lastName: 'tan' } });
      const price = await h.run('queryChangePrice(p)');
      assert.equal(price.additionalCollection.value, 0);
      assert.equal(price.refund.value, 10);
      assert.equal(h.calls.at(-1).url, 'https://test/' + prefix + 'order-change' +
        (type === 'CI' ? '?flow=complexRebook' : ''));
      assert.deepEqual(h.calls.at(-1).body, { body: { lastName: 'tan', tspId: 'NEW-TSP', rloc: 'TEST' } });
      for (const c of h.calls.slice(1)) {
        assert.equal(c.headers['x-trace-id'], 'NEW-TRACE');
        assert.equal(c.method, 'POST');
      }
    });
  }
  test(`${type}: unchanged bounds make no offer requests`, async () => {
    const h = harness(type); await h.load(); h.select([]);
    await h.run('searchOffers(p)');
    assert.equal(h.calls.length, 2);
  });
  test(`${type}: noncontiguous selection and retried dates preserve context`, async () => {
    const h = harness(type, { retry: true }); await h.load(); h.select([2, 3]);
    await h.run('searchOffers(p)');
    const searches = h.calls.slice(2);
    assert.equal(searches.length, type === 'CI' ? 6 : 4);
    assert.equal(searches[2].body.body.itineraries[0].departureDate, '2026-12-02');
    const b = searches[2].body.body;
    assert.ok(type === 'RT' ? b.selectedBoundId : b.itineraries[0].selectedBoundId);
  });
  for (const [status, http, expected] of [['FAIL', 200, 'failed'], ['INIT', 200, 'timeout'], ['SUCCESS', 500, 'start_failed']]) {
    test(`${type}: ${status}/${http} -> ${expected}`, async () => {
      const h = harness(type, { status, http }); await h.load();
      assert.equal((await h.run("runCombination({...p,tspId:state.order.tspId},[{airBoundId:'ID'}])")).result, expected);
    });
  }
  test(`${type}: UI selects matching flow and start wrapping`, async () => {
    const h = harness(type); await h.load();
    h.run('renderOrder()');
    assert.match(h.element('orderTspId').textContent, new RegExp(type));
    assert.equal(h.element('optStartWrapped').disabled, type === 'RT');
    assert.match(h.element('offersFlowHint').textContent, new RegExp(type === 'RT' ? 'rebook-air-bound' : 'rebook-complex-air-bound'));
    h.run("p.startWrapped=true; p.tspId=state.order.tspId");
    await h.run("runCombination(p,[{airBoundId:'ID'}])");
    assert.equal(h.calls.at(-2).body.body.airBoundIds[0], 'ID');
  });
}
test('CI: four-bound Cartesian product retains all previous contexts', async () => {
  const h = harness('CI'); await h.load(); h.select([1, 2, 3, 4]);
  const result = await h.run('searchOffers(p)');
  assert.equal(result.combos.length, 16);
  assert.equal(h.calls.length, 17);
  const it = h.calls.at(-1).body.body.itineraries;
  assert.equal(it[3].isRequestedBound, true);
  for (let i = 0; i < 3; i++) {
    assert.equal(it[i].selectedBoundId, `AAA,BBB,2026-12-01,CX${i + 1},ECONFLEX`);
  }
});
test('RT opaque ID is preserved without CI fare metadata', () => {
  const h = harness('RT');
  const value = h.run("optionsFromResponse({data:{flightList:[{flightOffers:[{airBoundId:'opaque+/=='}]}]}},'RT')");
  assert.equal(value[0].airBoundId, 'opaque+/==');
  assert.equal(value[0].selectedBoundId, 'opaque+/==');
  assert.throws(() => h.run("optionsFromResponse({data:{flightList:[{flightOffers:[{}]}]}},'RT')"), /airBoundId/);
});
for (const type of [undefined, 'OW']) {
  test(`unsupported itinerary type ${type} fails explicitly`, async () => {
    const h = harness(type);
    await assert.rejects(() => h.load(), /itineraryType/);
    assert.equal(h.run('state.order'), null);
  });
}
for (const type of ['RT', 'CI']) {
  test(`${type}: combinations and results show escaped connecting flight information, not IDs`, async () => {
    const h = harness(type); await h.load();
    h.run(`globalThis.displayOptions=optionsFromResponse({data:{flightList:[{
      flightDetails:{flightSegments:[
        {flightId:'A',flightInfo:{marketingAirlineCode:'CX',marketingFlightNumber:'123',
          departure:{airportCode:'HKG',dateTime:'2026-12-01T10:00:00+08:00'},arrival:{airportCode:'SIN',dateTime:'2026-12-01T14:00:00+08:00'}}},
        {flightId:'B',flightInfo:{marketingAirlineCode:'CX',marketingFlightNumber:'<456>',
          departure:{airportCode:'SIN',dateTime:'2026-12-01T16:00:00+08:00'},arrival:{airportCode:'NRT',dateTime:'2026-12-02T00:00:00+09:00'}}}
      ]},
      flightOffers:[{airBoundId:'OPAQUE-DISPLAY-ID',fareFamilyName:'ECONLIGHT',cabinClass:'Y',
        fareInfos:[{brandCode:'ECONLIGHT',flightIds:['A','B']}]}]
    }]}},'${type}'); state.combinations=[displayOptions]; renderCombos();
    addResultRow(1,{result:'success',bounds:displayOptions,details:{},airBoundIds:displayOptions.map(o=>o.airBoundId)});`);
    const combo = h.element('combos').innerHTML;
    for (const text of ['CX123', 'CX&lt;456&gt;', 'HKG', 'SIN', 'NRT', '2026-12-01 10:00', '2026-12-02 00:00', 'Economy Light']) {
      assert.ok(combo.includes(text), text);
      assert.ok(h.element('resultsBody').child.innerHTML.includes(text), text);
    }
    assert.ok(!combo.includes('OPAQUE-DISPLAY-ID'));
    assert.ok(!combo.includes('HKG,SIN,'));
    assert.equal(h.run('displayOptions[0].airBoundId'), type === 'RT' ? 'OPAQUE-DISPLAY-ID' :
      'HKG,SIN,2026-12-01,CX123,ECONLIGHT|SIN,NRT,2026-12-01,CX<456>,ECONLIGHT');
  });
}
for (const ids of [
  ['SYD,HKG,2026-12-01,CX110,ECONLIGHT', 'HKG,MAN,2026-12-14,CX219,ECONLIGHT'],
  ['opaque+/<id>=='],
]) {
  test(`result combination cell displays actual start IDs: ${ids.length} bound(s)`, () => {
    const h = harness('CI');
    h.run(`addResultRow(1,{result:'success',details:{},bounds:[],
      airBoundIds:['NOT-THE-REQUEST'],startRequest:{airBoundIds:${JSON.stringify(ids)}}})`);
    const cell = h.element('resultsBody').child.innerHTML.split('<td>')[3].split('</td>')[0];
    const expected = JSON.stringify({ airBoundIds: ids }).slice(1, -1)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    assert.ok(cell.includes(expected), cell);
    assert.ok(!cell.includes('NOT-THE-REQUEST'));
    assert.ok(!cell.includes('<id>'));
    assert.equal(h.calls.length, 0);
  });
}
test('combination selection defaults to all and searches readable flight fields', () => {
  const h = harness('RT');
  h.run(`state.combinations=[
    [{airBoundId:'ONE',fareFamilyName:'ECONLIGHT',flights:[{flightNumber:'CX110',depCode:'SYD',arrCode:'HKG',depTime:'2026-12-01T08:45'}]}],
    [{airBoundId:'TWO',fareFamilyName:'BIZFLEX',flights:[{flightNumber:'CX219',depCode:'HKG',arrCode:'MAN'}]}]
  ];`);
  assert.equal(h.run('selectedCombos().length'), 2);
  h.element('comboSearch').value = 'Economy Light CX110';
  assert.equal(h.run('selectedCombos().length'), 1);
  h.element('comboSearch').value = 'Economy   Light CX110 · SYD → HKG · 2026-12-01 08:45 → —';
  assert.equal(h.run('selectedCombos().length'), 1);
  h.element('comboSearch').value = 'CX110 Light';
  assert.equal(h.run('selectedCombos().length'), 0);
  h.element('comboSearch').value = 'Economy Light CX110';
  h.run('state.excludedCombos.add(0)');
  assert.equal(h.run('selectedCombos().length'), 0);
  h.element('comboSearch').value = '';
  assert.deepEqual(plain(h.run('selectedCombos().map(c=>c.index)')), [1]);
  h.element('comboSearch').value = 'no match';
  assert.equal(h.run('selectedCombos().length'), 0);
});
test('runner excludes hidden and unchecked combinations and honors limit', async () => {
  const h = harness('RT'); await h.load();
  h.run(`state.combinations=['HIDDEN','MATCH-1','MATCH-2','MATCH-3'].map(id=>[{airBoundId:id,flights:[{flightNumber:id}]}]);
    state.excludedCombos.add(1); globalThis.executed=[];
    runCombination=async(p,opts)=>{executed.push(opts[0].airBoundId); return {result:'failed',details:{}}};
    readParams=()=>({...p,execute:true,limit:1}); addResultRow=()=>{}; filterResults=()=>{};`);
  h.element('comboSearch').value = 'match';
  await h.run('onRun()');
  assert.deepEqual(plain(h.run('executed')), ['MATCH-2']);
  h.element('comboSearch').value = 'missing';
  await h.run('onRun()');
  assert.deepEqual(plain(h.run('executed')), ['MATCH-2']);
});
test('bulk selection affects visible results only, dry run matches selection and running locks edits', () => {
  const h = harness('RT');
  h.run("state.combinations=['ONE','TWO'].map(id=>[{airBoundId:id,flights:[{flightNumber:id}]}]);");
  h.element('comboSearch').value = 'one';
  h.run('selectVisibleCombos(false)');
  h.element('comboSearch').value = '';
  assert.deepEqual(plain(h.run('selectedCombos().map(c=>c.index)')), [1]);
  h.run("globalThis.lines=[]; logLine=t=>lines.push(t); dryRun()");
  assert.ok(h.run("lines.some(t=>t.includes('TWO'))"));
  assert.ok(!h.run("lines.some(t=>t.includes('ONE'))"));
  h.element('comboSearch').value = 'one';
  h.run('selectVisibleCombos(true)');
  h.element('comboSearch').value = '';
  assert.equal(h.run('selectedCombos().length'), 2);
  h.run('state.running=true; selectVisibleCombos(false); refreshRunButtons()');
  assert.equal(h.run('selectedCombos().length'), 2);
  assert.equal(h.element('comboSearch').disabled, true);
});
test('execution locks itinerary controls and restores them', async () => {
  const h = harness('RT'); await h.load();
  h.run("state.combinations=[[{airBoundId:'ID'}]]; globalThis.locked=false; runCombination=async()=>{locked=$('nchg-0').disabled && $('date-0').disabled; updatePlan(); if(state.combinations.length!==1) throw Error('Plan cleared while running'); return {result:'failed',details:{}}}; readParams=()=>({...p,execute:true}); addResultRow=()=>{}; filterResults=()=>{}");
  await h.run('onRun()');
  assert.equal(h.run('locked'), true);
  assert.equal(h.element('nchg-0').disabled, false);
});
test('CI paths use their own upstream selections and retain partial paths at request cap', async () => {
  const h = harness('CI'); await h.load(); h.select([1, 2]);
  const result = await h.run('searchOffers({...p,quoteLimit:100})');
  assert.equal(result.combos.length, 4);
  const secondCalls = h.calls.slice(3);
  assert.equal(secondCalls[0].body.body.itineraries[0].selectedBoundId, 'AAA,BBB,2026-12-01,CX1,ECONLIGHT');
  assert.equal(secondCalls[1].body.body.itineraries[0].selectedBoundId, 'AAA,BBB,2026-12-01,CX1,ECONFLEX');
  assert.equal(result.combos[2][0].fareFamilyName, 'ECONFLEX');
  const capped = harness('CI'); await capped.load(); capped.select([1, 2]);
  await assert.rejects(() => capped.run('searchOffers({...p,quoteLimit:2})'), /上限/);
  assert.equal(capped.run('state.combinations.length'), 2);
  assert.equal(capped.run('state.discoveryComplete'), false);
});
for (const mode of ['empty', 'error', 'abort']) {
  test(`CI ${mode} path handling preserves completed paths and execution safety`, async () => {
    const h = harness('CI'); await h.load(); h.select([1, 2]);
    h.run(`globalThis.originalFetch=fetch; globalThis.aborter=new AbortController();
      fetch=async(url,opts)=>{
        const b=JSON.parse(opts.body).body;
        if(b.itineraries && b.itineraries[0].selectedBoundId?.endsWith('ECONFLEX')){
          if('${mode}'==='abort'){aborter.abort();throw new DOMException('aborted','AbortError')}
          return {status:'${mode}'==='error'?500:200,headers:new Map(),text:async()=>JSON.stringify('${mode}'==='error'?{errors:[{code:'FAIL'}]}:{data:{flightList:[]}})};
        }
        return originalFetch(url,opts);
      };`);
    if (mode === 'empty') {
      const r = await h.run('searchOffers(p,aborter.signal)');
      assert.equal(r.combos.length, 2);
      assert.equal(h.run('state.discoveryComplete'), true);
    } else {
      await assert.rejects(() => h.run('searchOffers(p,aborter.signal)'));
      assert.equal(h.run('state.combinations.length'), 2);
      assert.equal(h.run('state.discoveryComplete'), false);
      h.element('optExecute').checked = true;
      h.run('refreshRunButtons()');
      assert.equal(h.element('btnRun').disabled, true);
      const count = h.calls.length;
      await h.run('onRun()');
      assert.equal(h.calls.length, count);
    }
  });
}
