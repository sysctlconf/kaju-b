const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use /data on Railway (persistent volume), local dir otherwise
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'memebot.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id   TEXT PRIMARY KEY,
    username  TEXT,
    xp        INTEGER DEFAULT 0,
    total_xp  INTEGER DEFAULT 0,
    level     INTEGER DEFAULT 0
  );
`);

/**
 * Get a user record (creates one if it doesn't exist).
 */
function getUser(userId, username) {
    let user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    if (!user) {
        db.prepare('INSERT INTO users (user_id, username, xp, total_xp, level) VALUES (?, ?, 0, 0, 0)')
            .run(userId, username || 'Unknown');
        user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
    }
    // Update username in case it changed
    if (username && user.username !== username) {
        db.prepare('UPDATE users SET username = ? WHERE user_id = ?').run(username, userId);
        user.username = username;
    }
    return user;
}

/**
 * Add XP to a user. Returns { user, leveledUp, newLevel }.
 */
function addXP(userId, username, amount, LEVEL_XP) {
    const user = getUser(userId, username);
    let { xp, level } = user;
    const newTotalXp = user.total_xp + amount;
    let newXp = xp + amount;
    let newLevel = level;
    let leveledUp = false;

    // Check for level up (max level 10)
    while (newLevel < 10) {
        const xpNeeded = LEVEL_XP[newLevel]; // xp needed to reach next level (newLevel+1)
        if (newXp >= xpNeeded) {
            newXp -= xpNeeded;
            newLevel++;
            leveledUp = true;
        } else {
            break;
        }
    }

    db.prepare('UPDATE users SET xp = ?, total_xp = ?, level = ? WHERE user_id = ?')
        .run(newXp, newTotalXp, newLevel, userId);

    return {
        user: { ...user, xp: newXp, total_xp: newTotalXp, level: newLevel },
        leveledUp,
        newLevel,
    };
}

/**
 * Get top N users by total_xp for leaderboard.
 */
function getLeaderboard(limit = 10) {
    return db.prepare('SELECT * FROM users ORDER BY total_xp DESC LIMIT ?').all(limit);
}

module.exports = { getUser, addXP, getLeaderboard };
