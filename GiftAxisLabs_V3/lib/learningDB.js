

const fs = require("fs");
const path = require("path");

const DB_DIR  = path.join(__dirname, "..", "data");
const LDB_FILE = path.join(DB_DIR, "learning.json");

const defaultLDB = {
    learningGroups: {},   // groupId → { name, topic, language, registeredAt, registeredBy, sensitivity, aiMode, active }
    students:       {},   // groupId → { userId → { name, role, xp, warnings, mutedUntil, streak, lastSeen } }
    attendance:     {},   // groupId → { sessions: [ {id, date, openedBy, closedAt, present[], absent[]} ] }
    quizzes:        {},   // groupId → { active: {...}, history: [] }
    assignments:    {},   // groupId → { list: [ {id, title, description, deadline, submissions:{}} ] }
    schedules:      {},   // groupId → { timetable: [], reminders: [] }
    labs:           {},   // userId  → { activeLab: {}, completed: [], xp: 0 }
    punishments:    {},   // groupId → { log: [ {userId, action, reason, by, at} ] }
    aiLogs:         {},   // groupId → [ {userId, message, verdict, action, at} ]
};

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function loadLDB() {
    try {
        if (fs.existsSync(LDB_FILE)) {
            const data = JSON.parse(fs.readFileSync(LDB_FILE, "utf-8"));
            return { ...defaultLDB, ...data };
        }
    } catch (e) { console.error("⚠️ LearningDB load error:", e.message); }
    return { ...defaultLDB };
}

function saveLDB() {
    try { fs.writeFileSync(LDB_FILE, JSON.stringify(ldb, null, 2)); }
    catch (e) { console.error("⚠️ LearningDB save error:", e.message); }
}

let ldb = loadLDB();

function registerLearningGroup(groupId, name, registeredBy, options = {}) {
    ldb.learningGroups[groupId] = {
        name,
        topic:        options.topic       || "General Programming",
        language:     options.language    || "JavaScript",
        registeredAt: Date.now(),
        registeredBy,
        sensitivity:  options.sensitivity || "moderate", // strict | moderate | lenient
        aiMode:       options.aiMode      || "auto",     // auto | suggest | off
        active:       true,
        classOpen:    false,
    };
    if (!ldb.students[groupId])    ldb.students[groupId]    = {};
    if (!ldb.attendance[groupId])  ldb.attendance[groupId]  = { sessions: [] };
    if (!ldb.quizzes[groupId])     ldb.quizzes[groupId]     = { active: null, history: [] };
    if (!ldb.assignments[groupId]) ldb.assignments[groupId] = { list: [] };
    if (!ldb.schedules[groupId])   ldb.schedules[groupId]   = { timetable: [], reminders: [] };
    if (!ldb.punishments[groupId]) ldb.punishments[groupId] = { log: [] };
    if (!ldb.aiLogs[groupId])      ldb.aiLogs[groupId]      = [];
    saveLDB();
}

function isLearningGroup(groupId) {
    return !!(ldb.learningGroups[groupId]?.active);
}

function getLearningGroup(groupId) {
    return ldb.learningGroups[groupId] || null;
}

function updateGroupSetting(groupId, key, value) {
    if (!ldb.learningGroups[groupId]) return;
    ldb.learningGroups[groupId][key] = value;
    saveLDB();
}

function getAllLearningGroups() {
    return Object.entries(ldb.learningGroups).filter(([, g]) => g.active);
}

function registerStudent(groupId, userId, name, role = "student") {
    if (!ldb.students[groupId]) ldb.students[groupId] = {};
    if (!ldb.students[groupId][userId]) {
        ldb.students[groupId][userId] = {
            name,
            role,
            xp:        0,
            warnings:  0,
            mutedUntil: null,
            streak:    0,
            joinedAt:  Date.now(),
            lastSeen:  Date.now(),
        };
    } else {
        ldb.students[groupId][userId].name    = name;
        ldb.students[groupId][userId].lastSeen = Date.now();
    }
    saveLDB();
}

function getStudent(groupId, userId) {
    return ldb.students[groupId]?.[userId] || null;
}

