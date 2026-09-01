import { useEffect, useState } from "react";
import { Cloud, HardDrive, Split, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import * as api from "@/lib/api";
import { toast } from "@/components/common/Toast";
import type { RouteTemplatePreview } from "@/lib/bindings";

type TemplateId = "task_split" | "local_cloud";

export function RouteTemplateDialog({
  profileId,
  providers,
  canRollback,
  onClose,
  onApplied,
  onRollback,
}: {
  profileId: string;
  providers: { id: string; name: string; base_url: string }[];
  canRollback: boolean;
  onClose: () => void;
  onApplied: () => void;
  onRollback: () => void;
}) {
  const { t } = useI18n();
  const [templateId, setTemplateId] = useState<TemplateId>("task_split");
  const [mainId, setMainId] = useState("");
  const [thinkId, setThinkId] = useState("");
  const [backgroundId, setBackgroundId] = useState("");
  const [applyAll, setApplyAll] = useState(true);
  const [preview, setPreview] = useState<RouteTemplatePreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await api.previewRouteTemplate({
          template_id: templateId,
          profile_id: profileId,
          main_provider_id: mainId || null,
          think_provider_id: thinkId || null,
          background_provider_id: backgroundId || null,
          apply_to_all_defaults: applyAll,
        });
        if (cancelled) return;
        setPreview(next);
        const suggestedMain = next.roles.find((r) => r.role === "main");
        const suggestedBg = next.roles.find((r) => r.role === "background");
        const suggestedThink = next.roles.find((r) => r.role === "think");
        if (!mainId && suggestedMain) setMainId(suggestedMain.provider_id);
        if (!backgroundId && suggestedBg)
          setBackgroundId(suggestedBg.provider_id);
        if (!thinkId && suggestedThink) setThinkId(suggestedThink.provider_id);
      } catch (err) {
        if (!cancelled) toast("error", (err as api.AppError).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, profileId, mainId, thinkId, backgroundId, applyAll]);

  const apply = async () => {
    if (!preview?.can_apply) return;
    setBusy(true);
    try {
      await api.applyRouteTemplate({
        template_id: templateId,
        profile_id: profileId,
        main_provider_id: mainId || null,
        think_provider_id: thinkId || null,
        background_provider_id: backgroundId || null,
        apply_to_all_defaults: applyAll,
      });
      toast("success", t("routes.template_applied"));
      onApplied();
    } catch (err) {
      toast("error", (err as api.AppError).message);
    } finally {
      setBusy(false);
    }
  };

  const warnText = (code: string) => {
    const key = `routes.tpl.${code}`;
    const translated = t(key);
    return translated === key ? code : translated;
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="animate-scale-in relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-5"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {t("routes.template_title")}
            </h3>
            <p className="mt-1 text-[11px] text-text-muted">
              {t("routes.template_failover_note")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTemplateId("task_split")}
            className={`rounded-lg border p-3 text-left ${
              templateId === "task_split"
                ? "border-accent/40 bg-accent/5"
                : "border-border hover:bg-hover"
            }`}
          >
            <Split className="mb-1.5 h-4 w-4 text-accent" />
            <p className="text-xs font-semibold text-text-primary">
              {t("routes.template_task_split")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              {t("routes.template_task_split_desc")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setTemplateId("local_cloud")}
            className={`rounded-lg border p-3 text-left ${
              templateId === "local_cloud"
                ? "border-accent/40 bg-accent/5"
                : "border-border hover:bg-hover"
            }`}
          >
            <span className="mb-1.5 flex items-center gap-1 text-accent">
              <HardDrive className="h-4 w-4" />
              <Cloud className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold text-text-primary">
              {t("routes.template_local_cloud")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              {t("routes.template_local_cloud_desc")}
            </p>
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <label className="block text-[11px] text-text-muted">
            {t("routes.template_main")}
            <select
              value={mainId}
              onChange={(e) => setMainId(e.target.value)}
              className="form-input mt-1 w-full"
            >
              <option value="">{t("common.none")}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-text-muted">
            {t("routes.template_think")}
            <select
              value={thinkId}
              onChange={(e) => setThinkId(e.target.value)}
              className="form-input mt-1 w-full"
            >
              <option value="">{t("routes.template_think_none")}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-text-muted">
            {t("routes.template_background")}
            <select
              value={backgroundId}
              onChange={(e) => setBackgroundId(e.target.value)}
              className="form-input mt-1 w-full"
            >
              <option value="">{t("common.none")}</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 flex items-start gap-2 text-[11px] text-text-secondary">
          <input
            type="checkbox"
            checked={applyAll}
            onChange={(e) => setApplyAll(e.target.checked)}
            className="mt-0.5"
          />
          {t("routes.template_apply_all")}
        </label>

        {preview && preview.roles.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-md border border-border bg-card-secondary px-3 py-2 text-[11px] text-text-secondary">
            {preview.roles.map((role) => (
              <li key={role.role}>
                {t(`routes.template_role_${role.role}`)} → {role.provider_name}
                {role.is_local ? " (local)" : ""}
              </li>
            ))}
          </ul>
        )}

        {preview?.warnings.map((code) => (
          <p key={code} className="mt-2 text-[11px] text-warning">
            {warnText(code)}
          </p>
        ))}

        <div className="mt-4 flex justify-end gap-2">
          {canRollback && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onRollback}
            >
              {t("routes.template_rollback")}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!preview?.can_apply || busy}
            onClick={apply}
          >
            {t("routes.template_apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
