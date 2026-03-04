const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { getUser } = require('../database');
const config = require('../config');
const { ensureFont, FONT_FAMILY } = require('../fontLoader');
const https = require('https');
const http = require('http');
const path = require('path');

// ── fetch helper ──────────────────────────────────────────────────────────────
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

// ── pill helper ───────────────────────────────────────────────────────────────
function pill(ctx, x, y, w, h, r) {
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

// ── card generator ────────────────────────────────────────────────────────────
async function generateProfileCard(member, dbUser) {
    const font = await ensureFont();

    const W = 960, H = 460;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const level = dbUser.level;
    const rankObj = level > 0 ? config.RANKS[level - 1] : null;
    const rankName = rankObj ? rankObj.name : 'Unranked';
    const xp = dbUser.xp || 0;
    const totalXp = dbUser.total_xp || 0;
    const xpNeeded = level < 10 ? config.LEVEL_XP[level] : config.LEVEL_XP[9];
    const pct = level >= 10 ? 100 : Math.round((xp / xpNeeded) * 100);
    const barFill = level >= 10 ? 1 : Math.min(xp / xpNeeded, 1);

    // ── background (pixel2.png) ───────────────────────────────────────────────
    try {
        const bg = await loadImage(path.join(__dirname, '..', config.PROFILE_BG));
        ctx.drawImage(bg, 0, 0, W, H);
    } catch {
        const gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
        gr.addColorStop(0, '#0d1035');
        gr.addColorStop(1, '#04040f');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
    }

    // ── avatar ────────────────────────────────────────────────────────────────
    const ax = 230, ay = 270, ar = 155;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const buf = await fetchBuffer(avatarUrl);
        const img = await loadImage(buf);
        ctx.drawImage(img, ax - ar, ay - ar, ar * 2, ar * 2);
    } catch {
        ctx.fillStyle = '#1e1e3a';
        ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    }
    ctx.restore();

    // edge vignette
    const edge = ctx.createRadialGradient(ax, ay, ar * 0.85, ax, ay, ar);
    edge.addColorStop(0, 'transparent');
    edge.addColorStop(1, 'rgba(5,5,20,0.5)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.fillStyle = edge;
    ctx.fill();
    ctx.restore();

    // ── level badge ───────────────────────────────────────────────────────────
    const bx = ax - 85, by = ay - ar + 10, br = 44;

    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,20,45,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold 15px "${font}"`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LV${level}`, bx, by);

    // ── rank name ─────────────────────────────────────────────────────────────
    const cx = 420, ry = 220;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold 22px "${font}"`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`|| ${rankName}`, cx, ry);

    // ── XP line ───────────────────────────────────────────────────────────────
    ctx.font = `12px "${font}"`;
    ctx.fillStyle = 'rgba(220,220,255,0.80)';
    const xpLine = level < 10
        ? `XP: ${xp} / ${xpNeeded}   Total: ${totalXp} memes`
        : `MAX LEVEL   Total: ${totalXp} memes`;
    ctx.fillText(xpLine, cx, ry + 48);

    // ── XP bar ────────────────────────────────────────────────────────────────
    const bX = cx, bY = ry + 75, bW = 480, bH = 50, bR = 25;

    // track
    pill(ctx, bX, bY, bW, bH, bR);
    ctx.fillStyle = 'rgba(15,15,40,0.65)';
    ctx.fill();

    // fill
    if (barFill > 0) {
        ctx.save();
        pill(ctx, bX, bY, bW, bH, bR);
        ctx.clip();
        const fg = ctx.createLinearGradient(bX, bY, bX + bW * barFill, bY);
        fg.addColorStop(0, '#383880');
        fg.addColorStop(1, '#5858b8');
        ctx.fillStyle = fg;
        ctx.fillRect(bX, bY, bW * barFill, bH);
        ctx.restore();
    }

    // % text
    ctx.font = `bold 16px "${font}"`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, bX + bW / 2, bY + bH / 2);

    // ── footer ────────────────────────────────────────────────────────────────
    ctx.font = `10px "${font}"`;
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('CAJU Meme Bot', W - 30, H - 22);

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'profile.png' });
}

// ── command handler ───────────────────────────────────────────────────────────
async function handleProfile(message) {
    const target = message.mentions.members?.first() || message.member;
    const dbUser = getUser(target.id, target.user.username);
    try {
        const attachment = await generateProfileCard(target, dbUser);
        await message.channel.send({ files: [attachment] });
    } catch (err) {
        console.error('[Profile]', err);
        await message.channel.send('❌ Could not generate profile card.');
    }
}

module.exports = { handleProfile };
