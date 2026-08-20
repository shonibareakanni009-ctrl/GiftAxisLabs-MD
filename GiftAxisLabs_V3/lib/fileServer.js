

const fs    = require("fs-extra");
const path  = require("path");
const crypto = require("crypto");
const ngrok = require("./ngrokManager");

const GEN_DIR = path.join(__dirname, "../public/generated");
fs.ensureDirSync(GEN_DIR);

setInterval(() => {
    try {
        const files = fs.readdirSync(GEN_DIR);
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        files.forEach(f => {
            const fp = path.join(GEN_DIR, f);
            const stat = fs.statSync(fp);
            if (stat.mtimeMs < cutoff) fs.removeSync(fp);
        });
    } catch(e) {}
}, 60 * 60 * 1000); // run every hour


async function serveFile(content, filename, opts = {}) {
    const safe = filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    const id   = crypto.randomBytes(4).toString("hex");
    const name = `${id}_${safe}`;
    const filePath = path.join(GEN_DIR, name);

    await fs.writeFile(filePath, content, "utf8");

    const base = ngrok.getUrl() || "http://localhost:3000";
    const url  = `${base}/generated/${name}`;
    const downloadUrl = opts.allowDownload ? `${url}?download=1` : null;

    return { url, downloadUrl, filename: name, localPath: filePath };
}


async function serveBuffer(buffer, filename) {
    const safe = filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    const id   = crypto.randomBytes(4).toString("hex");
    const name = `${id}_${safe}`;
    const filePath = path.join(GEN_DIR, name);

    await fs.writeFile(filePath, buffer);

    const base = ngrok.getUrl() || "http://localhost:3000";
    const url  = `${base}/generated/${name}`;
    return { url, filename: name, localPath: filePath };
}


async function serveLabPage(lab, groupName = "GiftAxis Lab") {
    const html = buildLabHTML(lab, groupName);
    return serveFile(html, `lab_${lab.title.replace(/\s+/g,"_").slice(0,30)}.html`);
}


async function serveInvoicePage(data) {
    const html = buildInvoiceHTML(data);
    return serveFile(html, `invoice_${data.invoiceNo}.html`, { allowDownload: true });
}


async function serveCodePage(code, language, title = "Code Output") {
    const html = buildCodeHTML(code, language, title);
    return serveFile(html, `code_${title.replace(/\s+/g,"_").slice(0,20)}.html`, { allowDownload: true });
}


