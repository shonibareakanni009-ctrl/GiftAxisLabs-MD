const config = require("../../config");
const fs = require("fs-extra");
const path = require("path");
const CDOWN_FILE = path.join(__dirname, "../../data/countdowns.json");
async function getCD() { await fs.ensureFile(CDOWN_FILE); return fs.readJson(CDOWN_FILE).catch(()=>({})); }
async function saveCD(db) { await fs.writeJson(CDOWN_FILE, db); }
module.exports = {
  name: "countdown", alias: ["timer2","event","eventcount"],
  description: "Set a countdown to an event",
  category: "productivity",
  async execute(sock, m, args, reply) {
    const sender = m.key.participant || m.key.remoteJid;
    const sub = (args[0]||"").toLowerCase();
    const db = await getCD();
    if (sub==="list"||sub==="all") {
      const mine = Object.entries(db).filter(([k])=>k.startsWith(sender));
      if (!mine.length) return reply("No countdowns set. Use .countdown <DD/MM/YYYY> <Event Name>");
      const rows = mine.map(([,cd])=>{
        const left = cd.target - Date.now();
        if(left<0) return "├◆ ✅ " + cd.name + " (passed)";
        const d=Math.floor(left/86400000),h=Math.floor((left%86400000)/3600000),m2=Math.floor((left%3600000)/60000);
        return "├◆ ⏰ " + cd.name + ": " + d + "d " + h + "h " + m2 + "m";
      }).join("\n");
      return reply("┌ ❏ ◆ ⌜⏱️ 𝗬𝗢𝗨𝗥 𝗖𝗢𝗨𝗡𝗧𝗗𝗢𝗪𝗡𝗦⌟ ◆\n│\n" + rows + "\n└ ❏" + config.footer);
    }
    if (sub==="delete"||sub==="del") {
      const name = args.slice(1).join(" ").toLowerCase();
      const key = Object.keys(db).find(k=>k.startsWith(sender)&&db[k].name.toLowerCase()===name);
      if (!key) return reply("❌ Countdown not found.");
      delete db[key]; await saveCD(db);
      return reply("✅ Countdown deleted." + config.footer);
    }
    const datePart = args[0];
    const eventName = args.slice(1).join(" ");
    if (!datePart || !eventName) return reply("Usage: .countdown <DD/MM/YYYY> <Event name>\nExample: .countdown 25/12/2025 Christmas\n\n.countdown list — see all your countdowns");
    const [day,month,year] = datePart.split("/").map(Number);
    if (!day||!month||!year||year<2020) return reply("❌ Invalid date. Use DD/MM/YYYY format.");
    const target = new Date(year,month-1,day).getTime();
    if (target < Date.now()) return reply("❌ That date has already passed!");
    const key = sender + ":" + Date.now();
    db[key] = { name: eventName, target, creator: sender };
    await saveCD(db);
    const left = target - Date.now();
    const d=Math.floor(left/86400000);
    reply("⏱️ Countdown set!\n\n📅 *" + eventName + "*\n🗓️ Date: " + datePart + "\n⏰ " + d + " days to go!" + config.footer);
  }
};
