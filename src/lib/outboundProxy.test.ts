import { describe, expect, it } from "vitest";
import {
  outboundProxyToastKey,
  shouldRestartGatewayForProxy,
} from "./outboundProxy";

describe("outboundProxyToastKey", () => {
  it("开启且无地址时提示去填地址", () => {
    expect(
      outboundProxyToastKey(true, { outbound_proxy_enabled: true }, false)
    ).toBe("settings.outbound_proxy_need_url");
  });

  it("开启且网关在跑时提示已开启", () => {
    expect(
      outboundProxyToastKey(true, { outbound_proxy_enabled: true }, true)
    ).toBe("settings.outbound_proxy_on");
  });

  it("关闭且网关在跑时提示已关闭", () => {
    expect(
      outboundProxyToastKey(true, { outbound_proxy_enabled: false }, true)
    ).toBe("settings.outbound_proxy_off");
  });

  it("改地址且网关在跑时提示地址已更新", () => {
    expect(
      outboundProxyToastKey(
        true,
        { outbound_proxy_url: "http://127.0.0.1:7890" },
        true
      )
    ).toBe("settings.outbound_proxy_url_saved");
  });

  it("清空地址时提示不会生效", () => {
    expect(outboundProxyToastKey(true, { outbound_proxy_url: "" }, false)).toBe(
      "settings.outbound_proxy_need_url"
    );
  });

  it("网关未启动时不说已重启", () => {
    expect(
      outboundProxyToastKey(false, { outbound_proxy_enabled: false }, true)
    ).toBe("settings.outbound_proxy_need_start");
  });
});

describe("shouldRestartGatewayForProxy", () => {
  it("开启但还没地址时不重启", () => {
    expect(
      shouldRestartGatewayForProxy(
        true,
        { outbound_proxy_enabled: true },
        false
      )
    ).toBe(false);
  });

  it("关闭时重启", () => {
    expect(
      shouldRestartGatewayForProxy(
        true,
        { outbound_proxy_enabled: false },
        false
      )
    ).toBe(true);
  });

  it("网关没跑不重启", () => {
    expect(
      shouldRestartGatewayForProxy(
        false,
        { outbound_proxy_enabled: false },
        true
      )
    ).toBe(false);
  });
});
