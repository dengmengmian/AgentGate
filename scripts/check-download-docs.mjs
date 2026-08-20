import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);

const downloadDocs = [
  "README.md",
  "README_ZH.md",
  "docs/full-reference.md",
  "docs/full-reference-zh.md",
];

let failed = false;

for (const file of downloadDocs) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  const releaseVersions = [
    ...content.matchAll(
      /github\.com\/dengmengmian\/muxlayer\/releases\/download\/v([0-9]+\.[0-9]+\.[0-9]+)/g,
    ),
  ].map((match) => match[1]);
  const assetVersions = [
    ...content.matchAll(/MuxLayer_([0-9]+\.[0-9]+\.[0-9]+)_/g),
  ].map((match) => match[1]);
  const legacyAssetRefs = [
    ...content.matchAll(/AgentGate_[0-9]+\.[0-9]+\.[0-9]+_/g),
  ];

  const versions = new Set([...releaseVersions, ...assetVersions]);
  if (
    legacyAssetRefs.length > 0 ||
    versions.size !== 1 ||
    !versions.has(packageJson.version)
  ) {
    failed = true;
    console.error(
      `${file} download reference mismatch: expected MuxLayer ${packageJson.version}, found ${[...versions].join(", ") || "none"}${legacyAssetRefs.length > 0 ? "; legacy AgentGate asset reference found" : ""}`,
    );
  }
}

if (failed) {
  process.exitCode = 1;
}
