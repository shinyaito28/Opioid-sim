import { Info } from 'lucide-react';

// Phase 5-L-2: One card in the Summary panel. accent ∈ {pink, emerald, red, purple}
// is mapped to a Tailwind colour set so we can keep the same accent styling that
// the inline JSX used to have. helpKey identifies the card for the single-open
// shared popover state managed by the parent.
const ACCENTS = {
  pink: {
    border: 'border-pink-200 dark:border-pink-900/40',
    label: 'text-pink-600',
    value: 'text-pink-700 dark:text-pink-300',
    btn: 'text-pink-500 hover:text-pink-700 dark:hover:text-pink-200',
  },
  emerald: {
    border: 'border-emerald-200 dark:border-emerald-900/40',
    label: 'text-emerald-600',
    value: 'text-emerald-700 dark:text-emerald-300',
    btn: 'text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200',
  },
  red: {
    border: 'border-red-200 dark:border-red-900/40',
    label: 'text-red-600',
    value: 'text-red-700 dark:text-red-300',
    btn: 'text-red-500 hover:text-red-700 dark:hover:text-red-200',
  },
  purple: {
    border: 'border-purple-200 dark:border-purple-900/40',
    label: 'text-purple-600',
    value: 'text-purple-700 dark:text-purple-300',
    btn: 'text-purple-500 hover:text-purple-700 dark:hover:text-purple-200',
  },
};

export default function SummaryCard({
  accent = 'pink',
  label,
  value,
  footer,
  helpKey,
  openId,
  setOpenId,
  t,
}) {
  const styles = ACCENTS[accent] || ACCENTS.pink;
  const isOpen = openId === helpKey;
  return (
    <div className={`bg-white dark:bg-slate-900 border ${styles.border} rounded-lg p-2.5 shadow-sm relative`}>
      <div className="flex items-center justify-between gap-1">
        <div className={`text-[10px] uppercase font-bold tracking-wide truncate ${styles.label}`}>{label}</div>
        <button
          type="button"
          onClick={() => setOpenId(isOpen ? null : helpKey)}
          className={`shrink-0 p-0.5 rounded ${styles.btn} ${isOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
          title={t('summaryHelpTooltip')}
          aria-label={t('summaryHelpTooltip')}
          aria-expanded={isOpen}
        >
          <Info className="w-3 h-3" />
        </button>
      </div>
      <div className={`text-xl font-bold font-mono leading-tight ${styles.value}`}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400">
        {footer}
      </div>
    </div>
  );
}
