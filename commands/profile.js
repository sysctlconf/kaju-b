const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { getUser } = require('../database');
const config = require('../config');
const https = require('https');
const http = require('http');

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/** Draw a filled rounded-rect path */
function pillPath(ctx, x, y, w, h, r) {
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

// ── starfield ────────────────────────────────────────────────────────────────

/** Seed-based simple random, reproducible per user */
function seededRand(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function drawStarfield(ctx, W, H, seed = 42) {
    const rand = seededRand(seed);
    const STARS = 280;
    for (let i = 0; i < STARS; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const r = rand() * 1.4 + 0.3;
        const a = rand() * 0.7 + 0.3;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.fill();
    }
}

// ── main generator ───────────────────────────────────────────────────────────

async function generateProfileCard(member, dbUser) {
    const W = 960, H = 460;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const level = dbUser.level;
    const rankObj = level > 0 ? config.RANKS[level - 1] : null;
    const rankName = rankObj ? rankObj.name : 'Unranked';
    const xp = dbUser.xp;
    const totalXp = dbUser.total_xp || 0;
    const xpNeeded = level < 10 ? config.LEVEL_XP[level] : config.LEVEL_XP[9];
    const pct = level >= 10 ? 100 : Math.round((xp / xpNeeded) * 100);
    const barFill = level >= 10 ? 1 : Math.min(xp / xpNeeded, 1);

    // ── Background ─────────────────────────────────────────────────────────────
    // Deep space navy gradient
    const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.75);
    bgGrad.addColorStop(0, '#0d1035');
    bgGrad.addColorStop(0.6, '#080820');
    bgGrad.addColorStop(1, '#04040f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    drawStarfield(ctx, W, H, member.user.id.charCodeAt(0));

    // ── Avatar shadow bloom ─────────────────────────────────────────────────────
    const avatarCX = 230, avatarCY = 270, avatarR = 155;

    const bloom = ctx.createRadialGradient(avatarCX, avatarCY, avatarR * 0.4, avatarCX, avatarCY, avatarR * 1.6);
    bloom.addColorStop(0, 'rgba(80,80,160,0.35)');
    bloom.addColorStop(1, 'transparent');
    ctx.fillStyle = bloom;
    ctx.fillRect(avatarCX - avatarR * 2, avatarCY - avatarR * 2, avatarR * 4, avatarR * 4);

    // ── Avatar circle ───────────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const buf = await fetchBuffer(avatarUrl);
        const img = await loadImage(buf);
        ctx.drawImage(img,
            avatarCX - avatarR, avatarCY - avatarR,
            avatarR * 2, avatarR * 2
        );
    } catch {
        // fallback: dark circle
        ctx.fillStyle = '#1e1e3a';
        ctx.fillRect(avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2);
    }
    ctx.restore();

    // Soft inner shadow on avatar edge
    const edgeShadow = ctx.createRadialGradient(
        avatarCX, avatarCY, avatarR * 0.85,
        avatarCX, avatarCY, avatarR
    );
    edgeShadow.addColorStop(0, 'transparent');
    edgeShadow.addColorStop(1, 'rgba(5,5,20,0.55)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = edgeShadow;
    ctx.fill();
    ctx.restore();

    // ── Level badge circle (top-left of avatar) ──────────────────────────────
    const badgeCX = avatarCX - 85, badgeCY = avatarCY - avatarR + 10;
    const badgeR = 44;

    // Badge background
    ctx.save();
    ctx.beginPath();
    ctx.arc(badgeCX, badgeCY, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c38';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Badge text "LvX"
    ctx.font = 'bold 19px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv${level}`, badgeCX, badgeCY + 7);

    // ── Right-side content ─────────────────────────────────────────────────────
    const contentX = 420;
    const rankY = 230;

    // Rank name with "║" prefix
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`\u2016 ${rankName}`, contentX, rankY);

    // XP line
    ctx.font = '22px sans-serif';
    ctx.fillStyle = 'rgba(220,220,255,0.75)';
    if (level < 10) {
        ctx.fillText(`XP: ${xp} / ${xpNeeded}  \u00b7  Total: ${totalXp} memes`, contentX, rankY + 52);
    } else {
        ctx.fillText(`MAX LEVEL  \u00b7  Total: ${totalXp} memes`, contentX, rankY + 52);
    }

    // ── XP bar (pill) ──────────────────────────────────────────────────────────
    const barX = contentX, barY = rankY + 82, barW = 480, barH = 52, barRad = 26;

    // Track (dark pill)
    pillPath(ctx, barX, barY, barW, barH, barRad);
    ctx.fillStyle = '#1a1a3e';
    ctx.fill();

    // Fill
    if (barFill > 0) {
        const fillW = Math.max(barH, barW * barFill); // at least as wide as height for round ends
        ctx.save();
        pillPath(ctx, barX, barY, barW, barH, barRad); // clip to track
        ctx.clip();

        const fillGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
        fillGrad.addColorStop(0, '#3a3a7a');
        fillGrad.addColorStop(1, '#5a5aaa');
        pillPath(ctx, barX, barY, fillW, barH, barRad);
        ctx.fillStyle = fillGrad;
        ctx.fill();
        ctx.restore();
    }

    // % label centred in bar
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${pct}%`, barX + barW / 2, barY + barH / 2 + 8);

    // ── Footer ─────────────────────────────────────────────────────────────────
    ctx.font = '18px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.textAlign = 'right';
    ctx.fillText('CAJU Meme Bot', W - 28, H - 22);

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'profile.png' });
}

// ── command handler ───────────────────────────────────────────────────────────

async function handleProfile(message) {
    const guild = message.guild;
    if (!guild) return;

    const target = message.mentions.members?.first() || message.member;
    const dbUser = getUser(target.id, target.user.username);

    try {
        const attachment = await generateProfileCard(target, dbUser);
        await message.channel.send({
            content: `📊 **${target.user.username}**`,
            files: [attachment],
        });
    } catch (err) {
        console.error('[Profile]', err);
        await message.channel.send('❌ Could not generate profile card.');
    }
}

module.exports = { handleProfile };
