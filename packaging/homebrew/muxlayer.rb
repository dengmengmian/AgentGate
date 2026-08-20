cask "muxlayer" do
  arch arm: "aarch64", intel: "x64"

  version "2.0.0"
  sha256 arm:   "3146f681cfe80ed6229b545c78e2fb7c212e21a24aebf67488bae10684bc5abf",
         intel: "6f015060bc8ef60c49e782fb9e1250c915698bf2b5259f27dae481ed8c4bf3ea"

  url "https://github.com/dengmengmian/muxlayer/releases/download/v#{version}/MuxLayer_#{version}_#{arch}.dmg",
      verified: "github.com/dengmengmian/muxlayer/"
  name "MuxLayer"
  desc "Local model control layer for coding agents"
  homepage "https://dengmengmian.github.io/muxlayer/"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  conflicts_with cask: "agentgate"
  depends_on :macos

  app "MuxLayer.app"

  zap trash: [
    "~/Library/Application Support/com.mengmian.agentgate",
    "~/Library/Caches/com.mengmian.agentgate",
    "~/Library/Preferences/com.mengmian.agentgate.plist",
    "~/Library/Saved Application State/com.mengmian.agentgate.savedState",
    "~/Library/WebKit/com.mengmian.agentgate",
  ]
end
