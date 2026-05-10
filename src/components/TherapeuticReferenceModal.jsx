import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';
import { THERAPEUTIC_REFERENCES } from '../lib/therapeuticReferences';

// Phase 5-K-2: full-screen overlay modal showing literature citations + bilingual
// summary + caveats for the current drug's therapeutic range. Triggered from the
// ⓘ button next to the drug select. Closes on outside click, Escape, or ×.
//
// Design notes:
// - Glass card centred over a dim backdrop. Mobile-friendly width (max-w-lg).
// - Locale-aware: summary text comes from THERAPEUTIC_REFERENCES.summaryEn/Ja,
//   selected by i18n.language (no t() — these are drug-specific data, not UI strings).
// - Citation cards link to PubMed in a new tab. PMIDs are permanent identifiers.
// - When `provisional: true`, shows a yellow notice that some values are extrapolated.
export default function TherapeuticReferenceModal({ drug, open, onClose }) {
  const { t, i18n } = useTranslation();
  const cardRef = useRef(null);
  const ref = THERAPEUTIC_REFERENCES[drug];

  // Close on Escape (existing pattern from ChartEventPopover).
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const isJa = i18n.language === 'ja';

  // Render-friendly citation card.
  const Citation = ({ c }) => (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 mb-2">
      <div className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">
        {c.authors} ({c.year})
      </div>
      <div className="text-[11px] italic text-slate-600 dark:text-slate-300">
        {c.journal} {c.volumePage}
      </div>
      <div className="text-[11px] text-slate-700 dark:text-slate-200 mt-1 leading-snug">
        {c.keyFindings}
      </div>
      {c.population && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
          {c.population}
        </div>
      )}
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
        >
          {t('viewOnPubmed')} (PMID:{c.pmid}) <ExternalLink className="w-2.5 h-2.5" />
        </a>
        {c.confidence && (
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
            c.confidence === 'SOLID'
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : c.confidence === 'MODERATE'
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
          }`}>
            {c.confidence}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/70 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        ref={cardRef}
        className="glass rounded-xl shadow-xl border border-slate-300 dark:border-slate-600 w-full max-w-lg p-4 my-4"
        style={{ minHeight: 'fit-content' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
          <h2 className="font-bold text-base text-slate-700 dark:text-slate-200">
            {drug} — {t('therapeuticReferenceTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-red-600 p-1 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!ref ? (
          <div className="text-sm text-slate-600 dark:text-slate-300 italic p-2">
            {t('noReferenceData')}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Applied range */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wide block">
                {t('appliedRange')}
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                Analgesia {ref.appliedRange.analgesiaMin}–{ref.appliedRange.analgesiaMax} ng/mL
                {ref.appliedRange.respiratoryRisk != null &&
                  ` / Resp C50 ${ref.appliedRange.respiratoryRisk} ng/mL`}
              </span>
            </div>

            {/* Provisional warning */}
            {ref.provisional && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-800 rounded p-2 text-[11px] text-amber-800 dark:text-amber-200 flex gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{t('provisionalWarning')}</span>
              </div>
            )}

            {/* Analgesia */}
            {ref.analgesiaCitations?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1.5">
                  {t('analgesiaSection')}
                </h3>
                {ref.analgesiaCitations.map((c, i) => <Citation key={i} c={c} />)}
              </div>
            )}

            {/* Respiratory depression */}
            {ref.respiratoryRiskCitations?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300 mb-1.5">
                  {t('respDepressionSection')}
                </h3>
                {ref.respiratoryRiskCitations.map((c, i) => <Citation key={i} c={c} />)}
              </div>
            )}

            {/* Summary */}
            {(ref.summaryEn || ref.summaryJa) && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1.5">
                  {t('summarySection')}
                </h3>
                <div className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-2">
                  {isJa ? ref.summaryJa : ref.summaryEn}
                </div>
              </div>
            )}

            {/* Caveats */}
            {ref.caveats?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1.5">
                  {t('caveatsSection')}
                </h3>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-disc">
                  {ref.caveats.map((cv, i) => (
                    <li key={i}>{isJa ? cv.ja : cv.en}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