function buildLabHTML(lab, groupName) {
    const sections = [
        { icon: "📖", title: "Concept", content: lab.concept },
        { icon: "💡", title: "Example", content: `<pre><code class="language-js">${esc(lab.example)}</code></pre>`, raw: true },
        { icon: "🎯", title: "Challenge", content: lab.challenge },
        { icon: "💬", title: "Hints", content: (lab.hints||[]).map((h,i)=>`<li>Hint ${i+1}: ${h}</li>`).join(""), list: true },
        { icon: "🧪", title: "Test Cases", content: (lab.testCases||[]).map(t=>`<li><code>${esc(t.input||"")}</code> → <code>${esc(t.expected||"")}</code></li>`).join(""), list: true },
        { icon: "✅", title: "Solution", content: `<pre><code class="language-js">${esc(lab.solution)}</code></pre>`, raw: true, collapsed: true },
        { icon: "🚀", title: "Bonus Challenge", content: lab.bonus || "Try extending your solution with your own twist!" },
    ];

    const sectionsHTML = sections.map(s => `
        <div class="section ${s.collapsed?"collapsed":""}">
            <div class="section-header" onclick="toggleSection(this)">
                <span>${s.icon} ${s.title}</span>
                <span class="toggle-icon">${s.collapsed?"▼":"▲"}</span>
            </div>
            <div class="section-body">
                ${s.raw ? s.content : s.list ? `<ul>${s.content}</ul>` : `<p>${s.content}</p>`}
            </div>
        </div>`).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${lab.title} — GiftAxis Lab</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh}
  .header{background:linear-gradient(135deg,#1a1f2e,#0d1117);border-bottom:1px solid #30363d;padding:24px 20px;text-align:center}
  .badge{display:inline-block;background:#58a6ff22;border:1px solid #58a6ff44;color:#58a6ff;padding:4px 12px;border-radius:20px;font-size:12px;margin-bottom:12px}
  h1{font-size:clamp(1.4rem,4vw,2rem);font-weight:700;background:linear-gradient(90deg,#58a6ff,#bc8cff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .meta{color:#8b949e;font-size:13px;margin-top:8px}
  .container{max-width:800px;margin:0 auto;padding:20px}
  .section{background:#161b22;border:1px solid #30363d;border-radius:12px;margin-bottom:16px;overflow:hidden}
  .section-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;cursor:pointer;font-weight:600;font-size:15px;background:#1c2128;transition:background .2s}
  .section-header:hover{background:#252b33}
  .toggle-icon{color:#8b949e;font-size:12px}
  .section-body{padding:18px;line-height:1.7;font-size:14px}
  .section.collapsed .section-body{display:none}
  pre{border-radius:8px;overflow:auto;margin:0}
  code{font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px}
  ul{padding-left:20px;line-height:2}
  p{color:#c9d1d9}
  .editor-section{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;margin-bottom:16px}
  .editor-section h3{color:#58a6ff;margin-bottom:12px;font-size:15px}
  textarea{width:100%;height:200px;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:12px;font-family:'JetBrains Mono',monospace;font-size:13px;resize:vertical;outline:none}
  textarea:focus{border-color:#58a6ff}
  .btn{background:linear-gradient(135deg,#58a6ff,#bc8cff);color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;margin-right:8px;transition:opacity .2s}
  .btn:hover{opacity:.85}
  .btn.secondary{background:#21262d;border:1px solid #30363d;color:#c9d1d9}
  .output{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px;margin-top:12px;font-family:monospace;font-size:13px;min-height:60px;color:#3fb950;white-space:pre-wrap}
  .footer{text-align:center;padding:24px;color:#6e7681;font-size:12px;border-top:1px solid #21262d;margin-top:20px}
  .diff-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;margin-left:8px}
  .easy{background:#1a3a1a;color:#3fb950}.medium{background:#3a2d0d;color:#d29922}.hard{background:#3a1a1a;color:#f85149}
</style>
</head>
<body>
<div class="header">
  <div class="badge">📚 ${groupName} Coding Lab</div>
  <h1>${lab.title}</h1>
  <div class="meta">
    Language: ${lab.language || "JavaScript"} &nbsp;|&nbsp;
    Difficulty: <span class="diff-badge ${(lab.difficulty||"medium").toLowerCase()}">${lab.difficulty||"Medium"}</span> &nbsp;|&nbsp;
    XP: ⭐ ${lab.xp || 50}
  </div>
</div>
<div class="container">
  ${sectionsHTML}
  <div class="editor-section">
    <h3>✏️ Try It Here</h3>
    <textarea id="code-editor" placeholder="Write your solution here..."></textarea>
    <div style="margin-top:10px">
      <button class="btn" onclick="runCode()">▶ Run Code</button>
      <button class="btn secondary" onclick="clearOutput()">🗑 Clear</button>
    </div>
    <div class="output" id="output">// Output will appear here</div>
  </div>
</div>
<div class="footer">
  Generated by <strong>Gift Axis Labs™</strong> &nbsp;•&nbsp; ${new Date().toLocaleDateString()} &nbsp;•&nbsp; Powered by Gemini AI
</div>
<script>
hljs.highlightAll();
function toggleSection(el) {
  el.parentElement.classList.toggle("collapsed");
  el.querySelector(".toggle-icon").textContent = el.parentElement.classList.contains("collapsed") ? "▼" : "▲";
}
function runCode() {
  const code = document.getElementById("code-editor").value;
  const out = document.getElementById("output");
  const logs = [];
  const fakeConsole = { log:(...a)=>logs.push(a.map(String).join(" ")), error:(...a)=>logs.push("ERROR: "+a.join(" ")), warn:(...a)=>logs.push("WARN: "+a.join(" ")) };
  try {
    const fn = new Function("console", code);
    fn(fakeConsole);
    out.style.color = "#3fb950";
    out.textContent = logs.length ? logs.join("\\n") : "(no output)";
  } catch(e) {
    out.style.color = "#f85149";
    out.textContent = "Error: " + e.message;
  }
}
function clearOutput() { document.getElementById("output").textContent = "// Output will appear here"; document.getElementById("output").style.color="#3fb950"; }
</script>
</body></html>`;
}

function buildCodeHTML(code, language, title) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — GiftAxis Code</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh;padding:20px}
.header{text-align:center;padding:30px 20px;border-bottom:1px solid #30363d;margin-bottom:24px}
h1{font-size:1.5rem;background:linear-gradient(90deg,#58a6ff,#3fb950);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.meta{color:#8b949e;font-size:13px;margin-top:8px}
.container{max-width:900px;margin:0 auto}
.toolbar{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.btn{background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;transition:background .2s}
.btn:hover{background:#30363d}.btn.primary{background:#1f6feb;border-color:#388bfd;color:#fff}
pre{background:#161b22!important;border:1px solid #30363d;border-radius:12px;padding:20px;overflow:auto;font-size:13px;line-height:1.6}
.footer{text-align:center;padding:24px;color:#6e7681;font-size:12px;margin-top:20px}
</style>
</head>
<body>
<div class="header">
  <h1>⚙️ ${esc(title)}</h1>
  <div class="meta">Language: ${esc(language)} &nbsp;•&nbsp; Generated by Gift Axis Labs™</div>
</div>
<div class="container">
  <div class="toolbar">
    <button class="btn primary" onclick="copyCode()">📋 Copy Code</button>
    <button class="btn" onclick="downloadCode()">⬇️ Download</button>
  </div>
  <pre><code class="language-${esc(language)}">${esc(code)}</code></pre>
</div>
<div class="footer">Gift Axis Labs™ &nbsp;•&nbsp; ${new Date().toLocaleDateString()}</div>
<script>
hljs.highlightAll();
function copyCode() { navigator.clipboard.writeText(document.querySelector("code").innerText).then(()=>{const b=event.target;b.textContent="✅ Copied!";setTimeout(()=>b.textContent="📋 Copy Code",2000)}); }
function downloadCode() {
  const blob = new Blob([document.querySelector("code").innerText],{type:"text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "${esc(title.replace(/\s+/g,"_"))}.${esc(language)}";
  a.click();
}
</script>
</body></html>`;
}

function buildInvoiceHTML(data) {
    const rows = data.items.map(i =>
        `<tr><td>${esc(i.name)}</td><td>${esc(String(i.qty||1))}</td><td>₦${Number(i.price).toLocaleString()}</td><td>₦${(Number(i.price)*(i.qty||1)).toLocaleString()}</td></tr>`
    ).join("");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(data.invoiceNo)} — GiftAxis</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#1a1a2e;max-width:700px;margin:0 auto;padding:40px 24px}
@media print{body{padding:0}}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid #6366f1;margin-bottom:28px}
.brand{font-size:1.4rem;font-weight:800;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.inv-meta{text-align:right;font-size:13px;color:#6b7280}
.inv-num{font-size:1.1rem;font-weight:700;color:#6366f1}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;background:#f8fafc;border-radius:12px;padding:20px}
.party h4{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px}
.party p{font-size:14px;color:#374151;line-height:1.6}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#6366f1;color:#fff;padding:12px 14px;text-align:left;font-size:13px;font-weight:600}
td{padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
tr:hover td{background:#f8fafc}
.totals{margin-left:auto;width:260px;border-top:2px solid #e5e7eb;padding-top:12px}
.total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
.total-row.grand{font-size:1rem;font-weight:700;color:#6366f1;border-top:2px solid #6366f1;margin-top:8px;padding-top:10px}
.footer{margin-top:40px;text-align:center;color:#9ca3af;font-size:12px;border-top:1px solid #f1f5f9;padding-top:20px}
.btn{display:inline-block;margin:20px 8px 0;padding:10px 22px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;text-decoration:none}
.btn.outline{background:transparent;border:2px solid #6366f1;color:#6366f1}
@media print{.btn{display:none}}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">🏦 Gift Axis Labs™</div>
    <div style="font-size:13px;color:#6b7280;margin-top:4px">Professional Invoice</div>
  </div>
  <div class="inv-meta">
    <div class="inv-num">Invoice #${esc(data.invoiceNo)}</div>
    <div>Date: ${esc(data.date)}</div>
    <div>Due: ${esc(data.due||data.date)}</div>
  </div>
</div>
<div class="parties">
  <div class="party"><h4>From</h4><p><strong>${esc(data.from||"Gift Axis Labs™")}</strong></p></div>
  <div class="party"><h4>Bill To</h4><p><strong>${esc(data.client)}</strong></p></div>
</div>
<table>
  <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span>Subtotal</span><span>₦${Number(data.subtotal).toLocaleString()}</span></div>
  <div class="total-row"><span>VAT (7.5%)</span><span>₦${Number(data.tax).toFixed(2)}</span></div>
  <div class="total-row grand"><span>TOTAL</span><span>₦${Number(data.total).toLocaleString()}</span></div>
</div>
<div style="margin-top:28px;text-align:right">
  <button class="btn" onclick="window.print()">🖨️ Print</button>
  <button class="btn outline" onclick="saveAsPDF()">💾 Save PDF</button>
</div>
<div class="footer">Thank you for your business! &nbsp;•&nbsp; Powered by Gift Axis Labs™</div>
<script>function saveAsPDF(){window.print()}</script>
</body></html>`;
}

function esc(s) {
    return String(s||"")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

module.exports = { serveFile, serveBuffer, serveLabPage, serveInvoicePage, serveCodePage };
