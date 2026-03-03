const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../database');
const config = require('../config');
const https = require('https');
const http = require('http');

/**
 * Fetch image from URL as a Buffer.
 */
function fetchImage(url) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Draws a rounded rectangle path.
 */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * Generates the profile canvas for a user.
 * Returns an AttachmentBuilder.
 */
async function generateProfileCard(member, dbUser) {
    const W = 800, H = 270;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const level = dbUser.level;
    const accentColor = config.LEVEL_COLORS[Math.max(0, level - 1)] || '#9E9E9E';
    const rank = level > 0 ? config.RANKS[level - 1] : null;
    const rankName = rank ? rank.name : 'Unranked';
    const currentXp = dbUser.xp;
    const xpNeeded = level < 10 ? config.LEVEL_XP[level] : config.LEVEL_XP[9];
    const xpProgress = level < 10 ? Math.min(currentXp / xpNeeded, 1) : 1;

    // --- Background ---
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f0f1a');
    bg.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H, 20);
    ctx.fill();

    // --- Accent side bar ---
    ctx.fillStyle = accentColor;
    roundRect(ctx, 0, 0, 8, H, 4);
    ctx.fill();

    // --- Glow behind avatar ---
    const glowGrad = ctx.createRadialGradient(130, 135, 20, 130, 135, 90);
    glowGrad.addColorStop(0, accentColor + '55');
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(40, 45, 180, 180);

    // --- Avatar ---
    let avatarImg;
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarBuf = await fetchImage(avatarUrl);
        avatarImg = await loadImage(avatarBuf);
    } catch {
        avatarImg = null;
    }

    // Avatar circle clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 135, 80, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (avatarImg) {
        ctx.drawImage(avatarImg, 50, 55, 160, 160);
    } else {
        ctx.fillStyle = '#333';
        ctx.fill();
    }
    ctx.restore();

    // Avatar border ring
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(130, 135, 82, 0, Math.PI * 2);
    ctx.stroke();

    // --- Level badge ---
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(195, 55, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`LV${level}`, 195, 61);

    // --- Username ---
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(member.user.username, 240, 90);

    // --- Rank name ---
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`🏆 ${rankName}`, 240, 128);

    // --- XP text ---
    ctx.fillStyle = '#cccccc';
    ctx.font = '16px sans-serif';
    if (level < 10) {
        ctx.fillText(`XP: ${currentXp} / ${xpNeeded}  •  Total: ${dbUser.total_xp} memes`, 240, 162);
    } else {
        ctx.fillText(`MAX LEVEL  •  Total: ${dbUser.total_xp} memes`, 240, 162);
    }

    // --- XP bar background ---
    const barX = 240, barY = 185, barW = 510, barH = 22;
    ctx.fillStyle = '#2a2a3e';
    roundRect(ctx, barX, barY, barW, barH, 11);
    ctx.fill();

    // --- XP bar fill ---
    if (xpProgress > 0) {
        const fillW = Math.max(22, barW * xpProgress);
        const barFill = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
        barFill.addColorStop(0, accentColor + 'aa');
        barFill.addColorStop(1, accentColor);
        ctx.fillStyle = barFill;
        roundRect(ctx, barX, barY, fillW, barH, 11);
        ctx.fill();
    }

    // --- XP bar percentage label ---
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(xpProgress * 100)}%`, barX + barW / 2, barY + 15);

    // --- Footer label ---
    ctx.textAlign = 'right';
    ctx.fillStyle = '#555577';
    ctx.font = '13px sans-serif';
    ctx.fillText('CAJU Meme Bot', W - 20, H - 15);

    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'profile.png' });
}

/**
 * Handles !p / !P command.
 */
async function handleProfile(message) {
    const guild = message.guild;
    if (!guild) return;

    let target = message.mentions.members?.first() || message.member;

    const dbUser = getUser(target.id, target.user.username);
    if (dbUser.level === 0 && dbUser.xp === 0) {
        // New user, still at level 0
    }

    try {
        const attachment = await generateProfileCard(target, dbUser);
        await message.channel.send({
            content: `📊 Profile for **${target.user.username}**`,
            files: [attachment],
        });
    } catch (err) {
        console.error('[Profile] Error generating card:', err);
        await message.channel.send('❌ Could not generate profile card. Try again later.');
    }
}

module.exports = { handleProfile };
