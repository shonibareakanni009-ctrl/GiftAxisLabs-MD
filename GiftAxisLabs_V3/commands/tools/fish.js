
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
const CATCHES = [
    { name:"🐟 Common Fish",    min:20,  max:60,  rare:false },
    { name:"🐠 Tropical Fish",  min:60,  max:120, rare:false },
    { name:"🦈 Shark",          min:200, max:400, rare:true  },
    { name:"🐙 Octopus",        min:150, max:300, rare:true  },
    { name:"🦞 Lobster",        min:80,  max:180, rare:false },
    { name:"🐡 Pufferfish",     min:40,  max:100, rare:false },
    { name:"💎 Treasure Chest", min:500, max:1000,rare:true  },
    { name:"👟 Old Boot",       min:0,   max:5,   rare:false },
];
module.exports = {
    name: "fish", alias: ["fishing","cast"],
    async execute(sock, m, args, reply) {
        const db = await getDB(); const userId = m.key.participant || m.key.remoteJid;
        const user = getUser(db, userId);
        if (!user.inventory.includes("rod")) return reply("❌ You need a 🎣 *Fishing Rod*!\nBuy one at .shop for $500.");
        const cd = 5 * 60 * 1000;
        if (Date.now() - (user.lastFish||0) < cd) {
            const left = Math.ceil((cd - (Date.now()-user.lastFish))/60000);
            return reply(`⏰ Fishing cooldown! Wait *${left} min*.`);
        }
        const hasBait = user.inventory.includes("bait");
        const roll = Math.random();
        let catchItem;
        if (hasBait && roll < 0.15 || !hasBait && roll < 0.05) {
            catchItem = CATCHES.filter(c=>c.rare)[Math.floor(Math.random()*3)];
            if (hasBait) { const idx = user.inventory.indexOf("bait"); user.inventory.splice(idx,1); }
        } else {
            catchItem = CATCHES.filter(c=>!c.rare)[Math.floor(Math.random()*5)];
        }
        const earned = Math.floor(Math.random()*(catchItem.max-catchItem.min+1)) + catchItem.min;
        user.balance += earned; user.xp += 5; user.lastFish = Date.now();
        await saveDB(db);
        reply(`🎣 *Fishing Result!*\n\nYou caught a ${catchItem.name}!\n💰 Sold for *$${earned}*\n💳 Balance: $${user.balance}\n⭐ +5 XP` + config.footer);
    }
};
