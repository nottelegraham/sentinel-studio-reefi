/* Sentinel Studio for ReeFi: Home Assistant card. Pairs with the "reefi" integration. */
const CARD_VERSION = '0.1.0';
const CH = [
  { label: '395 nm', color: '#aa83cb' }, { label: '420 nm', color: '#785cb4' },
  { label: 'Violet', color: '#8e00ff' }, { label: 'R Blue', color: '#3502ff' },
  { label: 'Blue', color: '#0087ff' },   { label: 'Lime', color: '#b5d62e' },
  { label: 'Amber', color: '#ff8c28' },  { label: 'Warm', color: '#ffc78a' },
  { label: 'Cool', color: '#e4eefc' }];
const UI_ORDER = [8, 7, 6, 5, 4, 3, 2, 1, 0];
const WPC = [36, 36, 36, 64.8, 57.6, 7.2, 9.36, 9.36, 9.36].map(w => w / 1023); // light's own Uno2 table
const QUICK_NAMES = ['Maintenance', 'Photo_SPS', 'Photo_LPS', 'NightView'];
const FAN = { 2: 'Warmer' };
const REEFS = [['keys', 'Florida Keys, USA', 24.63], ['redsea', 'Red Sea, Ras Mohammed, Egypt', 27.73], ['bonaire', 'Bonaire, Caribbean', 12.15],
  ['gbr', 'Great Barrier Reef, Cairns, Australia', -16.92], ['raja', 'Raja Ampat, Indonesia', -0.5]];
function reefTable(key, dates) { // day length vs longest day; noon sun angle (sine) vs highest
  if (key === 'ghl') return GHL_TABLE.map(r => r.slice());
  const lat = REEFS.find(r => r[0] === key)[2] * Math.PI / 180, h0 = -0.833 * Math.PI / 180;
  const dec = n => -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365) * Math.PI / 180;
  const len = n => { const d = dec(n); return Math.acos(Math.max(-1, Math.min(1, (Math.sin(h0) - Math.sin(lat) * Math.sin(d)) / (Math.cos(lat) * Math.cos(d))))); };
  const sun = n => Math.cos(lat - dec(n));
  let mL = 0, mB = 0; for (let n = 0; n < 365; n++) { mL = Math.max(mL, len(n)); mB = Math.max(mB, sun(n)); }
  return dates.map(md => { const n = doy(md); return [md, Math.round(sun(n) / mB * 100), Math.round(len(n) / mL * 100)]; });
}

function ensureFonts() {
  if (document.getElementById('reefi-fonts')) return;
  const l = document.createElement('link');
  l.id = 'reefi-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
  document.head.appendChild(l);
}

const STYLE = `
:host{
  --panel:var(--card-background-color,#111922); --panel-2:var(--secondary-background-color,#17212c);
  --line:var(--divider-color,#233140); --line-2:var(--divider-color,#2e3f52);
  --fg:var(--primary-text-color,#dde6ee); --muted:var(--secondary-text-color,#8193a6); --faint:var(--disabled-text-color,#55677a);
  --sun:var(--reefi-accent,#e9a83a); --sun-ink:#1b1305; --sun-soft:rgba(233,168,58,.16);
  --ok:var(--success-color,#4cc38a); --warn:var(--warning-color,#e8a33d); --info:var(--info-color,#6aa7e8); --bad:var(--error-color,#ef6b5e);
  --grid:rgba(127,140,155,.16); --chart-bg:var(--secondary-background-color,#0d141c);
  --display:"Barlow Semi Condensed","Arial Narrow",var(--ha-font-family-body,Roboto),sans-serif;
  --body:var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif));
  --mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;
  display:block}
*{box-sizing:border-box} [hidden]{display:none!important}
ha-card{overflow:visible}
.wrap{padding:16px;display:flex;flex-direction:column;gap:14px;font:14px/1.5 var(--body);color:var(--fg)}
.box{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;min-width:0}
h2{font:600 13px/1.2 var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0}
h3{font:600 12px var(--body);color:var(--muted);margin:0 0 8px;letter-spacing:.04em;text-transform:uppercase}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
button,input,select{font:inherit;color:inherit}
button{cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.5}
:focus-visible{outline:2px solid var(--sun);outline-offset:2px}
.muted{color:var(--muted)}
a{color:var(--sun)}
.top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.brand{font:700 24px/1 var(--display)}
.brand b{color:var(--sun)}
.dev{color:var(--muted);font-size:13px}
.spacer{flex:1}
.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;border:1px solid var(--line-2);font-size:12px;white-space:nowrap}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--ok)}
.pill.ovr i{background:var(--sun)} .pill.bad i{background:var(--bad)} .pill.warn i{background:var(--warn)}
.clock{font:600 20px/1 var(--display);font-variant-numeric:tabular-nums}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);overflow-x:auto}
.tab{background:transparent;border:0;border-bottom:2px solid transparent;padding:8px 14px 9px;font:600 14px var(--body);color:var(--muted);display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.tab:hover{color:var(--fg)}
.tab[aria-selected="true"]{color:var(--fg);border-bottom-color:var(--sun)}
.badge{font:600 11px/1 var(--mono);padding:3px 6px;border-radius:99px;background:var(--warn);color:var(--sun-ink)}
.panel{display:flex;flex-direction:column;gap:14px}
.now{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px}
.big{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end}
.big .v{font:600 42px/1 var(--display);font-variant-numeric:tabular-nums}
.big .u{font:500 18px var(--display);color:var(--muted);margin-left:2px}
.big .l{font-size:12px;color:var(--muted);margin-top:4px}
.mode{font:600 18px/1.2 var(--display);margin-bottom:8px}
.mode span{color:var(--muted);font-weight:500}
.strip{display:flex;gap:3px;height:34px;align-items:flex-end;margin-top:12px}
.strip div{flex:1;border-radius:2px 2px 0 0;min-height:2px}
.moonrow{margin-top:10px;font-size:13px;color:var(--muted)}
.qgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
.qbtn{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid var(--line-2);background:var(--panel-2);text-align:left;min-width:0}
.qbtn:hover{border-color:var(--sun)}
.qbtn.on{border-color:var(--sun);background:var(--sun-soft)}
.qbtn b{display:block;font-weight:600;font-size:13px}
.qbtn small{color:var(--muted);font-size:11.5px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ms{display:flex;gap:1.5px;height:18px;width:30px;align-items:flex-end;flex:none}
.ms i{flex:1;min-height:1px;border-radius:1px}
.dur{display:flex;gap:6px;align-items:center;margin-top:10px;font-size:12.5px;color:var(--muted);flex-wrap:wrap}
.chip{padding:3px 10px;border-radius:99px;border:1px solid var(--line-2);background:transparent;font-size:12.5px}
.chip.on{background:var(--sun);color:var(--sun-ink);border-color:var(--sun)}
.ovrbar{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 10px;border-radius:8px;background:var(--sun-soft);font-size:13px;flex-wrap:wrap}
.btn{border:1px solid var(--line-2);background:var(--panel-2);border-radius:6px;padding:5px 12px;font-size:13px}
.btn.pri{background:var(--sun);border-color:var(--sun);color:var(--sun-ink);font-weight:600}
.btn.danger{border-color:var(--bad);color:var(--bad)}
.ovrbar .btn{margin-left:auto}
.tlhead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.legend{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
.lg{display:inline-flex;align-items:center;gap:5px;padding:2px 8px 2px 6px;border-radius:99px;border:1px solid var(--line);background:transparent;font-size:11.5px}
.lg i{width:9px;height:9px;border-radius:2px;border:1px solid var(--line-2)}
.lg.off{opacity:.4;text-decoration:line-through}
.chartwrap{position:relative;background:var(--chart-bg);border:1px solid var(--line);border-radius:8px;overflow:hidden}
svg.chart{display:block;width:100%;touch-action:none;user-select:none;-webkit-user-select:none}
.scrub{display:flex;gap:14px;align-items:center;min-height:28px;margin-top:8px;font-size:13px;color:var(--muted);flex-wrap:wrap}
.scrub .num{color:var(--fg)}
.split{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;align-items:start}
.insp-head{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
input.name{font:600 22px/1.2 var(--display);background:transparent;border:1px solid transparent;border-radius:6px;padding:2px 6px;margin-left:-6px;min-width:0;width:12ch}
input.name:hover,input.name:focus{border-color:var(--line-2)}
.nav{margin-left:auto;display:flex;gap:6px}
.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
.f label{display:block;font-size:11.5px;color:var(--muted);margin-bottom:4px;letter-spacing:.03em}
.f input,.f select{width:100%;background:var(--panel-2);border:1px solid var(--line-2);border-radius:6px;padding:7px 8px}
.master{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin-bottom:6px}
.master .lab{font-size:11.5px;color:var(--muted)}
input[type=range]{accent-color:var(--sun);width:100%}
.mval{font:600 22px/1 var(--display);font-variant-numeric:tabular-nums;min-width:4ch;text-align:right}
.preset{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.preset label{margin-left:auto;font-size:12.5px;color:var(--muted);display:flex;gap:6px;align-items:center}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
.bars{display:flex;flex-direction:column;gap:5px}
.bar{display:grid;grid-template-columns:62px 1fr 52px;gap:8px;align-items:center;font-size:12.5px}
.bar .t{height:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:3px;overflow:hidden}
.bar .t div{height:100%}
.bar .p{text-align:right;color:var(--muted)}
.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.metric{background:var(--panel-2);border-radius:6px;padding:8px}
.metric .v{font:600 20px/1.1 var(--display);font-variant-numeric:tabular-nums}
.metric .l{font-size:11px;color:var(--muted)}
.note{font-size:11.5px;color:var(--faint);margin-top:8px}
.chks{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.ptime{font:600 24px/1.1 var(--display);font-variant-numeric:tabular-nums}
.chk{display:grid;grid-template-columns:4px 1fr;gap:10px;background:var(--panel-2);border-radius:8px;overflow:hidden}
.chk .sev{background:var(--info)} .chk.warn .sev{background:var(--warn)} .chk.ok .sev{background:var(--ok)}
.chk .c{padding:9px 10px 10px 0}
.chk b{display:block;font-size:13.5px;font-weight:600}
.chk p{margin:2px 0 0;font-size:12.5px;color:var(--muted)}
.acts{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:12px}
.pc{border:1px solid var(--line);background:var(--panel-2);border-radius:8px;padding:10px;text-align:left;display:flex;flex-direction:column;gap:6px;min-width:0}
.pc.sel{border-color:var(--sun);box-shadow:0 0 0 1px var(--sun) inset}
.pc .n{display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;min-width:0}
.pc .n span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mini{display:flex;gap:2px;height:26px;align-items:flex-end}
.mini div{flex:1;min-height:1px;border-radius:1px}
.pc small{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc small.use{color:var(--sun)}
.editor{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.slid{display:grid;grid-template-columns:62px 1fr 56px;gap:8px;align-items:center;font-size:12.5px;margin-bottom:4px}
.slid input[type=number]{width:100%;background:var(--panel-2);border:1px solid var(--line-2);border-radius:5px;padding:3px 5px;text-align:right}
.slid .c{display:flex;align-items:center;gap:6px}
.slid .c i{width:9px;height:9px;border-radius:2px;border:1px solid var(--line-2)}
.setgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:14px;align-items:start}
.simgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
.sim{background:var(--panel-2);border-radius:8px;padding:10px 12px;min-width:0}
.sim .h{display:flex;align-items:center;justify-content:space-between;gap:8px}
.sim b{font-size:13.5px}
.state{font-size:11px;padding:1px 8px;border-radius:99px;border:1px solid var(--line-2);color:var(--muted)}
.state.on{color:var(--ok);border-color:var(--ok)}
.sim p{margin:4px 0 0;font-size:12.5px;color:var(--muted)}
.sim .row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
.sim label.ck{display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--muted);margin-top:8px}
.links{display:flex;flex-direction:column;gap:6px;margin-top:8px;font-size:13px}
.savebar{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:10px;border:1px solid var(--sun);background:var(--panel);box-shadow:0 -4px 16px rgba(0,0,0,.18);z-index:2}
.savebar .b{display:flex;gap:8px;margin-left:auto}
.toast{font-size:12.5px;padding:8px 12px;border-radius:8px;background:var(--panel-2)}
.toast.err{color:var(--bad)}
.empty{padding:28px;text-align:center;color:var(--muted)}
.badge.on{background:var(--ok)}
.seahead{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.seahead .grow{flex:1;min-width:240px}
.kv{display:flex;gap:22px;flex-wrap:wrap;margin-top:10px}
.kv div{font-size:12px;color:var(--muted)} .kv b{display:block;font:600 24px/1.1 var(--display);color:var(--fg);font-variant-numeric:tabular-nums}
.ttable{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 28px;margin-top:12px}
.tcol{display:flex;flex-direction:column;gap:2px;min-width:0}
.trow{display:grid;grid-template-columns:62px 1fr 1fr;gap:8px;align-items:center;font-size:13px;padding:1px 8px;border-radius:6px}
.trow input{width:100%;background:transparent;border:1px solid transparent;border-bottom-color:var(--line);border-radius:4px;padding:4px 6px;text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums}
.trow input:hover{border-color:var(--line-2)} .trow input:focus{border-color:var(--sun);outline:none;background:var(--panel-2)}
.trow.hd{color:var(--muted);font-size:11px;letter-spacing:.03em;padding-bottom:4px}
.trow.hd span:not(:first-child){text-align:right;padding-right:7px}
.trow.cur{background:var(--sun-soft)}
.trow.cur span{color:var(--sun);font-weight:600}
.fill{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:13px}
.fi{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)} .fill .fi input{width:64px} .fill .fi select{width:auto}
.split2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:stretch}
.midctl{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted)} .midctl input{background:var(--panel-2);border:1px solid var(--line-2);border-radius:6px;padding:4px 8px;color:var(--fg)}
.stat4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px} .stat4 .metric{padding:10px 12px} .stat4 .v{font-size:26px}
.seanote{font-size:12.5px;margin:6px 0 0}
.lgd{margin-left:auto}
.fill .f{min-width:120px}
.ptab{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}
.ptab td,.ptab th{padding:6px;border-bottom:1px solid var(--line);text-align:left}
.ptab th{color:var(--muted);font-weight:500;font-size:11.5px}
.ptab td.num{font-family:var(--mono)}
.ptab select,.fill select,.fill input{background:var(--panel-2);border:1px solid var(--line-2);border-radius:5px;padding:4px 6px;width:100%}
svg.ychart,svg.dchart{display:block;width:100%}
.lgd{display:flex;gap:14px;font-size:12px;color:var(--muted);margin-top:6px;flex-wrap:wrap}
.lgd i{display:inline-block;width:16px;height:3px;border-radius:2px;vertical-align:middle;margin-right:5px}
.warnbox{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--sun-soft);font-size:13px}
@media (max-width:860px){.now,.split,.setgrid,.cols,.split2,.ttable{grid-template-columns:minmax(0,1fr)} .stat4{grid-template-columns:repeat(2,minmax(0,1fr))} .simgrid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:520px){.fields{grid-template-columns:repeat(2,minmax(0,1fr))} .big .v{font-size:34px} .legend{margin-left:0}}
@media (max-width:520px){
  #inspector .insp-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 10px;align-items:center}
  #inspector .insp-head h2{grid-column:1/3;grid-row:1}
  #inspector .insp-head .nav{grid-column:3;grid-row:1;margin-left:0}
  #inspector .insp-head .ptime{grid-column:1;grid-row:2}
  #inspector .insp-head input.name{grid-column:2/4;grid-row:2;width:100%;margin-left:0}
  .fields .f{min-width:0}
  .fields input[type=time]{min-width:0;max-width:100%;-webkit-appearance:none;appearance:none;display:block;text-align:left}
}

#fReef{width:auto;max-width:100%}
.tgl{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-2);background:var(--panel-2);border-radius:99px;padding:4px 12px 4px 5px;font-size:12.5px;font-weight:600}
.tgl .knob{width:30px;height:18px;border-radius:99px;background:var(--line-2);position:relative;flex:none}
.tgl .knob::after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:var(--panel);transition:left .15s}
.tgl[aria-checked="true"]{border-color:var(--sun)} .tgl[aria-checked="true"] .knob{background:var(--sun)} .tgl[aria-checked="true"] .knob::after{left:15px}
svg.chart.locked{touch-action:pan-y}
fieldset.efs{border:0;margin:0;padding:0;min-width:0}
fieldset.efs:disabled{opacity:.8}
@media (prefers-reduced-motion:no-preference){.bar .t div,.strip div{transition:width .25s,height .25s}}
`;

