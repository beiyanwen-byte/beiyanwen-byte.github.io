import pathlib

SRC = pathlib.Path('/mnt/c/Users/Tanpeter/OneDrive - Accenture (China)/myComputer/backup2025/linuxwork/ai/myKnowledge/tools/rebook-runner.html')
html = SRC.read_text(encoding='utf-8')

MOCK = r'''
<script>
window.__calls = [];
window.fetch = async (input, opts) => {
  const url = String(input);
  const name = url.split('/').pop().split('?')[0];
  let body = null; try { body = JSON.parse(opts.body); } catch(e) {}
  window.__calls.push({ name, body });
  const json = (o, status=200, hdrs={}) => new Response(JSON.stringify(o), { status, headers: Object.assign({'content-type':'application/json','x-trace-id':'TRACE-TEST'}, hdrs) });
  if (name === 'check-rebook-eligible') return json({ data: { rebookCapability: { canAtcRebook: true } } });
  if (name === 'retrieve-rebook-order') return json({ data: { tspId: 'TSP-TEST', air: { bounds: [
      { airBoundId: '1', flights: [{ flightInfo: { marketingAirlineCode: 'CX', marketingFlightNumber: '110', departure: { airportCode: 'SYD', dateTime: '2026-12-06T08:45:00+11:00' }, arrival: { airportCode: 'HKG', dateTime: '2026-12-06T15:00:00+08:00' } } }] },
      { airBoundId: '2', flights: [{ flightInfo: { marketingAirlineCode: 'CX', marketingFlightNumber: '219', departure: { airportCode: 'HKG', dateTime: '2026-12-14T01:05:00+08:00' }, arrival: { airportCode: 'MAN', dateTime: '2026-12-14T07:55:00Z' } } }] }
    ] } } });
  if (name === 'rebook-complex-air-bound') {
    const it = (body.body && body.body.itineraries) || [];
    const req = it.find(x => x.isRequestedBound);
    const bid = req ? req.boundId : '1';
    const dep = req ? req.departureDate : '2026-12-06';
    return json({ data: { flightList: [{ flightDetails: { flightSegments: [{ flightId: 'SEG-'+bid, flightInfo: { marketingAirlineCode: 'CX', marketingFlightNumber: '9'+bid, departure: { airportCode: 'AAA', dateTime: dep+'T10:00:00' }, arrival: { airportCode: 'BBB' } } }] }, flightOffers: [{ fareFamilyName: 'ECONLIGHT', cabinClass: 'Y', totalPrice: { value: 100, currencyCode: 'HKD' }, fareInfos: [{ fareClass: 'YQ21HKAR', flightIds: ['SEG-'+bid] }] }] }] } });
  }
  if (name === 'rebook-complex-order-change-start') return json({ data: { type: 'COMPLEX_CREATE_ORDER_CHANGE' } }, 201);
  if (name === 'rebook-complex-order-change-polling') return json({ data: { status: 'SUCCESS' } });
  if (name === 'rebook-complex-order-change') return json({ data: { airOffer: { prices: { exchangePrices: { additionalCollection: { value: 0, currencyCode: 'HKD' }, refund: { value: 0 } } } } } });
  return json({});
};
</script>
'''

TEST = r'''
<script>
const waitFor = async (pred, ms=3000) => { const t0=Date.now(); while(Date.now()-t0<ms){ if(pred()) return true; await new Promise(r=>setTimeout(r,10)); } return false; };
(async () => {
  const res = [];
  try {
    document.getElementById('rloc').value = 'EK5JQO';
    document.getElementById('lastName').value = 'test';
    document.getElementById('btnOrder').click();
    if (!await waitFor(()=>state.order!==null)) throw new Error('order not loaded');
    SCENARIO
    document.getElementById('btnOffers').click();
    if (!await waitFor(()=>state.combinations.length>0 || !document.getElementById('btnOffers').disabled)) throw new Error('offers not done');
    const ab = window.__calls.filter(c=>c.name==='rebook-complex-air-bound');
    res.push('air-bound request count: ' + ab.length);
    ab.forEach((c,i)=>res.push('  req#'+(i+1)+' itineraries: '+JSON.stringify(c.body.body.itineraries)));
    const pre=document.createElement('pre'); pre.id='out'; pre.textContent='RESULT\n'+res.join('\n'); document.body.appendChild(pre);
    document.title = 'DONE';
  } catch(e) {
    const pre=document.createElement('pre'); pre.id='out'; pre.textContent='ERROR: '+e.message; document.body.appendChild(pre);
    document.title = 'DONE';
  }
})();
</script>'''

def setchk(i, val):
    return "document.getElementById('nchg-%d').checked = %s; document.getElementById('nchg-%d').dispatchEvent(new Event('change'));" % (i, 'true' if val else 'false', i)

SCENARIOS = {
    'bound1only': setchk(0, False) + " " + setchk(1, True),
    'bound2only': setchk(0, True) + " " + setchk(1, False),
    'both': setchk(0, False) + " " + setchk(1, False),
}

anchor = '<script>\n"use strict";'
assert anchor in html, "anchor not found"
for name, actions in SCENARIOS.items():
    t = html.replace(anchor, MOCK + '\n' + anchor, 1)
    t = t.replace('</body>', TEST.replace('SCENARIO', actions) + '\n</body>', 1)
    out = pathlib.Path('/tmp/opencode/itest_%s.html' % name)
    out.write_text(t, encoding='utf-8')
    print('wrote', out)
