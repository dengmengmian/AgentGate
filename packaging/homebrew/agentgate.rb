cask "agentgate" do
  arch arm: "aarch64", intel: "x64"

  version "1.6.3"
  sha256 arm:   "af5352eb127f0760deed0dbf97f505c331c2622a9adcd3a6842a55d9216a4437",
         intel: "dcec5277ddda7cf3e6fb3296096b604f8c90db894db180abc012d5d1861f2de2"

  url "https://github.com/dengmengmian/muxlayer/releases/download/v#{version}/MuxLayer_#{version}_#{arch}.dmg",
      verified: "github.com/dengmengmian/muxlayer/"
  name "MuxLayer"
  desc "Local AI gateway that routes, converts, fails over, and traces model requests"
  homepage "https://dengmengmian.github.io/muxlayer/"

  livecheck do
    url :url
    strategy :github_latest
  end

  # 应用内置 tauri-plugin-updater 自更新
  auto_updates true
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
