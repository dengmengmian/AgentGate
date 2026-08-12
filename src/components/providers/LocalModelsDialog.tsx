import { useCallback, useEffect, useState } from "react";
import { X, Loader2, HardDrive } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/common/Toast";
import * as api from "@/lib/api";

interface LocalModelsDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (ep: api.LocalEndpoint) => void | Promise<void>;
}

/// Local Ollama / LM Studio / OpenAI-compatible discovery. User-triggered only
/// (toolbar → dialog) so the Providers page stays focused on cloud providers.
export function LocalModelsDialog({
  open,
  onClose,
  onAdd,
}: LocalModelsDialogProps) {
  const { t } = useI18n();
  const [endpoints, setEndpoints] = useState<api.LocalEndpoint[]>([]);
  const [scanning, setScanning] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      setEndpoints(await api.discoverLocalEndpoints());
    } catch (err) {
      toast("error", (err as api.AppError).message);
    } finally {
      setScanning(false);
    }
  }, []);

  // Auto-scan each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    void scan();
  }, [open, scan]);

  if (!open) return null;

  const handleAdd = async (ep: api.LocalEndpoint) => {
    const key = `${ep.name}-${ep.port}`;
    setAddingKey(key);
    try {
      await onAdd(ep);
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">
                {t("providers.local_discover")}
              </h2>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {t("providers.local_discover_hint")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:bg-card-secondary hover:text-text-primary"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-2.5">
          <p className="text-[11px] text-text-muted">
            {scanning
              ? t("providers.local_scanning")
              : t("providers.local_scan_done")}
          </p>
          <button
            type="button"
            onClick={() => void scan()}
            disabled={scanning}
            className="btn-secondary text-xs"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("providers.local_scan")}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {scanning && endpoints.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("providers.local_scanning")}
            </div>
          ) : endpoints.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">
              {t("providers.local_empty")}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {endpoints.map((ep) => {
                const key = `${ep.name}-${ep.port}`;
                const busy = addingKey === key;
                return (
                  <li
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {ep.name}
                        </span>
                        <span
                          className={
                            ep.reachable
                              ? "text-[10px] text-success"
                              : "text-[10px] text-text-muted"
                          }
                        >
                          {ep.reachable
                            ? t("providers.local_reachable")
                            : t("providers.local_offline")}
                        </span>
                      </div>
                      <p className="truncate font-mono text-[11px] text-text-secondary">
                        {ep.base_url}
                      </p>
                      {ep.models.length > 0 && (
                        <p className="mt-0.5 text-[10px] text-text-muted">
                          {ep.models.slice(0, 4).join(", ")}
                          {ep.models.length > 4 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-primary shrink-0 text-[11px]"
                      disabled={busy}
                      onClick={() => void handleAdd(ep)}
                    >
                      {busy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {t("providers.local_add")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
