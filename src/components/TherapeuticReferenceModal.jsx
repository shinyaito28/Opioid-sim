import {useTranslation} from 'react-i18next';
import {ExternalLink} from 'lucide-react';
import {THERAPEUTIC_REFERENCES} from '../lib/therapeuticReferences';
import ViewportDialog from './ViewportDialog';

export default function TherapeuticReferenceModal({drug,open,onClose}) {
  const {t,i18n}=useTranslation(),isJa=i18n.language==='ja',reference=THERAPEUTIC_REFERENCES[drug];
  const citation=c=><article key={c.pmid} className="reference-citation">
    <h4>{c.authors} ({c.year})</h4><p className="reference-journal">{c.journal} {c.volumePage}</p>
    {isJa?<details className="reference-original"><summary>{t('originalCitationNotes')}</summary><p lang="en">{c.keyFindings}</p>{c.population&&<p lang="en">{c.population}</p>}</details>:
      <><p>{c.keyFindings}</p>{c.population&&<p className="muted">{c.population}</p>}</>}
    <div className="reference-links"><a href={c.url} target="_blank" rel="noopener noreferrer">{t('viewOnPubmed')} (PMID: {c.pmid}) <ExternalLink size={13} aria-hidden="true"/></a>
      {c.confidence&&<span>{t('referenceConfidence',{level:t('confidence'+c.confidence)})}</span>}</div>
  </article>;
  return <ViewportDialog open={open} onClose={onClose} t={t} width={600} testId="reference-dialog"
    title={t('entryDrug'+drug,{defaultValue:drug})+' · '+t('therapeuticReferenceTitle')}>
    {!reference?<p className="muted">{t('noReferenceData')}</p>:<div className="reference-content">
      <div className="reference-range"><h3>{t('appliedRange')}</h3>
        <p>{t('referenceAnalgesia')} {reference.appliedRange.analgesiaMin}–{reference.appliedRange.analgesiaMax} ng/mL</p>
        {reference.appliedRange.respiratoryRisk!=null&&<p>{t('referenceRespC50')} {reference.appliedRange.respiratoryRisk} ng/mL</p>}</div>
      {reference.provisional&&<p className="reference-warning">{t('provisionalWarning')}</p>}
      {(reference.summaryEn||reference.summaryJa)&&<section><h3>{t('summarySection')}</h3><p>{isJa?reference.summaryJa:reference.summaryEn}</p></section>}
      {reference.analgesiaCitations?.length>0&&<section><h3>{t('analgesiaSection')}</h3>{reference.analgesiaCitations.map(citation)}</section>}
      {reference.respiratoryRiskCitations?.length>0&&<section><h3>{t('respDepressionSection')}</h3>{reference.respiratoryRiskCitations.map(citation)}</section>}
      {reference.caveats?.length>0&&<section><h3>{t('caveatsSection')}</h3><ul>{reference.caveats.map((c,index)=><li key={index}>{isJa?c.ja:c.en}</li>)}</ul></section>}
    </div>}
  </ViewportDialog>;
}
