import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const sourcePath = "docs/logo.svg";
const manifestPath = "scripts/brand-assets.json";
const iconsDir = path.join(root, "src-tauri", "icons");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listFiles(directory, prefix = "") {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.join(prefix, entry.name);
      if (entry.isDirectory()) return listFiles(path.join(directory, entry.name), relative);
      return [relative.split(path.sep).join("/")];
    })
    .sort();
}

function pngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${filePath} is not a PNG`);
  }
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function fail(message) {
  console.error(`Brand asset check failed: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(path.join(root, sourcePath))) fail(`${sourcePath} is missing`);
if (!fs.existsSync(path.join(root, manifestPath))) {
  fail(`${manifestPath} is missing; regenerate it after running the Tauri icon pipeline`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), "utf8"));
const sourceHash = sha256(path.join(root, sourcePath));
if (manifest.source !== sourcePath) fail(`manifest source must be ${sourcePath}`);
if (manifest.sourceSha256 !== sourceHash) {
  fail(`${sourcePath} changed without regenerating native icons`);
}

const actualAssets = listFiles(iconsDir).filter((file) => /.(png|icns|ico)$/.test(file));
const expectedAssets = Object.keys(manifest.assets).sort();
if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
  fail("src-tauri/icons does not match the generated asset manifest");
}

for (const [relative, expected] of Object.entries(manifest.assets)) {
  const filePath = path.join(iconsDir, relative);
  if (!fs.existsSync(filePath)) {
    fail(`src-tauri/icons/${relative} is missing`);
    continue;
  }
  if (sha256(filePath) !== expected.sha256) {
    fail(`src-tauri/icons/${relative} is not generated from the current MuxLayer logo`);
  }
  if (expected.type === "png") {
    let size;
    try {
      size = pngSize(filePath);
    } catch (error) {
      fail(error.message);
      continue;
    }
    if (size[0] !== expected.width || size[1] !== expected.height) {
      fail(`src-tauri/icons/${relative} has size ${size[0]}x${size[1]}, expected ${expected.width}x${expected.height}`);
    }
  }
}

const uiLogoPath = path.join(root, "src", "assets", "logo.png");
if (!fs.existsSync(uiLogoPath)) {
  fail("src/assets/logo.png is missing");
} else if (sha256(uiLogoPath) !== manifest.assets["icon.png"]?.sha256) {
  fail("src/assets/logo.png must match the generated Tauri icon.png");
}

const tauriConfig = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
for (const configuredIcon of tauriConfig.bundle.icon) {
  const relative = configuredIcon.replace(/^icons\//, "");
  if (!manifest.assets[relative]) fail(`Tauri bundle icon ${configuredIcon} is not in the manifest`);
}

const icns = fs.readFileSync(path.join(iconsDir, "icon.icns"));
if (icns.toString("ascii", 0, 4) !== "icns") fail("icon.icns has an invalid ICNS signature");
const ico = fs.readFileSync(path.join(iconsDir, "icon.ico"));
if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) fail("icon.ico has an invalid ICO signature");

if (process.exitCode) process.exit(1);
console.log(`Brand assets are consistent with ${sourcePath}.`);