function getAllStudents(groupId) {
    return ldb.students[groupId] || {};
}

function setRole(groupId, userId, role) {
    if (!ldb.students[groupId]?.[userId]) return;
    ldb.students[groupId][userId].role = role;
    saveLDB();
}

function addXP(groupId, userId, amount) {
    if (!ldb.students[groupId]?.[userId]) return;
    ldb.students[groupId][userId].xp = (ldb.students[groupId][userId].xp || 0) + amount;
    saveLDB();
}

function getLeaderboard(groupId, limit = 10) {
    const students = ldb.students[groupId] || {};
    return Object.entries(students)
        .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0))
        .slice(0, limit)
        .map(([id, s]) => ({ id, ...s }));
}

function addWarning(groupId, userId, reason, by) {
    if (!ldb.students[groupId]?.[userId]) return 0;
    ldb.students[groupId][userId].warnings = (ldb.students[groupId][userId].warnings || 0) + 1;
    logPunishment(groupId, userId, "WARN", reason, by);
    saveLDB();
    return ldb.students[groupId][userId].warnings;
}

function resetWarnings(groupId, userId) {
    if (!ldb.students[groupId]?.[userId]) return;
    ldb.students[groupId][userId].warnings = 0;
    saveLDB();
}

function muteStudent(groupId, userId, durationMs, reason, by) {
    if (!ldb.students[groupId]?.[userId]) return;
    const until = Date.now() + durationMs;
    ldb.students[groupId][userId].mutedUntil = until;
    logPunishment(groupId, userId, "MUTE", reason, by);
    saveLDB();
    return until;
}

function isStudentMuted(groupId, userId) {
    const s = ldb.students[groupId]?.[userId];
    if (!s) return false;
    if (!s.mutedUntil) return false;
    if (Date.now() > s.mutedUntil) {
        s.mutedUntil = null;
        saveLDB();
        return false;
    }
    return true;
}

function logPunishment(groupId, userId, action, reason, by) {
    if (!ldb.punishments[groupId]) ldb.punishments[groupId] = { log: [] };
    ldb.punishments[groupId].log.push({ userId, action, reason, by, at: Date.now() });
    if (ldb.punishments[groupId].log.length > 500)
        ldb.punishments[groupId].log = ldb.punishments[groupId].log.slice(-500);
    saveLDB();
}

function getPunishmentLog(groupId, limit = 20) {
    return (ldb.punishments[groupId]?.log || []).slice(-limit).reverse();
}

function logAIAction(groupId, userId, message, verdict, action) {
    if (!ldb.aiLogs[groupId]) ldb.aiLogs[groupId] = [];
    ldb.aiLogs[groupId].push({ userId, message: message.slice(0, 200), verdict, action, at: Date.now() });
    if (ldb.aiLogs[groupId].length > 200) ldb.aiLogs[groupId] = ldb.aiLogs[groupId].slice(-200);
    saveLDB();
}

function openAttendance(groupId, openedBy) {
    if (!ldb.attendance[groupId]) ldb.attendance[groupId] = { sessions: [] };
    const session = {
        id:       Date.now().toString(),
        date:     new Date().toISOString(),
        openedBy,
        closedAt: null,
        present:  [],
        absent:   [],
    };
    ldb.attendance[groupId].sessions.push(session);
    ldb.learningGroups[groupId].classOpen    = true;
    ldb.learningGroups[groupId].activeSession = session.id;
    saveLDB();
    return session;
}

function markPresent(groupId, userId, name) {
    const grp = ldb.learningGroups[groupId];
    if (!grp?.classOpen || !grp.activeSession) return false;
    const sessions = ldb.attendance[groupId].sessions;
    const session  = sessions.find(s => s.id === grp.activeSession);
    if (!session) return false;
    if (!session.present.find(p => p.userId === userId)) {
        session.present.push({ userId, name, time: Date.now() });
        addXP(groupId, userId, 5); // 5 XP for attendance
        saveLDB();
        return true;
    }
    return false; // already marked
}