const MARKUP = `
<ha-card><div class="wrap">
  <header class="top">
    <div class="brand">Sentinel <b>Studio</b></div>
    <div class="dev" id="dev"></div>
    <div class="spacer"></div>
    <span class="pill" id="statusPill"><i></i><span id="statusText">Connecting</span></span>
    <div class="clock" id="clock">--:--</div>
  </header>
  <nav class="tabs" role="tablist">
    <button class="tab" role="tab" data-tab="today" aria-selected="true">Today</button>
    <button class="tab" role="tab" data-tab="seasons" aria-selected="false">Seasons <span class="badge on" id="seaBadge" hidden>On</span></button>
    <button class="tab" role="tab" data-tab="settings" aria-selected="false">Settings <span class="badge" id="setBadge" hidden></span></button>
  </nav>
  <div class="toast" id="toast" hidden></div>
  <div class="empty" id="empty">Reading the light…</div>

  <div class="panel" id="p-today" hidden>
    <section>
      <div class="box">
        <div class="mode" id="nowMode">—</div>
        <div class="big">
          <div><span class="v" id="nowW">0</span><span class="u">W</span><div class="l">Power</div></div>
          <div><span class="v" id="nowPct">0</span><span class="u">%</span><div class="l">Channel average</div></div>
          <div><span class="v" id="nowNext">—</span><span class="u">W</span><div class="l" id="nowNextL">Next point</div></div>
        </div>
        <div class="strip" id="nowStrip"></div>
        <div class="moonrow" id="nowNote"></div>
      </div>
    </section>
    <section class="box">
      <div class="tlhead"><h2>Today's light</h2><button class="tgl" id="editTgl" role="switch" aria-checked="false"><span class="knob"></span><span id="editTxt">Edit off</span></button><div class="legend" id="legend"></div></div>
      <div class="chartwrap" id="chartwrap"><svg class="chart locked" id="chart" role="img" aria-label="24-hour light curve"></svg></div>
      <div class="scrub" id="scrub"></div>
    </section>
    <div class="split">
      <section class="box" id="inspector"></section>
<div class="panel">
      <div class="box">
        <h2>Quick looks</h2>
        <div class="qgrid" id="qgrid"></div>
        <div class="dur" id="dur">Hold for
          <button class="chip" data-d="15">15 min</button><button class="chip on" data-d="30">30 min</button>
          <button class="chip" data-d="60">1 h</button><button class="chip" data-d="120">2 h</button>
        </div>
        <div class="ovrbar" id="ovrbar" hidden><span id="ovrText"></span><button class="btn pri" id="resume">Resume schedule</button></div>
      </div>
      <div class="box"><h2>Moon</h2><div id="moonText"></div></div>
      </div>
    </div>
    <section class="box"><h2>Daily totals</h2><div class="stat4" id="statRow"></div></section>
  </div>

  <div class="panel" id="p-profiles" hidden>
    <section class="box">
      <div class="top"><h2>Profiles</h2><span class="muted" style="font-size:12.5px" id="pcount"></span></div>
      <div class="pgrid" id="pgrid"></div>
      <div class="editor" id="editor"></div>
    </section>
  </div>

  <div class="panel" id="p-seasons" hidden>
    <section class="box" id="seaHead"></section>
    <section class="box"><div class="tlhead"><h2>Today against the longest day</h2>
      <div class="lgd"><span><i style="background:var(--muted)"></i>Longest day</span><span><i style="background:var(--sun)"></i>Today</span><span><i style="background:var(--info)"></i>Midday</span></div></div>
      <svg class="dchart" id="dayCompare"></svg></section>
    <div class="split2">
      <section class="box"><div class="tlhead"><h2>Points</h2><label class="midctl" for="seaMid">Midday<input type="time" id="seaMid" step="300"></label></div>
        <table class="ptab" id="seaPoints"></table>
        <p class="note">As days shorten, each point moves toward midday by the duration percent and its intensity is multiplied by the brightness percent.</p></section>
      <section class="box"><div class="tlhead"><h2>Through the year</h2>
        <div class="lgd"><span><i style="background:var(--sun)"></i>Brightness</span><span><i style="background:var(--info)"></i>Duration</span></div></div>
        <svg class="ychart" id="yearChart"></svg></section>
    </div>
    <section class="box"><div class="tlhead"><h2>Seasonal table</h2><span class="muted" style="font-size:12.5px">Percent of the longest day. Days between rows are interpolated.</span></div>
      <div class="ttable" id="seaTable"></div>
      <div class="fill"><b>Reef location</b>
        <select id="fReef" aria-label="Reef location"><option value="">Custom</option><option value="ghl">GHL-style table</option>${REEFS.map(r => `<option value="${r[0]}">${r[1]} (${Math.abs(r[2]).toFixed(1)}°${r[2] >= 0 ? 'N' : 'S'})</option>`).join('')}</select>
        <span class="muted" style="font-size:12.5px">Fills the table from that reef's day length and noon sun angle.</span></div>
      <div class="fill"><b>Auto-fill</b>
        <label class="fi">Longest day <select id="fLong"><option value="06-21">June 21 (northern)</option><option value="12-21">December 21 (southern)</option></select></label>
        <label class="fi">Shortest-day brightness <input type="number" id="fB" min="1" max="100" value="66"> %</label>
        <label class="fi">Shortest-day duration <input type="number" id="fD" min="10" max="100" value="78"> %</label>
        <button class="btn" data-sea="fill">Fill table now</button></div></section>
  </div>

  <div class="panel" id="p-settings" hidden>
    <div class="setgrid">
      <section class="box"><h2>Schedule checks</h2><ul class="chks" id="checks"></ul></section>
      <div class="panel">
        <section class="box"><h2>Simulation &amp; location</h2><div class="simgrid" id="sim"></div></section>
        <section class="box"><h2>Device</h2><div class="simgrid" id="device"></div></section>
      </div>
    </div>
  </div>

  <div class="savebar" id="savebar" hidden>
    <b id="editCount"></b><span class="muted" style="font-size:12.5px" id="saveNote">Not on the light yet.</span>
    <div class="b"><button class="btn" id="discard">Discard</button><button class="btn pri" id="send">Send to light</button></div>
  </div>
</div></ha-card>`;

