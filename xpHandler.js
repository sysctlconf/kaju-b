const path = require('path');
const { addXP } = require('./database');
const config = require('./config');

// Track recently processed messages to avoid double-handling
const processedMessages = new Set();

/**
 * Handles a message in a meme channel:
 * 1. Awards XP for meme images
 * 2. Sends fence image after the meme
 * 3. Handles level-up role assignment
 */
async function handleMemeMessage(message, client) {
    if (message.author.bot) return;
    if (!config.MEME_CHANNELS.includes(message.channelId)) return;
    if (processedMessages.has(message.id)) return;

    // Check for image/video attachments (meme content)
    const hasMeme = message.attachments.some(att => {
        const url = att.url.toLowerCase();
        return (
            att.contentType?.startsWith('image/') ||
            att.contentType?.startsWith('video/') ||
            url.endsWith('.jpg') || url.endsWith('.jpeg') ||
            url.endsWith('.png') || url.endsWith('.gif') ||
            url.endsWith('.webp') || url.endsWith('.mp4') ||
            url.endsWith('.mov')
        );
    });

    // Also check for URLs that are images (e.g. tenor/giphy links)
    const hasImageUrl = /https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|mp4|mov)/i.test(message.content) ||
        message.embeds.some(e => e.image || e.thumbnail || e.video);

    if (!hasMeme && !hasImageUrl) return;

    processedMessages.add(message.id);
    // Clean up after 60s
    setTimeout(() => processedMessages.delete(message.id), 60000);

    // --- Award XP ---
    const { user, leveledUp, newLevel } = addXP(
        message.author.id,
        message.author.username,
        1,
        config.LEVEL_XP
    );

    // --- Send fence image ---
    try {
        const fencePath = path.join(__dirname, config.FENCE_IMAGE);
        await message.channel.send({ files: [fencePath] });
    } catch (err) {
        console.error('[Fence] Could not send fence image:', err.message);
    }

    // --- Handle level-up ---
    if (leveledUp && newLevel >= 1) {
        const guild = message.guild;
        if (!guild) return;

        const member = await guild.members.fetch(message.author.id).catch(() => null);
        if (!member) return;

        const newRank = config.RANKS[newLevel - 1];

        // Remove all old rank roles
        const allRankRoleIds = config.RANKS.map(r => r.roleId);
        for (const roleId of allRankRoleIds) {
            if (member.roles.cache.has(roleId) && roleId !== newRank.roleId) {
                await member.roles.remove(roleId).catch(e =>
                    console.error('[Role] Could not remove role:', e.message)
                );
            }
        }

        // Add new rank role
        await member.roles.add(newRank.roleId).catch(e =>
            console.error('[Role] Could not add role:', e.message)
        );

        // Announce level-up in the same channel
        const xpForNext = newLevel < 10 ? config.LEVEL_XP[newLevel] : null;
        const nextInfo = xpForNext
            ? `Next rank in **${xpForNext} memes**`
            : `You've reached the **maximum rank**!`;

        await message.channel.send(
            `🎉 **${message.author.username}** leveled up to **Level ${newLevel}** — 🏆 **${newRank.name}**!\n${nextInfo}`
        ).catch(e => console.error('[LevelUp] Could not send message:', e.message));
    }
}

module.exports = { handleMemeMessage };
