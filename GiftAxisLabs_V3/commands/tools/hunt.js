
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
const PREY = [
    { name:"🐇 Rabbit",  min:30,  max:80  },
    { name:"🦊 Fox",     min:80,  max:150 },
    { name:"🦌 Deer",    min:120, max:250 },
    { name:"🐗 Boar",    min:100, max:200 },
    { name:"🦁 Lion",    min:300, max:600 },
    { name:"🐻 Bear",    min:200, max:450 },
    { name:"🦅 Eagle",   min:60,  max:130 },
];
module.exports = {
    name: "hunt", alias: ["hunting","shoot"],
    async execute(sock, m, args, reply) {
        const db = await getDB(); const userId = m.key.participant || m.key.remoteJid;
        const user = getUser(db, userId);
        if (!user.inventory.includes("rifle")) return reply("❌ You need a 🔫 *Hunting Rifle*!\nBuy one at .shop for $800.");
        const cd = 10 * 60 * 1000;
        if (Date.now() - (user.lastHunt||0) < cd) {
            const left = Math.ceil((cd - (Date.now()-user.lastHunt))/60000);
            return reply(`⏰ Hunting cooldown! Wait *${left} min*.`);
        }
        if (Math.random() < 0.25) {
            user.hp = Math.max(0, user.hp - 20); user.lastHunt = Date.now();
            await saveDB(db);
            return reply(`😔 The animal escaped and scratched you!\n❤️ HP: ${user.hp}/${user.maxHp}\n\nUse .heal if low on health.`);
        }
        const prey = PREY[Math.floor(Math.random()*PREY.length)];
        const earned = Math.floor(Math.random()*(prey.max-prey.min+1)) + prey.min;
        user.balance += earned; user.xp += 8; user.lastHunt = Date.now();
        await saveDB(db);
        reply(`🔫 *Hunt Successful!*\n\nYou hunted a ${prey.name}!\n💰 Sold for *$${earned}*\n💳 Balance: $${user.balance}\n⭐ +8 XP` + config.footer);
    }
};