/* ---------- seasonal math (same as the integration's seasonal_math.py) ---------- */
const GHL_TABLE = [['01-04', 66, 78], ['01-19', 68, 79], ['02-04', 70, 81], ['02-19', 74, 83], ['03-06', 78, 86], ['03-21', 82, 88],
  ['04-05', 87, 91], ['04-21', 91, 94], ['05-06', 94, 96], ['05-21', 97, 98], ['06-05', 99, 99], ['06-21', 100, 100],
  ['07-06', 99, 99], ['07-21', 97, 98], ['08-05', 95, 96], ['08-20', 91, 94], ['09-05', 87, 91], ['09-20', 83, 89],
  ['10-05', 78, 86], ['10-20', 74, 83], ['11-04', 70, 81], ['11-20', 68, 79], ['12-05', 66, 78], ['12-20', 66, 78]];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const doy = md => { const [m, d] = md.split('-').map(Number); return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 864e5); };
const mdLabel = md => MON[+md.slice(0, 2) - 1] + ' ' + md.slice(3);
const hm = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const todayDoy = () => { const n = new Date(); return Math.min(364, Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(n.getFullYear(), 0, 1)) / 864e5)); };
function sFactors(table, t) {
  const rows = table.map(r => [doy(r[0]), +r[1], +r[2]]).sort((a, b) => a[0] - b[0]);
  if (!rows.length) return [100, 100];
  const before = rows.filter(r => r[0] <= t), after = rows.filter(r => r[0] > t);
  const a = before.length ? before[before.length - 1] : rows[rows.length - 1], b = after.length ? after[0] : rows[0];
  const span = (((b[0] - a[0]) % 365) + 365) % 365 || 365, f = ((((t - a[0]) % 365) + 365) % 365) / span;
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
function sTransform(base, modes, mid, br, du) {
  const out = base.map(p => { const mode = modes[String(p.index)] || 'both'; let t = p.hr * 60 + p.min, m = p.master;
    if (mode !== 'fixed') t = Math.max(0, Math.min(1439, Math.round(mid + (t - mid) * du / 100)));
    if (mode === 'both') m = Math.max(0, Math.min(100, Math.round(m * br / 100)));
    return { index: p.index, name: p.name, hr: Math.floor(t / 60), min: t % 60, master: m }; });
  let last = -1;
  base.map((p, i) => i).sort((a, b) => (base[a].hr * 60 + base[a].min) - (base[b].hr * 60 + base[b].min)).forEach(i => {
    let t = out[i].hr * 60 + out[i].min; if (t <= last) t = Math.min(1439, last + 1); out[i].hr = Math.floor(t / 60); out[i].min = t % 60; last = t; });
  return out;
}
function sAutofill(longest, mb, md) { // GHL Connect fillTableAutomatically(), same constants
  let e = doy(longest); const out = [];
  for (let a = 0; a < 24; a++) {
    const dt = new Date(Date.UTC(2001, 0, 1 + Math.trunc(e))), c = (Math.cos(a / 24 * 6.28) + 1) / 2;
    out.push([String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'), Math.trunc(c * (100 - mb) + mb), Math.trunc(c * (100 - md) + md)]);
    e += 365 / 24; if (e >= 365) e -= 365;
  }
  return out.sort((x, y) => doy(x[0]) - doy(y[0]));
}

function createStudio(root, api) {
  const $ = id => root.getElementById(id);
  const S = { d: null, points: [], profiles: [], orig: null, sel: 0, selProf: 0, dur: 30, hidden: new Set(),
    scrub: null, drag: null, edit: false, tab: 'today', busy: false, confirm: null, geo: null };

  /* ---------- math ---------- */
  const tm = p => p.hr * 60 + p.min;
  const lvl = pt => (S.profiles[pt.pindex] || { ch: Array(9).fill(0) }).ch.map(c => c * pt.master / 100);
  const watts = c => c.reduce((s, v, k) => s + v * WPC[k], 0);
  const avgPct = c => c.reduce((s, v) => s + v, 0) / 1023 / 9 * 100;
  const order = () => S.points.map((p, i) => i).sort((a, b) => tm(S.points[a]) - tm(S.points[b]));
  function levelAt(t) {
    const o = order(), P = S.points;
    if (!o.length) return { c: Array(9).fill(0), from: 0, to: 0 };
    let pi = o.filter(i => tm(P[i]) <= t).pop(); if (pi === undefined) pi = o[o.length - 1];
    let ni = o.find(i => tm(P[i]) > t); if (ni === undefined) ni = o[0];
    const a = tm(P[pi]), b = tm(P[ni]), span = ((b - a + 1440) % 1440) || 1440, f = ((t - a + 1440) % 1440) / span;
    const A = lvl(P[pi]), B = lvl(P[ni]);
    return { c: A.map((v, k) => v + (B[k] - v) * f), from: pi, to: ni };
  }
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  const fmtT = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; let h = Math.floor(m / 60), mi = m % 60, ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; return h + ':' + String(mi).padStart(2, '0') + ' ' + ap; };
  const fmtShort = m => { let h = Math.floor(m / 60) % 24, ap = h < 12 ? 'a' : 'p'; h = h % 12 || 12; return h + ap; };
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const set = () => (S.d && S.d.settings) || {};
  const ovr = () => S.d && S.d.override && Date.parse(S.d.override.until) > Date.now() ? S.d.override : null;
  const snap = t => Math.round(t / 5) * 5;
  const topCh = c => UI_ORDER.filter(k => c[k] > 0).sort((a, b) => c[b] - c[a]).slice(0, 3);
  const moonInfo = () => { const d = S.d, slot = d.points.find(p => p.index === 19), pr = slot && S.profiles[slot.pindex];
    const rise = +d.now.MoonRiseHr * 60 + +d.now.MoonRiseMin, sett = +d.now.MoonSetHr * 60 + +d.now.MoonSetMin, t = nowMin();
    const up = rise < sett ? (t >= rise && t < sett) : (t >= rise || t < sett);
    const on = set().EnMoon === '1' && !!pr && pr.ch.some(v => v > 0) && slot.master > 0;
    return { on, up, pr, slot, rise, sett, text: on ? `${pr.name.trim()} at ${slot.master}% × phase, moon ${up ? 'up now' : 'below the horizon now'}` : 'off' }; };
  const ptLabel = p => ((S.d && S.d.labels) || {})[String(p.index)] || (p.name || '').trim();
  const clockDrift = () => { const lc = (+S.d.now.chr) * 60 + (+S.d.now.cmin); return [lc, Math.abs(((lc - Math.floor(nowMin()) + 720 + 1440) % 1440) - 720)]; };

  /* ---------- data in ---------- */
  function load(d) {
    S.points = d.points.slice(0, Math.max(1, d.vm)).map(p => ({ ...p }));
    S.profiles = d.profiles.map(p => ({ index: p.index, name: p.name, ch: p.ch.slice() }));
    S.orig = JSON.stringify({ points: S.points, profiles: S.profiles });
    S.sel = Math.min(S.sel, S.points.length - 1);
    if (!S.profiles[S.selProf]) S.selProf = 0;
  }
  function setData(d) {
    const first = !S.d;
    S.d = d;
    if (!S.orig || (!editCount() && !S.drag)) load(d);
    if (!S.sea || !seaDirty()) seaLoad(d);
    if (first) { const pk = S.points.findIndex(p => /^peak$/i.test(p.name)); if (pk >= 0) S.sel = pk; S.selProf = S.points[S.sel] ? S.points[S.sel].pindex : 0; }
    $('empty').hidden = true; showTab(S.tab, true);
    S.drag ? renderNow() : renderAll();
  }
  function setError(msg) {
    if (!S.d) { $('empty').hidden = false; $('empty').textContent = msg; }
    $('statusPill').className = 'pill bad'; $('statusText').textContent = 'Light not answering';
  }
  function editCount() {
    if (!S.orig) return 0; const o = JSON.parse(S.orig); let n = 0;
    S.points.forEach((p, i) => ['name', 'hr', 'min', 'pindex', 'master', 'rate', 'seasonal'].forEach(f => { if (p[f] !== o.points[i][f]) n++; }));
    S.profiles.forEach((p, i) => { if (p.name !== o.profiles[i].name) n++; p.ch.forEach((v, k) => { if (v !== o.profiles[i].ch[k]) n++; }); });
    return n;
  }
  function toast(msg, err) { const t = $('toast'); t.hidden = false; t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); clearTimeout(S.tt); S.tt = setTimeout(() => t.hidden = true, err ? 8000 : 3500); }
  async function run(label, fn) {
    if (S.busy) return; S.busy = true; renderSave();
    try { await fn(); if (label) toast(label); } catch (e) { toast((e && e.message) || String(e), true); }
    finally { S.busy = false; renderSave(); }
  }

  /* ---------- now ---------- */
  function renderNow() {
    const d = S.d; if (!d) return;
    $('clock').textContent = fmtT(nowMin());
    $('dev').textContent = `${set().ModelType || 'Uno'} · ${d.title} · fw ${d.now.Ver || '?'}`;
    const c = d.now.nowch, o = ovr(), P = S.points, [lc, drift] = clockDrift();
    $('nowW').textContent = Math.round(d.watts);
    const ap = avgPct(c); $('nowPct').textContent = ap.toFixed(ap < 10 ? 1 : 0);
    if (!d.available) { $('statusPill').className = 'pill bad'; $('statusText').textContent = 'Light not answering'; }
    else if (o) { $('statusPill').className = 'pill ovr'; $('statusText').textContent = 'Quick look active'; }
    else if (drift > 2) { $('statusPill').className = 'pill warn'; $('statusText').textContent = `Light clock ${fmtT(lc)}`; }
    else { $('statusPill').className = 'pill'; $('statusText').textContent = 'Running schedule'; }
    if (o) {
      const pr = S.profiles[o.profile] || { name: 'Profile', ch: Array(9).fill(0) };
      const left = Math.max(0, Date.parse(o.until) - Date.now()), mm = Math.floor(left / 60000), ss = Math.floor(left % 60000 / 1000);
      $('nowMode').innerHTML = `${esc(pr.name)} <span>· quick look</span>`;
      $('nowNext').textContent = Math.round(watts(pr.ch)); $('nowNextL').textContent = 'Quick look at 100%';
      $('ovrbar').hidden = false; $('ovrText').innerHTML = `<b>${esc(pr.name)}</b> for <span class="num">${mm}:${String(ss).padStart(2, '0')}</span> more`;
    } else if (P.length) {
      const L = levelAt(nowMin()), a = P[L.from], b = P[L.to];
      const wa = watts(lvl(a)), wb = watts(lvl(b));
      $('nowMode').innerHTML = Math.abs(wb - wa) < 0.5 ? (wa < 0.5 ? `Lights off <span>until ${fmtT(tm(b))}</span>` : `Holding <span>until ${fmtT(tm(b))}</span>`) : `${wb > wa ? 'Ramping up' : 'Ramping down'} <span>to ${Math.round(wb)} W by ${fmtT(tm(b))}</span>`;
      $('nowNext').textContent = Math.round(wb); $('nowNextL').textContent = `Next point, ${fmtT(tm(b))}`;
      $('ovrbar').hidden = true;
    }
    $('nowStrip').innerHTML = UI_ORDER.map(k => `<div title="${CH[k].label} ${Math.round(c[k] / 10.23)}%" style="height:${Math.max(2, c[k] / 1023 * 100)}%;background:${CH[k].color}"></div>`).join('');
    const mi = moonInfo();
    const mr = +d.now.MoonRiseHr * 60 + +d.now.MoonRiseMin, ms = +d.now.MoonSetHr * 60 + +d.now.MoonSetMin;
    $('moonText').innerHTML = `<div class="metrics" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:10px"><div class="metric"><div class="v">${d.now.cMoon}%</div><div class="l">Lit</div></div><div class="metric"><div class="v">${fmtT(mr)}</div><div class="l">Moonrise</div></div><div class="metric"><div class="v">${fmtT(ms)}</div><div class="l">Moonset</div></div></div>
      <p class="note">${mi.on ? `Moonlight uses ${esc(mi.pr.name.trim())} at ${mi.slot.master}%, scaled by phase. The moon is ${mi.up ? 'up now' : 'below the horizon now'}.` : 'Moonlight is off on the light.'}</p>`;
    $('nowNote').textContent = d.seasonal && d.seasonal.enabled ? `Seasons: ${Math.round(d.seasonal.today.brightness)}% brightness, ${Math.round(d.seasonal.today.duration)}% duration today` : '';
    root.querySelectorAll('.qbtn').forEach(b => b.classList.toggle('on', !!(o && +b.dataset.p === o.profile)));
  }
  function quickList() {
    const idx = QUICK_NAMES.map(n => S.profiles.findIndex(p => p.name.trim().toLowerCase() === n.toLowerCase())).filter(i => i >= 0);
    return idx.length ? idx : [0, 1, 2, 5].filter(i => S.profiles[i]);
  }
  function renderQuick() {
    $('qgrid').innerHTML = quickList().map(j => { const ch = S.profiles[j].ch, top = topCh(ch);
      return `<button class="qbtn" data-p="${j}"><span class="ms" aria-hidden="true">${UI_ORDER.map(k => `<i style="height:${Math.max(5, ch[k] / 1023 * 100)}%;background:${CH[k].color};opacity:${ch[k] ? 1 : .25}"></i>`).join('')}</span><span style="min-width:0"><b>${esc(S.profiles[j].name.replace('_', ' '))}</b><small>${top.map(k => CH[k].label).join(', ') || 'All off'} · ${Math.round(watts(ch))} W</small></span></button>`; }).join('');
  }

  /* ---------- chart ---------- */
  const svg = $('chart');
  function renderChart() {
    if (!S.d || S.tab !== 'today') return;
    const W = svg.clientWidth || 900, H = W < 560 ? 230 : 300, pad = { l: 40, r: 14, t: 78, b: 26 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, N = 289, ts = [...Array(N)].map((_, i) => i * 5);
    const L = ts.map(t => levelAt(t).c), tot = L.map(avgPct), ptsY = S.points.map(p => avgPct(lvl(p)));
    const ymax = Math.ceil(Math.max(10, ...tot, ...ptsY) * 1.12 / 10) * 10;
    const X = t => pad.l + t / 1440 * iw, Y = v => pad.t + ih - v / ymax * ih;
    S.geo = { pad, iw, ih, ymax };
    let h = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--sun-soft)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--sun)" stroke-width="1.2" opacity=".5"/></pattern></defs>`;
    for (let v = 0; v <= ymax; v += ymax <= 40 ? 10 : 20) h += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)" font-family="var(--mono)">${v}%</text>`;
    for (let t = 0; t <= 1440; t += 180) h += `<line x1="${X(t)}" x2="${X(t)}" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--grid)"/><text x="${X(t)}" y="${H - 8}" text-anchor="${t === 0 ? 'start' : t === 1440 ? 'end' : 'middle'}" font-size="10.5" fill="var(--muted)" font-family="var(--mono)">${t === 1440 ? '12a' : fmtShort(t)}</text>`;
    const base = ts.map(() => 0);
    for (let k = 0; k < 9; k++) {
      if (S.hidden.has(k)) continue;
      const top = base.map((b, i) => b + L[i][k] / 1023 / 9 * 100);
      let d = 'M' + ts.map((t, i) => `${X(t).toFixed(1)},${Y(top[i]).toFixed(1)}`).join('L');
      d += 'L' + ts.slice().reverse().map((t, j) => `${X(t).toFixed(1)},${Y(base[N - 1 - j]).toFixed(1)}`).join('L') + 'Z';
      h += `<path d="${d}" fill="${CH[k].color}" fill-opacity=".82" stroke="${CH[k].color}" stroke-width=".6"/>`;
      for (let i = 0; i < N; i++) base[i] = top[i];
    }
    h += `<path d="M${ts.map((t, i) => `${X(t).toFixed(1)},${Y(tot[i]).toFixed(1)}`).join('L')}" fill="none" stroke="var(--fg)" stroke-opacity=".55" stroke-width="1.2"/>`;
    const nm = nowMin(), o = ovr();
    if (o) { const end = Math.min(1440, nm + (Date.parse(o.until) - Date.now()) / 60000); h += `<rect x="${X(nm)}" y="${pad.t}" width="${Math.max(2, X(end) - X(nm))}" height="${ih}" fill="url(#hatch)"/>`; }
    h += `<line x1="${X(nm)}" x2="${X(nm)}" y1="${pad.t - 8}" y2="${pad.t + ih}" stroke="var(--sun)" stroke-width="1.5"/><circle cx="${X(nm)}" cy="${pad.t - 12}" r="4.5" fill="var(--sun)"/>`;
    if (S.scrub != null && !S.drag) h += `<line x1="${X(S.scrub)}" x2="${X(S.scrub)}" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--fg)" stroke-dasharray="3 3" stroke-opacity=".6"/>`;
    const showAll = W >= 720, lab = S.points.map((p, i) => i).sort((a, b) => tm(S.points[a]) - tm(S.points[b])), lift = {}; lab.forEach((i, n) => { lift[i] = n > 0 && !lift[lab[n - 1]] && X(tm(S.points[i])) - X(tm(S.points[lab[n - 1]])) < 90 ? 26 : 0; });
    S.points.forEach((p, i) => {
      const x = X(tm(p)), y = Y(ptsY[i]), sel = i === S.sel, w = Math.round(watts(lvl(p)));
      if (showAll || sel) { const ly = Math.max(14, Math.min(y - 16, pad.t - 8)) - (showAll ? lift[i] : 0), an = x < pad.l + 40 ? 'start' : x > W - pad.r - 40 ? 'end' : 'middle';
        h += `<text x="${x}" y="${ly - 13}" text-anchor="${an}" font-size="11.5" font-weight="600" fill="${sel ? 'var(--sun)' : 'var(--fg)'}">${ptLabel(p) ? esc(ptLabel(p)) : fmtT(tm(p))}</text><text x="${x}" y="${ly}" text-anchor="${an}" font-size="10.5" fill="var(--muted)" font-family="var(--mono)">${ptLabel(p) ? fmtT(tm(p)).replace(':00', '') + ' · ' : ''}${w} W</text>`; }
      h += `<g class="hd" data-i="${i}" tabindex="0" role="slider" aria-label="${esc(p.name)} at ${fmtT(tm(p))}, ${p.master}%" style="cursor:${S.edit ? 'grab' : 'pointer'}"><circle cx="${x}" cy="${y}" r="16" fill="transparent"/>${sel ? `<circle cx="${x}" cy="${y}" r="10.5" fill="none" stroke="var(--sun)" stroke-width="2"/>` : ''}<circle cx="${x}" cy="${y}" r="6" fill="var(--panel)" stroke="${sel ? 'var(--sun)' : 'var(--fg)'}" stroke-width="2"/></g>`;
    });
    svg.innerHTML = h;
    renderScrub();
  }
  function renderScrub() {
    const t = S.scrub != null ? S.scrub : (S.drag ? tm(S.points[S.drag.i]) : null);
    if (t == null) { $('scrub').innerHTML = S.edit ? '<span>Drag a point to move it in time or change its brightness. Hover the curve to preview any moment.</span>' : '<span>Tap a point to inspect it. Turn on Edit to change the schedule.</span>'; return; }
    const c = levelAt(t).c, top = topCh(c);
    $('scrub').innerHTML = `<span class="num">${fmtT(t)}</span><span><span class="num">${Math.round(watts(c))}</span> W</span><span><span class="num">${avgPct(c).toFixed(1)}</span>% avg</span><span>${top.length ? 'Highest: ' + top.map(k => `${CH[k].label} <span class="num">${Math.round(c[k] / 10.23)}%</span>`).join(', ') : 'All channels off'}</span>`;
  }
  const svgPt = e => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const bounds = i => { const o = order(), pos = o.indexOf(i); return [pos > 0 ? tm(S.points[o[pos - 1]]) + 5 : 0, pos < o.length - 1 ? tm(S.points[o[pos + 1]]) - 5 : 1435]; };
  svg.addEventListener('pointerdown', e => { const hd = e.target.closest('.hd'); if (!hd) return; if (!S.edit) { S.sel = +hd.dataset.i; renderAll(); return; } S.sel = +hd.dataset.i; S.drag = { i: S.sel }; svg.setPointerCapture(e.pointerId); e.preventDefault(); renderAll(); });
  svg.addEventListener('pointermove', e => {
    if (!S.geo) return; const { x, y } = svgPt(e), { pad, iw, ih, ymax } = S.geo, t = Math.max(0, Math.min(1435, (x - pad.l) / iw * 1440));
    if (S.drag) { const p = S.points[S.drag.i], [lo, hi] = bounds(S.drag.i), nt = Math.max(lo, Math.min(hi, snap(t)));
      p.hr = Math.floor(nt / 60); p.min = nt % 60;
      const pav = avgPct(S.profiles[p.pindex].ch); if (pav > 0) p.master = Math.max(0, Math.min(100, Math.round(Math.max(0, (pad.t + ih - y) / ih * ymax) / pav * 100)));
      renderChart(); renderInspector(); renderSave(); return; }
    S.scrub = t; renderChart();
  });
  svg.addEventListener('pointerup', () => { if (S.drag) { S.drag = null; renderAll(); } });
  svg.addEventListener('pointerleave', () => { if (!S.drag) { S.scrub = null; renderChart(); } });
  svg.addEventListener('keydown', e => {
    const hd = e.target.closest('.hd'); if (!hd) return; if (!S.edit && e.key.startsWith('Arrow')) return; const i = +hd.dataset.i, p = S.points[i], [lo, hi] = bounds(i); let t = tm(p), hit = true;
    if (e.key === 'ArrowLeft') t = Math.max(lo, t - 5); else if (e.key === 'ArrowRight') t = Math.min(hi, t + 5);
    else if (e.key === 'ArrowUp') p.master = Math.min(100, p.master + 1); else if (e.key === 'ArrowDown') p.master = Math.max(0, p.master - 1);
    else if (e.key !== 'Enter' && e.key !== ' ') hit = false;
    if (hit) { e.preventDefault(); p.hr = Math.floor(t / 60); p.min = t % 60; S.sel = i; renderAll(); const n = svg.querySelector(`.hd[data-i="${i}"]`); if (n) n.focus(); }
  });
  function renderLegend() { $('legend').innerHTML = UI_ORDER.map(k => `<button class="lg${S.hidden.has(k) ? ' off' : ''}" data-k="${k}" aria-pressed="${!S.hidden.has(k)}"><i style="background:${CH[k].color}"></i>${CH[k].label}</button>`).join(''); }
  $('legend').addEventListener('click', e => { const b = e.target.closest('.lg'); if (!b) return; const k = +b.dataset.k; S.hidden.has(k) ? S.hidden.delete(k) : S.hidden.add(k); renderLegend(); renderChart(); });

  /* ---------- inspector ---------- */
  function detach(i) { // give the point its own hidden profile before its channels change
    const p = S.points[i], ref = new Set(quickList());
    S.d.points.filter(q => !S.points.some(a => a.index === q.index)).forEach(q => ref.add(q.pindex));
    S.points.forEach((q, n) => { if (n !== i) ref.add(q.pindex); });
    if (!ref.has(p.pindex)) return true;
    const free = S.profiles.map((q, j) => j).filter(j => !ref.has(j) && j !== p.pindex);
    const empty = free.find(j => !S.profiles[j].ch.some(v => v > 0)), j = empty !== undefined ? empty : free[0];
    if (j === undefined) { toast('The light has no free profile slot for this point.', true); return false; }
    S.profiles[j].ch = S.profiles[p.pindex].ch.slice(); S.profiles[j].name = ('Pt ' + fmtT(tm(p)).replace(' ', '')).slice(0, 15); p.pindex = j;
    return true;
  }
  function setOutputs(i, O) {
    if (!detach(i)) return false;
    const p = S.points[i], pr = S.profiles[p.pindex];
    O = O.map(v => Math.max(0, Math.min(1023, Math.round(v))));
    if (p.master > 0 && Math.max(...O) <= 1023 * p.master / 100) pr.ch = O.map(v => Math.min(1023, Math.round(v * 100 / p.master)));
    else { p.master = 100; pr.ch = O.slice(); }
    return true;
  }
  function renderInspector() {
    const i = S.sel, p = S.points[i]; if (!p) return;
    const ae = root.activeElement; if (ae && ae.closest && ae.closest('#inspector') && (ae.type === 'range' || ae.id === 'plabel') && !S.drag) return; // mid-drag
    const c = lvl(p), el = $('inspector'), active = root.activeElement && root.activeElement.id, o = order(), pos = o.indexOf(i), nxt = S.points[o[(pos + 1) % o.length]];
    el.innerHTML = `<div class="insp-head"><h2>Point ${pos + 1} of ${o.length}</h2><span class="ptime">${fmtT(tm(p))}</span><input class="name" id="plabel" maxlength="24" placeholder="${S.edit ? 'Add a label' : ''}" value="${esc(ptLabel(p))}" aria-label="Point label"${S.edit ? '' : ' disabled'}>
      <div class="nav"><button class="btn" id="prev" aria-label="Previous point">‹</button><button class="btn" id="next" aria-label="Next point">›</button></div></div>
    <fieldset class="efs"${S.edit ? '' : ' disabled'}>
    <div class="fields">
      <div class="f"><label for="ptime">Starts at</label><input type="time" id="ptime" step="300" value="${String(p.hr).padStart(2, '0')}:${String(p.min).padStart(2, '0')}"></div>
      <div class="f"><label for="prate">Transition</label><select id="prate">${[...new Set([1, 5, 10, 15, 20, 30, 45, 60, 90, 120, p.rate])].sort((a, b) => a - b).map(v => `<option value="${v}"${v === p.rate ? ' selected' : ''}>${v} min</option>`).join('')}</select></div>
      <div class="f"><label for="pcopy">Copy channels from</label><select id="pcopy"><option value="">Choose a point</option>${o.filter(j => j !== i).map(j => `<option value="${j}">${fmtT(tm(S.points[j]))} · ${Math.round(watts(lvl(S.points[j])))} W</option>`).join('')}</select></div>
    </div>
    <div class="cols">
      <div><h3>Channels at this point</h3>
        ${UI_ORDER.map(k => `<div class="slid"><span class="c"><i style="background:${CH[k].color}"></i>${CH[k].label}</span><input type="range" min="0" max="100" step="0.5" value="${(c[k] / 10.23).toFixed(1)}" data-ok="${k}" aria-label="${CH[k].label}"><input type="number" min="0" max="100" step="0.5" value="${(c[k] / 10.23).toFixed(1)}" data-okn="${k}" aria-label="${CH[k].label} percent"></div>`).join('')}
        <div class="master" style="margin-top:12px"><span class="lab">Scale all</span><input type="range" id="pmaster" min="0" max="100" value="${p.master}" aria-label="Scale all channels"><span class="mval" id="mval">${p.master}%</span></div>
        <div class="preset">${[0, 25, 50, 75, 100].map(v => `<button class="chip${v === p.master ? ' on' : ''}" data-m="${v}">${v}%</button>`).join('')}</div></div>
      <div><h3>Output</h3><div class="metrics">
        <div class="metric"><div class="v" id="pW">${Math.round(watts(c))} W</div><div class="l">At this point</div></div>
        <div class="metric"><div class="v" id="pA">${avgPct(c).toFixed(1)}%</div><div class="l">Channel average</div></div>
        <div class="metric"><div class="v">${p.rate} min</div><div class="l">Transition</div></div>
        <div class="metric"><div class="v">${fmtT(tm(nxt))}</div><div class="l">Next point · ${Math.round(watts(lvl(nxt)))} W</div></div></div>
        <p class="note">Sliders show what the light puts out at this point. Scale all dims or brightens every channel together.</p></div>
    </div></fieldset>`;
    const upd = fn => e => { fn(e); renderAll(); };
    const live = () => { const cc = lvl(p); $('pW').textContent = Math.round(watts(cc)) + ' W'; $('pA').textContent = avgPct(cc).toFixed(1) + '%'; renderChart(); renderSave(); };
    const setK = (k, pct) => { const O = lvl(p); O[k] = Math.max(0, Math.min(100, pct)) * 10.23; return setOutputs(i, O); };
    el.querySelectorAll('[data-ok]').forEach(r => {
      r.addEventListener('input', () => { if (setK(+r.dataset.ok, +r.value)) { r.nextElementSibling.value = (+r.value).toFixed(1); live(); } });
      r.addEventListener('change', () => { r.blur(); renderAll(); }); });
    el.querySelectorAll('[data-okn]').forEach(n => n.addEventListener('change', () => { setK(+n.dataset.okn, +n.value); n.blur(); renderAll(); }));
    $('plabel').addEventListener('change', e => { const v = e.target.value.replace(/\s+/g, ' ').trim(); e.target.blur(); run(v ? 'Label saved in Home Assistant' : 'Label removed', async () => { await api.call('set_point_label', { index: p.index, label: v }); await api.refresh(); }); });
    $('pcopy').addEventListener('change', upd(e => { if (e.target.value !== '') setOutputs(i, lvl(S.points[+e.target.value])); }));
    $('ptime').addEventListener('change', upd(e => { const [h, m] = e.target.value.split(':').map(Number); if (!isNaN(h)) { const [lo, hi] = bounds(i), t = Math.max(lo, Math.min(hi, h * 60 + m)); p.hr = Math.floor(t / 60); p.min = t % 60; } }));
    $('prate').addEventListener('change', upd(e => p.rate = +e.target.value));
    $('pmaster').addEventListener('input', e => { p.master = +e.target.value; $('mval').textContent = p.master + '%'; live(); });
    $('pmaster').addEventListener('change', e => { e.target.blur(); renderAll(); });
    el.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', upd(() => p.master = +b.dataset.m)));
    $('prev').addEventListener('click', upd(() => { S.sel = o[(pos - 1 + o.length) % o.length]; }));
    $('next').addEventListener('click', upd(() => { S.sel = o[(pos + 1) % o.length]; }));
    if (active && $(active)) $(active).focus();
  }

  /* ---------- stats ---------- */
  function renderStats() {
    const L = [...Array(289)].map((_, i) => levelAt(i * 5).c), Wt = L.map(watts), on = Wt.filter(w => w > .5).length;
    const photo = Math.max(0, (on - 1) * 5), peak = Math.max(...Wt), hiH = Wt.filter(w => peak > 0 && w >= peak * .8).length * 5 / 60, kwh = Wt.reduce((s, w) => s + w, 0) * 5 / 60 / 1000;
    $('statRow').innerHTML = [[`${Math.floor(photo / 60)}h${photo % 60 ? ' ' + photo % 60 + 'm' : ''}`, 'Light on'], [`${Math.round(peak)} W`, 'Peak power'], [`${hiH.toFixed(1)} h`, 'Within 80% of peak'], [`${kwh.toFixed(2)} kWh`, 'Energy per day']]
      .map(([v, l]) => `<div class="metric"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
  }

  /* ---------- profiles ---------- */
  function renderProfiles() {
    const used = S.profiles.map((_, j) => S.points.filter(p => p.pindex === j).map(p => fmtT(tm(p)).replace(':00', '').replace(' ', '')));
    const show = S.profiles.map((p, j) => j).filter(j => S.profiles[j].ch.some(v => v > 0) || used[j].length || j === S.selProf);
    const empty = S.profiles.length - show.length;
    $('pcount').textContent = `${show.length} in use or defined${empty ? ` · ${empty} empty slots` : ''}`;
    $('pgrid').innerHTML = show.map(j => { const p = S.profiles[j];
      return `<button class="pc${j === S.selProf ? ' sel' : ''}" data-j="${j}"><span class="n"><span>${esc(p.name)}</span><small class="num" style="margin-left:auto">${Math.round(watts(p.ch))} W</small></span>
      <span class="mini">${UI_ORDER.map(k => `<div style="height:${Math.max(4, p.ch[k] / 1023 * 100)}%;background:${CH[k].color};opacity:${p.ch[k] ? 1 : .25}"></div>`).join('')}</span>
      <small class="${used[j].length ? 'use' : ''}">${used[j].length ? 'Used ' + used[j].join(', ') : (p.ch.some(v => v > 0) ? 'Not in schedule' : 'Empty')}</small></button>`; }).join('');
    if (S.drag || (root.activeElement && root.activeElement.closest && root.activeElement.closest('#editor'))) return;
    const p = S.profiles[S.selProf];
    $('editor').innerHTML = `<div class="cols"><div><div class="insp-head" style="margin-bottom:10px"><h2>Edit profile</h2><input class="name" id="prname" maxlength="15" value="${esc(p.name)}" aria-label="Profile name"></div>
      ${UI_ORDER.map(k => `<div class="slid"><span class="c"><i style="background:${CH[k].color}"></i>${CH[k].label}</span><input type="range" min="0" max="100" value="${Math.round(p.ch[k] / 10.23)}" data-k="${k}" aria-label="${CH[k].label}"><input type="number" min="0" max="100" value="${Math.round(p.ch[k] / 10.23)}" data-kn="${k}" aria-label="${CH[k].label} percent"></div>`).join('')}
      <div class="note">Changes apply everywhere this profile is used${used[S.selProf].length ? ': ' + used[S.selProf].join(', ') : ''}.</div></div>
      <div><h3>At 100%</h3><div class="metrics"><div class="metric"><div class="v" id="prW">${Math.round(watts(p.ch))} W</div><div class="l">Power</div></div><div class="metric"><div class="v">${avgPct(p.ch).toFixed(1)}%</div><div class="l">Channel average</div></div></div>
      <div class="bars" style="margin-top:12px">${UI_ORDER.map(k => `<div class="bar"><span>${CH[k].label}</span><div class="t"><div style="width:${p.ch[k] / 1023 * 100}%;background:${CH[k].color}"></div></div><span class="p num">${(p.ch[k] * WPC[k]).toFixed(1)} W</span></div>`).join('')}</div></div></div>`;
    const setK = (k, v) => { p.ch[k] = Math.round(Math.max(0, Math.min(100, v)) * 10.23); };
    $('editor').querySelectorAll('[data-k]').forEach(r => { r.addEventListener('input', () => { setK(+r.dataset.k, +r.value); r.nextElementSibling.value = r.value; $('prW').textContent = Math.round(watts(p.ch)) + ' W'; renderSave(); }); r.addEventListener('change', () => { r.blur(); renderAll(); }); });
    $('editor').querySelectorAll('[data-kn]').forEach(n => n.addEventListener('change', () => { setK(+n.dataset.kn, +n.value); n.blur(); renderAll(); }));
    $('prname').addEventListener('change', e => { p.name = e.target.value.replace(/[,=&]/g, '').trim().slice(0, 15) || p.name; e.target.blur(); renderAll(); });
  }
  $('pgrid').addEventListener('click', e => { const b = e.target.closest('.pc'); if (!b) return; S.selProf = +b.dataset.j; if (root.activeElement && root.activeElement.blur) root.activeElement.blur(); renderProfiles(); });

  /* ---------- checks ---------- */
  function checks() {
    const P = S.points, out = [], d = S.d;
    { const m = moonInfo();
      out.push(m.on ? { id: 'moon', sev: 'ok', t: 'Moonlight on', d: `Slot 20 uses ${m.pr.name.trim()} at ${m.slot.master}%, scaled by moon phase (${d.now.cMoon}% today). The moon is up ${fmtT(m.rise)} to ${fmtT(m.sett)}${m.up ? '.' : ', so there is none right now.'}` }
        : { id: 'moon', sev: 'warn', t: 'Moonlight is off', d: set().EnMoon !== '1' ? 'Moon simulation is turned off on the light.' : 'The moonlight slot (slot 20) uses an empty profile or 0%.' }); }
    const inactive = d.points.length - S.points.length;
    if (inactive > 0) out.push({ id: 'hidden', sev: 'info', t: `${inactive} stored points are inactive`, d: `The light runs ${S.points.length} points. The other slots still hold old values and are ignored.` });
    const s = set(), off = [];
    if (+s.MaxCloud === 0) off.push('clouds'); if (!P.some(p => p.seasonal)) off.push('seasonal changes'); if (+s.AccDays === 0) off.push('acclimation');
    if (off.length) out.push({ id: 'sim', sev: 'info', t: `Off: ${off.join(', ')}`, d: 'Available on this light when you want them.' });
    const [lc, drift] = clockDrift();
    if (drift > 2) out.push({ id: 'clock', sev: 'warn', t: `Light clock is ${Math.round(drift)} min off`, d: `The light reads ${fmtT(lc)}. The schedule runs on the light's clock.`, fix: 'Sync clock' });
    return out;
  }
  function renderChecks() {
    const cs = checks(), nw = cs.filter(c => c.sev === 'warn').length;
    $('setBadge').hidden = !nw; $('setBadge').textContent = nw;
    $('checks').innerHTML = cs.map(c => `<li class="chk ${c.sev}"><span class="sev"></span><div class="c"><b>${esc(c.t)}</b><p>${esc(c.d)}</p>${c.fix || c.sel != null ? `<div class="acts">${c.fix ? `<button class="btn pri" data-fix="${c.id}">${c.fix}</button>` : ''}${c.sel != null ? `<button class="btn" data-sel="${c.sel}">Show point</button>` : ''}</div>` : ''}</div></li>`).join('');
  }
  $('checks').addEventListener('click', e => {
    const f = e.target.closest('[data-fix]'), s = e.target.closest('[data-sel]');
    if (f) { const id = f.dataset.fix;
      if (id === 'moon') { const mi = S.points.findIndex(p => /moon/i.test(p.name)); S.profiles[S.points[mi].pindex].ch = [0, 0, 0, 40, 20, 0, 0, 0, 0]; S.sel = mi; S.selProf = S.points[mi].pindex; renderAll(); toast('Moonlight added: royal blue 4%, blue 2%. Send to light to keep it.'); }
      if (id === 'name') { const si = S.points.findIndex(p => /sunrise/i.test(p.name) && tm(p) >= 720); S.points[si].name = 'Dusk'; S.sel = si; renderAll(); }
      if (id === 'clock') run('Light clock synced to Home Assistant', async () => { await api.call('sync_clock'); await api.refresh(); });
    }
    if (s) { S.sel = +s.dataset.sel; showTab('today'); renderAll(); }
  });

  /* ---------- settings: simulation + device ---------- */
  function renderSim() {
    const s = set(), d = S.d, seasonal = S.points.filter(p => p.seasonal).length;
    const rows = [
      ['Moon phase', s.EnMoon === '1', `${s.SelMoonType === '1' ? 'Real moon (calendar)' : 'Basic moon'}. Today ${d.now.cMoon}% lit. ${moonInfo().pr ? `Uses ${moonInfo().pr.name.trim()} at ${moonInfo().slot.master}%.` : ''}`],
      ['Location', true, `${(+s.Lat).toFixed(2)}° ${+s.Lat >= 0 ? 'N' : 'S'}, ${Math.abs(+s.Long).toFixed(2)}° ${+s.Long >= 0 ? 'E' : 'W'}. Sets moonrise and moonset.`],
      ['Clouds', +s.MaxCloud > 0, `Max cloud cover ${s.MaxCloud}%.`],
      ['Seasonal changes', seasonal > 0, `${seasonal} of ${S.points.length} points follow the season. Turn it on per point in the inspector.`],
      ['Acclimation', +s.AccDays > 0, `${(+s.AccPercent).toFixed(0)}% for ${(+s.AccDays).toFixed(0)} days.`],
      ['Quick look default', true, `The light's manual timer is ${s.MMSetDelay} min.`]];
    $('sim').innerHTML = rows.map(([t, on, txt]) => `<div class="sim"><div class="h"><b>${t}</b><span class="state${on ? ' on' : ''}">${on ? 'On' : 'Off'}</span></div><p>${esc(txt)}</p></div>`).join('');
  }
  function renderDevice() {
    if (root.activeElement && root.activeElement.closest && root.activeElement.closest('#device')) return; // keep a form being edited
    const s = set(), d = S.d, host = d.host, [lc] = clockDrift(), restartAsk = S.confirm === 'restart';
    $('device').innerHTML = `
    <div class="sim"><div class="h"><b>Date &amp; time</b></div>
      <p>Light clock <span class="num">${fmtT(lc)}</span> · Home Assistant <span class="num">${fmtT(nowMin())}</span><br>UTC${(+s.TZ) >= 0 ? '+' : '−'}${Math.abs(+s.TZ)} · daylight saving ${s.ADLS === '1' ? 'automatic (' + esc(s.SelectedDLS) + ')' : 'off'}</p>
      <div class="acts"><button class="btn pri" data-act="sync">Sync to Home Assistant</button></div></div>
    <div class="sim"><div class="h"><b>Seasonal changes</b></div>
      <div class="row"><div class="f"><label for="sSun1">Sunrise shift, summer to winter (min)</label><input type="number" id="sSun1" min="0" max="240" value="${+s.max_S_min}"></div>
      <div class="f"><label for="sSun2">Sunset shift, summer to winter (min)</label><input type="number" id="sSun2" min="0" max="240" value="${+s.max_S_min2}"></div></div>
      <div class="row"><div class="f"><label for="sHem">Hemisphere</label><select id="sHem"><option${s.NorthHemi === '1' ? ' selected' : ''}>Northern</option><option${s.NorthHemi !== '1' ? ' selected' : ''}>Southern</option></select></div>
      <div class="f"><label for="sSol">Schedule is set for</label><select id="sSol"><option value="1"${s.SummerSolTime === '1' ? ' selected' : ''}>Summer solstice</option><option value="0"${s.SummerSolTime !== '1' ? ' selected' : ''}>Winter solstice</option></select></div></div>
      <label class="ck"><input type="checkbox" id="sDst"${s.sol_DLS === '1' ? ' checked' : ''}> Ignore daylight saving</label>
      <div class="acts"><button class="btn pri" data-act="seasonal">Save seasonal</button></div></div>
    <div class="sim"><div class="h"><b>Power outage check</b><span class="state${s.POC === '1' ? ' on' : ''}">${s.POC === '1' ? 'On' : 'Off'}</span></div>
      <p>The light pings a device on mains power. If it stops answering, the LEDs turn off to save battery backup, and the schedule resumes when it answers again.</p>
      <label class="ck"><input type="checkbox" id="pEn"${s.POC === '1' ? ' checked' : ''}> Enabled</label>
      <div class="row"><div class="f"><label for="pIp">Device to ping</label><input id="pIp" value="${esc(s.POCip === '0.0.0.0' ? '' : (s.POCip || ''))}" placeholder="192.168.4.1"></div></div>
      <div class="acts"><button class="btn pri" data-act="poc">Save</button></div></div>
    <div class="sim"><div class="h"><b>System tools</b></div>
      <p>Fan mode: ${esc(FAN[+s.FanMode] || s.FanMode)}.</p>
      <div class="acts"><button class="btn" data-act="demo">Run lighting demo</button><button class="btn" data-act="recalibrate_fan">Recalibrate fan</button><button class="btn" data-act="display_toggle">Display on/off</button>
      ${restartAsk ? '<button class="btn danger" data-act="restart-yes">Restart now</button><button class="btn" data-act="restart-no">Cancel</button>' : '<button class="btn danger" data-act="restart">Restart light</button>'}</div></div>
    <div class="sim" style="grid-column:1/-1"><div class="h"><b>On the light's own pages</b></div>
      <p>These change the light's firmware, network or stored defaults, so they open the ReeFi's built-in pages. They work only on your home network.</p>
      <div class="links"><a href="http://${host}/firmware" target="_blank" rel="noopener">Firmware update ↗</a><a href="http://${host}/wifi.html" target="_blank" rel="noopener">Wi-Fi config ↗</a>
      <a href="http://${host}/info" target="_blank" rel="noopener">Info gauges ↗</a><a href="http://${host}/" target="_blank" rel="noopener">Group setup, retrieve LED settings, full system tools ↗</a></div></div>`;
  }
  $('device').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act; b.blur();
    const after = async fn => { await fn(); await api.refresh(); };
    if (a === 'sync') run('Light clock synced to Home Assistant', () => after(() => api.call('sync_clock')));
    else if (a === 'seasonal') run('Seasonal settings saved', () => after(() => api.call('set_seasonal', { sunrise_minutes: +$('sSun1').value, sunset_minutes: +$('sSun2').value, hemisphere: $('sHem').value, ignore_dst: $('sDst').checked, schedule_is_summer: $('sSol').value === '1' })));
    else if (a === 'poc') run('Power outage check saved', () => after(() => api.call('set_power_check', { enabled: $('pEn').checked, ip: $('pIp').value.trim() || '0.0.0.0' })));
    else if (a === 'restart') { S.confirm = 'restart'; renderDevice(); }
    else if (a === 'restart-no') { S.confirm = null; renderDevice(); }
    else if (a === 'restart-yes') { S.confirm = null; renderDevice(); run('Restarting the light. It should answer again in about 30 seconds.', () => api.call('device_action', { action: 'restart' })); }
    else run({ demo: 'Lighting demo started', recalibrate_fan: 'Fan recalibration started', display_toggle: 'Display toggled' }[a], () => api.call('device_action', { action: a }));
  });

  /* ---------- seasons ---------- */
  const seaDirty = () => !!S.sea && JSON.stringify(S.sea) !== S.seaOrig;
  function seaLoad(d) {
    const s = d.seasonal || {};
    S.sea = { table: (s.table || GHL_TABLE).map(r => [r[0], +r[1], +r[2]]), midday: s.midday || '15:50', modes: { ...(s.modes || {}) } };
    S.seaOrig = JSON.stringify(S.sea);
  }
  function seaBase() {
    const sv = S.d.seasonal || {};
    return (sv.base || S.points.map(p => ({ index: p.index, name: p.name, hr: p.hr, min: p.min, master: p.master })));
  }
  const seaMode = p => S.sea.modes[String(p.index)] || (/moon/i.test(p.name) ? 'fixed' : 'both');
  function levelOf(P, t) {
    const o = P.map((p, i) => i).sort((a, b) => tm(P[a]) - tm(P[b]));
    if (!o.length) return Array(9).fill(0);
    let pi = o.filter(i => tm(P[i]) <= t).pop(); if (pi === undefined) pi = o[o.length - 1];
    let ni = o.find(i => tm(P[i]) > t); if (ni === undefined) ni = o[0];
    const a = tm(P[pi]), b = tm(P[ni]), span = ((b - a + 1440) % 1440) || 1440, f = ((t - a + 1440) % 1440) / span;
    const A = lvl(P[pi]), B = lvl(P[ni]);
    return A.map((v, k) => v + (B[k] - v) * f);
  }
  function renderSeasons() {
    if (!S.d || !S.sea) return;
    const sv = S.d.seasonal || {}, on = !!sv.enabled, ty = todayDoy(), [br, du] = sFactors(S.sea.table, ty), mid = hm(S.sea.midday);
    $('seaBadge').hidden = !on;
    if (S.tab !== 'seasons') return;
    const base = seaBase(), modes = {}; base.forEach(p => { modes[String(p.index)] = seaMode(p); });
    const today = sTransform(base, modes, mid, br, du), dirty = seaDirty();
    const pidx = i => { const lp = S.d.points.find(p => p.index === i); return lp ? lp.pindex : 0; };
    const withP = list => list.map(p => ({ ...p, pindex: pidx(p.index) }));
    const last = sv.last, n = new Date(), dateTxt = `${MON[n.getMonth()]} ${n.getDate()}`;
    const ask = S.confirm;
    /* head */
    const TPw = withP(today), BPw = withP(base); let on1 = null, on2 = null, pkT = 0, pkB = 0;
    for (let t = 0; t < 1440; t++) { const wt = watts(levelOf(TPw, t)), wb = watts(levelOf(BPw, t)); if (wt > 0.5) { if (on1 === null) on1 = t; on2 = t; } pkT = Math.max(pkT, wt); pkB = Math.max(pkB, wb); }
    const status = on ? `Home Assistant rewrites the light's schedule at 12:05 AM each day.${last ? ` Last update ${mdLabel(last.date.slice(5))}: ${last.changed} point${last.changed === 1 ? '' : 's'} changed.` : ''}` : 'Off. The light runs its own schedule unchanged.';
    const baseTxt = sv.base ? ` Longest-day schedule saved ${new Date(sv.base_saved).toLocaleDateString()}.` : ' Turning on saves the light\'s current schedule as the longest day.';
    $('seaHead').innerHTML = `<div class="seahead"><div class="grow"><div class="top"><h2>Seasonal lighting</h2><span class="state${on ? ' on' : ''}">${on ? 'On' : 'Off'}</span></div>
      <p class="muted seanote">${status}${baseTxt}</p></div>
      <div class="acts" style="margin-top:0">
        ${dirty ? '<button class="btn" data-sea="discard">Discard</button><button class="btn pri" data-sea="save">Save seasonal settings</button>' : ''}
        ${on ? '<button class="btn" data-sea="apply">Apply now</button><button class="btn" data-sea="rebase">Use current schedule as longest day</button><button class="btn danger" data-sea="off">Turn off</button>' : '<button class="btn pri" data-sea="on">Turn on</button>'}
      </div></div>
      <div class="stat4">
        <div class="metric"><div class="v">${br.toFixed(1)}%</div><div class="l">Brightness, ${dateTxt}</div></div>
        <div class="metric"><div class="v">${du.toFixed(1)}%</div><div class="l">Duration, ${dateTxt}</div></div>
        <div class="metric"><div class="v">${on1 === null ? '—' : `${fmtT(on1)} – ${fmtT(on2 + 1)}`}</div><div class="l">Light on today</div></div>
        <div class="metric"><div class="v">${Math.round(pkT)} W</div><div class="l">Peak today · ${Math.round(pkB)} W on the longest day</div></div>
      </div>
      ${ask === 'sea-on' ? `<div class="warnbox">Turning on saves the light's current ${S.points.length}-point schedule as the longest, brightest day and immediately sets today's schedule to ${br.toFixed(0)}% brightness and ${du.toFixed(0)}% duration (light on ${on1 === null ? '' : fmtT(on1) + ' to ' + fmtT(on2 + 1)}). <div class="acts"><button class="btn pri" data-sea="on-yes">Turn on now</button><button class="btn" data-sea="cancel">Cancel</button></div></div>` : ''}
      ${ask === 'sea-rebase' ? `<div class="warnbox">This replaces the saved longest-day schedule with what the light runs right now, which is today's already-reduced schedule. Only do this after setting the light back to your full summer schedule. <div class="acts"><button class="btn danger" data-sea="rebase-yes">Replace longest day</button><button class="btn" data-sea="cancel">Cancel</button></div></div>` : ''}
      ${ask === 'sea-off' ? `<div class="warnbox">Turning off stops the daily updates. The light keeps today's schedule until you change it. <div class="acts"><button class="btn danger" data-sea="off-yes">Turn off</button><button class="btn" data-sea="cancel">Cancel</button></div></div>` : ''}`;
    /* year chart */
    const yc = $('yearChart'), W = yc.clientWidth || 560, H = 270, pad = { l: 38, r: 12, t: 12, b: 24 }, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const rows = S.sea.table.map(r => [doy(r[0]), +r[1], +r[2]]).sort((a, b) => a[0] - b[0]);
    const lo = Math.max(0, Math.floor((Math.min(...rows.map(r => Math.min(r[1], r[2]))) - 5) / 10) * 10);
    const X = d => pad.l + d / 364 * iw, Y = v => pad.t + ih - (v - lo) / (100 - lo) * ih;
    let h = '';
    for (let v = lo; v <= 100; v += 10) h += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)" font-family="var(--mono)">${v}%</text>`;
    MON.forEach((m, i) => { const x = X(doy(String(i + 1).padStart(2, '0') + '-01')); h += `<line x1="${x}" x2="${x}" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--grid)"/><text x="${x + 3}" y="${H - 8}" font-size="10.5" fill="var(--muted)" font-family="var(--mono)">${m}</text>`; });
    [[1, 'var(--sun)'], [2, 'var(--info)']].forEach(([k, col]) => {
      h += `<path d="M${[...Array(365)].map((_, d) => `${X(d).toFixed(1)},${Y(sFactors(S.sea.table, d)[k - 1]).toFixed(1)}`).join('L')}" fill="none" stroke="${col}" stroke-width="2"/>`;
      rows.forEach(r => { h += `<circle cx="${X(r[0])}" cy="${Y(r[k])}" r="2.6" fill="${col}"/>`; });
    });
    h += `<line x1="${X(ty)}" x2="${X(ty)}" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--fg)" stroke-dasharray="3 3" stroke-opacity=".7"/>`;
    yc.setAttribute('viewBox', `0 0 ${W} ${H}`); yc.setAttribute('height', H); yc.innerHTML = h;
    /* day compare */
    const dc = $('dayCompare'), W2 = dc.clientWidth || 900, H2 = W2 < 560 ? 210 : 250, p2 = { l: 40, r: 14, t: 28, b: 26 }, iw2 = W2 - p2.l - p2.r, ih2 = H2 - p2.t - p2.b;
    const ts = [...Array(289)].map((_, i) => i * 5);
    const bl = ts.map(t => avgPct(levelOf(BPw, t))), tl = ts.map(t => avgPct(levelOf(TPw, t)));
    const ym = Math.ceil(Math.max(10, ...bl, ...tl) * 1.12 / 10) * 10, X2 = t => p2.l + t / 1440 * iw2, Y2 = v => p2.t + ih2 - v / ym * ih2;
    let g = '';
    for (let v = 0; v <= ym; v += ym <= 40 ? 10 : 20) g += `<line x1="${p2.l}" x2="${W2 - p2.r}" y1="${Y2(v)}" y2="${Y2(v)}" stroke="var(--grid)"/><text x="${p2.l - 6}" y="${Y2(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)" font-family="var(--mono)">${v}%</text>`;
    for (let t = 0; t <= 1440; t += 180) g += `<line x1="${X2(t)}" x2="${X2(t)}" y1="${p2.t}" y2="${p2.t + ih2}" stroke="var(--grid)"/><text x="${X2(t)}" y="${H2 - 8}" text-anchor="${t === 0 ? 'start' : t === 1440 ? 'end' : 'middle'}" font-size="10.5" fill="var(--muted)" font-family="var(--mono)">${t === 1440 ? '12a' : fmtShort(t)}</text>`;
    const line = arr => ts.map((t, i) => `${X2(t).toFixed(1)},${Y2(arr[i]).toFixed(1)}`).join('L');
    g += `<path d="M${line(tl)}L${X2(1440)},${Y2(0)}L${X2(0)},${Y2(0)}Z" fill="var(--sun-soft)"/>`;
    g += `<path d="M${line(bl)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/><path d="M${line(tl)}" fill="none" stroke="var(--sun)" stroke-width="2.2"/>`;
    g += `<line x1="${X2(mid)}" x2="${X2(mid)}" y1="${p2.t - 6}" y2="${p2.t + ih2}" stroke="var(--info)" stroke-dasharray="3 3"/><text x="${X2(mid)}" y="${p2.t - 10}" text-anchor="middle" font-size="10.5" fill="var(--info)" font-family="var(--mono)">${fmtT(mid)}</text>`;
    BPw.forEach(p => { g += `<circle cx="${X2(tm(p))}" cy="${Y2(avgPct(lvl(p)))}" r="3.5" fill="var(--panel)" stroke="var(--muted)" stroke-width="1.5"><title>${esc(p.name)} longest day: ${fmtT(tm(p))}, ${p.master}%</title></circle>`; });
    TPw.forEach(p => { g += `<circle cx="${X2(tm(p))}" cy="${Y2(avgPct(lvl(p)))}" r="4.5" fill="var(--sun)" stroke="var(--panel)" stroke-width="1.5"><title>${esc(p.name)} today: ${fmtT(tm(p))}, ${p.master}%</title></circle>`; });
    dc.setAttribute('viewBox', `0 0 ${W2} ${H2}`); dc.setAttribute('height', H2); dc.innerHTML = g;
    /* points */
    if (!(root.activeElement && root.activeElement.closest && root.activeElement.closest('#seaPoints'))) {
      $('seaPoints').innerHTML = `<tr><th>Point</th><th>Longest day</th><th>Today</th><th>Follows season</th></tr>` + base.map((p, i) => {
        const t = today[i], m = modes[String(p.index)];
        return `<tr><td>${esc(ptLabel(p)) || i + 1}</td><td class="num">${fmtT(tm(p))} · ${p.master}%</td><td class="num">${fmtT(tm(t))} · ${t.master}%</td>
        <td><select data-mode="${p.index}" aria-label="${esc(p.name)} seasonal mode"><option value="both"${m === 'both' ? ' selected' : ''}>Time and brightness</option><option value="time"${m === 'time' ? ' selected' : ''}>Time only</option><option value="fixed"${m === 'fixed' ? ' selected' : ''}>Fixed</option></select></td></tr>`; }).join('');
    }
    if (root.activeElement !== $('seaMid')) $('seaMid').value = S.sea.midday;
    if (root.activeElement !== $('fReef')) { const ds = S.sea.table.map(r => r[0]), cur = JSON.stringify(S.sea.table.map(r => [r[0], +r[1], +r[2]]));
      $('fReef').value = ['ghl', ...REEFS.map(r => r[0])].find(k => JSON.stringify(reefTable(k, ds).map(r => [r[0], +r[1], +r[2]])) === cur) || ''; }
    /* table */
    if (!(root.activeElement && root.activeElement.closest && root.activeElement.closest('#seaTable'))) {
      const rs = S.sea.table.map((r, i) => [r, i]).sort((a, b) => doy(a[0][0]) - doy(b[0][0]));
      const cur = rs.filter(([r]) => doy(r[0]) <= ty).pop() || rs[rs.length - 1];
      const row = ([r, i]) => `<div class="trow${cur && cur[1] === i ? ' cur' : ''}"><span>${mdLabel(r[0])}</span><input type="number" min="1" max="100" data-tb="${i}:1" value="${r[1]}" aria-label="${mdLabel(r[0])} brightness"><input type="number" min="10" max="100" data-tb="${i}:2" value="${r[2]}" aria-label="${mdLabel(r[0])} duration"></div>`;
      const hd = '<div class="trow hd"><span>Date</span><span>Brightness %</span><span>Duration %</span></div>', per = Math.ceil(rs.length / 3);
      $('seaTable').innerHTML = [0, 1, 2].map(c => `<div class="tcol">${hd}${rs.slice(c * per, (c + 1) * per).map(row).join('')}</div>`).join('');
    }
  }
  $('p-seasons').addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.tb) { const [i, k] = el.dataset.tb.split(':').map(Number); const v = Math.max(k === 1 ? 1 : 10, Math.min(100, +el.value || 0)); S.sea.table[i][k] = v; el.value = v; }
    else if (el.dataset.mode) S.sea.modes[el.dataset.mode] = el.value;
    else if (el.id === 'seaMid' && el.value) S.sea.midday = el.value;
    else if (el.id === 'fReef') { if (!el.value) return; S.sea.table = reefTable(el.value, S.sea.table.map(r => r[0])); }
    else return;
    el.blur(); renderSeasons();
  });
  $('p-seasons').addEventListener('click', e => {
    const b = e.target.closest('[data-sea]'); if (!b) return; const a = b.dataset.sea;
    const settings = () => ({ table: S.sea.table, midday: S.sea.midday, modes: Object.fromEntries(seaBase().map(p => [String(p.index), seaMode(p)])) });
    const done = async data => { await api.call('seasonal_configure', data); S.sea = null; S.orig = editCount() ? S.orig : null; await api.refresh(); };
    if (a === 'fill') { S.sea.table = sAutofill($('fLong').value, +$('fB').value, +$('fD').value, S.sea.table.map(r => r[0])); renderSeasons(); }
    else if (a === 'discard') { seaLoad(S.d); renderSeasons(); }
    else if (a === 'save') run('Seasonal settings saved', () => done(settings()));
    else if (a === 'on') { S.confirm = 'sea-on'; renderSeasons(); }
    else if (a === 'on-yes') { S.confirm = null; run('Seasonal lighting is on. Today\'s schedule was sent to the light.', () => done({ ...settings(), enabled: true })); }
    else if (a === 'off') { S.confirm = 'sea-off'; renderSeasons(); }
    else if (a === 'off-yes') { S.confirm = null; run('Seasonal lighting is off', () => done({ enabled: false })); }
    else if (a === 'rebase') { S.confirm = 'sea-rebase'; renderSeasons(); }
    else if (a === 'rebase-yes') { S.confirm = null; run('Longest-day schedule replaced', async () => { await api.call('seasonal_capture_base'); S.sea = null; await api.refresh(); }); }
    else if (a === 'apply') run('Today\'s seasonal schedule sent to the light', async () => { await api.call('seasonal_apply'); S.orig = null; await api.refresh(); });
    else if (a === 'cancel') { S.confirm = null; renderSeasons(); }
  });

  /* ---------- save ---------- */
  function renderSave() {
    const n = editCount(); $('savebar').hidden = n === 0;
    $('saveNote').textContent = S.d && S.d.seasonal && S.d.seasonal.enabled ? 'Seasons is on: these edits are kept as longest-day values.' : 'Not on the light yet.'; $('editCount').textContent = `${n} unsaved change${n === 1 ? '' : 's'}`;
    $('send').disabled = S.busy; $('send').textContent = S.busy ? 'Sending…' : 'Send to light';
  }
  $('discard').addEventListener('click', () => { load(S.d); renderAll(); });
  $('send').addEventListener('click', () => {
    const o = JSON.parse(S.orig);
    const points = S.points.filter((p, i) => JSON.stringify(p) !== JSON.stringify(o.points[i])).map(p => ({ index: p.index, name: p.name, hr: p.hr, min: p.min, rate: p.rate, pindex: p.pindex, master: p.master, seasonal: p.seasonal }));
    const profiles = S.profiles.filter((p, i) => JSON.stringify(p) !== JSON.stringify(o.profiles[i])).map(p => ({ index: p.index, name: p.name, ch: p.ch }));
    run('Saved to the light', async () => { await api.call('save_schedule', { points, profiles }); S.orig = null; await api.refresh(); });
  });

  /* ---------- quick looks ---------- */
  $('qgrid').addEventListener('click', e => { const b = e.target.closest('.qbtn'); if (!b) return; const p = +b.dataset.p, o = ovr();
    if (o && o.profile === p) run('Schedule resumed', async () => { await api.call('resume_schedule'); await api.refresh(); });
    else run(null, async () => { await api.call('quick_look', { profile: p, minutes: S.dur }); await api.refresh(); }); });
  $('dur').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; S.dur = +b.dataset.d; root.querySelectorAll('#dur .chip').forEach(c => c.classList.toggle('on', c === b));
    const o = ovr(); if (o) run(null, async () => { await api.call('quick_look', { profile: o.profile, minutes: S.dur }); await api.refresh(); }); });
  $('resume').addEventListener('click', () => run('Schedule resumed', async () => { await api.call('resume_schedule'); await api.refresh(); }));

  /* ---------- tabs ---------- */
  function showTab(t, quiet) {
    S.tab = t; ['today', 'profiles', 'seasons', 'settings'].forEach(n => { $('p-' + n).hidden = !S.d || n !== t; });
    root.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    if (!quiet && t === 'today') requestAnimationFrame(renderChart);
    if (!quiet && t === 'seasons') requestAnimationFrame(renderSeasons);
  }
  $('editTgl').addEventListener('click', () => {
    S.edit = !S.edit; $('editTgl').setAttribute('aria-checked', String(S.edit)); $('editTxt').textContent = S.edit ? 'Edit on' : 'Edit off';
    svg.classList.toggle('locked', !S.edit); S.scrub = null; renderAll();
  });
  root.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); });

  function renderAll() { if (!S.d) return; renderNow(); renderQuick(); renderChart(); renderInspector(); renderChecks(); renderStats(); renderProfiles(); renderSim(); renderDevice(); renderSeasons(); renderSave(); }
  renderLegend();
  const ro = new ResizeObserver(() => { renderChart(); if (S.tab === 'seasons') renderSeasons(); }); ro.observe($('chartwrap')); ro.observe($('p-seasons'));
  const tick = setInterval(renderNow, 1000);
  const slow = setInterval(() => { if (!S.drag) { renderChart(); renderChecks(); } }, 30000);
  return { setData, setError, destroy() { clearInterval(tick); clearInterval(slow); ro.disconnect(); } };
}

