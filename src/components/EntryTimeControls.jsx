import { clockToMinutes } from '../lib/clock';
import { formatEntryTime } from '../lib/workflow';

export default function EntryTimeControls({ minute, setMinute, reference, isClockMode, startTime, t, prefix = 'entry' }) {
  const display = Number.isFinite(minute) ? formatEntryTime(minute, true, startTime).split(' · ')[0].split(' ').at(-1) : '';
  return <div className="space-y-2">
    <div className="flex items-center flex-wrap gap-2">
      <span className="text-xs font-semibold text-slate-500">{t('entryTime')}</span>
      {[[-5, t('entryFiveAgo')], [0, isClockMode ? t('now') : t('entryReference')], [5, t('entryFiveLater')]].map(([offset, label]) =>
        <button key={offset} type="button" data-testid={`${prefix}-time-${offset}`} onClick={() => setMinute(reference + offset)} className={`rounded-lg px-3 py-2 text-xs font-bold ${minute === reference + offset ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{label}</button>)}
      <label className="flex items-center gap-1 text-xs">
        <span>{t('entryExactTime')}</span>
        <input aria-label={t('entryExactTime')} data-testid={`${prefix}-time`} type={isClockMode ? 'time' : 'number'} step="any"
          value={isClockMode ? display : Number.isFinite(minute) ? minute : ''}
          onChange={e => { try { setMinute(isClockMode ? clockToMinutes(e.target.value,startTime,Number.isFinite(minute) ? minute : reference) : e.target.value === '' ? NaN : Number(e.target.value)); } catch { setMinute(NaN); } }}
          className="w-28 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2 text-sm" />
      </label>
    </div>
    <p className="text-xs font-mono text-slate-500" data-testid={`${prefix}-time-label`}>{formatEntryTime(minute,isClockMode,startTime)}</p>
  </div>;
}
