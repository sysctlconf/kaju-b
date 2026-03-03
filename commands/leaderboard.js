const { EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../database');
const config = require('../config');

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Handles !rank command — posts a leaderboard embed.
 */
async function handleLeaderboard(message) {
    const rows = getLeaderboard(10);

    if (!rows.length) {
        return message.channel.send('📭 No meme data yet — go post some memes!');
    }

    const embed = new EmbedBuilder()
        .setTitle('🏆 Meme Leaderboard')
        .setColor('#FFD700')
        .setFooter({ text: 'CAJU Meme Bot • Keep posting!' })
        .setTimestamp();

    let description = '';

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const pos = i < 3 ? MEDALS[i] : `**#${i + 1}**`;
        const rankObj = row.level > 0 ? config.RANKS[row.level - 1] : null;
        const rankName = rankObj ? rankObj.name : 'Unranked';
        const xpForNext = row.level < 10
            ? `${row.xp}/${config.LEVEL_XP[row.level]} XP`
            : 'MAX';

        // Try to get mention, fall back to stored username
        description += `${pos} <@${row.user_id}>\n`;
        description += `　　Level **${row.level}** • ${rankName} • ${xpForNext} • **${row.total_xp}** total memes\n\n`;
    }

    embed.setDescription(description.trim());

    await message.channel.send({ embeds: [embed] });
}

module.exports = { handleLeaderboard };
