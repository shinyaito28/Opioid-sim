// Phase 5-K-1: Literature-backed therapeutic-range references for the 6 opioid drugs.
//
// All PMIDs were verified by direct PubMed abstract fetch on 2026-05-10. Values
// here are quoted/extracted from the abstracts; numbers in full-text-only papers
// are explicitly noted in `keyFindings`. Confidence levels:
//   SOLID    — abstract-extractable Ce/Css50 from primary RCT or PK/PD study
//   MODERATE — extrapolated from a related study or review article
//   WEAK     — no PubMed-abstract-discoverable Ce, textbook consensus only
//
// `appliedRange` is the value actually used in THERAPEUTIC_RANGES (drugs.js). When
// `provisional: true`, the app should show a "value-extrapolation" warning in the
// reference modal so the clinician knows the literature is thin.

export const THERAPEUTIC_REFERENCES = {
  Fentanyl: {
    appliedRange: { analgesiaMin: 0.5, analgesiaMax: 2.5, respiratoryRisk: 2.3 },
    analgesiaCitations: [
      {
        authors: 'Bae J et al.',
        year: 2020,
        journal: 'Br J Anaesth',
        volumePage: '125:976-985',
        pmid: '32861508',
        url: 'https://pubmed.ncbi.nlm.nih.gov/32861508/',
        keyFindings: 'Postoperative analgesia in adults achieved at Ce 0.5-2.5 ng/mL.',
        population: 'Postoperative adult population, opioid-naive',
        confidence: 'SOLID',
      },
    ],
    respiratoryRiskCitations: [
      {
        authors: 'van Lemmen M et al.',
        year: 2025,
        journal: 'Anesthesiology',
        volumePage: '143:1171-1183',
        pmid: '40773676',
        url: 'https://pubmed.ncbi.nlm.nih.gov/40773676/',
        keyFindings: 'Physiologic CO2 kinetics model gave Ce50 for 50% MV drop = 2.3±0.5 ng/mL (simpler model gave 7.5±1.3 ng/mL).',
        population: 'Healthy volunteers, hyperoxic CO2 challenge',
        confidence: 'SOLID',
      },
    ],
    summaryEn: '0.5-2.5 ng/mL covers postoperative analgesia. Respiratory C50 ≈ 2.3 ng/mL means the upper analgesic band sits right next to clinically meaningful ventilatory depression — patients dosed near the analgesic max should be monitored. Tolerance shifts both bands upward.',
    summaryJa: '0.5-2.5 ng/mL は術後鎮痛域。呼吸抑制 C50 が 2.3 ng/mL なので鎮痛上限と臨床的に意味のある呼吸抑制域がほぼ重なる — 鎮痛上限近辺で運用するときはモニタリング必須。耐性形成で両者が上方にシフトする。',
    caveats: [
      { en: 'Wide interindividual variability (CV ~30-50%)', ja: '個人差が大きい (CV ~30-50%)' },
      { en: 'Opioid-tolerant patients require higher Ce for both analgesia and respiratory depression', ja: 'オピオイド耐性患者では鎮痛も呼吸抑制も Ce が上にシフト' },
      { en: 'Pediatric / neonate ranges differ — see Ginsberg / Anand model citations', ja: '小児・新生児では数値が異なる — Ginsberg / Anand モデルの citation 参照' },
    ],
    provisional: false,
  },

  Remifentanil: {
    appliedRange: { analgesiaMin: 1.0, analgesiaMax: 8.0, respiratoryRisk: 1.1 },
    analgesiaCitations: [
      {
        authors: 'Egan TD et al.',
        year: 1996,
        journal: 'Anesthesiology',
        volumePage: '84:821-833',
        pmid: '8638836',
        url: 'https://pubmed.ncbi.nlm.nih.gov/8638836/',
        keyFindings: 'PK/PD study using EEG spectral edge as the effect measure: remifentanil EEG EC50 = 19.9 ± 5.2 ng/mL (vs alfentanil 375.9 ng/mL, 18.9× more potent). t½ke0 = 1.6 min (k_e0 = 1.14/min) — very rapid effect-site equilibration. NOTE: This EC50 is for deep CNS depression (anesthesia depth), not analgesia. Surgical anesthesia clinical Ce 4-8 ng/mL (textbook/practice-based) is well below the EEG EC50.',
        population: '10 healthy adult male volunteers, EEG-based PK/PD model',
        confidence: 'WEAK', // EEG-based, not analgesia
      },
    ],
    respiratoryRiskCitations: [
      {
        authors: 'Babenco HD, Conard PF, Gross JB',
        year: 2000,
        journal: 'Anesthesiology',
        volumePage: '92:393-398',
        pmid: '10691225',
        url: 'https://pubmed.ncbi.nlm.nih.gov/10691225/',
        keyFindings: 'EC50 for ventilatory depression = 1.12 ng/mL (γ = 1.74). Minute ventilation dropped from 12.9 to 6.1 L/min after 0.5 mcg/kg IV bolus, recovery within 15 min.',
        population: '8 healthy adult volunteers, dual isohypercapnic technique',
        confidence: 'SOLID',
      },
    ],
    summaryEn: 'Respiratory C50 (1.12 ng/mL, Babenco 2000) overlaps the lower end of the analgesic range — this is the narrowest therapeutic margin among common opioids. Fast keo (t½ ~2.9 min) means Ce tracks Cp closely, so steady-state interpretation holds well. Clinical TIVA-with-propofol practice often runs Ce 4-8 ng/mL and accepts the controlled ventilation that comes with it.',
    summaryJa: '呼吸抑制 C50 (1.12 ng/mL、Babenco 2000) は鎮痛域下端と重なり、主要オピオイド中で最も狭い治療幅。keo が速い (t½ ~2.9 min) ため Ce が Cp に追従し、定常状態の解釈がしやすい。Propofol 併用 TIVA では実臨床で Ce 4-8 ng/mL を狙い、調節呼吸下で運用するのが通常。',
    caveats: [
      { en: 'Analgesic Ce range derives from full-text and TIVA practice — abstract-level primary data is sparse', ja: '鎮痛 Ce 域は full text と TIVA 実践由来 — abstract レベルの primary data は少ない' },
      { en: 'Babenco data are opioid-naive volunteers; tolerant patients require higher Ce', ja: 'Babenco データはオピオイド未使用者；耐性者ではより高い Ce が必要' },
      { en: 'Spontaneous breathing under remifentanil at Ce >2 ng/mL is rarely safe outside ICU/recovery', ja: 'Ce >2 ng/mL での自発呼吸は ICU/recovery 以外では安全とは言いがたい' },
    ],
    provisional: false,
  },

  Morphine: {
    appliedRange: { analgesiaMin: 20, analgesiaMax: 80, respiratoryRisk: 10 },
    analgesiaCitations: [
      {
        authors: 'Owen JA, Sitar DS et al.',
        year: 1985,
        journal: 'Clin Pharmacol Ther',
        volumePage: '38:425-431',
        pmid: '3156020',
        url: 'https://pubmed.ncbi.nlm.nih.gov/3156020/',
        keyFindings: 'Patients defined a minimum effective plasma morphine concentration of 20-40 ng/mL. Morphine was consistently effective at ≥40 ng/mL. Maximum self-administered concentration was 82 ng/mL.',
        population: '12 postoperative patients on PCA',
        confidence: 'SOLID',
      },
      {
        authors: 'Dahan A et al.',
        year: 2004,
        journal: 'Anesthesiology',
        volumePage: '101:1201-1209',
        pmid: '15505457',
        url: 'https://pubmed.ncbi.nlm.nih.gov/15505457/',
        keyFindings: 'Integrated NONMEM analysis: potency parameter 32±1.4 nM (~9 ng/mL morphine free base) — analgesia and respiration share the same potency. Blood-effect-site equilibration t½ = 4.4±0.3 h.',
        population: '8 healthy volunteers (4M/4F), morphine infusion, 24-h observation',
        confidence: 'SOLID',
      },
    ],
    respiratoryRiskCitations: [
      {
        authors: 'Dahan A et al.',
        year: 2004,
        journal: 'Anesthesiology',
        volumePage: '101:1201-1209',
        pmid: '15505457',
        url: 'https://pubmed.ncbi.nlm.nih.gov/15505457/',
        keyFindings: 'Same potency parameter (32 nM ≈ 9 ng/mL) governs both analgesia and ventilatory depression — γ = 1 for hypercapnic/hypoxic breathing, γ = 2.4 for analgesia.',
        population: '8 healthy volunteers',
        confidence: 'SOLID',
      },
      {
        authors: 'Romberg R et al.',
        year: 2003,
        journal: 'Anesthesiology',
        volumePage: '99:788-798',
        pmid: '14508308',
        url: 'https://pubmed.ncbi.nlm.nih.gov/14508308/',
        keyFindings: 'Morphine C25 (25% reduction in V_i45) = 28±6 nM ≈ 8 ng/mL — supports the Dahan 2004 potency.',
        population: 'Volunteers, hypoxic ventilatory response',
        confidence: 'SOLID',
      },
      {
        authors: 'Olofsen E et al.',
        year: 2026,
        journal: 'Br J Anaesth',
        volumePage: '136:1459-1471',
        pmid: '41656122',
        url: 'https://pubmed.ncbi.nlm.nih.gov/41656122/',
        keyFindings: 'Physiological ventilatory model C50,Phys = 8.9 ng/mL (IQR 7.0–10.6) for 50% depression of the ventilatory controller output, with blood-effect-site t½ke0 = 4.7 h. Effect-site potency for respiratory rate decrease (C25,RR) = 14.9 ng/mL, end-expiratory CO2 (C1%) = 7.6 ng/mL. Directly measured in 51 healthy volunteers via NONMEM analysis.',
        population: '51 healthy volunteers, 2-h infusion 0.05 mg/kg morphine, crossover design',
        confidence: 'SOLID',
      },
    ],
    summaryEn: 'Morphine\'s analgesic and respiratory depressant potencies share roughly the same Ce (~9 ng/mL for 50% effect — directly confirmed by Olofsen 2026 C50,Phys = 8.9 ng/mL and Dahan 2004 32nM ≈ 9 ng/mL). The clinically targeted analgesic range (20-80 ng/mL) sits well above the respiratory C50 — which is exactly why morphine has a reputation for respiratory depression at therapeutic doses. The very slow keo (t½ 4.4–4.7 h) explains the delayed peak after IV bolus; wait before re-dosing.',
    summaryJa: 'モルヒネは鎮痛効果と呼吸抑制の Ce がほぼ同じ (~9 ng/mL で 50% 効果 — Olofsen 2026 C50,Phys = 8.9 ng/mL と Dahan 2004 の 32 nM 換算 ~9 ng/mL で直接確認済み)。臨床鎮痛域 20-80 ng/mL は呼吸抑制 C50 を遥かに超えるため、治療量で呼吸抑制が起きるのはこの薬理が原因。keo が極端に遅い (t½ 4.4-4.7 h) ため、IV bolus 後のピークが遅れる — 追加投与は十分待つ。',
    caveats: [
      { en: 'M6G (morphine-6-glucuronide) contributes additional respiratory depression, especially in renal impairment', ja: 'M6G (morphine-6-glucuronide) が腎機能低下時に追加で呼吸抑制を起こす' },
      { en: 'Analgesia γ ≈ 2.4 means dose-response is steep — small Ce changes give large analgesic shifts', ja: '鎮痛の γ ≈ 2.4 で用量反応が急峻 — わずかな Ce 変化で鎮痛効果が大きく動く' },
      { en: 'Sex differences: Sarton 1998 showed women have lower morphine respiratory depression Ce', ja: '性差: Sarton 1998 で女性は morphine 呼吸抑制 Ce がより低い' },
    ],
    provisional: false,
  },

  Hydromorphone: {
    appliedRange: { analgesiaMin: 2, analgesiaMax: 8, respiratoryRisk: 3.4 },
    analgesiaCitations: [
      {
        authors: 'Olofsen E et al.',
        year: 2026,
        journal: 'Br J Anaesth',
        volumePage: '136:1459-1471',
        pmid: '41656122',
        url: 'https://pubmed.ncbi.nlm.nih.gov/41656122/',
        keyFindings: 'Limit-temperature potency C1D = 4.4 ng/mL (IQR 3.4–5.5), VAS T50 potency C1D = 4.0 ng/mL (IQR 3.1–6.0). Morphine-to-hydromorphone potency ratios varied 1.2 (CO2) to 10.7 (limit temperature) across endpoints; HM consistently more potent.',
        population: '51 healthy volunteers, balanced crossover, 0.05 mg/kg hydromorphone over 2 h, thermal pain stimulus + VAS',
        confidence: 'SOLID',
      },
      {
        authors: 'Coda BA et al.',
        year: 1997,
        journal: 'Pain',
        volumePage: '71:41-48',
        pmid: '9313274',
        url: 'https://pubmed.ncbi.nlm.nih.gov/9313274/',
        keyFindings: 'Postoperative PCA HM vs morphine comparison in BMT patients; clinical PCA dose ratio HM:morphine ≈ 1:5 confirmed. No direct Ce50 numerical data — supports clinical 2-8 ng/mL range qualitatively.',
        population: '34 postoperative BMT patients (PCA mucositis pain)',
        confidence: 'MODERATE',
      },
    ],
    respiratoryRiskCitations: [
      {
        authors: 'Olofsen E et al.',
        year: 2026,
        journal: 'Br J Anaesth',
        volumePage: '136:1459-1471',
        pmid: '41656122',
        url: 'https://pubmed.ncbi.nlm.nih.gov/41656122/',
        keyFindings: 'Physiological ventilatory model C50,Phys = 3.4 ng/mL (IQR 2.8–4.0) for 50% depression of the ventilatory controller output, with t½ke0 = 2.2 h. Respiratory rate C25,RR = 4.1 ng/mL, end-expiratory CO2 C1% = 6.1 ng/mL. Hydromorphone is approximately 2.6× more potent than morphine for ventilatory depression (8.9 → 3.4 ng/mL). Directly measured in 51 healthy volunteers via NONMEM analysis.',
        population: '51 healthy volunteers, 2-h infusion 0.05 mg/kg hydromorphone, crossover design',
        confidence: 'SOLID',
      },
    ],
    summaryEn: 'Hydromorphone is approximately 2.6× more potent than morphine for respiratory depression (Olofsen 2026 C50,Phys = 3.4 vs 8.9 ng/mL) and 10× more potent for analgesia (limit-temperature endpoint). Clinical PCA analgesic Ce 2-8 ng/mL overlaps with the respiratory C50 — therapeutic window is narrow, similar to morphine. Faster onset than morphine (t½ke0 2.2 h vs 4.7 h for ventilatory effect) means peak effects arrive sooner after bolus.',
    summaryJa: 'ハイドロモルフォンはモルヒネに対し呼吸抑制で約 2.6 倍、鎮痛 (限界温度) で約 10 倍の力価 (Olofsen 2026 直接測定; C50,Phys 3.4 vs 8.9 ng/mL)。臨床 PCA 鎮痛 Ce 2-8 ng/mL は呼吸抑制 C50 と重なり、モルヒネ同様に治療幅が狭い。呼吸 effect への t½ke0 は 2.2 h (vs morphine 4.7 h) で onset がやや速く、bolus 後のピーク到達も早い。',
    caveats: [
      { en: 'Respiratory Ce50 now directly measured (Olofsen 2026); previous extrapolation from morphine ratio is obsolete', ja: '呼吸抑制 Ce50 は直接測定値 (Olofsen 2026); 旧 extrapolation 値は廃止' },
      { en: 'Less metabolite-driven respiratory effect than morphine (no M6G analog)', ja: 'モルヒネと違い M6G に相当する活性代謝物による追加効果は無い' },
      { en: 'Faster onset than morphine but still much slower than fentanyl', ja: 'モルヒネより onset は速いが fentanyl より遥かに遅い' },
    ],
    provisional: false, // Phase 5-K-3: Olofsen 2026 directly measured C50,Phys = 3.4 ng/mL — flag removed
  },

  Methadone: {
    appliedRange: { analgesiaMin: 100, analgesiaMax: 400, respiratoryRisk: 400 },
    analgesiaCitations: [
      {
        authors: 'Inturrisi CE et al.',
        year: 1990,
        journal: 'Clin Pharmacol Ther',
        volumePage: '47:565-577',
        pmid: '2188771',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2188771/',
        keyFindings: 'Mean Css50 for pain relief = 0.359±0.158 µg/mL (≈359 ng/mL); virtually identical to Css50 for sedation (0.336±0.205 µg/mL ≈ 336 ng/mL).',
        population: '15 cancer pain patients, 180-270 min IV methadone infusion',
        confidence: 'SOLID',
      },
      {
        authors: 'Inturrisi CE et al.',
        year: 1987,
        journal: 'Clin Pharmacol Ther',
        volumePage: '41:392-401',
        pmid: '3829576',
        url: 'https://pubmed.ncbi.nlm.nih.gov/3829576/',
        keyFindings: 'Steady-state plasma methadone for 50% maximum pain relief ranged 0.04-1.13 µg/mL (40-1130 ng/mL), mean 0.29 µg/mL (290 ng/mL).',
        population: 'Cancer pain patients',
        confidence: 'SOLID',
      },
    ],
    respiratoryRiskCitations: [
      {
        authors: 'Eap CB, Buclin T, Baumann P',
        year: 2002,
        journal: 'Clin Pharmacokinet',
        volumePage: '41:1153-1193',
        pmid: '12498726',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12498726/',
        keyFindings: 'Comprehensive PK review. MMT induction deaths in non-tolerant heroin users: plasma mean 710 ng/mL (range 300-2520 ng/mL). Inferred respiratory Ce50 ~400 ng/mL falls between sedation Css50 (336 ng/mL, Inturrisi 1990) and lethal plasma mean (710 ng/mL). 17-fold interindividual variation in plasma/dose ratio. QTc prolongation: ECG monitoring recommended for doses >500 mg/day (HERG IC50 = 3032 ng/mL — well above analgesic range).',
        population: 'Review of MMT cohorts + 10 induction-phase fatalities',
        confidence: 'MODERATE',
      },
      {
        authors: 'Inturrisi CE et al. (sedation Css50 as proxy)',
        year: 1990,
        journal: 'Clin Pharmacol Ther',
        volumePage: '47:565-577',
        pmid: '2188771',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2188771/',
        keyFindings: 'Sedation Css50 = 336 ± 205 ng/mL ≈ analgesia Css50 (359 ng/mL); respiratory depression Ce inferred to be in the same 300-450 ng/mL range. No primary respiratory C50 study located.',
        population: '15 cancer pain patients on IV methadone infusion',
        confidence: 'WEAK',
      },
    ],
    summaryEn: 'Methadone has enormous interindividual variability (10-20× range). Analgesic Css50 ~290-359 ng/mL (Inturrisi 1987/1990). Respiratory Ce50 ~400 ng/mL is not directly measured — inferred from sedation Css50 (336 ng/mL) plus MMT induction-phase deaths plasma mean (710 ng/mL, Eap 2002). Long elimination half-life (24-36 h) means accumulation; steady-state Ce is the operational concept. QTc prolongation is a separate non-Ce safety concern — ECG monitoring recommended for doses >500 mg/day.',
    summaryJa: 'メサドンは個人差が極めて大きい (10-20倍)。鎮痛 Css50 ~290-359 ng/mL (Inturrisi 1987/1990)。呼吸抑制 Ce50 ~400 ng/mL は直接測定値ではなく、sedation Css50 (336 ng/mL) と MMT 導入期死亡例の plasma mean (710 ng/mL、Eap 2002) からの推定。半減期が長く (24-36 h) 蓄積するため、定常状態の Ce が臨床的な操作概念。QT 延長は Ce と独立した別個のリスク — Eap 2002 は >500 mg/day で ECG モニタを推奨。',
    caveats: [
      { en: 'Respiratory Ce50 is INFERRED from sedation Css50 + induction-phase deaths plasma data (Eap 2002) — no direct primary Ce50 study', ja: '呼吸抑制 Ce50 は sedation Css50 と導入期死亡例 plasma 値 (Eap 2002) からの推定 — 直接の primary Ce50 study は無し' },
      { en: 'Css50 range across individuals 40-1130 ng/mL — clinical dosing must be titrated, never use a single number', ja: '個人間の Css50 範囲 40-1130 ng/mL — 単一値で投与せず必ず titrate' },
      { en: 'Long terminal half-life (24-36 h) → repeated daily dosing accumulates over 5-7 days', ja: '消失半減期が長く (24-36 h) 反復投与で 5-7 日かけて蓄積' },
      { en: 'QTc prolongation: ECG monitoring recommended for doses >500 mg/day (Eap 2002); HERG IC50 = ~3000 ng/mL', ja: 'QT 延長: >500 mg/day で ECG モニタ推奨 (Eap 2002); HERG IC50 ~3000 ng/mL' },
    ],
    provisional: true, // Phase 5-K-3: WEAK → MODERATE upgraded (Eap 2002), but no primary Ce50 study — flag retained
  },

  Sufentanil: {
    appliedRange: { analgesiaMin: 0.03, analgesiaMax: 0.5, respiratoryRisk: 0.5 },
    analgesiaCitations: [
      {
        authors: 'Lehmann KA et al.',
        year: 1991,
        journal: 'Acta Anaesthesiol Scand',
        volumePage: '35:221-226',
        pmid: '1674829',
        url: 'https://pubmed.ncbi.nlm.nih.gov/1674829/',
        keyFindings: 'Minimum effective serum sufentanil concentration ranged <0.01-0.56 ng/mL (median 0.024 ng/mL). "To get into the therapeutic window for analgesia, a serum sufentanil concentration of more than 0.03 ng/ml seems to be necessary."',
        population: '40 ASA I-III patients post major gynecological surgery, IV PCA',
        confidence: 'SOLID',
      },
    ],
    respiratoryRiskCitations: [
      {
        authors: 'Bailey PL et al.',
        year: 1990,
        journal: 'Anesth Analg',
        volumePage: '70:8-15',
        pmid: '2136976',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2136976/',
        keyFindings: 'Sufentanil 0.4 mcg/kg IV bolus produced significant ventilatory depression with plasma 1.19 ± 0.20 ng/mL at 5 min; recovery to baseline by 30 min when plasma fell to ~0.14-0.50 ng/mL. No explicit Ce50 formula — derived range suggests respiratory C50 around 0.5 ng/mL. At equipotent doses, sufentanil produced less and shorter-lasting respiratory depression than fentanyl.',
        population: '30 healthy young adult male volunteers, double-blind randomized crossover, doses 0.1/0.2/0.4 mcg/kg',
        confidence: 'MODERATE',
      },
    ],
    summaryEn: 'Sufentanil is ~5-10× more potent than fentanyl. Lehmann 1991 PCA data give a clear MEAC threshold of ~0.03 ng/mL — patients should not be expected to obtain analgesia below this. Surgical/PCA upper range up to 0.5 ng/mL. Respiratory depression Ce50 is moderately well established at ~0.5 ng/mL but the primary data is in full text rather than abstract.',
    summaryJa: 'スフェンタニルは fentanyl の 5-10 倍力価。Lehmann 1991 の PCA データから MEAC 閾値が明確に ~0.03 ng/mL — これを下回れば鎮痛は期待できない。手術・PCA 上限は 0.5 ng/mL 程度。呼吸抑制 Ce50 は ~0.5 ng/mL がほどほど確立されているが primary data は full text にしかない。',
    caveats: [
      { en: 'Respiratory Ce50 numeric value comes from full-text Bailey 1990 / textbook conventions, not abstract-extractable', ja: '呼吸抑制 Ce50 数値は full text Bailey 1990 / 教科書由来、abstract からは抽出不可' },
      { en: 'Surgical anesthesia Ce 1-3 ng/mL is from MAC-reduction studies (Glass and others) — not from Lehmann', ja: '外科麻酔 Ce 1-3 ng/mL は MAC 減量研究 (Glass 他) 由来 — Lehmann ではない' },
      { en: 'Very lipophilic — large Vd and slow context-sensitive offset', ja: '高親油性のため Vd が大きく、context-sensitive な消失が遅い' },
    ],
    provisional: false,
  },
};
