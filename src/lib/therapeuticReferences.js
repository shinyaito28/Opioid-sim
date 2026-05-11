// Phase 5-K-1 → 5-K-4: Literature-backed therapeutic-range references for the 6 opioid drugs.
//
// All PMIDs were verified by direct PubMed abstract fetch on 2026-05-10. Values
// here are quoted/extracted from the abstracts; numbers in full-text-only papers
// are explicitly noted in `keyFindings`. Confidence levels:
//   SOLID    — abstract-extractable Ce/Css50 from primary RCT or PK/PD study
//   MODERATE — extrapolated from a related study or review article
//   WEAK     — no PubMed-abstract-discoverable Ce, textbook consensus only
//
// Phase 5-K-4 (2026-05-10): keyFindings and caveats enriched from full-text PDFs
// for Dahan 2004 (γ split, postop target 30-90 nM), Sarton 2000 (sex-difference
// PD origin), Lehmann 1991 (MEC distribution + cross-validation), Inturrisi 1987
// (t½ke0 = 3.6 min, cross-tolerance impact), and Bae 2020 (Korean major OPEN
// abdominal MEAC = upper reference). No appliedRange value changes in 5-K-4.
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
        keyFindings: 'In adults after major open abdominal surgery, median MEC (need for rescue) = 0.72 ng/mL (IQR 0.58-1.05) and median MEAC (pain relieved) = 0.99 ng/mL (IQR 0.76-1.28). Corresponding effect-site Ce: 1.09 ng/mL at MEC, 1.73 ng/mL at MEAC. Logistic regression Cp50 (50% probability of analgesia) = 0.63 ± 0.05 ng/mL, γ = 2.24. Authors\' explicit note: "MEAC value of fentanyl determined in this study may be the UPPER REFERENCE value for postoperative pain control" — laparoscopic surgery and ward-day-1-2 settings should have lower MEAC.',
        population: '30 Korean patients post stomach / colorectal / hepatobiliary OPEN abdominal surgery (severe pain), opioid-naive, ASA 1-2',
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
      { en: 'Bae 2020 MEAC (0.99 ng/mL) is an UPPER reference — sourced from Korean major OPEN abdominal surgery (severe acute pain). Laparoscopic procedures and postoperative day 1-2 ward analgesia should have lower MEAC than this.', ja: 'Bae 2020 MEAC (0.99 ng/mL) は upper reference — 出典は韓国の major open abdominal surgery (強い急性痛)。腹腔鏡や術後 1-2 日目病棟管理ではより低い MEAC が想定される。' },
      { en: 'First-arrival-at-PACU plasma fentanyl in Bae 2020 averaged just 0.15 ng/mL — intraop dosing alone usually does not cover early PACU pain; titrate rescue doses promptly', ja: 'Bae 2020 で PACU 到着直後の plasma fentanyl 平均は 0.15 ng/mL — 術中投与だけでは PACU 初期痛をカバーしきれず、rescue を遅滞なく titrate' },
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
        keyFindings: 'Integrated NONMEM analysis: potency parameter AC50 = C50 = 32±1.4 nM (≈9 ng/mL) — analgesia and respiration share the same potency. Steep analgesic dose-response (γ = 2.4±0.7) vs flat respiratory (γ = 1). Blood-effect-site t½ke0 = 4.4±0.3 h. Time-to-peak: analgesia 80-119 min, respiration 90-111 min. Clinical postop/cancer pain treatment targets 30-90 nM (9-25 ng/mL) — at these concentrations, healthy volunteers show 60% respiratory depression. M6G contribution to overall effect: 5-10%.',
        population: '8 healthy volunteers (4M/4F), 0.2 mg/kg IV morphine, 24-h observation',
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
        keyFindings: 'Same potency parameter (32 nM ≈ 9 ng/mL) governs both analgesia and ventilatory depression — γ = 1 for hypercapnic/hypoxic breathing, γ = 2.4 for analgesia. Implication: mild-to-moderate respiratory depression occurs at Ce <10 nM, well before analgesic onset. Clinical worst-case scenario — severe respiratory depression remains possible despite inadequate pain relief.',
        population: '8 healthy volunteers',
        confidence: 'SOLID',
      },
      {
        authors: 'Sarton E et al.',
        year: 2000,
        journal: 'Anesthesiology',
        volumePage: '93:1245-1254',
        pmid: '11046213',
        url: 'https://pubmed.ncbi.nlm.nih.gov/11046213/',
        keyFindings: 'Sex difference in morphine analgesic pharmacodynamics (no PK difference): AC50 for pain tolerance men 76.5±7.4 nM vs women 32.9±7.9 nM (women ~2.3× more potent). ke0 men 0.0073/min (t½ ~1.6 h) vs women 0.0024/min (t½ ~4.8 h) — women have 2-3× slower onset/offset. Plasma morphine, M6G, M3G concentrations identical between sexes. May explain higher postop opioid consumption in men.',
        population: '20 healthy volunteers (10M/10F), 0.1 mg/kg bolus + 30 mcg/kg/h for 1 h',
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
      { en: 'M6G (morphine-6-glucuronide) contributes additional respiratory depression, especially in renal impairment; Dahan 2004 attributed only 5-10% of acute effect to M6G in healthy volunteers', ja: 'M6G (morphine-6-glucuronide) が腎機能低下時に追加で呼吸抑制を起こす; Dahan 2004 では健常者の急性効果に占める M6G 寄与は 5-10% のみ' },
      { en: 'Analgesia γ ≈ 2.4 means dose-response is steep — small Ce changes give large analgesic shifts', ja: '鎮痛の γ ≈ 2.4 で用量反応が急峻 — わずかな Ce 変化で鎮痛効果が大きく動く' },
      { en: 'Sex differences (Sarton 2000): women have ~2× lower AC50 (more potent) for analgesia and ~2-3× slower ke0 (delayed onset/offset). Same direction confirmed for respiratory depression in Sarton 1998/Dahan 1998. PK identical between sexes — the difference is purely pharmacodynamic.', ja: '性差 (Sarton 2000): 女性は AC50 が約半分 (より potent)、ke0 が 2-3 倍遅い (onset/offset 遅延)。Sarton 1998 / Dahan 1998 で呼吸抑制も同方向に確認。PK は両性同一 — 純粋に PD 由来の差。' },
      { en: 'Time-to-peak after IV bolus is delayed (80-119 min for analgesia; Dahan 2004) — wait before re-dosing to avoid stacking', ja: 'IV bolus 後のピーク到達は遅延 (鎮痛 80-119 分; Dahan 2004) — 追加投与は十分待ち、stacking を避ける' },
    ],
    provisional: false,
  },

  Hydromorphone: {
    appliedRange: { analgesiaMin: 4, analgesiaMax: 8, respiratoryRisk: 3.4 },
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
    summaryEn: 'On Olofsen 2026 direct measurements in 51 healthy volunteers, hydromorphone\'s analgesia onset Ce (limit-temp C1D = 4.4, VAS T50 C1D = 4.0 ng/mL) sits ABOVE the respiratory C50,Phys (3.4 ng/mL). Clinically: meaningful respiratory depression starts BEFORE adequate analgesia is reached on average. This is the narrowest therapeutic margin among the 6 opioids on the chart. HM is ~2.6× more potent than morphine for respiratory depression and ~10× more potent for analgesia (limit-temperature endpoint). Faster ventilatory t½ke0 (2.2 h vs morphine 4.7 h) means peak effects arrive sooner after bolus.',
    summaryJa: 'Olofsen 2026 (健常者 51 名直接測定) では、ハイドロモルフォンの鎮痛 onset Ce (限界温度 C1D = 4.4、VAS T50 C1D = 4.0 ng/mL) は呼吸抑制 C50,Phys (3.4 ng/mL) より **高い**。すなわち平均的に「十分な鎮痛が得られる前に臨床的な呼吸抑制が始まる」。これは本アプリ上 6 オピオイド中、最も狭い治療幅。呼吸抑制で morphine の約 2.6 倍、鎮痛 (限界温度) で約 10 倍の力価。呼吸 effect への t½ke0 は 2.2 h (vs morphine 4.7 h) で onset が比較的速く、bolus 後のピーク到達も早い。',
    caveats: [
      { en: 'Analgesic onset Ce sits ~0.6 ng/mL ABOVE the respiratory C50 — HM should be titrated with the same caution as morphine despite its higher absolute potency. Resp depression often precedes analgesia at average potencies.', ja: '鎮痛 onset Ce が呼吸抑制 C50 より ~0.6 ng/mL 高い — 絶対力価が大きくても morphine 同等の慎重な titrate が必要。平均的力価では鎮痛より先に呼吸抑制が出る。' },
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
        keyFindings: 'Steady-state plasma methadone for 50% maximum pain relief (Css50) ranged 0.04-1.13 µg/mL (40-1130 ng/mL), mean 0.29 ± 0.38 µg/mL (290 ng/mL) — ~30-fold individual variation. Hill slope γ = 2.02 (mean). Blood-effect-site t½ke0 = 3.6 min (harmonic mean, range 1.3-23.1 min) — much faster onset than morphine (4.4 h) due to high lipophilicity. 2 of 8 cancer-pain patients showed no analgesic response, attributed to cross-tolerance from prior opioid exposure. Patient with highest prior opioid exposure had the highest Css50 (1.13 µg/mL).',
        population: '8 chronic-pain patients (5 cancer), single IV dose 10-30 mg methadone HCl, all with prior opioid experience',
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
      { en: 'Effect-site equilibration is fast (t½ke0 ≈ 3.6 min, Inturrisi 1987) due to high lipophilicity — IV bolus produces rapid analgesic onset, distinct from the long elimination half-life', ja: 'Effect-site 平衡が速い (t½ke0 ≈ 3.6 min、Inturrisi 1987) — 高親油性のため IV bolus 後の鎮痛 onset は速い (長い消失半減期とは別の話)' },
      { en: 'Cross-tolerance from prior opioids raises required Ce: in Inturrisi 1987, the patient with most prior opioid exposure had a Css50 of 1130 ng/mL vs the cohort mean of 290 ng/mL', ja: '前治療オピオイドからの cross-tolerance で必要 Ce が上昇: Inturrisi 1987 では既往オピオイド最多の症例で Css50 が 1130 ng/mL (集団平均 290 の約4倍)' },
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
        keyFindings: 'Minimum effective serum sufentanil concentration ranged <0.01-0.56 ng/mL (median 0.024 ng/mL), log-normally distributed. Inter-subject CV 84.8%, intra-individual CV 76.0%. "To get into the therapeutic window for analgesia, a serum sufentanil concentration of more than 0.03 ng/ml seems to be necessary." Sufentanil 2.2-3.8× more potent than fentanyl when both effect intensity and duration are considered. Cross-validation: White 1987 reported respiratory depression onset at plasma 0.95 ng/mL; Hudson 1989 reported 0.6-1.9 ng/mL during general anesthesia; O\'Connor & Sear 1988 reported extubation at 0.03-0.37 ng/mL.',
        population: '40 ASA I-III patients post major gynecological surgery, IV PCA, RIA detection limit 0.01 ng/mL',
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
      { en: 'Enormous interindividual variability in MEC (intersubject CV ~85%, Lehmann 1991) — single-number titration unreliable; individual MEC ranged <0.01 to 0.56 ng/mL across 40 patients', ja: 'MEC の個人差が極めて大きい (intersubject CV ~85%、Lehmann 1991) — 単一値での titrate は不確実; 40人中の個人 MEC は <0.01〜0.56 ng/mL に分布' },
    ],
    provisional: false,
  },
};
