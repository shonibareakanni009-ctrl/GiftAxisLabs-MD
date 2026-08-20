
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
const MINERALS = [
    { name:"🪨 Stone",    min:10,  max:30  },
    { name:"⚙️ Iron",     min:40,  max:80  },
    { name:"🥈 Silver",   min:80,  max:150 },
    { name:"🥇 Gold",     min:150, max:300 },
    { name:"💎 Diamond",  min:400, max:800 },
    { name:"🔮 Amethyst", min:200, max:450 },
];
module.exports = {
    name: "mining", alias: ["mine","dig"],
    async execute(sock, m, args, reply) {
        const db = await getDB(); const userId = m.key.participant || m.key.remoteJid;
        const user = getUser(db, userId);
        if (!user.inventory.includes("pickaxe")) return reply("❌ You need a ⛏️ *Pickaxe*!\nBuy one at .shop for $600.");
        const cd = 8 * 60 * 1000;
        if (Date.now() - (user.lastMine||0) < cd) {
            const left = Math.ceil((cd - (Date.now()-user.lastMine))/60000);
            return reply(`⏰ Mining cooldown! Wait *${left} min*.`);
        }
        const weights = [40,25,15,10,5,5];
        let roll = Math.random()*100, cum = 0, mineral = MINERALS[0];
        for (let i=0; i<MINERALS.length; i++) { cum += weights[i]; if (roll < cum) { mineral = MINERALS[i]; break; } }
        const earned = Math.floor(Math.random()*(mineral.max-mineral.min+1)) + mineral.min;
        user.balance += earned; user.xp += 6; user.lastMine = Date.now();
        await saveDB(db);
        reply(`⛏️ *Mining Result!*\n\nYou found ${mineral.name}!\n💰 Worth *$${earned}*\n💳 Balance: $${user.balance}\n⭐ +6 XP` + config.footer);
    }
};
