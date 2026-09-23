/* Interactive ticket-operations dashboard.
   All data is generated here with a seeded random generator, so it is the same on every visit.
   Charts are hand-drawn SVG. No libraries. */
(function () {
  "use strict";

  var root = document.getElementById("view-dashboard");
  if (!root) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Helpers ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function $(id) { return document.getElementById(id); }
  function s(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function tx(str, attrs, parent) { var e = s("text", attrs, parent); e.textContent = str; return e; }
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + "%"; }
  function sum(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    var i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }
  function niceStep(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function axis(max, ticks) {
    var step = niceStep(max / ticks), top = step * Math.ceil(max / step);
    return { step: step, max: top, n: Math.round(top / step) };
  }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, f) {
    var A = hexRgb(a), B = hexRgb(b);
    return "rgb(" + A.map(function (v, i) { return Math.round(v + (B[i] - v) * f); }).join(",") + ")";
  }
  function activatable(el, fn) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("click", fn);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e); }
    });
  }
  function monotone(pts) {
    var n = pts.length;
    if (n < 2) return "";
    var dx = [], dy = [], m = [], tg = [], i;
    for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    tg[0] = m[0]; tg[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) tg[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { tg[i] = 0; tg[i + 1] = 0; }
      else {
        var a = tg[i] / m[i], b = tg[i + 1] / m[i], q = a * a + b * b;
        if (q > 9) { var k = 3 / Math.sqrt(q); tg[i] = k * a * m[i]; tg[i + 1] = k * b * m[i]; }
      }
    }
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (i = 0; i < n - 1; i++) {
      var hh = dx[i] / 3;
      d += "C" + (pts[i][0] + hh) + "," + (pts[i][1] + tg[i] * hh) + "," + (pts[i + 1][0] - hh) + "," + (pts[i + 1][1] - tg[i + 1] * hh) + "," + pts[i + 1][0] + "," + pts[i + 1][1];
    }
    return d;
  }
  function arcPath(cx, cy, r0, r1, a0, a1) {
    if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2 - 0.0001;
    var large = a1 - a0 > Math.PI ? 1 : 0;
    function p(r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
    var A = p(r1, a0), B = p(r1, a1), C = p(r0, a1), D = p(r0, a0);
    return "M" + A[0] + "," + A[1] + "A" + r1 + "," + r1 + " 0 " + large + " 1 " + B[0] + "," + B[1] +
      "L" + C[0] + "," + C[1] + "A" + r0 + "," + r0 + " 0 " + large + " 0 " + D[0] + "," + D[1] + "Z";
  }

  /* ---------- Static sample data ---------- */
  var CATS = [
    { id: "delay", name: "Flight delays", short: "DLY", color: "#FF4D64", w: 26 },
    { id: "bag", name: "Baggage", short: "BAG", color: "#5BA4FF", w: 14 },
    { id: "crew", name: "Crew scheduling", short: "CRW", color: "#FFB020", w: 11 },
    { id: "gate", name: "Gate and ramp", short: "GATE", color: "#2EC4B6", w: 12 },
    { id: "mx", name: "Maintenance", short: "MNT", color: "#9B8CFF", w: 9 },
    { id: "pax", name: "Passenger systems", short: "PAX", color: "#6BD68C", w: 10 },
    { id: "wx", name: "Weather impact", short: "WX", color: "#FF8A4C", w: 8 },
    { id: "it", name: "Vendor and IT", short: "IT", color: "#E58AD6", w: 10 }
  ];
  var NEIGH = { 0: [6, 3, 2], 1: [5, 3], 2: [3, 0], 3: [2, 1], 4: [7, 3], 5: [7, 1], 6: [0], 7: [5, 4] };
  var CAT_SLOW = [1, 0.8, 1, 0.9, 1.6, 0.9, 1.1, 1.3];
  var STATIONS = [
    { id: "ATL", name: "Atlanta", w: 30 }, { id: "DTW", name: "Detroit", w: 13 },
    { id: "MSP", name: "Minneapolis-St. Paul", w: 11 }, { id: "SLC", name: "Salt Lake City", w: 10 },
    { id: "JFK", name: "New York JFK", w: 12 }, { id: "LAX", name: "Los Angeles", w: 10 },
    { id: "SEA", name: "Seattle", w: 8 }, { id: "BOS", name: "Boston", w: 6 }
  ];
  var PRI = ["P1", "P2", "P3", "P4"];
  var WEEKS = 12;
  var NOW = new Date(2026, 8, 20, 12, 0);
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20260920);
  function pick(w) {
    var r = rnd() * sum(w);
    for (var i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return w.length - 1;
  }
  function gauss() {
    var u = 0, v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function weekDate(w, d, hour, min) { return new Date(2026, 5, 29 + 7 * w + (d || 0), hour || 0, min || 0); }
  function weekLabel(w) { return weekDate(w).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  var WEEK_LABELS = [];
  for (var wi = 0; wi < WEEKS; wi++) WEEK_LABELS.push(weekLabel(wi));

  var HOUR_W = [];
  for (var hh0 = 0; hh0 < 24; hh0++) {
    HOUR_W.push(0.35 + 1.6 * Math.exp(-Math.pow(hh0 - 7.5, 2) / 6) + 1.7 * Math.exp(-Math.pow(hh0 - 17.5, 2) / 7) + 0.7 * Math.exp(-Math.pow(hh0 - 12, 2) / 10));
  }
  var DAY_W = [1.15, 1.2, 1.15, 1.1, 1.25, 0.7, 0.65];
  var STATION_W = STATIONS.map(function (x) { return x.w; });

  var TICKETS = [];
  (function generate() {
    for (var w = 0; w < WEEKS; w++) {
      var spike = w === 6 || w === 7;
      var n = Math.round(168 + w * 3.5 + (spike ? 42 : 0) + gauss() * 8);
      var cw = CATS.map(function (c) {
        var x = c.w;
        if (spike && c.id === "wx") x *= 3.4;
        if (spike && c.id === "delay") x *= 1.35;
        if (w >= 9 && c.id === "it") x *= 1.25;
        return x;
      });
      for (var i = 0; i < n; i++) {
        var ci = pick(cw), c = CATS[ci], si = pick(STATION_W);
        var pw = [6, 19, 45, 30];
        if (c.id === "delay" || c.id === "wx") pw = [9, 24, 42, 25];
        if (c.id === "mx") pw = [10, 22, 40, 28];
        var pi = pick(pw);
        var created = weekDate(w, pick(DAY_W), pick(HOUR_W), Math.floor(rnd() * 60));
        if (created > NOW) created = new Date(NOW.getTime() - Math.floor(rnd() * 30 * 36e5));
        var ageH = (NOW - created) / 36e5;
        var openP = ageH < 24 ? 0.65 : ageH < 72 ? 0.35 : ageH < 168 ? 0.12 : 0.03;
        var status = rnd() < openP ? (rnd() < 0.5 ? "Open" : "In progress") : "Resolved";
        var res = null;
        if (status === "Resolved") {
          res = [3, 8, 20, 44][pi] * CAT_SLOW[ci] * Math.exp(gauss() * 0.65);
          res = Math.max(0.3, Math.min(res, Math.max(0.5, ageH * 0.9)));
          res = Math.round(res * 10) / 10;
        }
        var conf = 0.55 + 0.44 * Math.pow(rnd(), 0.55);
        var correct = rnd() < 0.82 + 0.17 * ((conf - 0.55) / 0.44);
        var pred = ci;
        if (!correct) { var nb = NEIGH[ci]; pred = nb[Math.floor(rnd() * nb.length)]; }
        TICKETS.push({ w: w, created: created, cat: ci, st: si, pri: pi, status: status, res: res, conf: conf, pred: pred });
      }
    }
    TICKETS.sort(function (a, b) { return a.created - b.created; });
    TICKETS.forEach(function (t, i) { t.id = "TKT-" + (10400 + i); });
  })();

  /* ---------- State + filtering ---------- */
  var state = { cats: new Set(), sts: new Set(), pris: new Set(), range: 12 };
  function subset(o) {
    o = o || {};
    return TICKETS.filter(function (t) {
      return (o.noRange || t.w >= WEEKS - state.range) &&
        (o.noCat || !state.cats.size || state.cats.has(t.cat)) &&
        (o.noSt || !state.sts.size || state.sts.has(t.st)) &&
        (o.noPri || !state.pris.size || state.pris.has(t.pri));
    });
  }
  function toggle(set, v) { if (set.has(v)) set["delete"](v); else set.add(v); update(); }
  function isOpen(t) { return t.status !== "Resolved"; }
  function resolvedList(a) { return a.filter(function (t) { return t.res != null; }); }
  function sortedRes(a) { return resolvedList(a).map(function (t) { return t.res; }).sort(function (x, y) { return x - y; }); }
  function mean(a) { return a.length ? sum(a) / a.length : null; }
  function accuracy(a) { return a.length ? a.filter(function (t) { return t.pred === t.cat; }).length / a.length : null; }

  /* ---------- Tooltips ---------- */
  var pageTip = $("dash-tip"), dlgTip = $("dlg-tip"), dlg = $("dlg");
  function moveTip(e) {
    var tipEl = dlg.open ? dlgTip : pageTip;
    var target = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
    pageTip.hidden = true; dlgTip.hidden = true;
    if (!target) return;
    tipEl.innerHTML = target.getAttribute("data-tip");
    tipEl.hidden = false;
    var pad = 14, w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    var x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + hgt > window.innerHeight - 8) y = e.clientY - hgt - pad;
    tipEl.style.left = Math.max(8, x) + "px";
    tipEl.style.top = Math.max(8, y) + "px";
  }
  root.addEventListener("pointermove", moveTip);
  root.addEventListener("pointerleave", function () { pageTip.hidden = true; dlgTip.hidden = true; });
  root.addEventListener("pointerdown", function () { pageTip.hidden = true; dlgTip.hidden = true; });

  /* ---------- KPI cards ---------- */
  var KPIS = [
    { id: "total", label: "Tickets", color: "#5BA4FF",
      fn: function (a) { return a.length; }, f: fmt,
      sub: function (d) { return fmt(d.length / state.range) + " a week"; }, open: openTotal },
    { id: "open", label: "Open backlog", color: "#FFB020",
      fn: function (a) { return a.filter(isOpen).length; }, f: fmt,
      sub: function (d) { return d.length ? pct(d.filter(isOpen).length / d.length) + " of tickets" : "No tickets"; }, open: openBacklog },
    { id: "res", label: "Avg resolution", color: "#2EC4B6",
      fn: function (a) { return mean(sortedRes(a)); }, f: function (v) { return v.toFixed(1) + " h"; },
      sub: function (d) { var m = quantile(sortedRes(d), 0.5); return m == null ? "No resolved tickets" : "Median " + m.toFixed(1) + " h"; }, open: openResolution },
    { id: "acc", label: "Classifier accuracy", color: "#6BD68C",
      fn: accuracy, f: function (v) { return (v * 100).toFixed(1) + "%"; },
      sub: function (d) { return fmt(d.filter(function (t) { return t.pred === t.cat; }).length) + " labeled correctly"; }, open: openAccuracy },
    { id: "p1", label: "P1 share", color: "#FF4D64",
      fn: function (a) { return a.length ? a.filter(function (t) { return t.pri === 0; }).length / a.length : null; },
      f: function (v) { return (v * 100).toFixed(1) + "%"; },
      sub: function (d) { return fmt(d.filter(function (t) { return t.pri === 0; }).length) + " P1 tickets"; }, open: openP1 }
  ];
  var kpiBox = $("kpis"), kpiEls = {};
  function buildKpis() {
    KPIS.forEach(function (k) {
      var b = h("button", "kpi");
      b.type = "button";
      b.setAttribute("aria-haspopup", "dialog");
      b.innerHTML = '<span class="kpi-label">' + k.label + '</span><span class="kpi-value">0</span><span class="kpi-sub"></span>' +
        '<svg class="kpi-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path class="area"/><path class="line"/></svg>' +
        '<svg class="kpi-open" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2h5v5M14 2L8 8M12 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/></svg>';
      b.style.setProperty("--kc", k.color);
      b.addEventListener("click", k.open);
      kpiBox.appendChild(b);
      kpiEls[k.id] = { root: b, value: b.querySelector(".kpi-value"), sub: b.querySelector(".kpi-sub"),
        area: b.querySelector(".area"), line: b.querySelector(".line"), last: 0 };
    });
  }
  function tween(el, from, to, f) {
    if (reduce || from == null || to == null) { el.textContent = to == null ? "n/a" : f(to); return; }
    var start = performance.now(), dur = 450;
    if (el._raf) cancelAnimationFrame(el._raf);
    (function step(now) {
      var p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(from + (to - from) * e);
      if (p < 1) el._raf = requestAnimationFrame(step);
    })(start);
  }
  function renderKpis() {
    var data = subset();
    var weeks = [];
    for (var i = WEEKS - state.range; i < WEEKS; i++) weeks.push([]);
    data.forEach(function (t) { weeks[t.w - (WEEKS - state.range)].push(t); });
    KPIS.forEach(function (k) {
      var el = kpiEls[k.id], v = k.fn(data);
      tween(el.value, el.last, v, k.f);
      el.last = v;
      el.sub.textContent = k.sub(data);
      var series = weeks.map(function (a) { var x = k.fn(a); return x == null ? 0 : x; });
      var min = Math.min.apply(null, series), max = Math.max.apply(null, series), span = max - min || 1;
      var pts = series.map(function (x, i) { return [series.length < 2 ? 60 : (i / (series.length - 1)) * 120, 31 - ((x - min) / span) * 26]; });
      var d = monotone(pts);
      el.line.setAttribute("d", d);
      el.area.setAttribute("d", d ? d + "L120,36L0,36Z" : "");
    });
  }

  /* ---------- Filter bar ---------- */
  var filterChips = $("filter-chips"), priBox = $("pri-toggles");
  function buildPriorityToggles() {
    PRI.forEach(function (p, i) {
      var b = h("button", "pri-btn", p);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { toggle(state.pris, i); });
      priBox.appendChild(b);
    });
  }
  function chip(label, color, onRemove) {
    var c = h("span", "chip");
    if (color) { var d = h("i", "chip-dot"); d.style.background = color; c.appendChild(d); }
    c.appendChild(document.createTextNode(label));
    var x = h("button", "chip-x", "&times;");
    x.type = "button";
    x.setAttribute("aria-label", "Remove filter: " + label);
    x.addEventListener("click", onRemove);
    c.appendChild(x);
    return c;
  }
  function renderFilterbar() {
    filterChips.textContent = "";
    state.cats.forEach(function (i) { filterChips.appendChild(chip(CATS[i].name, CATS[i].color, function () { toggle(state.cats, i); })); });
    state.sts.forEach(function (i) { filterChips.appendChild(chip("Station " + STATIONS[i].id, "#9FB4D6", function () { toggle(state.sts, i); })); });
    var any = state.cats.size || state.sts.size || state.pris.size;
    if (!state.cats.size && !state.sts.size) {
      filterChips.appendChild(h("span", "chip-empty", any ? "" : "No category or station filters. Click a bar or a station to add one."));
    }
    $("reset").hidden = !any;
    Array.prototype.forEach.call(priBox.children, function (b, i) { b.setAttribute("aria-pressed", state.pris.has(i) ? "true" : "false"); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-range]"), function (b) {
      b.setAttribute("aria-pressed", String(+b.getAttribute("data-range") === state.range));
    });
  }

  /* ---------- Line chart (trend + modal) ---------- */
  function lineChart(box, o) {
    var W = Math.max(260, Math.floor(box.clientWidth)), H = o.height || 280;
    var m = { l: o.ml || 42, r: 18, t: 22, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.labels.length;
    var all = [];
    o.series.forEach(function (se) { all = all.concat(se.values); });
    var ax = axis(Math.max(1, Math.max.apply(null, all)), 4);
    function x(i) { return m.l + (n < 2 ? iw / 2 : iw * i / (n - 1)); }
    function y(v) { return m.t + ih * (1 - v / ax.max); }
    box.textContent = "";
    var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "group", "aria-label": o.aria }, box);
    var defs = s("defs", {}, svg);
    o.series.forEach(function (se, k) {
      if (!se.area) return;
      var g = s("linearGradient", { id: o.id + "-g" + k, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      s("stop", { offset: 0, "stop-color": se.color, "stop-opacity": 0.38 }, g);
      s("stop", { offset: 1, "stop-color": se.color, "stop-opacity": 0 }, g);
    });
    var i;
    for (i = 0; i <= ax.n; i++) {
      var v = ax.step * i, yy = y(v);
      s("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy, "class": "grid" }, svg);
      tx(o.yFmt ? o.yFmt(v) : fmt(v), { x: m.l - 8, y: yy + 4, "text-anchor": "end", "class": "axis" }, svg);
    }
    if (o.band) {
      var bx = x(o.band[0]) - (iw / (n - 1)) / 2, bw = x(o.band[1]) + (iw / (n - 1)) / 2 - bx;
      s("rect", { x: Math.max(m.l, bx), y: m.t, width: Math.min(bw, W - m.r - Math.max(m.l, bx)), height: ih, "class": "band" }, svg);
    }
    var every = W < 520 ? 2 : 1;
    o.labels.forEach(function (lb, idx) {
      if ((n - 1 - idx) % every === 0) tx(lb, { x: x(idx), y: H - 10, "text-anchor": "middle", "class": "axis" }, svg);
    });
    o.series.forEach(function (se, k) {
      var pts = se.values.map(function (val, idx) { return [x(idx), y(val)]; });
      var d = monotone(pts);
      if (se.area) s("path", { d: d + "L" + x(n - 1) + "," + y(0) + "L" + x(0) + "," + y(0) + "Z", fill: "url(#" + o.id + "-g" + k + ")" }, svg);
      s("path", { d: d, fill: "none", stroke: se.color, "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    });
    var s0 = o.series[0], peak = s0.values.indexOf(Math.max.apply(null, s0.values));
    if (o.peak && Math.max.apply(null, s0.values) > 0) {
      tx("Peak " + (o.yFmt ? o.yFmt(s0.values[peak]) : fmt(s0.values[peak])), { x: x(peak), y: y(s0.values[peak]) - 16, "text-anchor": "middle", "class": "peak" }, svg);
    }
    o.series.forEach(function (se, k) {
      se.values.forEach(function (val, idx) {
        var g = s("g", { "class": "pt" + (k === 0 && o.onPoint ? " pt-live" : "") }, svg);
        if (k === 0 && o.onPoint) {
          s("line", { x1: x(idx), x2: x(idx), y1: m.t, y2: m.t + ih, "class": "guide" }, g);
          s("circle", { cx: x(idx), cy: y(val), r: 16, "class": "hit" }, g);
        }
        s("circle", { cx: x(idx), cy: y(val), r: k === 0 ? 4.5 : 3.5, "class": "dot", stroke: se.color }, g);
        if (o.tip) g.setAttribute("data-tip", o.tip(idx, k));
        if (k === 0 && o.onPoint) {
          g.setAttribute("data-key", o.id + idx);
          g.setAttribute("aria-label", o.pointLabel(idx));
          activatable(g, function () { o.onPoint(idx); });
        }
      });
    });
  }

  function renderTrend() {
    var d = subset({ noRange: true }), tot = [], hi = [], i;
    for (i = 0; i < WEEKS; i++) { tot.push(0); hi.push(0); }
    d.forEach(function (t) { tot[t.w]++; if (t.pri <= 1) hi[t.w]++; });
    lineChart($("chart-trend"), {
      id: "trend", labels: WEEK_LABELS, height: 300, peak: true,
      band: state.range < WEEKS ? [WEEKS - state.range, WEEKS - 1] : null,
      series: [{ name: "All tickets", values: tot, color: "#5BA4FF", area: true }, { name: "P1 and P2", values: hi, color: "#FF4D64" }],
      aria: "Tickets per week for the last 12 weeks. Select a point to open details for that week.",
      tip: function (idx, k) {
        return "<strong>Week of " + WEEK_LABELS[idx] + "</strong>" + fmt(tot[idx]) + " tickets" + "<br>" + fmt(hi[idx]) + " P1 and P2" +
          (k === 0 ? "<br><em>Click for details</em>" : "");
      },
      pointLabel: function (idx) { return "Week of " + WEEK_LABELS[idx] + ": " + tot[idx] + " tickets. Open details."; },
      onPoint: openWeek
    });
  }

  /* ---------- Category bars (persistent, animated) ---------- */
  var bars = (function () {
    var box = $("chart-cats"), rows = [], W = 0, barW = 0;
    function build() {
      W = Math.floor(box.clientWidth);
      if (W < 10) return;
      box.textContent = "";
      var rowH = 38, H = CATS.length * rowH, labelW = Math.min(148, Math.round(W * 0.42)), valueW = 44, barX = labelW + 8;
      barW = Math.max(40, W - barX - valueW);
      var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "group", "aria-label": "Tickets by category. Select bars to filter the dashboard." }, box);
      rows = CATS.map(function (c, i) {
        var g = s("g", { "class": "brow", transform: "translate(0 " + i * rowH + ")", "data-key": "cat" + i }, svg);
        s("rect", { x: 0, y: 2, width: W, height: rowH - 4, rx: 6, "class": "brow-bg" }, g);
        tx(c.name, { x: 8, y: rowH / 2 + 4, "class": "blabel" }, g);
        s("rect", { x: barX, y: rowH / 2 - 8, width: barW, height: 16, rx: 4, "class": "btrack" }, g);
        var bar = s("rect", { x: barX, y: rowH / 2 - 8, width: barW, height: 16, rx: 4, fill: c.color, "class": "bbar" }, g);
        var val = tx("0", { x: W - 4, y: rowH / 2 + 4, "text-anchor": "end", "class": "bval" }, g);
        activatable(g, function () { toggle(state.cats, i); });
        return { g: g, bar: bar, val: val };
      });
    }
    function update() {
      if (!rows.length || Math.abs(box.clientWidth - W) > 2) build();
      if (!rows.length) return;
      var d = subset({ noCat: true }), counts = CATS.map(function () { return 0; });
      d.forEach(function (t) { counts[t.cat]++; });
      var max = Math.max(1, Math.max.apply(null, counts)), total = d.length || 1, any = state.cats.size > 0;
      rows.forEach(function (r, i) {
        var sel = state.cats.has(i);
        r.bar.style.transform = "scaleX(" + (counts[i] / max) + ")";
        r.val.textContent = fmt(counts[i]);
        r.g.setAttribute("aria-pressed", sel ? "true" : "false");
        r.g.setAttribute("aria-label", CATS[i].name + ": " + counts[i] + " tickets. " + (sel ? "Selected." : "Select to filter."));
        r.g.setAttribute("data-tip", "<strong>" + CATS[i].name + "</strong>" + fmt(counts[i]) + " tickets (" + pct(counts[i] / total, 0) + ")<br><em>Click to " + (sel ? "remove" : "add") + " filter</em>");
        r.g.classList.toggle("sel", sel);
        r.g.classList.toggle("dim", any && !sel);
      });
    }
    return { update: update, rebuild: function () { rows = []; update(); } };
  })();

  /* ---------- Station map ---------- */
  function renderMap() {
    var box = $("chart-map"), W = Math.max(260, Math.floor(box.clientWidth)), H = 310;
    var d = subset({ noSt: true }), counts = STATIONS.map(function () { return 0; }), top = STATIONS.map(function () { return CATS.map(function () { return 0; }); });
    d.forEach(function (t) { counts[t.st]++; top[t.st][t.cat]++; });
    var maxO = Math.max(1, Math.max.apply(null, counts.slice(1))), any = state.sts.size > 0;
    box.textContent = "";
    var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "group", "aria-label": "Tickets by station. Select a station to filter the dashboard." }, box);
    var cx = W / 2, cy = 150, rx = W / 2 - 46, ry = 100;
    s("ellipse", { cx: cx, cy: cy, rx: rx, ry: ry, "class": "orbit" }, svg);
    s("ellipse", { cx: cx, cy: cy, rx: rx * 0.55, ry: ry * 0.55, "class": "orbit" }, svg);
    var nodes = [];
    for (var i = 1; i < STATIONS.length; i++) {
      var ang = -Math.PI / 2 + ((i - 1) / (STATIONS.length - 1)) * Math.PI * 2;
      nodes.push({ i: i, x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) });
    }
    nodes.forEach(function (nd) {
      var mx = (cx + nd.x) / 2, my = (cy + nd.y) / 2, dx = nd.x - cx, dy = nd.y - cy, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var qx = mx - (dy / len) * 22, qy = my + (dx / len) * 22;
      var wgt = 1 + 3 * (counts[nd.i] / maxO);
      var sel = state.sts.has(nd.i);
      s("path", { d: "M" + cx + "," + cy + "Q" + qx + "," + qy + " " + nd.x + "," + nd.y, "class": "spoke" + (sel ? " on" : ""), "stroke-width": wgt.toFixed(1) }, svg);
      var px = 0.25 * cx + 0.5 * qx + 0.25 * nd.x, py = 0.25 * cy + 0.5 * qy + 0.25 * nd.y;
      var tdx = nd.x - cx, tdy = nd.y - cy, deg = Math.atan2(tdy, tdx) * 180 / Math.PI + 90;
      var pl = s("use", { href: "#plane", x: -7, y: -7, width: 14, height: 14, "class": "spoke-plane", transform: "translate(" + px + " " + py + ") rotate(" + deg + ")" }, svg);
    });
    function node(i, x, y, r, big) {
      var g = s("g", { "class": "snode" + (state.sts.has(i) ? " sel" : "") + (any && !state.sts.has(i) ? " dim" : ""), "data-key": "st" + i }, svg);
      var best = 0;
      top[i].forEach(function (v, k) { if (v > top[i][best]) best = k; });
      s("circle", { cx: x, cy: y, r: r + 8, "class": "shit" }, g);
      s("circle", { cx: x, cy: y, r: r, "class": "sdisc" }, g);
      tx(STATIONS[i].id, { x: x, y: y + (big ? 2 : -1), "text-anchor": "middle", "class": "scode" + (big ? " big" : "") }, g);
      tx(fmt(counts[i]), { x: x, y: y + (big ? 18 : 12), "text-anchor": "middle", "class": "scount" }, g);
      g.setAttribute("aria-pressed", state.sts.has(i) ? "true" : "false");
      g.setAttribute("aria-label", STATIONS[i].name + " (" + STATIONS[i].id + "): " + counts[i] + " tickets. " + (state.sts.has(i) ? "Selected." : "Select to filter."));
      g.setAttribute("data-tip", "<strong>" + STATIONS[i].name + " (" + STATIONS[i].id + ")</strong>" + fmt(counts[i]) + " tickets" + (counts[i] ? "<br>Most common: " + CATS[best].name : "") + "<br><em>Click to " + (state.sts.has(i) ? "remove" : "add") + " filter</em>");
      activatable(g, function () { toggle(state.sts, i); });
    }
    nodes.forEach(function (nd) { node(nd.i, nd.x, nd.y, 17 + 14 * Math.sqrt(counts[nd.i] / maxO), false); });
    node(0, cx, cy, 38, true);
  }

  /* ---------- Heatmap: when tickets arrive ---------- */
  function renderHeat() {
    var box = $("chart-heat"), W = Math.max(280, Math.floor(box.clientWidth));
    var d = subset(), grid = [], r, c;
    for (r = 0; r < 7; r++) { grid.push([0, 0, 0, 0, 0, 0, 0, 0]); }
    d.forEach(function (t) { grid[(t.created.getDay() + 6) % 7][Math.floor(t.created.getHours() / 3)]++; });
    var max = Math.max(1, Math.max.apply(null, grid.map(function (row) { return Math.max.apply(null, row); })));
    var lab = 40, top = 24, cw = (W - lab) / 8, ch = 30, H = top + 7 * ch + 34;
    box.textContent = "";
    var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Heat map of when tickets are created, by weekday and time of day." }, box);
    for (c = 0; c < 8; c++) {
      var hr = c * 3, lbl = hr === 0 ? "12a" : hr < 12 ? hr + "a" : hr === 12 ? "12p" : (hr - 12) + "p";
      if (cw > 34 || c % 2 === 0) tx(lbl, { x: lab + cw * (c + 0.5), y: 14, "text-anchor": "middle", "class": "axis" }, svg);
    }
    for (r = 0; r < 7; r++) {
      tx(DAYS[r], { x: lab - 8, y: top + ch * r + ch / 2 + 4, "text-anchor": "end", "class": "axis" }, svg);
      for (c = 0; c < 8; c++) {
        var v = grid[r][c], f = v / max;
        var rect = s("rect", { x: lab + cw * c + 1.5, y: top + ch * r + 1.5, width: Math.max(2, cw - 3), height: ch - 3, rx: 4, fill: mix("#0F2D5C", "#FF4D64", Math.pow(f, 0.85)), "class": "hcell" }, svg);
        var end = c * 3 + 3;
        rect.setAttribute("data-tip", "<strong>" + DAYS[r] + ", " + (c * 3) + ":00 to " + (end % 24 === 0 ? "24" : end) + ":00</strong>" + fmt(v) + " tickets created");
      }
    }
    var ly = top + 7 * ch + 14, gid = "heat-legend";
    var defs = s("defs", {}, svg), lg = s("linearGradient", { id: gid, x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    s("stop", { offset: 0, "stop-color": "#0F2D5C" }, lg);
    s("stop", { offset: 1, "stop-color": "#FF4D64" }, lg);
    tx("Fewer", { x: lab, y: ly + 10, "class": "axis" }, svg);
    s("rect", { x: lab + 44, y: ly, width: Math.min(160, W - lab - 130), height: 10, rx: 5, fill: "url(#" + gid + ")" }, svg);
    tx("More tickets", { x: lab + 44 + Math.min(160, W - lab - 130) + 8, y: ly + 10, "class": "axis" }, svg);
  }

  /* ---------- Latest tickets table ---------- */
  function renderTable() {
    var d = subset(), rowsEl = $("table-body"), latest = d.slice(-8).reverse();
    rowsEl.textContent = "";
    if (!latest.length) {
      var tr0 = h("tr"), td0 = h("td", "empty", "No tickets match these filters.");
      td0.colSpan = 7; tr0.appendChild(td0); rowsEl.appendChild(tr0);
      return;
    }
    latest.forEach(function (t) {
      var tr = h("tr");
      var when = t.created.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + ("0" + t.created.getHours()).slice(-2) + ":" + ("0" + t.created.getMinutes()).slice(-2);
      var stCls = t.status === "Resolved" ? "ok" : t.status === "Open" ? "hot" : "mid";
      tr.innerHTML = "<td class='mono'>" + t.id + "</td><td>" + when + "</td>" +
        "<td><i class='chip-dot' style='background:" + CATS[t.cat].color + "'></i>" + CATS[t.cat].name + "</td>" +
        "<td>" + STATIONS[t.st].id + "</td>" +
        "<td><span class='pill pP" + t.pri + "'>" + PRI[t.pri] + "</span></td>" +
        "<td><span class='pill " + stCls + "'>" + t.status + "</span></td>" +
        "<td><span class='conf'><span style='width:" + Math.round(t.conf * 100) + "%'></span></span>" + Math.round(t.conf * 100) + "%</td>";
      rowsEl.appendChild(tr);
    });
  }

  /* ---------- Modal ---------- */
  var dlgTitle = $("dlg-title"), dlgSub = $("dlg-sub"), dlgBody = $("dlg-body"), currentModal = null;
  function openModal(o) {
    currentModal = o;
    dlgTitle.textContent = o.title;
    dlgSub.textContent = o.sub || "";
    if (!dlg.open) { dlg.showModal(); document.documentElement.classList.add("no-scroll"); }
    drawModal();
  }
  function drawModal() {
    if (!currentModal) return;
    dlgBody.textContent = "";
    var grid = h("div", "dlg-grid"), chart = h("div", "dlg-chart"), side = h("aside", "dlg-side");
    grid.appendChild(chart); grid.appendChild(side);
    dlgBody.appendChild(grid);
    currentModal.build(chart, side);
  }
  dlg.querySelector(".dlg-close").addEventListener("click", function () { dlg.close(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", function () { currentModal = null; dlgTip.hidden = true; document.documentElement.classList.remove("no-scroll"); });
  dlg.addEventListener("cancel", function () { document.documentElement.classList.remove("no-scroll"); });
  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (dlg.open) drawModal(); }, 150);
  });
  function stats(side, rows) {
    var dl = h("dl", "stats");
    rows.forEach(function (r) { dl.appendChild(h("div", "", "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>")); });
    side.appendChild(dl);
  }
  function applyAndClose(fn) { fn(); dlg.close(); update(); }

  /* Donut */
  function donut(box, side, data, o) {
    var total = sum(data.map(function (d) { return d.value; }));
    var size = Math.min(Math.floor(box.clientWidth) || 320, 380), R = size / 2 - 8, r = R * 0.62, cx = size / 2, cy = size / 2;
    var svg = s("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, role: "group", "aria-label": o.aria, "class": "donut" }, box);
    var cTop = tx(fmt(total), { x: cx, y: cy + 6, "text-anchor": "middle", "class": "dc-big" }, svg);
    var cBot = tx(o.centerLabel, { x: cx, y: cy + 28, "text-anchor": "middle", "class": "dc-small" }, svg);
    var legend = h("ul", "legend"), slices = [], legs = [];
    var a = -Math.PI / 2, live = data.filter(function (d) { return d.value > 0; });
    data.forEach(function (d, idx) {
      var li = h("li", "leg");
      li.innerHTML = "<i style='background:" + d.color + "'></i><span class='leg-name'>" + d.label + "</span><span class='leg-val'>" + fmt(d.value) + "</span><span class='leg-pct'>" + (total ? pct(d.value / total, 0) : "0%") + "</span>";
      legend.appendChild(li); legs.push(li);
      if (o.onPick) activatable(li, function () { o.onPick(d); });
      if (!d.value) return;
      var span = d.value / total * Math.PI * 2, pad = live.length > 1 ? 0.025 : 0;
      var path = s("path", { d: arcPath(cx, cy, r, R, a + pad, a + span - pad), fill: d.color, "class": "slice", "data-i": idx }, svg);
      a += span;
      slices[idx] = path;
      function on() {
        slices.forEach(function (p, j) { if (p) p.classList.toggle("dim", j !== idx); });
        legs.forEach(function (l, j) { l.classList.toggle("dim", j !== idx); });
        cTop.textContent = fmt(d.value); cBot.textContent = d.label + ", " + pct(d.value / total, 0);
      }
      function off() {
        slices.forEach(function (p) { if (p) p.classList.remove("dim"); });
        legs.forEach(function (l) { l.classList.remove("dim"); });
        cTop.textContent = fmt(total); cBot.textContent = o.centerLabel;
      }
      path.addEventListener("pointerenter", on); path.addEventListener("pointerleave", off);
      li.addEventListener("pointerenter", on); li.addEventListener("pointerleave", off);
      path.addEventListener("focus", on); path.addEventListener("blur", off);
      if (o.onPick) {
        path.setAttribute("aria-label", d.label + ": " + d.value + ". Filter the dashboard to this.");
        activatable(path, function () { o.onPick(d); });
      }
    });
    side.appendChild(legend);
    if (o.note) side.appendChild(h("p", "dlg-note", o.note));
    if (o.after) o.after(side);
  }

  /* Histogram of resolution times */
  function histogram(box, vals, medianV, p90V) {
    var edges = [0, 2, 4, 8, 16, 32, 64, Infinity], labels = ["0\u20132", "2\u20134", "4\u20138", "8\u201316", "16\u201332", "32\u201364", "64+"];
    var counts = labels.map(function () { return 0; });
    vals.forEach(function (v) { for (var i = 0; i < labels.length; i++) { if (v >= edges[i] && v < edges[i + 1]) { counts[i]++; break; } } });
    var W = Math.max(280, Math.floor(box.clientWidth)), H = 320, m = { l: 44, r: 12, t: 44, b: 46 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, bw = iw / labels.length, ax = axis(Math.max(1, Math.max.apply(null, counts)), 4);
    var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Histogram of resolution times in hours" }, box);
    for (var i = 0; i <= ax.n; i++) {
      var yy = m.t + ih * (1 - (ax.step * i) / ax.max);
      s("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy, "class": "grid" }, svg);
      tx(fmt(ax.step * i), { x: m.l - 8, y: yy + 4, "text-anchor": "end", "class": "axis" }, svg);
    }
    counts.forEach(function (c, i) {
      var bh = ih * c / ax.max, bx = m.l + i * bw + 5;
      var r = s("rect", { x: bx, y: m.t + ih - bh, width: bw - 10, height: bh, rx: 5, fill: mix("#5BA4FF", "#FF4D64", i / (labels.length - 1)), "class": "hbar" }, svg);
      r.setAttribute("data-tip", "<strong>" + labels[i] + " hours</strong>" + fmt(c) + " tickets (" + pct(c / (vals.length || 1), 0) + ")");
      tx(labels[i], { x: bx + (bw - 10) / 2, y: H - 24, "text-anchor": "middle", "class": "axis" }, svg);
    });
    tx("Hours to resolve", { x: m.l + iw / 2, y: H - 5, "text-anchor": "middle", "class": "axis" }, svg);
    function xpos(v) {
      for (var i = 0; i < labels.length; i++) {
        if (v >= edges[i] && v < edges[i + 1]) {
          var f = isFinite(edges[i + 1]) ? (v - edges[i]) / (edges[i + 1] - edges[i]) : 0.5;
          return m.l + bw * (i + f);
        }
      }
      return m.l;
    }
    var close = Math.abs(xpos(p90V) - xpos(medianV)) < 150;
    [[medianV, "Median " + medianV.toFixed(1) + " h"], [p90V, "90th percentile " + p90V.toFixed(1) + " h"]].forEach(function (mk, k) {
      var px = xpos(mk[0]);
      s("line", { x1: px, x2: px, y1: m.t - 8, y2: m.t + ih, "class": "marker" + (k ? " m2" : "") }, svg);
      tx(mk[1], { x: px - 6, y: m.t - 12 - (k && close ? 16 : 0), "text-anchor": "end", "class": "mlabel" + (k ? " m2" : "") }, svg);
    });
  }

  /* Confusion matrix */
  function confusion(box, data) {
    var n = CATS.length, M = [], r, c;
    for (r = 0; r < n; r++) { M.push([]); for (c = 0; c < n; c++) M[r].push(0); }
    data.forEach(function (t) { M[t.cat][t.pred]++; });
    var rowT = M.map(sum), lab = 50, top = 30, cell = Math.max(30, Math.min(58, Math.floor((box.clientWidth - lab) / n)));
    var W = lab + cell * n, H = top + cell * n + 6;
    var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Confusion matrix. Rows are the true category, columns are the predicted category." }, box);
    for (c = 0; c < n; c++) tx(CATS[c].short, { x: lab + cell * (c + 0.5), y: 20, "text-anchor": "middle", "class": "axis" }, svg);
    for (r = 0; r < n; r++) {
      tx(CATS[r].short, { x: lab - 8, y: top + cell * (r + 0.5) + 4, "text-anchor": "end", "class": "axis" }, svg);
      for (c = 0; c < n; c++) {
        var v = M[r][c], f = rowT[r] ? v / rowT[r] : 0;
        var fill = r === c ? mix("#123A73", "#2EC4B6", f) : mix("#0F2D5C", "#FF4D64", Math.min(1, f * 5));
        var rc = s("rect", { x: lab + cell * c + 1, y: top + cell * r + 1, width: cell - 2, height: cell - 2, rx: 5, fill: fill, "class": "hcell" }, svg);
        rc.setAttribute("data-tip", "<strong>" + (r === c ? "Correct: " : "Mix-up: ") + CATS[r].name + "</strong>" + (r === c ? "" : "Model said " + CATS[c].name + "<br>") + fmt(v) + " tickets (" + pct(f, 0) + " of " + CATS[r].name + ")");
        if (cell >= 34 && v > 0) tx(fmt(v), { x: lab + cell * (c + 0.5), y: top + cell * (r + 0.5) + 4, "text-anchor": "middle", "class": "mtext" }, svg);
      }
    }
    return { M: M, rowT: rowT };
  }

  /* Scatter plot (log y axis) */
  function scatter(box, pts, o) {
    var W = Math.max(280, Math.floor(box.clientWidth)), H = 360, m = { l: 52, r: 16, t: 16, b: 46 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var yMin = 0.3, yMax = Math.max(10, Math.max.apply(null, pts.map(function (p) { return p.y; }).concat([10]))) * 1.3;
    var xMin = 0.55, xMax = 1.0, hidden = new Set();
    function xs(v) { return m.l + iw * (v - xMin) / (xMax - xMin); }
    function ys(v) { return m.t + ih * (1 - (Math.log(v) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin))); }
    var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Scatter plot of resolution hours against classifier confidence, one dot per ticket" }, box);
    [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].forEach(function (v) {
      if (v < yMin || v > yMax) return;
      var yy = ys(v);
      s("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy, "class": "grid" }, svg);
      tx(v + " h", { x: m.l - 8, y: yy + 4, "text-anchor": "end", "class": "axis" }, svg);
    });
    [0.6, 0.7, 0.8, 0.9, 1.0].forEach(function (v) {
      s("line", { x1: xs(v), x2: xs(v), y1: m.t, y2: m.t + ih, "class": "grid" }, svg);
      tx(Math.round(v * 100) + "%", { x: xs(v), y: H - 24, "text-anchor": "middle", "class": "axis" }, svg);
    });
    tx("Classifier confidence", { x: m.l + iw / 2, y: H - 5, "text-anchor": "middle", "class": "axis" }, svg);
    if (pts.length) {
      var med = quantile(pts.map(function (p) { return p.y; }).sort(function (a, b) { return a - b; }), 0.5);
      s("line", { x1: m.l, x2: W - m.r, y1: ys(med), y2: ys(med), "class": "marker" }, svg);
      tx("Median " + med.toFixed(1) + " h", { x: W - m.r - 4, y: ys(med) - 6, "text-anchor": "end", "class": "mlabel" }, svg);
    }
    var dots = pts.map(function (p) {
      var c = s("circle", { cx: xs(p.x), cy: ys(p.y), r: 4, fill: p.color, "class": "sdot" }, svg);
      c.setAttribute("data-tip", "<strong>" + p.id + "</strong>" + p.cat + "<br>" + p.y + " h to resolve<br>" + Math.round(p.x * 100) + "% confidence" + (p.ok ? "" : "<br><em>Model got this one wrong</em>"));
      if (!p.ok) c.setAttribute("stroke", "#fff");
      return c;
    });
    var legend = h("ul", "legend legend-inline");
    CATS.forEach(function (c, i) {
      if (!pts.some(function (p) { return p.catIdx === i; })) return;
      var li = h("li", "leg leg-btn");
      li.innerHTML = "<i style='background:" + c.color + "'></i><span class='leg-name'>" + c.name + "</span>";
      activatable(li, function () {
        if (hidden.has(i)) hidden["delete"](i); else hidden.add(i);
        li.classList.toggle("off", hidden.has(i));
        li.setAttribute("aria-pressed", String(!hidden.has(i)));
        dots.forEach(function (d, k) { d.classList.toggle("gone", hidden.has(pts[k].catIdx)); });
      });
      li.setAttribute("role", "button"); li.setAttribute("aria-pressed", "true");
      legend.appendChild(li);
    });
    return legend;
  }

  /* ---------- Modal content: KPI drill-downs ---------- */
  function openTotal() {
    var d = subset(), counts = CATS.map(function () { return 0; });
    d.forEach(function (t) { counts[t.cat]++; });
    openModal({
      title: "Where the tickets come from",
      sub: fmt(d.length) + " tickets in the last " + state.range + " weeks. Hover a slice for detail, click one to filter the dashboard.",
      build: function (chart, side) {
        if (!d.length) { chart.appendChild(h("p", "dlg-note", "No tickets match the current filters.")); return; }
        donut(chart, side, CATS.map(function (c, i) { return { label: c.name, value: counts[i], color: c.color, i: i }; }), {
          centerLabel: "tickets", aria: "Donut chart of tickets by category",
          onPick: function (x) { applyAndClose(function () { state.cats = new Set([x.i]); }); },
          note: "Clicking a slice replaces the category filter with that category."
        });
      }
    });
  }
  function openBacklog() {
    var d = subset().filter(isOpen), counts = [0, 0, 0, 0];
    d.forEach(function (t) { counts[t.pri]++; });
    var colors = ["#FF4D64", "#FF8A4C", "#FFB020", "#5BA4FF"];
    openModal({
      title: "Open backlog by priority",
      sub: fmt(d.length) + " tickets are open or in progress right now.",
      build: function (chart, side) {
        if (!d.length) { chart.appendChild(h("p", "dlg-note", "Nothing is open for the current filters.")); return; }
        var oldest = Math.max.apply(null, d.map(function (t) { return (NOW - t.created) / 864e5; }));
        var stc = STATIONS.map(function () { return 0; });
        d.forEach(function (t) { stc[t.st]++; });
        var bi = stc.indexOf(Math.max.apply(null, stc));
        donut(chart, side, PRI.map(function (p, i) { return { label: p, value: counts[i], color: colors[i], i: i }; }), {
          centerLabel: "open", aria: "Donut chart of open tickets by priority",
          onPick: function (x) { applyAndClose(function () { state.pris = new Set([x.i]); }); },
          after: function (sd) {
            stats(sd, [["Oldest open ticket", oldest.toFixed(1) + " days"], ["In progress", pct(d.filter(function (t) { return t.status === "In progress"; }).length / d.length, 0)], ["Largest backlog", STATIONS[bi].name + " (" + stc[bi] + ")"]]);
          }
        });
      }
    });
  }
  function openResolution() {
    var d = subset(), sorted = sortedRes(d);
    openModal({
      title: "How long tickets take to resolve",
      sub: sorted.length ? fmt(sorted.length) + " resolved tickets, grouped by hours to resolve." : "No resolved tickets for the current filters.",
      build: function (chart, side) {
        if (!sorted.length) return;
        var med = quantile(sorted, 0.5), p90 = quantile(sorted, 0.9);
        histogram(chart, sorted, med, p90);
        var rows = [["Average", mean(sorted).toFixed(1) + " h"], ["Median", med.toFixed(1) + " h"], ["90th percentile", p90.toFixed(1) + " h"]];
        PRI.forEach(function (p, i) {
          var v = resolvedList(d).filter(function (t) { return t.pri === i; }).map(function (t) { return t.res; }).sort(function (a, b) { return a - b; });
          if (v.length) rows.push(["Median, " + p, quantile(v, 0.5).toFixed(1) + " h"]);
        });
        stats(side, rows);
        side.appendChild(h("p", "dlg-note", "Higher-priority tickets close faster, which is why the long tail is mostly P3 and P4."));
      }
    });
  }
  function openAccuracy() {
    var d = subset();
    openModal({
      title: "Where the classifier gets confused",
      sub: d.length ? "Each row is the true category and each column is what the model predicted. Green is correct, red is a mix-up." : "No tickets match the current filters.",
      build: function (chart, side) {
        if (!d.length) return;
        var res = confusion(chart, d);
        var list = h("ul", "acc-list");
        CATS.forEach(function (c, i) {
          if (!res.rowT[i]) return;
          var a = res.M[i][i] / res.rowT[i];
          list.appendChild(h("li", "", "<span>" + c.name + "</span><b>" + pct(a, 0) + "</b><em><u style='width:" + Math.round(a * 100) + "%;background:" + c.color + "'></u></em>"));
        });
        side.appendChild(h("h3", "side-h", "Accuracy by category"));
        side.appendChild(list);
        side.appendChild(h("p", "dlg-note", "Sample data. The mix-ups are built in on purpose: weather and delays get swapped, and so do gate and crew issues."));
      }
    });
  }
  function openP1() {
    var d = subset({ noRange: true }), share = [], cnt = [], tot = [], i;
    for (i = 0; i < WEEKS; i++) { share.push(0); cnt.push(0); tot.push(0); }
    d.forEach(function (t) { tot[t.w]++; if (t.pri === 0) cnt[t.w]++; });
    for (i = 0; i < WEEKS; i++) share[i] = tot[i] ? +(cnt[i] / tot[i] * 100).toFixed(1) : 0;
    openModal({
      title: "P1 share over time",
      sub: "The share of each week's tickets that were priority 1.",
      build: function (chart, side) {
        lineChart(chart, {
          id: "p1", labels: WEEK_LABELS, height: 320, peak: true, ml: 46,
          series: [{ name: "P1 share", values: share, color: "#FF4D64", area: true }],
          yFmt: function (v) { return v + "%"; }, aria: "Line chart of P1 share by week",
          tip: function (idx) { return "<strong>Week of " + WEEK_LABELS[idx] + "</strong>" + share[idx] + "% P1<br>" + cnt[idx] + " of " + tot[idx] + " tickets"; },
          pointLabel: function (idx) { return "Week of " + WEEK_LABELS[idx] + ": " + share[idx] + " percent P1"; }
        });
        var p1 = d.filter(function (t) { return t.pri === 0; }), cc = CATS.map(function () { return 0; }), sc = STATIONS.map(function () { return 0; });
        p1.forEach(function (t) { cc[t.cat]++; sc[t.st]++; });
        var bc = cc.indexOf(Math.max.apply(null, cc)), bs = sc.indexOf(Math.max.apply(null, sc));
        stats(side, [["P1 tickets, 12 weeks", fmt(p1.length)], ["Most common category", p1.length ? CATS[bc].name : "n/a"], ["Busiest station", p1.length ? STATIONS[bs].name : "n/a"], ["Highest week", Math.max.apply(null, share) + "%"]]);
      }
    });
  }

  /* ---------- Modal content: week detail ---------- */
  function openWeek(w) {
    var d = subset({ noRange: true }).filter(function (t) { return t.w === w; });
    var res = resolvedList(d);
    var start = weekDate(w), end = weekDate(w, 6);
    var range = start.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " to " + end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    openModal({
      title: "Week of " + WEEK_LABELS[w],
      sub: fmt(d.length) + " tickets from " + range + ". Each dot is a resolved ticket: how long it took against how confident the classifier was.",
      build: function (chart, side) {
        if (!res.length) { chart.appendChild(h("p", "dlg-note", "No resolved tickets this week for the current filters.")); return; }
        var pts = res.map(function (t) { return { x: t.conf, y: t.res, color: CATS[t.cat].color, cat: CATS[t.cat].name, catIdx: t.cat, id: t.id, ok: t.pred === t.cat }; });
        var legend = scatter(chart, pts, {});
        chart.appendChild(legend);
        var cc = CATS.map(function () { return 0; });
        d.forEach(function (t) { cc[t.cat]++; });
        var bc = cc.indexOf(Math.max.apply(null, cc)), sorted = sortedRes(d);
        stats(side, [
          ["Tickets", fmt(d.length)],
          ["Resolved", fmt(res.length) + " (" + pct(res.length / d.length, 0) + ")"],
          ["Median resolution", quantile(sorted, 0.5).toFixed(1) + " h"],
          ["Classifier accuracy", pct(accuracy(d), 1)],
          ["Top category", CATS[bc].name + " (" + pct(cc[bc] / d.length, 0) + ")"],
          ["P1 tickets", fmt(d.filter(function (t) { return t.pri === 0; }).length)]
        ]);
        side.appendChild(h("p", "dlg-note", "Dots with a white outline are tickets the model labeled wrong. Click a category in the legend to hide or show it."));
      }
    });
  }

  /* ---------- Wiring ---------- */
  var started = false, lastW = {};
  function restoreFocus(key) {
    if (!key) return;
    var el = root.querySelector('[data-key="' + key + '"]');
    if (el) el.focus({ preventScroll: true });
  }
  function update() {
    var ae = document.activeElement, key = ae && ae.getAttribute ? ae.getAttribute("data-key") : null;
    renderKpis(); renderFilterbar(); bars.update(); renderMap(); renderHeat(); renderTrend(); renderTable();
    restoreFocus(key);
  }
  function start() {
    buildKpis();
    buildPriorityToggles();
    $("reset").addEventListener("click", function () { state.cats.clear(); state.sts.clear(); state.pris.clear(); update(); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-range]"), function (b) {
      b.addEventListener("click", function () { state.range = +b.getAttribute("data-range"); update(); });
    });
    update();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function (entries) {
        var changed = false;
        entries.forEach(function (en) {
          var w = Math.round(en.contentRect.width);
          if (w > 0 && Math.abs((lastW[en.target.id] || 0) - w) > 2) { lastW[en.target.id] = w; changed = true; }
        });
        if (changed) update();
      });
      ["chart-trend", "chart-cats", "chart-map", "chart-heat"].forEach(function (id) { ro.observe($(id)); });
    }
  }
  window.initDashboard = function () {
    if (!started) { started = true; start(); } else { update(); }
  };
})();
