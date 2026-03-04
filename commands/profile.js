const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const { getUser } = require('../database');
const config = require('../config');
const { ensureFont, FONT_FAMILY } = require('../fontLoader');
const https = require('https');
const http = require('http');
const path = require('path');

// ── fetch buffer ──────────────────────────────────────────────────────────────
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

// ── starfield (always-working fallback bg) ────────────────────────────────────
function drawStars(ctx, W, H, seed) {
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < 300; i++) {
        const a = rnd() * 0.8 + 0.2;
        ctx.beginPath();
        ctx.arc(rnd() * W, rnd() * H, rnd() * 1.5 + 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.fill();
    }
}

// ── card generator ────────────────────────────────────────────────────────────
async function generateProfileCard(member, dbUser) {
    // 1. Ensure pixel font is registered (downloads from Google Fonts if needed)
    await ensureFont();

    // Use a safe fallback font stack: PressStart2P, then monospace, then sans-serif
    const fontStack = `PressStart2P, monospace, sans-serif`;

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

    // ── 2. Background: try pixel2.png, fall back to starfield ─────────────────
    let bgLoaded = false;
    try {
        const bg = await loadImage(path.join(__dirname, '..', config.PROFILE_BG));
        ctx.drawImage(bg, 0, 0, W, H);
        bgLoaded = true;
    } catch (_) { }

    if (!bgLoaded) {
        // Starfield fallback (same as the reference design)
        const gr = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
        gr.addColorStop(0, '#0d1035');
        gr.addColorStop(1, '#04040f');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, W, H);
        drawStars(ctx, W, H, member.user.id.charCodeAt(0) || 42);
    }

    // ── 3. Avatar ─────────────────────────────────────────────────────────────
    const ax = 230, ay = 270, ar = 155;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.clip();
    try {
        const url = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const img = await loadImage(await fetchBuffer(url));
        ctx.drawImage(img, ax - ar, ay - ar, ar * 2, ar * 2);
    } catch {
        ctx.fillStyle = '#1e1e3a';
        ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    }
    ctx.restore();

    // Soft edge shadow over avatar
    const edgeSh = ctx.createRadialGradient(ax, ay, ar * 0.85, ax, ay, ar);
    edgeSh.addColorStop(0, 'transparent');
    edgeSh.addColorStop(1, 'rgba(5,5,20,0.55)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.fillStyle = edgeSh;
    ctx.fill();
    ctx.restore();

    // ── 4. Level badge ────────────────────────────────────────────────────────
    const bx = ax - 85, by = ay - ar + 10, br = 44;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,20,45,0.90)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.save();
    ctx.font = `bold 14px ${fontStack}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LV${level}`, bx, by);
    ctx.restore();

    // ── 5. Rank name (right side) ─────────────────────────────────────────────
    const cx = 420, ry = 220;
    ctx.save();
    ctx.font = `bold 20px ${fontStack}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`|| ${rankName}`, cx, ry);
    ctx.restore();

    // ── 6. XP info line ───────────────────────────────────────────────────────
    ctx.save();
    ctx.font = `11px ${fontStack}`;
    ctx.fillStyle = 'rgba(220,220,255,0.80)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const xpTxt = level < 10
        ? `XP: ${xp} / ${xpNeeded}   Total: ${totalXp} memes`
        : `MAX LEVEL   Total: ${totalXp} memes`;
    ctx.fillText(xpTxt, cx, ry + 52);
    ctx.restore();

    // ── 7. XP bar ─────────────────────────────────────────────────────────────
    const bX = cx, bY = ry + 78, bW = 480, bH = 50, bR = 25;

    // track
    pill(ctx, bX, bY, bW, bH, bR);
    ctx.fillStyle = 'rgba(15,15,40,0.70)';
    ctx.fill();

    // fill
    if (barFill > 0) {
        ctx.save();
        pill(ctx, bX, bY, bW, bH, bR);
        ctx.clip();
        const fg = ctx.createLinearGradient(bX, bY, bX + bW * barFill, bY);
        fg.addColorStop(0, '#373780');
        fg.addColorStop(1, '#5858b8');
        ctx.fillStyle = fg;
        ctx.fillRect(bX, bY, bW * barFill, bH);
        ctx.restore();
    }

    // % label
    ctx.save();
    ctx.font = `bold 15px ${fontStack}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, bX + bW / 2, bY + bH / 2);
    ctx.restore();

    // ── 8. Footer ─────────────────────────────────────────────────────────────
    ctx.save();
    ctx.font = `9px ${fontStack}`;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('CAJU Meme Bot', W - 28, H - 20);
    ctx.restore();

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
        await message.channel.send('❌ Could not generate profile card: ' + err.message);
    }
}

module.exports = { handleProfile };
