import { AlertTriangle, AlertCircle, ShieldCheck, Info } from 'lucide-react';

// Phase 5-L-4 — Render structured alerts produced by lib/alerts.js as colour-
// coded cards under the summary panel. The component intentionally stays
// presentational: the parent computes alerts via useMemo and just passes the
// list down.
//
// Levels:
//   red    — sustained respiratory depression, combined depression > 70%
//   amber  — undertreatment, narrow therapeutic window, analgesia waning
//
// The strip is hidden entirely when there are no alerts (no clutter for the
// happy-path case). A persistent disclaimer footnote reminds the user the
// alerts are advisory, not a substitute for bedside judgement.

const LEVEL_STYLES = {
  red: {
    container: 'border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-900/30',
    title: 'text-red-700 dark:text-red-200',
    body: 'text-red-700/90 dark:text-red-200/90',
    icon: 'text-red-600 dark:text-red-300',
    Icon: AlertTriangle,
  },
  amber: {
    container: 'border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/30',
    title: 'text-amber-700 dark:text-amber-200',
    body: 'text-amber-700/90 dark:text-amber-200/90',
    icon: 'text-amber-600 dark:text-amber-300',
    Icon: AlertCircle,
  },
};

export default function ClinicalAlerts({ alerts, t }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-200">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>{t('alertsStable')}</span>
      </div>
    );
  }

  // Sort red first, then amber. Inside a level, keep original order (which
  // reflects per-drug iteration in lib/alerts.js).
  const ordered = [...alerts].sort((a, b) => {
    if (a.level === b.level) return 0;
    return a.level === 'red' ? -1 : 1;
  });

  return (
    <div className="space-y-1.5">
      {ordered.map((a) => {
        const s = LEVEL_STYLES[a.level] || LEVEL_STYLES.amber;
        const Icon = s.Icon;
        return (
          <div
            key={a.id}
            className={`border ${s.container} rounded-lg p-2.5 flex items-start gap-2 text-xs`}
            role="alert"
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${s.icon}`} />
            <div className="min-w-0 flex-1">
              <div className={`font-bold ${s.title}`}>{t(a.titleKey, a.bodyParams)}</div>
              <div className={`mt-0.5 leading-snug ${s.body}`}>{t(a.bodyKey, a.bodyParams)}</div>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pl-1">
        <Info className="w-3 h-3" />
        <span>{t('alertsDisclaimer')}</span>
      </div>
    </div>
  );
}
