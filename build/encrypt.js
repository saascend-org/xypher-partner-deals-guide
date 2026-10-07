#!/usr/bin/env node
/*
 * DXR Cyber partner-deals guide — static-site encryptor (copied from partner-portal/build/encrypt.js).
 *
 * Reads build/index.plain.html (all CSS/JS inlined by build/inline.py), gzips it, encrypts it
 * with AES-256-GCM under a PBKDF2-SHA256(600k) key and writes the password gate to index.html.
 * Only the gate is committed (.gitignore drops the plaintext sources), so GitHub Pages never
 * serves the guide in the clear.
 *
 *   python3 build/build_plain.py && printf %s "$PW" | node build/encrypt.js -
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

let PASSWORD = process.argv[2];
if (PASSWORD === "-") PASSWORD = fs.readFileSync(0, "utf8").replace(/\r?\n$/, "");
if (!PASSWORD) { console.error('usage: node build/encrypt.js -   (password on stdin)'); process.exit(1); }

const ITER = 600000;

const T = {
  title: "Partner deals in Salesforce",
  sub: "This guide shows live DXR Cyber pipeline data. Enter the access password to continue.",
  foot: "Do not forward this link or the password.",
};
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "build", "index.plain.html");
const OUT = path.join(ROOT, "index.html");

const plain = fs.readFileSync(SRC);
const gz    = zlib.gzipSync(plain, { level: 9 });

const salt = crypto.randomBytes(16);
const iv   = crypto.randomBytes(12);
const key  = crypto.pbkdf2Sync(PASSWORD, salt, ITER, 32, "sha256");
const c    = crypto.createCipheriv("aes-256-gcm", key, iv);
const ct   = Buffer.concat([c.update(gz), c.final()]);
const tag  = c.getAuthTag();                       // WebCrypto wants ct||tag
const payload = Buffer.concat([ct, tag]).toString("base64");

const page = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<title>${T.title}</title>
<link rel="icon" href="assets/marker.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:#fff;color:#2b303a;font:400 16px/1.5 "Instrument Sans",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden}
body:before,body:after{content:"";position:fixed;transform:skewX(-28deg);pointer-events:none}
body:before{width:190px;height:360px;right:12%;top:-80px;background:#a6ff33}
body:after{width:46px;height:240px;right:5%;bottom:-40px;background:#00ffff}
.card{width:100%;max-width:420px;position:relative;z-index:1;background:#fff;border-radius:26px;padding:34px;box-shadow:0 18px 50px rgba(29,29,27,.12),inset 0 0 0 1.5px rgba(43,48,58,.1)}
.rule{display:none}
h1{margin:0 0 8px;font-size:30px;font-weight:700;color:#1d1d1b;letter-spacing:-.02em}
p.sub{margin:0 0 24px;color:#5d626c;font-size:15px}
label{display:block;margin:0 0 7px;font-size:13px;font-weight:600;color:#5d626c}
input{width:100%;padding:12px 18px;font:inherit;color:#2b303a;background:#fff;border:1.5px solid rgba(43,48,58,.22);border-radius:1440px}
input:focus{outline:none;border-color:#2b303a;box-shadow:0 0 0 4px rgba(166,255,51,.45)}
button{width:100%;margin-top:12px;padding:12px;font:inherit;font-weight:600;letter-spacing:.5px;font-size:15px;color:#2b303a;background:#a6ff33;border:0;border-radius:1440px;cursor:pointer;transition:all .25s}
button:hover:not(:disabled){background:#1d1d1b;color:#a6ff33}
button:disabled{opacity:.6;cursor:default}
.msg{min-height:19px;margin-top:12px;font-size:14px;color:#c03a3a}
.foot{margin-top:26px;padding-top:16px;border-top:1px solid rgba(43,48,58,.12);color:#8a8e96;font-size:12.5px;line-height:1.6}
</style>
</head>
<body>
<main class="card">
  <img src="assets/logo_black.png" alt="DXR Cyber" style="width:150px;height:auto;margin:0 0 26px;display:block"><div class="rule"></div>
  <h1>${T.title}</h1>
  <p class="sub">${T.sub}</p>
  <form id="f" autocomplete="off">
    <label for="pw">Password</label>
    <input id="pw" type="password" autocomplete="current-password" autofocus>
    <button id="go" type="submit">Unlock</button>
  </form>
  <div class="msg" id="msg" role="status" aria-live="polite"></div>
  <div class="foot">SaaScend &middot; DXR Cyber Salesforce enablement. ${T.foot}</div>
</main>
<script>
(function () {
  var SALT = "${salt.toString("base64")}";
  var IV   = "${iv.toString("base64")}";
  var ITER = ${ITER};
  var DATA = "${payload}";

  var f = document.getElementById("f"), pw = document.getElementById("pw"),
      go = document.getElementById("go"), msg = document.getElementById("msg");

  function b64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  if (!(window.crypto && crypto.subtle && window.DecompressionStream)) {
    msg.textContent = "This browser is too old to open the page. Please use an up-to-date Chrome, Edge, Safari or Firefox.";
    go.disabled = true; pw.disabled = true; return;
  }

  async function unlock(password) {
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password),
      "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64(SALT), iterations: ITER, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(IV) }, key, b64(DATA));
    var stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }

  function show(html) {
    document.open();
    document.write(html);
    document.close();
  }

  async function attempt(password, fromSession) {
    go.disabled = true; pw.disabled = true;
    msg.style.color = "#5d626c";
    msg.textContent = "Unlocking\\u2026";
    try {
      var html = await unlock(password);
      try { sessionStorage.setItem("dxrpartnerguide", password); } catch (_) {}
      show(html);
    } catch (_) {
      if (fromSession) { try { sessionStorage.removeItem("dxrpartnerguide"); } catch (_) {} }
      msg.style.color = "#c03a3a";
      msg.textContent = "That password did not work. Check it and try again.";
      go.disabled = false; pw.disabled = false; pw.value = ""; pw.focus();
    }
  }

  function submit(e) {
    if (e) e.preventDefault();
    if (pw.value && !go.disabled) attempt(pw.value, false);
  }
  f.addEventListener("submit", submit);
  go.addEventListener("click", submit);
  pw.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.keyCode === 13) submit(e);
  });

  var saved = null;
  try { saved = sessionStorage.getItem("dxrpartnerguide"); } catch (_) {}
  if (saved) attempt(saved, true);
})();
</script>
</body>
</html>
`;

/* GUARD (from the Pricing Desk). OUT is always __dirname/site/<file>, so ANY invocation from the project directory
 * overwrites the published gate — including a test run with a throwaway password, which would
 * lock the live site behind a string nobody knows. Keep one backup of whatever was there, so a
 * mistaken run is one `mv` from recovery. (It cost us exactly this on 2026-09-04.) */
if (fs.existsSync(OUT)) {
  fs.copyFileSync(OUT, OUT + ".bak");
  console.log("backed up   ", OUT + ".bak");
}
fs.writeFileSync(OUT, page);

/* Prove the file we just wrote actually opens with the password we were given, rather than
 * trusting that it does. Cheap, and it catches a broken payload before anyone pushes it. */
(async () => {
  const k = crypto.pbkdf2Sync(PASSWORD, salt, ITER, 32, "sha256");
  const d = crypto.createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  const out = zlib.gunzipSync(Buffer.concat([d.update(ct), d.final()]));
  if (!out.equals(plain)) throw new Error("round-trip check FAILED — do not push this file");
  console.log("round-trip  ", "decrypts back to the plaintext with the given password");
})().catch(e => { console.error(String(e.message || e)); process.exit(1); });
console.log("plaintext   ", plain.length.toLocaleString(), "bytes");
console.log("gzipped     ", gz.length.toLocaleString(), "bytes");
console.log("wrote       ", OUT, "(" + fs.statSync(OUT).size.toLocaleString() + " bytes)");
console.log("pbkdf2 iters", ITER.toLocaleString());