class ReefiStudioCard extends HTMLElement {
  setConfig(config) { this._config = config || {}; }
  set hass(hass) { const first = !this._hass; this._hass = hass; if (first) this._init(); }
  get hass() { return this._hass; }
  getCardSize() { return 16; }
  getGridOptions() { return { columns: 'full', min_columns: 12 }; }
  static getStubConfig() { return {}; }
  connectedCallback() { if (this._studio && !this._poll) { this._fetch(); this._startPoll(); } }
  disconnectedCallback() { clearInterval(this._poll); this._poll = null; }
  _init() {
    ensureFonts();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style>${MARKUP}`;
    const api = {
      call: (service, data = {}) => this._hass.callService('reefi', service, { ...data, ...(this._entry ? { entry_id: this._entry } : {}) }),
      refresh: () => this._fetch(),
    };
    this._studio = createStudio(root, api);
    this._fetch(); this._startPoll();
  }
  _startPoll() { clearInterval(this._poll); this._poll = setInterval(() => this._fetch(), 10000); }
  async _fetch() {
    try {
      const msg = { type: 'reefi/data' }; if (this._config && this._config.entry_id) msg.entry_id = this._config.entry_id;
      const d = await this._hass.callWS(msg); this._entry = d.entry_id; this._studio.setData(d);
    } catch (e) { this._studio.setError((e && e.message) || 'Could not read the ReeFi integration.'); }
  }
}
if (!customElements.get('reefi-studio-card')) {
  customElements.define('reefi-studio-card', ReefiStudioCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'reefi-studio-card', name: 'Sentinel Studio for ReeFi', description: 'Schedule, profiles and live output for a ReeFi LED light.' });
  console.info(`%c REEFI-STUDIO %c ${CARD_VERSION} `, 'background:#e9a83a;color:#1b1305;font-weight:700', '');
}
