const config = require("../../config");
const fs = require("fs-extra");
const path = require("path");
const ADB = path.join(__dirname, "../../data/analytics.json");
async function getA() { await fs.ensureFile(ADB); return fs.readJson(ADB).catch(() => ({})); }
async function saveA(db) { await fs.writeJson(ADB, db); }
async function trackMsg(groupId, userId, name) {
    const db = await getA();
    if (!db[groupId]) db[groupId] = { total: 0, members: {} };
    db[groupId].total = (db[groupId].total || 0) + 1;
    if (!db[groupId].members[userId]) db[groupId].members[userId] = { name, count: 0 };
    db[groupId].members[userId].count++;
    db[groupId].members[userId].name = name;
    await saveA(db);
}
module.exports = [
  {
    name: "analytics", alias: ["groupstats","chatstats"],
    description: "Show group chat analytics", category: "group", groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid; const db = await getA();
        const g = db[from];
        if (!g?.total) return reply("📊 No analytics data yet. Messages will be tracked automatically.");
        const top = Object.entries(g.members || {}).sort(([,a],[,b]) => b.count-a.count).slice(0,5);
        const rows = top.map(([,u],i) => `├◆ ${["🥇","🥈","🥉","4.","5."][i]} ${u.name} — ${u.count} msgs`).join("\n");
        reply(
            `┌ ❏ ◆ ⌜📊 𝗚𝗥𝗢𝗨𝗣 𝗔𝗡𝗔𝗟𝗬𝗧𝗜𝗖𝗦⌟ ◆\n│\n` +
            `├◆ 💬 Total Messages: ${g.total.toLocaleString()}\n` +
            `├◆ 👥 Active Members: ${Object.keys(g.members||{}).length}\n│\n` +
            `├◆ 🏆 Top Chatters:\n${rows}\n└ ❏` + config.footer
        );
    }
  }
];
module.exports.trackMsg = trackMsg;
