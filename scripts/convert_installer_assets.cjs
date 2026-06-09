const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function processImg(src, outName, width, height) {
    try {
        const image = await Jimp.read(src);
        // Resize and crop to the exact dimensions needed
        image.cover(width, height);
        const outPath = path.join("src-tauri", "icons", "installer", outName);
        console.log(`Saving ${outName} to ${outPath}`);
        await image.writeAsync(outPath);
        console.log(`✅ Success: ${outName}`);
    } catch (e) {
        console.error(`❌ Failed to process ${outName}:`, e);
    }
}

const sourceDialog = "C:\\Users\\anjaymi\\.gemini\\antigravity\\brain\\a758a62c-734c-4cfa-942e-11cf0a772441\\installer_dialog_1771941929508.png";
const sourceBanner = "C:\\Users\\anjaymi\\.gemini\\antigravity\\brain\\a758a62c-734c-4cfa-942e-11cf0a772441\\installer_banner_1771942211524.png";

const outDir = path.join("src-tauri", "icons", "installer");
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
    console.log("Starting conversion to BMP...");
    await processImg(sourceDialog, "nsis_sidebar.bmp", 164, 314);
    await processImg(sourceDialog, "wix_dialog.bmp", 493, 312);
    await processImg(sourceBanner, "nsis_header.bmp", 150, 57);
    await processImg(sourceBanner, "wix_banner.bmp", 493, 58);
    console.log("All done!");
}

main();
