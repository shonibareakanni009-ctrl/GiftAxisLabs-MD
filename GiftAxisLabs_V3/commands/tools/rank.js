
const fs = require("fs-extra");
const path = require("path");
const config = require("../../config");
const DB = path.join(__dirname, "../../data/economy.json");
async function getDB() { await fs.ensureFile(DB); return fs.readJson(DB).catch(() => ({})); }
async function saveDB(db) { await fs.writeJson(DB, db); }
function getUser(db, id) {
    if (!db[id]) db[id] = { balance: 0, bank: 0, hp: 100, maxHp: 100, inventory: [], xp: 0, lastFish: 0, lastHunt: 0, lastMine: 0 };
    if (!db[id].inventory) db[id].inventory = [];
    if (db[id].hp === undefined) db[id].hp = 100;
    if (!db[id].maxHp) db[id].maxHp = 100;
    if (!db[id].xp) db[id].xp = 0;
    return db[id];
}
module.exports = {
    name: "rank", alias: ["richlist","toprich"],
    async execute(sock, m, args, reply) {
        const db = await getDB();
        const sorted = Object.entries(db)
            .filter(([k,v]) => typeof v === "object" && v.balance !== undefined)
            .sort(([,a],[,b]) => ((b.balance||0)+(b.bank||0)) - ((a.balance||0)+(a.bank||0)))
            .slice(0,10);
        if (!sorted.length) return reply("No economy data yet.");
        const medals = ["🥇","🥈","🥉","4.","5.","6.","7.","8.","9.","10."];
        const rows = sorted.map(([id,u],i) =>
            `├◆ ${medals[i]} +${id.split("@")[0]} — $${(u.balance||0)+(u.bank||0)}`
        ).join("\n");
        reply(`┌ ❏ ◆ ⌜💰 𝗪𝗘𝗔𝗟𝗧𝗛 𝗥𝗔𝗡𝗞𝗜𝗡𝗚⌟ ◆\n│\n${rows}\n└ ❏` + config.footer);
    }
};
