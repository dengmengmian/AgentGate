export function outboundProxyToastKey(
  running: boolean,
  patch: { outbound_proxy_enabled?: boolean; outbound_proxy_url?: string },
  hasUrl: boolean
): string {
  if (!hasUrl && patch.outbound_proxy_enabled !== false) {
    return "settings.outbound_proxy_need_url";
  }
  if (!running) {
    return "settings.outbound_proxy_need_start";
  }
  if (patch.outbound_proxy_enabled === false) {
    return "settings.outbound_proxy_off";
  }
  if (patch.outbound_proxy_enabled === true) {
    return "settings.outbound_proxy_on";
  }
  return "settings.outbound_proxy_url_saved";
}

export function shouldRestartGatewayForProxy(
  running: boolean,
  patch: { outbound_proxy_enabled?: boolean },
  hasUrl: boolean
): boolean {
  if (!running) return false;
  if (patch.outbound_proxy_enabled === true && !hasUrl) return false;
  return true;
}
