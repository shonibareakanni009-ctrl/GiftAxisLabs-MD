const fileServer = require("../../lib/fileServer");
const config = require("../../config");
const axios = require("axios");
const LANGS = {
  js: "javascript", javascript: "javascript", py: "python", python: "python",
  ts: "typescript", rb: "ruby", ruby: "ruby", go: "go", rs: "rust", rust: "rust",
  cpp: "c++", c: "c", java: "java", php: "php", cs: "csharp", swift: "swift",
  kt: "kotlin", kotlin: "kotlin", sh: "bash", bash: "bash", r: "r",
  lua: "lua", perl: "perl", scala: "scala", haskell: "haskell", elixir: "elixir"
};
module.exports = {
  name: "run", alias: ["exec","code","runcode"],
  description: "Run code in 20+ languages (Piston API)",
  category: "dev",
  async execute(sock, m, args, reply) {
    const lang = LANGS[(args[0]||"").toLowerCase()];
    const code = args.slice(1).join(" ").replace(/```/g,"").trim()
                 || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
    if (!lang || !code) return reply(
      "Usage: .run <language> <code>\nExample: .run js console.log('Hello!')\n\n" +
      "Supported: js, py, go, rust, cpp, c, java, php, rb, ts, cs, swift, kt, sh, lua, perl, r, scala, haskell, elixir"
    );
    reply("⚙️ Running " + lang + " code...");
    try {
      const res = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language: lang, version: "*",
        files: [{ content: code }]
      }, { timeout: 20000 });
      const out = res.data?.run;
      const stdout = (out?.stdout||"").trim();
      const stderr = (out?.stderr||"").trim();
      const output = stdout || stderr || "(no output)";
      const limited = output.length > 2000 ? output.slice(0,2000)+"\n...(truncated)" : output;
      try {
        const served = await fileServer.serveCodePage(code, lang, "Code Run — "+lang);
        reply("📎 *Download code:* " + served.url + config.footer);
      } catch(e) {}
      reply("┌ ❏ ◆ ⌜⚙️ 𝗖𝗢𝗗𝗘 𝗢𝗨𝗧𝗣𝗨𝗧⌟ ◆\n│\n" +
        "├◆ 🌐 Language: " + lang + "\n" +
        "├◆ ⏱️ Exit: " + (out?.code||0) + "\n│\n" +
        "```\n" + limited + "\n```\n└ ❏" + config.footer);
    } catch(e) { reply("❌ Execution failed: " + e.message); }
  }
};