function closeAttendance(groupId, allParticipants = []) {
    const grp = ldb.learningGroups[groupId];
    if (!grp?.classOpen || !grp.activeSession) return null;
    const sessions = ldb.attendance[groupId].sessions;
    const session  = sessions.find(s => s.id === grp.activeSession);
    if (!session) return null;
    session.closedAt = Date.now();
    const presentIds = session.present.map(p => p.userId);
    session.absent = allParticipants
        .filter(p => !presentIds.includes(p.id))
        .map(p => ({ userId: p.id, name: p.name || p.notify || "Unknown" }));
    grp.classOpen    = false;
    grp.activeSession = null;
    saveLDB();
    return session;
}

function getAttendanceHistory(groupId, limit = 5) {
    return (ldb.attendance[groupId]?.sessions || []).slice(-limit).reverse();
}

function getStudentAttendanceRate(groupId, userId) {
    const sessions = ldb.attendance[groupId]?.sessions || [];
    if (!sessions.length) return 0;
    const attended = sessions.filter(s => s.present.find(p => p.userId === userId)).length;
    return Math.round((attended / sessions.length) * 100);
}

function startQuiz(groupId, quiz) {
    if (!ldb.quizzes[groupId]) ldb.quizzes[groupId] = { active: null, history: [] };
    quiz.startedAt      = Date.now();
    quiz.currentQ       = 0;
    quiz.scores         = {};  // userId → points
    quiz.answered       = {};  // questionIndex → { userId: bool }
    ldb.quizzes[groupId].active = quiz;
    saveLDB();
    return quiz;
}

function getActiveQuiz(groupId) {
    return ldb.quizzes[groupId]?.active || null;
}

function recordAnswer(groupId, userId, userName, questionIndex, isCorrect, points) {
    const quiz = ldb.quizzes[groupId]?.active;
    if (!quiz) return;
    if (!quiz.answered[questionIndex]) quiz.answered[questionIndex] = {};
    quiz.answered[questionIndex][userId] = isCorrect;
    if (isCorrect) {
        quiz.scores[userId] = (quiz.scores[userId] || 0) + points;
        addXP(groupId, userId, points);
    }
    saveLDB();
}

function advanceQuiz(groupId) {
    const quiz = ldb.quizzes[groupId]?.active;
    if (!quiz) return null;
    quiz.currentQ++;
    if (quiz.currentQ >= quiz.questions.length) return endQuiz(groupId);
    saveLDB();
    return quiz.questions[quiz.currentQ];
}

function endQuiz(groupId) {
    const quiz = ldb.quizzes[groupId]?.active;
    if (!quiz) return null;
    quiz.endedAt = Date.now();
    ldb.quizzes[groupId].history.push(quiz);
    if (ldb.quizzes[groupId].history.length > 50)
        ldb.quizzes[groupId].history = ldb.quizzes[groupId].history.slice(-50);
    ldb.quizzes[groupId].active = null;
    saveLDB();
    return quiz;
}

function createAssignment(groupId, assignment) {
    if (!ldb.assignments[groupId]) ldb.assignments[groupId] = { list: [] };
    const a = { ...assignment, id: Date.now().toString(), submissions: {}, createdAt: Date.now() };
    ldb.assignments[groupId].list.push(a);
    saveLDB();
    return a;
}

function submitAssignment(groupId, assignmentId, userId, userName, content) {
    const list = ldb.assignments[groupId]?.list || [];
    const a    = list.find(x => x.id === assignmentId);
    if (!a) return null;
    a.submissions[userId] = { userName, content, submittedAt: Date.now(), grade: null, feedback: null };
    saveLDB();
    return a.submissions[userId];
}

function gradeAssignment(groupId, assignmentId, userId, grade, feedback) {
    const a = (ldb.assignments[groupId]?.list || []).find(x => x.id === assignmentId);
    if (!a || !a.submissions[userId]) return false;
    a.submissions[userId].grade    = grade;
    a.submissions[userId].feedback = feedback;
    if (grade >= 70) addXP(groupId, userId, Math.floor(grade / 10));
    saveLDB();
    return true;
}

function getAssignments(groupId, activeOnly = false) {
    const list = ldb.assignments[groupId]?.list || [];
    if (!activeOnly) return list;
    return list.filter(a => Date.now() < a.deadline);
}

