module.exports = {
    TOKEN: process.env.TOKEN || '',

    // Channels where memes are posted
    MEME_CHANNELS: [
        '1478442661261348944', // regular memes
        '1478442712658350182', // black / dark memes
        '1478442791117000818', // brainrot memes
        '1478442858594701392', // memes series and films
    ],

    // Channel where bot commands work
    COMMANDS_CHANNEL: '1478459670245933237',

    // Fence image filename (must be in the bot folder)
    FENCE_IMAGE: '71c83a3bc2488e6e.jpg',

    // XP required to REACH each level (doubles starting from 10)
    // Index 0 = XP needed to reach level 1, etc.
    LEVEL_XP: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],

    // Ranks: index 0 = level 1
    RANKS: [
        { level: 1, name: 'Rookie Memer', roleId: '1478441869762625671' },
        { level: 2, name: 'Casual Memer', roleId: '1478441879036231902' },
        { level: 3, name: 'Active Memer', roleId: '1478441888439599124' },
        { level: 4, name: 'Pro Memer', roleId: '1478441897549762712' },
        { level: 5, name: 'Laugh Maker', roleId: '1478441906949062686' },
        { level: 6, name: 'Meme Creator', roleId: '1478441915761299468' },
        { level: 7, name: 'Meme Genius', roleId: '1478441925723033650' },
        { level: 8, name: 'Meme King', roleId: '1478441935072002158' },
        { level: 9, name: 'Meme Legend', roleId: '1478441944479695101' },
        { level: 10, name: 'Grand Meme Emperor', roleId: '1478441953845575763' },
    ],

    // Colors for profile card per level
    LEVEL_COLORS: [
        '#9E9E9E', // 1 - Rookie
        '#4CAF50', // 2 - Casual
        '#2196F3', // 3 - Active
        '#FF9800', // 4 - Pro
        '#E91E63', // 5 - Laugh Maker
        '#9C27B0', // 6 - Meme Creator
        '#00BCD4', // 7 - Meme Genius
        '#FFD700', // 8 - Meme King
        '#FF5722', // 9 - Meme Legend
        '#F44336', // 10 - Grand Meme Emperor
    ],
};
