module.exports = {
    TOKEN: process.env.TOKEN || '',

    // Channels where memes are posted
    MEME_CHANNELS: [
        '1478442661261348944',
        '1478442712658350182',
        '1478442791117000818',
        '1478442858594701392',
    ],

    COMMANDS_CHANNEL: '1478459670245933237',
    FENCE_IMAGE: '71c83a3bc2488e6e.jpg',
    TICKET_BG: 'image0.png',
    PROFILE_BG: 'pixel2.png',

    LEVEL_XP: [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120],

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
};
