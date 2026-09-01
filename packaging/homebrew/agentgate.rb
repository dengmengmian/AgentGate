# Legacy compatibility only. New users should install the muxlayer cask.
cask "agentgate" do
  arch arm: "aarch64", intel: "x64"

  version "2.0.4"
  sha256 arm:   "dcbca89c94f2c2a61f54563418ca65d144e3b4b02825fcb05dcad6628e3df89d",
         intel: "7eed40633537729a18b531341abd8180b55a13dff271f56dba2cca94acda8cd2"

  url "https://github.com/dengmengmian/muxlayer/releases/download/v#{version}/MuxLayer_#{version}_#{arch}.dmg",
      verified: "github.com/dengmengmian/muxlayer/"
  name "MuxLayer (formerly AgentGate)"
  desc "Legacy cask for the MuxLayer local model control layer"
  homepage "https://dengmengmian.github.io/muxlayer/"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  conflicts_with cask: "muxlayer"
  depends_on :macos

  app "MuxLayer.app"

  zap trash: [
    "~/Library/Application Support/com.mengmian.agentgate",
    "~/Library/Caches/com.mengmian.agentgate",
    "~/Library/Preferences/com.mengmian.agentgate.plist",
    "~/Library/Saved Application State/com.mengmian.agentgate.savedState",
    "~/Library/WebKit/com.mengmian.agentgate",
  ]

  caveats <<~EOS
    This cask remains available so existing AgentGate installations keep upgrading.
    New installations should use:
      brew install --cask dengmengmian/tap/muxlayer

    To adopt the new cask name without deleting settings:
      brew uninstall --cask agentgate
      brew install --cask dengmengmian/tap/muxlayer
  EOS
end