function getAssignmentById(groupId, assignmentId) {
    return (ldb.assignments[groupId]?.list || []).find(x => x.id === assignmentId) || null;
}

function addSchedule(groupId, entry) {
    if (!ldb.schedules[groupId]) ldb.schedules[groupId] = { timetable: [], reminders: [] };
    entry.id = Date.now().toString();
    ldb.schedules[groupId].timetable.push(entry);
    saveLDB();
    return entry;
}

function removeSchedule(groupId, entryId) {
    if (!ldb.schedules[groupId]) return;
    ldb.schedules[groupId].timetable = ldb.schedules[groupId].timetable.filter(e => e.id !== entryId);
    saveLDB();
}

function getSchedule(groupId) {
    return ldb.schedules[groupId]?.timetable || [];
}

function setActiveLab(userId, lab) {
    if (!ldb.labs[userId]) ldb.labs[userId] = { activeLab: null, completed: [], xp: 0 };
    ldb.labs[userId].activeLab = { ...lab, startedAt: Date.now(), attempts: 0 };
    saveLDB();
}

function getActiveLab(userId) {
    return ldb.labs[userId]?.activeLab || null;
}

function completeLab(userId, groupId, labTitle, score) {
    if (!ldb.labs[userId]) ldb.labs[userId] = { activeLab: null, completed: [], xp: 0 };
    ldb.labs[userId].completed.push({ title: labTitle, score, completedAt: Date.now() });
    ldb.labs[userId].activeLab = null;
    ldb.labs[userId].xp        = (ldb.labs[userId].xp || 0) + score;
    addXP(groupId, userId, score);
    saveLDB();
}

function incrementLabAttempts(userId) {
    if (!ldb.labs[userId]?.activeLab) return;
    ldb.labs[userId].activeLab.attempts++;
    saveLDB();
}

function getLabStats(userId) {
    return {
        completed: ldb.labs[userId]?.completed?.length || 0,
        xp:        ldb.labs[userId]?.xp || 0,
        history:   ldb.labs[userId]?.completed || [],
    };
}

function getGroupStats(groupId) {
    const students    = ldb.students[groupId]    || {};
    const sessions    = ldb.attendance[groupId]?.sessions || [];
    const assignments = ldb.assignments[groupId]?.list    || [];
    const quizHistory = ldb.quizzes[groupId]?.history     || [];

    const totalStudents = Object.keys(students).length;
    const avgAttendance = sessions.length
        ? Math.round(sessions.reduce((s, sess) => s + sess.present.length, 0) / sessions.length)
        : 0;
    const assignmentsPosted    = assignments.length;
    const assignmentsCompleted = assignments.reduce((s, a) => s + Object.keys(a.submissions || {}).length, 0);
    const quizzesDone          = quizHistory.length;
    const topStudents          = getLeaderboard(groupId, 3);
    const ghostMembers         = Object.entries(students)
        .filter(([, s]) => {
            const rate = getStudentAttendanceRate(groupId, s.id || "");
            return sessions.length >= 3 && rate < 20;
        });

    return {
        totalStudents, avgAttendance, assignmentsPosted,
        assignmentsCompleted, quizzesDone, topStudents,
        ghostMembers: ghostMembers.length,
        punishments: (ldb.punishments[groupId]?.log || []).length,
    };
}

module.exports = {
    ldb, saveLDB,
    registerLearningGroup, isLearningGroup, getLearningGroup, updateGroupSetting, getAllLearningGroups,
    registerStudent, getStudent, getAllStudents, setRole, addXP, getLeaderboard,
    addWarning, resetWarnings, muteStudent, isStudentMuted, logPunishment, getPunishmentLog, logAIAction,
    openAttendance, markPresent, closeAttendance, getAttendanceHistory, getStudentAttendanceRate,
    startQuiz, getActiveQuiz, recordAnswer, advanceQuiz, endQuiz,
    createAssignment, submitAssignment, gradeAssignment, getAssignments, getAssignmentById,
    addSchedule, removeSchedule, getSchedule,
    setActiveLab, getActiveLab, completeLab, incrementLabAttempts, getLabStats,
    getGroupStats,
};
