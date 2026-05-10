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
        keyFindings: 'PK/PD study of remifentanil in volunteers; analgesic Ce values are reported in the full text but not in the PubMed abstract. Surgical anesthesia Ce typically 4-8 ng/mL with co-induction.',
        population: 'Healthy adult volunteers',
        confidence: 'WEAK', // abstract has no abstract-extractable Ce numbers
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
    ],
    summaryEn: 'Morphine\'s analgesic and respiratory depressant potencies share roughly the same Ce (~9 ng/mL for 50% effect). The clinically targeted analgesic range (20-80 ng/mL) sits well above the respiratory C50 — which is exactly why morphine has a reputation for respiratory depression at therapeutic doses. The very slow keo (t½ 4.4 h) explains the delayed peak after IV bolus; wait before re-dosing.',
    summaryJa: 'モルヒネは鎮痛効果と呼吸抑制の Ce がほぼ同じ (~9 ng/mL で 50% 効果)。臨床鎮痛域 20-80 ng/mL は呼吸抑制 C50 を遥かに超えるため、治療量で呼吸抑制が起きるのはこの薬理が原因。keo が極端に遅い (t½ 4.4 h) ため、IV bolus 後のピークが遅れる — 追加投与は十分待つ。',
    caveats: [
      { en: 'M6G (morphine-6-glucuronide) contributes additional respiratory depression, especially in renal impairment', ja: 'M6G (morphine-6-glucuronide) が腎機能低下時に追加で呼吸抑制を起こす' },
      { en: 'Analgesia γ ≈ 2.4 means dose-response is steep — small Ce changes give large analgesic shifts', ja: '鎮痛の γ ≈ 2.4 で用量反応が急峻 — わずかな Ce 変化で鎮痛効果が大きく動く' },
      { en: 'Sex differences: Sarton 1998 showed women have lower morphine respiratory depression Ce', ja: '性差: Sarton 1998 で女性は morphine 呼吸抑制 Ce がより低い' },
    ],
    provisional: false,
  },

  Hydromorphone: {
    appliedRange: { analgesiaMin: 2, analgesiaMax: 8, respiratoryRisk: 1.0 },
    analgesiaCitations: [
      {
        authors: 'Olofsen E et al.',
        year: 2026,
        journal: 'Br J Anaesth',
        volumePage: 'in press',
        pmid: '41656122',
        url: 'https://pubmed.ncbi.nlm.nih.gov/41656122/',
        keyFindings: 'Limit-temperature modelling gave separate morphine (46.9 ng/mL) and hydromorphone (4.4 ng/mL) analgesic potencies — ~10:1 morphine:hydromorphone potency ratio at the effect site.',
        population: '51 healthy volunteers, balanced crossover, 0.2 mg/kg hydromorphone over 2 h, thermal pain stimulus',
        confidence: 'SOLID',
      },
      {
        authors: 'Coda BA et al.',
        year: 1997,
        journal: 'Pain',
        volumePage: '71:41-48',
        pmid: '9313274',
        url: 'https://pubmed.ncbi.nlm.nih.gov/9313274/',
        keyFindings: 'Postoperative PCA hydromorphone — Ce ranges in full text only; supports clinical analgesic Ce ~2-8 ng/mL.',
        population: 'Postoperative PCA',
        confidence: 'MODERATE',
      },
    ],
    respiratoryRiskCitations: [
      {
        authors: 'Olofsen E et al. (extrapolated)',
        year: 2026,
        journal: 'Br J Anaesth',
        volumePage: 'in press',
        pmid: '41656122',
        url: 'https://pubmed.ncbi.nlm.nih.gov/41656122/',
        keyFindings: 'Abstract describes integrated respiratory + analgesia modeling but does not separately quote a hydromorphone respiratory Ce50. Extrapolated from morphine resp Ce50 (~9 ng/mL) using the 10:1 potency ratio → ~1 ng/mL.',
        population: 'Volunteers',
        confidence: 'MODERATE',
      },
    ],
    summaryEn: 'Hydromorphone is roughly 10× more potent than morphine on a Ce basis (Olofsen 2026 confirmed). Analgesic Ce 2-8 ng/mL covers most postoperative use. Respiratory C50 (~1 ng/mL) is extrapolated — primary abstract-level Ce50 data is sparse. Like morphine, the analgesic and respiratory potencies are similar, so the therapeutic window is narrow.',
    summaryJa: 'ハイドロモルフォンはモルヒネの約10倍力価 (Ce ベース、Olofsen 2026 確認)。鎮痛 Ce 2-8 ng/mL が術後の主使用域。呼吸抑制 C50 (~1 ng/mL) はモルヒネとの potency ratio から外挿 — primary な abstract レベルの Ce50 データは少ない。モルヒネ同様、鎮痛と呼吸抑制の potency が近いため治療幅は狭い。',
    caveats: [
      { en: 'Respiratory Ce50 is extrapolated from Olofsen morphine:hydromorphone potency ratio, not directly measured', ja: '呼吸抑制 Ce50 は Olofsen の morphine:hydromorphone potency 比から外挿、直接測定値ではない' },
      { en: 'Less metabolite-driven respiratory effect than morphine (no M6G analog)', ja: 'モルヒネと違い M6G に相当する活性代謝物による追加効果は無い' },
      { en: 'Faster onset than morphine but still much slower than fentanyl', ja: 'モルヒネより onset は速いが fentanyl より遥かに遅い' },
    ],
    provisional: true, // Resp Ce50 extrapolated, not directly measured
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
        authors: 'Inturrisi CE et al. (sedation Css50 as proxy)',
        year: 1990,
        journal: 'Clin Pharmacol Ther',
        volumePage: '47:565-577',
        pmid: '2188771',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2188771/',
        keyFindings: 'Sedation Css50 = 336 ng/mL ≈ analgesia Css50; respiratory Ce50 inferred to be in the same 300-450 ng/mL range. No primary respiratory C50 paper located on PubMed with abstract-level numbers.',
        population: 'Inferred extrapolation',
        confidence: 'WEAK',
      },
    ],
    summaryEn: 'Methadone has enormous interindividual variability (10-20× range). Analgesic Css50 ~290-359 ng/mL (Inturrisi 1987/1990). Respiratory Ce50 is not directly measured in any PubMed-abstract-level paper — inferred ~400 ng/mL from sedation Css50. Long elimination half-life (24-36 h) means accumulation; steady-state Ce is the operational concept. QTc prolongation is a separate non-Ce safety concern.',
    summaryJa: 'メサドンは個人差が極めて大きい (10-20倍)。鎮痛 Css50 ~290-359 ng/mL (Inturrisi 1987/1990)。呼吸抑制 Ce50 は PubMed abstract レベルでは未測定 — 鎮静 Css50 から ~400 ng/mL と外挿。半減期が長く (24-36 h) 蓄積するため、定常状態の Ce が臨床的な操作概念。QT 延長は Ce と独立した別個のリスク。',
    caveats: [
      { en: 'Respiratory Ce50 is INFERRED from sedation Css50 — no direct PubMed-abstract source', ja: '呼吸抑制 Ce50 は鎮静 Css50 からの外挿 — 直接的な PubMed abstract ソース無し' },
      { en: 'Css50 range across individuals 40-1130 ng/mL — clinical dosing must be titrated, never use a single number', ja: '個人間の Css50 範囲 40-1130 ng/mL — 単一値で投与せず必ず titrate' },
      { en: 'Long terminal half-life (24-36 h) → repeated daily dosing accumulates over 5-7 days', ja: '消失半減期が長く (24-36 h) 反復投与で 5-7 日かけて蓄積' },
      { en: 'QTc prolongation is a non-Ce safety concern — monitor ECG independently', ja: 'QT 延長は Ce と無関係の別個の安全課題 — 心電図モニタを独立に行う' },
    ],
    provisional: true, // Resp Ce50 not directly measured
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
        keyFindings: 'Magnitude and duration of ventilatory depression were significantly less with sufentanil than fentanyl at equipotent doses. Numeric Ce50 in full text only — abstract describes the qualitative comparison. Estimated Ce ~0.4-0.7 ng/mL for clinically meaningful depression.',
        population: '30 healthy young adult male volunteers, double-blind randomized crossover',
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
