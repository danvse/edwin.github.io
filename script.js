(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Split-flap codes on the boarding pass ---------- */
  function buildFlap(el) {
    var text = el.getAttribute("data-text");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", el.getAttribute("data-label") || text);
    el.textContent = "";
    return text.split("").map(function (ch) {
      var cell = document.createElement("span");
      cell.className = "cell";
      cell.setAttribute("aria-hidden", "true");
      cell.textContent = ch;
      el.appendChild(cell);
      return cell;
    });
  }

  function flipTo(cell, target, startDelay, ticks) {
    var count = 0;
    setTimeout(function tick() {
      count += 1;
      var last = count >= ticks;
      cell.textContent = last ? target : LETTERS[Math.floor(Math.random() * LETTERS.length)];
      if (cell.animate) {
        cell.animate(
          [{ transform: "scaleY(1)" }, { transform: "scaleY(0.2)" }, { transform: "scaleY(1)" }],
          { duration: 70 }
        );
      }
      if (!last) setTimeout(tick, 70);
    }, startDelay);
  }

  document.querySelectorAll(".flap").forEach(function (el) {
    var cells = buildFlap(el);
    if (el.hasAttribute("data-animate") && !reduceMotion) {
      var text = el.getAttribute("data-text");
      cells.forEach(function (cell, i) {
        flipTo(cell, text[i], 400 + i * 180, 9 + i * 5);
      });
    }
  });

  /* ---------- Barcode on the boarding pass stub ---------- */
  var barcode = document.getElementById("barcode");
  if (barcode) {
    var seed = 0;
    "EDWIN LIN 2026".split("").forEach(function (ch) {
      seed = (Math.imul(31, seed) + ch.charCodeAt(0)) | 0;
    });
    if (seed === 0) seed = 1;
    var rand = function () {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 1000) / 1000;
    };
    var ns = "http://www.w3.org/2000/svg";
    var x = 0;
    while (x < 320) {
      var w = 1 + Math.floor(rand() * 4);
      var gap = 1 + Math.floor(rand() * 3);
      if (x + w > 320) w = 320 - x;
      var bar = document.createElementNS(ns, "rect");
      bar.setAttribute("x", x);
      bar.setAttribute("y", 0);
      bar.setAttribute("width", w);
      bar.setAttribute("height", 52);
      bar.setAttribute("fill", "#0F1B2D");
      barcode.appendChild(bar);
      x += w + gap;
    }
  }

  /* ---------- Gauge tick marks ---------- */
  var ticks = document.getElementById("ticks");
  if (ticks) {
    var svgNs = "http://www.w3.org/2000/svg";
    for (var i = 0; i <= 10; i++) {
      var t = (i * Math.PI) / 10;
      var line = document.createElementNS(svgNs, "line");
      line.setAttribute("x1", (100 - 90 * Math.cos(t)).toFixed(2));
      line.setAttribute("y1", (100 - 90 * Math.sin(t)).toFixed(2));
      line.setAttribute("x2", (100 - 98 * Math.cos(t)).toFixed(2));
      line.setAttribute("y2", (100 - 98 * Math.sin(t)).toFixed(2));
      ticks.appendChild(line);
    }
  }

  /* ---------- Map focus follows the experience cards ---------- */
  var map = document.getElementById("map");
  var caption = document.getElementById("map-caption");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".stop[data-stop]"));

  var GROUPS = {
    delta: ["hub", "delta"],
    "gsu-it": ["hub", "gsu"],
    eh: ["hub"],
    edu: ["hub"],
    all: null
  };
  var CAPTIONS = {
    delta: "Delta Air Lines, Atlanta (Jan to Aug 2026)",
    "gsu-it": "Georgia State campuses: Alpharetta, Clarkston, Dunwoody, Decatur",
    eh: "Enterprise Hall, Atlanta (Oct to Dec 2022)",
    edu: "Georgia State University, Atlanta",
    all: "The Atlanta area: work and study"
  };

  function setFocus(key) {
    if (!map) return;
    map.setAttribute("data-focus", key);
    var on = GROUPS[key];
    map.querySelectorAll("[data-group]").forEach(function (el) {
      var lit = on === null || on.indexOf(el.getAttribute("data-group")) !== -1;
      el.classList.toggle("is-lit", lit);
    });
    if (caption) caption.textContent = CAPTIONS[key];
  }

  function activate(card) {
    cards.forEach(function (c) { c.classList.toggle("is-active", c === card); });
    setFocus(card.getAttribute("data-stop"));
  }

  if (map && cards.length) {
    var desktop = window.matchMedia("(min-width: 900px)");

    var observer = new IntersectionObserver(function (entries) {
      if (!desktop.matches) return;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) activate(entry.target);
      });
    }, { rootMargin: "-45% 0px -45% 0px" });

    cards.forEach(function (c) { observer.observe(c); });

    var sync = function () {
      if (desktop.matches) {
        activate(cards[0]);
      } else {
        cards.forEach(function (c) { c.classList.remove("is-active"); });
        setFocus("all");
      }
    };
    if (desktop.addEventListener) desktop.addEventListener("change", sync);
    else if (desktop.addListener) desktop.addListener(sync);
    sync();
  }

  /* ---------- Respect reduced motion for the map plane ---------- */
  if (reduceMotion) {
    document.querySelectorAll("animateMotion").forEach(function (el) { el.remove(); });
    var plane = document.querySelector(".plane > g");
    if (plane) plane.setAttribute("transform", "translate(62 498)");
  }

  /* ---------- Tabs: portfolio and dashboard demo ---------- */
  var viewP = document.getElementById("view-portfolio");
  var viewD = document.getElementById("view-dashboard");
  var navD = document.getElementById("nav-dashboard");
  var onDash = false;

  function route() {
    if (!viewP || !viewD) return;
    var hash = window.location.hash;
    if (hash === "#main") {
      var m = document.getElementById(onDash ? "dashboard-main" : "main");
      if (m) { m.setAttribute("tabindex", "-1"); m.focus(); }
      return;
    }
    onDash = hash === "#dashboard";
    viewP.hidden = onDash;
    viewD.hidden = !onDash;
    if (navD) {
      if (onDash) navD.setAttribute("aria-current", "page");
      else navD.removeAttribute("aria-current");
    }
    document.title = onDash ? "Dashboard demo | Edwin Lin" : "Edwin Lin | Software Developer";
    if (onDash) {
      window.scrollTo(0, 0);
      if (window.initDashboard) window.initDashboard();
    } else if (hash.length > 1) {
      var target = document.getElementById(hash.slice(1));
      if (target) requestAnimationFrame(function () { target.scrollIntoView(); });
    }
  }
  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", route);
})();
