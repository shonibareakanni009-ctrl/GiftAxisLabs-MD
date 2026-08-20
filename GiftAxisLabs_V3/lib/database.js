const fs = require("fs");
const path = require("path");

const DB_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DB_DIR, "database.json");

const defaultDB = {
    users: {},       // userId -> { name, firstSeen, lastSeen, banned, ... }
    economy: {},     // userId -> { wallet, bank, lastDaily, lastWork, ... }
    reminders: [],   // { userId, chatId, message, triggerAt }
    sessions: {},    // sessionId -> { phone, pairedAt, active }
    stats: {
        totalUsers: 0,
        totalMessages: 0,
        totalCommands: 0,
        todayCommands: 0,
        todayDate: new Date().toDateString()
    },
    admins: [],      // list of Telegram admin chatIds
    banned: [],      // list of banned user IDs
    maintenance: false,
    botSleeping: false,
    logs: [],        // audit logs
    groupSettings: {},  // groupId -> { mutedMembers, antilink, antispam, antiword, antitag, antibot, antiviewonce, bannedWords }
    allowedTgUsers: []  // Telegram chatIds allowed to use bot (empty = all allowed)
};

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
            return {
                ...defaultDB,
                ...data,
                stats: { ...defaultDB.stats, ...(data.stats || {}) },
                groupSettings: data.groupSettings || {},
                allowedTgUsers: data.allowedTgUsers || []
            };
        }
    } catch (e) {
        console.error("⚠️ DB load error, using defaults:", e.message);
    }
    return { ...defaultDB };
}

function saveDB(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("⚠️ DB save error:", e.message);
    }
}

let db = loadDB();

function checkDailyReset() {
    const today = new Date().toDateString();
    if (db.stats.todayDate !== today) {
        db.stats.todayCommands = 0;
        db.stats.todayDate = today;
        saveDB(db);
    }
}

function trackUser(userId, name) {
    checkDailyReset();
    if (!db.users[userId]) {
        db.users[userId] = {
            name: name || "Unknown",
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            messageCount: 0,
            commandCount: 0
        };
        db.stats.totalUsers = Object.keys(db.users).length;
    } else {
        db.users[userId].lastSeen = Date.now();
        if (name) db.users[userId].name = name;
    }
    db.users[userId].messageCount++;
    db.stats.totalMessages++;
    saveDB(db);
}

function trackCommand(userId) {
    checkDailyReset();
    if (db.users[userId]) {
        db.users[userId].commandCount++;
    }
    db.stats.totalCommands++;
    db.stats.todayCommands++;
    saveDB(db);
}

function addLog(action, details) {
    db.logs.push({
        timestamp: Date.now(),
        action,
        details
    });
    if (db.logs.length > 500) {
        db.logs = db.logs.slice(-500);
    }
    saveDB(db);
}

function addSession(sessionId, phone) {
    db.sessions[sessionId] = {
        phone,
        pairedAt: Date.now(),
        active: true
    };
    addLog("SESSION_PAIRED", { sessionId, phone });
    saveDB(db);
}

function removeSession(sessionId) {
    if (db.sessions[sessionId]) {
        db.sessions[sessionId].active = false;
        addLog("SESSION_REMOVED", { sessionId });
        saveDB(db);
    }
}

function getActiveSessions() {
    return Object.entries(db.sessions).filter(([_, s]) => s.active);
}

function banUser(userId) {
    if (!db.banned.includes(userId)) {
        db.banned.push(userId);
        addLog("USER_BANNED", { userId });
        saveDB(db);
    }
}

function unbanUser(userId) {
    db.banned = db.banned.filter(id => id !== userId);
    addLog("USER_UNBANNED", { userId });
    saveDB(db);
}

function isUserBanned(userId) {
    return db.banned.includes(userId);
}

function addAdmin(chatId) {
    if (!db.admins.includes(chatId)) {
        db.admins.push(chatId);
        addLog("ADMIN_ADDED", { chatId });
        saveDB(db);
    }
}

function removeAdmin(chatId) {
    db.admins = db.admins.filter(id => id !== chatId);
    addLog("ADMIN_REMOVED", { chatId });
    saveDB(db);
}

function isAdmin(chatId) {
    return db.admins.includes(chatId);
}

function setMaintenance(enabled) {
    db.maintenance = enabled;
    addLog("MAINTENANCE", { enabled });
    saveDB(db);
}

function setSleep(enabled) {
    db.botSleeping = enabled;
    addLog("SLEEP_MODE", { enabled });
    saveDB(db);
}

function addReminder(userId, chatId, message, triggerAt) {
    db.reminders.push({ userId, chatId, message, triggerAt });
    saveDB(db);
}

function getDueReminders() {
    const now = Date.now();
    const due = db.reminders.filter(r => r.triggerAt <= now);
    db.reminders = db.reminders.filter(r => r.triggerAt > now);
    if (due.length > 0) saveDB(db);
    return due;
}

