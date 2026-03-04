/**
 * Downloads and registers the Press Start 2P pixel font from Google Fonts CDN.
 * This is needed on Railway (Linux) where no system fonts are available.
 */
const { GlobalFonts } = require('@napi-rs/canvas');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FONT_URL = 'https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK3nRivM.ttf';
const FONT_DIR = path.join(__dirname, 'fonts');
const FONT_PATH = path.join(FONT_DIR, 'PressStart2P.ttf');
const FONT_FAMILY = 'PressStart2P';

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
        const file = fs.createWriteStream(dest);
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, res => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', err => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

let loaded = false;

async function ensureFont() {
    if (loaded) return FONT_FAMILY;

    if (!fs.existsSync(FONT_PATH)) {
        console.log('[Font] Downloading PressStart2P.ttf...');
        await downloadFile(FONT_URL, FONT_PATH);
        console.log('[Font] Downloaded.');
    }

    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
    loaded = true;
    console.log('[Font] Registered PressStart2P.');
    return FONT_FAMILY;
}

module.exports = { ensureFont, FONT_FAMILY };
