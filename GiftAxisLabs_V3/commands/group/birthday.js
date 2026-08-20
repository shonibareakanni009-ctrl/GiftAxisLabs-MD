const config = require("../../config");
const fs = require("fs-extra");
const path = require("path");
const BD_FILE = path.join(__dirname, "../../data/birthdays.json");
async function getBD() { await fs.ensureFile(BD_FILE); return fs.readJson(BD_FILE).catch(() => ({})); }
async function saveBD(db) { await fs.writeJson(BD_FILE, db); }
module.exports = [
  {
    name: "setbirthday", alias: ["birthday","bday"],
    description: "Set your birthday", category: "group",
    async execute(sock, m, args, reply) {
        if (!args[0]) return reply("Usage: .setbirthday DD/MM\nExample: .setbirthday 25/12");
        const sender = m.key.participant || m.key.remoteJid;
        const name = m.pushName || sender.split("@")[0];
        const [day, month] = args[0].split("/").map(Number);
        if (!day || !month || day > 31 || month > 12) return reply("❌ Invalid date. Use DD/MM format.");
        const db = await getBD();
        db[sender] = { name, day, month, setAt: Date.now() };
        await saveBD(db);
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        reply(`🎂 Birthday saved: *${day} ${months[month-1]}*\nWe'll celebrate you! 🥳` + config.footer);
    }
  },
  {
    name: "birthdays", alias: ["upcomingbdays","bdaylist"],
    description: "Show upcoming birthdays", category: "group",
    async execute(sock, m, args, reply) {
        const db = await getBD();
        const now = new Date(); const today = { d: now.getDate(), m: now.getMonth()+1 };
        const upcoming = Object.entries(db).map(([id,u]) => {
            let daysUntil = (u.month - today.m)*30 + (u.day - today.d);
            if (daysUntil < 0) daysUntil += 365;
            return { ...u, id, daysUntil };
        }).sort((a,b) => a.daysUntil - b.daysUntil).slice(0, 10);
        if (!upcoming.length) return reply("No birthdays registered yet! Use .setbirthday DD/MM");
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const rows = upcoming.map((u,i) => {
            const label = u.daysUntil === 0 ? "🎂 TODAY!" : u.daysUntil === 1 ? "🎁 Tomorrow!" : `in ${u.daysUntil} days`;
            return `├◆ ${i+1}. ${u.name} — ${u.day} ${months[u.month-1]} (${label})`;
        }).join("\n");
        reply(`┌ ❏ ◆ ⌜🎂 𝗕𝗜𝗥𝗧𝗛𝗗𝗔𝗬𝗦⌟ ◆\n│\n${rows}\n└ ❏` + config.footer);
    }
  }
];