function getGroupSettings(groupId) {
    if (!db.groupSettings[groupId]) {
        db.groupSettings[groupId] = {
            mutedMembers: [],
            antilink: false,
            antispam: false,
            antitag: false,
            antibot: false,
            antiviewonce: false,
            bannedWords: [],
            spamTracker: {}
        };
        saveDB(db);
    }
    return db.groupSettings[groupId];
}

function setGroupSetting(groupId, key, value) {
    const gs = getGroupSettings(groupId);
    gs[key] = value;
    db.groupSettings[groupId] = gs;
    saveDB(db);
}

function muteMember(groupId, userId) {
    const gs = getGroupSettings(groupId);
    if (!gs.mutedMembers.includes(userId)) {
        gs.mutedMembers.push(userId);
        db.groupSettings[groupId] = gs;
        saveDB(db);
    }
}

function unmuteMember(groupId, userId) {
    const gs = getGroupSettings(groupId);
    gs.mutedMembers = gs.mutedMembers.filter(id => id !== userId);
    db.groupSettings[groupId] = gs;
    saveDB(db);
}

function isMemberMuted(groupId, userId) {
    const gs = getGroupSettings(groupId);
    return (gs.mutedMembers || []).includes(userId);
}

function getMutedMembers(groupId) {
    return getGroupSettings(groupId).mutedMembers || [];
}

function addBannedWord(groupId, word) {
    const gs = getGroupSettings(groupId);
    const w = word.toLowerCase();
    if (!gs.bannedWords) gs.bannedWords = [];
    if (!gs.bannedWords.includes(w)) {
        gs.bannedWords.push(w);
        db.groupSettings[groupId] = gs;
        saveDB(db);
    }
}

function removeBannedWord(groupId, word) {
    const gs = getGroupSettings(groupId);
    gs.bannedWords = (gs.bannedWords || []).filter(w => w !== word.toLowerCase());
    db.groupSettings[groupId] = gs;
    saveDB(db);
}

function getBannedWords(groupId) {
    return getGroupSettings(groupId).bannedWords || [];
}

function trackSpam(groupId, userId) {
    const gs = getGroupSettings(groupId);
    const now = Date.now();
    if (!gs.spamTracker) gs.spamTracker = {};
    if (!gs.spamTracker[userId]) gs.spamTracker[userId] = { count: 0, lastTime: now };
    const tracker = gs.spamTracker[userId];
    if (now - tracker.lastTime > 10000) {
        tracker.count = 1;
        tracker.lastTime = now;
    } else {
        tracker.count++;
        tracker.lastTime = now;
    }
    db.groupSettings[groupId] = gs;
    saveDB(db);
    return tracker.count;
}

function resetSpam(groupId, userId) {
    const gs = getGroupSettings(groupId);
    if (gs.spamTracker && gs.spamTracker[userId]) {
        gs.spamTracker[userId] = { count: 0, lastTime: Date.now() };
        db.groupSettings[groupId] = gs;
        saveDB(db);
    }
}

const pendingReports = new Map(); // reportId -> { fromChatId, fromName, message, timestamp }

function storePendingReport(reportId, fromChatId, fromName, message) {
    pendingReports.set(reportId.toString(), { fromChatId, fromName, message, timestamp: Date.now() });
}

function getPendingReport(reportId) {
    return pendingReports.get(reportId.toString()) || null;
}

function deletePendingReport(reportId) {
    pendingReports.delete(reportId.toString());
}

function addAllowedTgUser(chatId) {
    const id = chatId.toString();
    if (!db.allowedTgUsers) db.allowedTgUsers = [];
    if (!db.allowedTgUsers.includes(id)) {
        db.allowedTgUsers.push(id);
        addLog("TG_USER_ALLOWED", { chatId: id });
        saveDB(db);
    }
}

function removeAllowedTgUser(chatId) {
    const id = chatId.toString();
    db.allowedTgUsers = (db.allowedTgUsers || []).filter(u => u !== id);
    addLog("TG_USER_REMOVED", { chatId: id });
    saveDB(db);
}

function isTgUserAllowed(chatId) {
    if (!db.allowedTgUsers || db.allowedTgUsers.length === 0) return true;
    return db.allowedTgUsers.includes(chatId.toString());
}

function getAllowedTgUsers() {
    return db.allowedTgUsers || [];
}

module.exports = {
    db,
    saveDB,
    loadDB,
    trackUser,
    trackCommand,
    addLog,
    addSession,
    removeSession,
    getActiveSessions,
    banUser,
    unbanUser,
    isUserBanned,
    addAdmin,
    removeAdmin,
    isAdmin,
    setMaintenance,
    setSleep,
    addReminder,
    getDueReminders,
    getGroupSettings,
    setGroupSetting,
    muteMember,
    unmuteMember,
    isMemberMuted,
    getMutedMembers,
    addBannedWord,
    removeBannedWord,
    getBannedWords,
    trackSpam,
    resetSpam,
    addAllowedTgUser,
    removeAllowedTgUser,
    isTgUserAllowed,
    getAllowedTgUsers,
    storePendingReport,
    getPendingReport,
    deletePendingReport
};
