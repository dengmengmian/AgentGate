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

const websiteDocs = ["site/index.html", "site/zh/index.html"];
const currentSurfaceDocs = [...downloadDocs, ...websiteDocs];
const primaryBrewCommand =
  "brew install --cask dengmengmian/tap/muxlayer";
const legacyBrewCommand =
  "brew install --cask dengmengmian/tap/agentgate";

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

  if (
    !content.includes(primaryBrewCommand) ||
    content.includes(legacyBrewCommand)
  ) {
    failed = true;
    console.error(
      `${file} Homebrew command mismatch: MuxLayer must be the primary cask`,
    );
  }
}

const providerCount = fs
  .readdirSync(path.join(root, "provider-catalog", "providers"))
  .filter((file) => file.endsWith(".json")).length;

if (providerCount < 25) {
  failed = true;
  console.error(
    `Provider marketing claim requires at least 25 catalog providers, found ${providerCount}`,
  );
}

const staleProviderClaims = [
  /20\+ providers/,
  /20\+ 家 Provider/,
  /26 providers/,
  /26 家/,
  /26 个 [Pp]rovider/,
  /再 \+ 20 家/,
  /\+ 20 more/,
];

for (const file of currentSurfaceDocs) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  const staleClaim = staleProviderClaims.find((pattern) =>
    pattern.test(content),
  );
  if (staleClaim) {
    failed = true;
    console.error(`${file} contains stale provider count: ${staleClaim}`);
  }
}

for (const file of ["README.md", "docs/full-reference.md", "site/index.html"]) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  if (!content.includes("25+ model providers")) {
    failed = true;
    console.error(`${file} is missing the canonical provider claim`);
  }
}

for (const file of [
  "README_ZH.md",
  "docs/full-reference-zh.md",
  "site/zh/index.html",
]) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  if (!content.includes("25+ 家模型供应商")) {
    failed = true;
    console.error(`${file} 缺少统一的 Provider 数量表达`);
  }
}

const caskChecks = [
  {
    file: "packaging/homebrew/muxlayer.rb",
    required: [
      'cask "muxlayer" do',
      `version "${packageJson.version}"`,
      "github.com/dengmengmian/muxlayer/releases/download/",
      'name "MuxLayer"',
      'homepage "https://dengmengmian.github.io/muxlayer/"',
      'app "MuxLayer.app"',
    ],
  },
  {
    file: "packaging/homebrew/agentgate.rb",
    required: [
      'cask "agentgate" do',
      `version "${packageJson.version}"`,
      "Legacy compatibility only",
      "github.com/dengmengmian/muxlayer/releases/download/",
      'app "MuxLayer.app"',
    ],
  },
];

for (const { file, required } of caskChecks) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failed = true;
    console.error(`${file} is missing`);
    continue;
  }
  const content = fs.readFileSync(fullPath, "utf8");
  for (const expected of required) {
    if (!content.includes(expected)) {
      failed = true;
      console.error(`${file} is missing: ${expected}`);
    }
  }
  const hashes = [...content.matchAll(/"([0-9a-f]{64})"/g)];
  if (hashes.length !== 2) {
    failed = true;
    console.error(`${file} must contain exactly two SHA-256 hashes`);
  }
}

const releaseWorkflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "release.yml"),
  "utf8",
);
for (const cask of ["tap/Casks/muxlayer.rb", "tap/Casks/agentgate.rb"]) {
  if (!releaseWorkflow.includes(cask)) {
    failed = true;
    console.error(`release workflow does not update ${cask}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
