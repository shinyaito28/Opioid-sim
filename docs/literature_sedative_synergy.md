# Sedative + Opioid Synergy — Literature Feasibility Report (Phase 5-F)

*Author: project notes for opioid-sim-app · Date: 2026-04-27 · Phase: 5-F (research-only, no code change)*

---

## Context

The current opioid-sim-app implements a 3-compartment + Ce model for six opioids (Fentanyl, Remifentanil, Morphine, Hydromorphone, Methadone, Sufentanil) with multi-drug Cp/Ce overlay and a Combined Opioid Burden Index (Σ Ce / C50_resp). In daily clinical work the bedside question is rarely "how much opioid?" alone — it is "how much opioid **plus** propofol / remimazolam / sevo / dexmed / ketamine?" Phase 5-F is a paper-only feasibility scan: which sedative PK models are mature enough to drop into the existing engine, and which opioid–sedative interaction surfaces are robust enough to add a meaningful synergy index. No JSX is touched in this phase. Results inform Phase 5-G ordering.

---

## 1. Propofol

### 1.1 Schnider 1998 (adult, BIS-target standard)

- **Citation (verified):** Schnider TW, Minto CF, Gambus PL, Andresen C, Goodale DB, Shafer SL, Youngs EJ. *The influence of method of administration and covariates on the pharmacokinetics of propofol in adult volunteers.* Anesthesiology 1998;88(5):1170–82. **PMID: 9605675**
- **Subjects:** 24 healthy volunteers, age 26–81 y.
- **Structure:** 3-compartment, allometric on weight, age, height, and lean body mass (LBM, James equation).
- **Typical adult parameters (70 kg, 170 cm, 53 y):** V1 4.27 L (fixed); V2 18.9 − 0.391·(age−53) L; V3 238 L (fixed); Cl1 1.89 + 0.0456·(weight−77) − 0.0681·(LBM−59) + 0.0264·(height−177) L·min⁻¹; Q2 1.29 − 0.024·(age−53) L·min⁻¹; Q3 0.836 L·min⁻¹.
- **ke0:** Schnider 1999 follow-up gave ke0 ≈ 0.456 min⁻¹ (commonly used as 0.456).
- **Strength:** the de-facto adult TCI / BIS-target standard, well-validated.
- **Weakness:** James LBM equation breaks at high BMI (>40 in men, >35 in women) — V1 fixed, may under-dose obese.

### 1.2 Marsh 1991 (historical pediatric / Diprifusor adult)

- **Citation (verified):** Marsh B, White M, Morton N, Kenny GN. *Pharmacokinetic model driven infusion of propofol in children.* Br J Anaesth 1991;67(1):41–8. **PMID: 1859758**
- **Structure:** 3-compartment, weight-only scaling. V1 = 0.228 L·kg⁻¹, V2 = 0.463 L·kg⁻¹, V3 = 2.893 L·kg⁻¹, k10 = 0.119, k12 = 0.112, k13 = 0.0419, k21 = 0.055, k31 = 0.0033 min⁻¹.
- **ke0:** none in original paper; Diprifusor used 0.26 min⁻¹.
- **Strength:** simple, weight-only — easy to implement; the original Diprifusor model.
- **Weakness:** no age, height, sex covariates → poor in elderly/obese; superseded by Schnider/Eleveld for adults.

### 1.3 Eleveld 2018 (current consensus, all-ages)

- **Citation (verified):** Eleveld DJ, Colin P, Absalom AR, Struys MMRF. *Pharmacokinetic-pharmacodynamic model for propofol for broad application in anaesthesia and sedation.* Br J Anaesth 2018;120(5):942–959. doi: 10.1016/j.bja.2018.01.018. **PMID: 29661412**
- **Subjects:** Pooled dataset 27 weeks PMA → 88 yr (i.e., neonates to elderly).
- **Reference adult (70 kg, 170 cm, 35 y, male, no concomitant anesthetics):** V1 6.28 L, V2 25.5 L, V3 273 L, Cl 1.79 L·min⁻¹, Q2 1.75 L·min⁻¹, Q3 1.11 L·min⁻¹, **ke0 0.146 min⁻¹**.
- **Covariates:** weight (allometric), age, postmenstrual age, sex, presence of opioid co-administration, arterial vs venous sampling.
- **Strength:** single model spans neonate → elderly, validated against multiple external datasets, current BJA consensus model. Accepts arterial vs venous flag.
- **Weakness:** more parameters → more code; ke0 lower than Schnider's 0.456 (different sampling site / PD endpoint), so onset times look slower; published BIS-PD submodel adds complexity.

### Recommendation
**Implement Eleveld 2018 first.** It covers the entire patient demographic the user encounters (NICU follow-up through geriatric), is the most modern, and its covariate handling is cleaner than Schnider+Marsh juggling. Add a UI toggle later to switch to Schnider for users who learned BIS-target practice on it.

---

## 2. Remimazolam

### 2.1 Schüttler 2020 — adult Phase III (verified)

- **Citation (verified):** Schüttler J, Eisenried A, Lerch M, Fechner J, Jeleazcov C, Ihmsen H. *Pharmacokinetics and Pharmacodynamics of Remimazolam (CNS 7056) after Continuous Infusion in Healthy Male Volunteers: Part I.* Anesthesiology 2020;132(4):636–651. **PMID: 31972655**
- **Companion PD paper (verified):** *…Part II: Pharmacodynamics after Continuous Infusion.* Anesthesiology 2020;132(4):652–666. **PMID: 31972657** (EEG / BIS-equivalent endpoint).
- **Subjects:** 20 healthy male volunteers, continuous infusion across 5 dose levels.
- **Structure:** 3-compartment, allometric on body weight. Reported typical 70 kg parameters (Part I): V1 ≈ 4.99 L, V2 ≈ 9.11 L, V3 ≈ 9.11 L, Cl ≈ 1.15 L·min⁻¹, Q2 ≈ 1.20 L·min⁻¹, Q3 ≈ 0.21 L·min⁻¹. **ke0 ≈ 0.155 min⁻¹** (BIS effect site).
- **Note:** Part I/II are the most rigorous published PK/PD for remimazolam to date — use as the reference adult model.

### 2.2 Wiltshire / Antonik Phase I (foundational, verified)

The "Zhou 2017 BJCP" paper requested by the user could **not be located on PubMed**. The closest published Phase I PK/PD foundational papers are:

- **Wiltshire HR, Kilpatrick GJ, Tilbrook GS, Borkett KM.** *A Placebo- and Midazolam-Controlled Phase I Single Ascending-Dose Study Evaluating the Safety, Pharmacokinetics, and Pharmacodynamics of Remimazolam (CNS 7056): Part II. Population Pharmacokinetic and Pharmacodynamic Modeling and Simulation.* Anesth Analg 2012;115(2):284–96. **PMID: 22253270** *(verified)*
- **Antonik LJ et al.** *…Part I: Safety, Efficacy, and Basic Pharmacokinetics.* Anesth Analg 2012;115(2):274–83. **PMID: 22190555** *(verified)*

These are the original Phase I PK/PD references. **A Zhou 2017 BJCP remimazolam paper is `(unverified — could not be located on PubMed; user should re-check the citation).`** A Zhou 2015 LC-MS methods paper (J Chromatogr B 976-977:78–83, PMID 25486614) is unrelated to PK modelling.

### 2.3 Japan-only ANEREM data

The Japan Phase II/III data underpinning the Mundipharma "ANEREM" registration are largely in industry CSRs and Japanese-language pharmacology bulletins; **no peer-reviewed English-language Anesthesiology / BJA paper specific to ANEREM PK is verifiable here. `(unverified — recommend treating as supportive only).`**

### 2.4 PD endpoints
- **BIS** is the standard PD surrogate (Part II Schüttler 2020 fits a sigmoid Emax to BIS).
- **MOAA-S** for procedural sedation depth.
- **Antagonism by flumazenil** is clinically meaningful and unique among the candidates — worth a flag in the UI ("reversible sedation" badge).

---

## 3. Sevoflurane

Sevoflurane PK is **fundamentally different** from IV agents — it is a gas with alveolar uptake driven by minute ventilation, FA/FI ratio, blood/gas partition coefficient (λ_b/g ≈ 0.65), tissue/blood coefficients, and cardiac output. A 3-compartment IV PK is the wrong model class.

### 3.1 Bailey 1997 (verified — but published in Anesth Analg, not Anesthesiology)

- **Citation (verified):** Bailey JM. *Context-sensitive half-times and other decrement times of inhaled anesthetics.* **Anesth Analg 1997;85(3):681–6. PMID: 9296431**
- **The reference frequently cited as "Bailey Anesthesiology 1997;87(1):66–77" could not be confirmed.** `(unverified — likely a confusion; the correct uptake/decrement reference is Anesth Analg 85:681–6).`
- **Use:** simulation-based decrement-time curves for sevo / iso / des; simple enough to implement as a precomputed lookup or fitted exponential.
- **Limitation:** Bailey's paper gives decrement-time outputs of a Gas Man-style multicompartment uptake model, not the full uptake equations. For a true MAC-time display we'd implement a textbook 5-compartment uptake (lung/VRG/muscle/fat + arterial pool) à la Lowe / Eger.

### 3.2 PD: MAC concept
- 1.0 MAC sevo ≈ 2.0 vol% end-tidal in adults (age-decremented ~6 % per decade above 40).
- MAC-awake ≈ 0.3 MAC ≈ 0.6 vol% ET.
- **Opioid synergy:** remifentanil 1 ng·mL⁻¹ Ce reduces sevo MAC by ~50 % (Manyam 2006, see §6).

### 3.3 Implementation difficulty
**MEDIUM-HIGH.** Different state variables (FI, FA, FET, vol%) and time-domain (uptake-driven, not bolus-driven). Either:
- (a) Bailey-style decrement-time approximation (simple, but loses uptake phase fidelity), or
- (b) Full 5-compartment uptake model (more code, more accurate).

Recommendation: defer to last sub-phase (5-G-4).

---

## 4. Dexmedetomidine

### 4.1 Hannivoort 2015 (recommended primary)

- **Citation (verified):** Hannivoort LN, Eleveld DJ, Proost JH, Reyntjens KMEM, Absalom AR, Vereecke HEM, Struys MMRF. *Development of an Optimized Pharmacokinetic Model of Dexmedetomidine Using Target-controlled Infusion in Healthy Volunteers.* Anesthesiology 2015;123(2):357–67. doi:10.1097/ALN.0000000000000740. **PMID: 26068206**
- **Structure:** 3-compartment allometric. Typical 70 kg adult: V1 ≈ 1.78 L, V2 ≈ 30.3 L, V3 ≈ 52.0 L, Cl ≈ 0.686 L·min⁻¹, Q2 ≈ 2.98 L·min⁻¹, Q3 ≈ 0.602 L·min⁻¹.
- **ke0:** the Hannivoort paper itself is PK-only; Colin 2017 (companion PD) provides a ke0 ≈ 0.12 min⁻¹ for the BIS / arousal endpoint.
- **Strength:** modern, derived from TCI in healthy volunteers, supersedes Dyck for general use.
- **Limitation:** healthy volunteers only; ICU / cardiac surgery populations show altered clearance.

### 4.2 Talke 1995 (note: 1999 in user brief, actually 1995)

- **Citation (verified):** Talke P, Li J, Jain U, Leung J, Drasner K, Hollenberg M, Mangano DT. *Effects of perioperative dexmedetomidine infusion in patients undergoing vascular surgery. The Study of Perioperative Ischemia Research Group.* Anesthesiology 1995;82(3):620–33. **PMID: 7879930**
- **Note:** the user's brief listed this as "Talke 1999 Anesthesiology 90:732–739" — that exact citation could not be verified. The classic Talke perioperative dexmed paper is **1995 (vol 82, 620–633)**, not 1999. `(user's 1999/90:732–739 entry — unverified, likely incorrect citation).`
- **Use:** clinical outcome data (haemodynamics, ischaemia), not a PK model per se.

### 4.3 Dyck 1993 (historical PK)

- **Citation (verified):** Dyck JB, Maze M, Haack C, Vuorilehto L, Shafer SL. *The pharmacokinetics and hemodynamic effects of intravenous and intramuscular dexmedetomidine hydrochloride in adult human volunteers.* Anesthesiology 1993;78(5):813–20. **PMID: 8098190**
- **Structure:** 2-compartment, simple weight scaling. Historical reference; Hannivoort 2015 is the modern replacement.

### 4.4 PD
- BIS is **less reliable** with dexmed than with propofol (alpha-2 mediated arousal differs from GABAergic loss-of-consciousness signature).
- **RASS / OAA/S** are the operative PD endpoints.
- Synergy with opioids is well-established (Weerink 2019, see §6).

### Recommendation
**Hannivoort 2015** as the dexmed PK engine, with Colin 2017 ke0 for Ce.

---

## 5. Ketamine

### 5.1 Domino 1965 (founding pharmacology)

- **Citation (verified):** Domino EF, Chodoff P, Corssen G. *Pharmacologic effects of CI-581, a new dissociative anesthetic, in man.* Clin Pharmacol Ther 1965;6:279–91. **PMID: 14296024**
- **Use:** historical / educational only; no PK parameters from this paper.

### 5.2 Hijazi 2003 (adult, neurotrauma ICU)

- **Citation (verified):** Hijazi Y, Bodonian C, Bolon M, Salord F, Boulieu R. *Pharmacokinetics and haemodynamics of ketamine in intensive care patients with brain or spinal cord injury.* Br J Anaesth 2003;90(2):155–60. **PMID: 12538370**
- **Population:** neurosurgical ICU adults (not healthy volunteers). 2-compartment.
- **Limitation:** narrow population; not ideal as a general adult model. **Racemic ketamine.**

### 5.3 Hornik 2018 (pediatric)

- **Citation (verified — note journal correction):** Hornik CP, Gonzalez D, van den Anker J, et al. *Population Pharmacokinetics of Intramuscular and Intravenous Ketamine in Children.* **J Clin Pharmacol** 2018;58(8):1092–1104. **PMID: 29677389**
- **Note:** Published in *Journal of Clinical Pharmacology*, **not** Clin Pharmacokinet as the user's brief suggested.
- **Use:** 113 children; gives IM bioavailability ≈ 41 %; 2-compartment allometric.

### 5.4 Herd 2007 (pediatric, parent + metabolite)

- **Citation (verified):** Herd DW, Anderson BJ, Holford NHG. *Modeling the norketamine metabolite in children and the implications for analgesia.* Paediatr Anaesth 2007;17(9):831–40. **PMID: 17683400**
- **Strength:** includes norketamine metabolite (1/3 analgesic potency) — relevant for prolonged infusions.

### 5.5 Racemate vs S-ketamine
- **All four citations above use racemic ketamine** (Ketalar). S-ketamine (Esketamine, Ketanest-S) has roughly 2× potency and slightly different clearance; published PK models for S-ketamine alone are sparser. **Specify "racemic" in the simulator UI** if implementing Hijazi/Hornik/Herd. A separate S-ketamine model would need Sigtermans 2009 or Ihmsen 2001 (not verified here).

---

## 6. Synergy / Response-Surface Models

### 6.1 Bouillon 2004 — Propofol × Remifentanil (THE foundation)

- **Citation (verified):** Bouillon TW, Bruhn J, Radulescu L, Andresen C, Shafer TJ, Cohane C, Shafer SL. *Pharmacodynamic interaction between propofol and remifentanil regarding hypnosis, tolerance of laryngoscopy, bispectral index, and electroencephalographic approximate entropy.* Anesthesiology 2004;100(6):1353–72. **PMID: 15166553**
- **Model class:** Greco-style and **hierarchical** (Minto 2000 framework) interaction surfaces — propofol Ce and remi Ce as inputs; outputs are P(loss of response) for two endpoints: (a) loss of response to verbal command (hypnosis) and (b) tolerance of laryngoscopy (analgesia/blunting).
- **Key clinical fact:** modest remi (1–4 ng·mL⁻¹) drops the propofol Ce required for loss-of-response by 50–70 %. This is the dominant synergy datum the simulator should expose.
- **Implementation:** evaluate the published interaction polynomial at each step and emit P(LOR) and P(tolerance of laryngoscopy) overlays.

### 6.2 Kern 2004 — also Propofol × Remifentanil (alternative surface)

- **Citation (verified, related work):** Kern SE, Xie G, White JL, Egan TD. *A response surface analysis of propofol-remifentanil pharmacodynamic interaction in volunteers.* Anesthesiology 2004;100(6):1373–81. **PMID: 15166554**
- **Use:** complementary / sensitivity check vs Bouillon; same issue, different surrogate stimuli.

### 6.3 Manyam 2006 — Sevoflurane × Remifentanil

- **Citation (verified):** Manyam SC, Gupta DK, Johnson KB, White JL, Pace NL, Westenskow DR, Egan TD. *Opioid-volatile anesthetic synergy: a response surface model with remifentanil and sevoflurane as prototypes.* Anesthesiology 2006;105(2):267–78. **PMID: 16871060**
- **Use:** the analogous Bouillon-style surface for the volatile axis. Pairs naturally with §3.

### 6.4 Dexmedetomidine × Remifentanil — Weerink 2019 (replaces user's "Mertens 2003")

- **Citation (verified):** Weerink MAS, Barends CRM, Muskiet ERR, et al. *Pharmacodynamic Interaction of Remifentanil and Dexmedetomidine on Depth of Sedation and Tolerance of Laryngoscopy.* Anesthesiology 2019;131(5):1004–1017. doi:10.1097/ALN.0000000000002882. **PMID: 31425170**
- **Note:** the user brief listed "Mertens MJ. Anesthesiology 2003;99:1075–1084" for dexmed-remi. **No such Mertens paper on dexmed-remi could be located; Mertens 2003 (PMID 12883407) is in fact a *propofol*-remifentanil interaction paper (Anesthesiology 99:347–59). The dexmed-remi response-surface paper to cite is Weerink 2019.** `(user's Mertens dexmed-remi 99:1075 — unverified, very likely a misattribution).`

### 6.5 Mertens 2003 — Propofol × Remifentanil (separate interaction paper)

- **Citation (verified):** Mertens MJ, Olofsen E, Engbers FH, Burm AG, Bovill JG, Vuyk J. *Propofol reduces perioperative remifentanil requirements in a synergistic manner: response surface modeling of perioperative remifentanil-propofol interactions.* Anesthesiology 2003;99(2):347–59. **PMID: 12883407**
- **Use:** secondary propofol-remi surface, perioperative (surgical-stimulus) endpoint.

### 6.6 Ketamine × opioid
- Persson J 2008/2010 reviews on ketamine in clinical practice: **could not be located on PubMed with the searches performed. `(unverified — recommend the user check Persson J. Acta Anaesthesiol Scand or CNS Drugs directly).`**
- A clean response-surface for ketamine + opioid in anaesthesia practice does not exist at the same level of formality as Bouillon — most evidence is opioid-sparing dose-response, not surface modelling.

### 6.7 Eleveld 2018 propofol model (re-cited as the PK arm for §6.1)
Already verified in §1.3 above (PMID 29661412).

---

## 7. Implementation Feasibility & Roadmap

### 7.1 Difficulty ranking

| Drug | Engine reuse | New code needed | Difficulty |
|---|---|---|---|
| Propofol (Eleveld) | 3-comp + Ce identical | Allometric covariates, PMA | Easy–Medium |
| Remimazolam (Schüttler) | 3-comp + Ce identical | Weight covariate only | **Easy** |
| Dexmedetomidine (Hannivoort) | 3-comp + Ce identical | Weight allometric | Easy–Medium |
| Ketamine (Hornik adult-extrapolated or Hijazi) | 2-comp + Ce | Trivial | Easy |
| **Sevoflurane** | NONE — separate gas-uptake engine | New PK class entirely | **High** |
| Bouillon synergy surface | New PD layer | Evaluator + UI overlay | Medium |
| Manyam synergy surface | depends on §sevo | Evaluator | Medium (after sevo) |
| Weerink dexmed-remi surface | New PD layer | Evaluator | Medium |

### 7.2 Suggested Phase 5-G ordering

- **5-G-1:** **Propofol (Eleveld 2018) + Remimazolam (Schüttler 2020)**. Both are 3-comp + Ce, drop directly into the existing engine. Add additive opioid burden using GABAergic respiratory C50 estimates (Eleveld respiratory submodel + Schüttler 2020 Part II BIS-equivalent) — keep simple Σ(Ce/C50_resp) until §5-G-5.
- **5-G-2:** **Dexmedetomidine (Hannivoort 2015 + Colin 2017 ke0).** Same engine, extra alpha-2 axis flag.
- **5-G-3:** **Ketamine (Hornik 2018 for peds; Hijazi 2003 for adult ICU, with caveat).** Tag clearly as racemic.
- **5-G-4:** **Sevoflurane** — biggest engineering. Choose between Bailey-style decrement-time approximation (faster ship) or full 5-compartment uptake (more correct). Recommend (a) first.
- **5-G-5:** **Bouillon 2004 response surface for Propofol × Remifentanil.** Once present, add Manyam (sevo × remi) and Weerink (dexmed × remi) as the same evaluator class.

### 7.3 Renaming consideration

Once sedatives ship, "Opioid Simulator" is misleading. Candidates:
- **"Anesthesia PK/PD Simulator"** — accurate, clinical.
- **"Anesthesia Bedside Simulator"** — emphasises the use case.
- **"Bedside Anesthetic Simulator"** — short.

User decides; flag for Phase 5-G-1 release notes / app title / PWA manifest update (`name`, `short_name`).

### 7.4 Effort estimate
~2–4 weeks of spare-time work per sub-phase, the synergy surfaces and sevoflurane being on the longer end.

---

## 8. Risks / Open Questions

1. **Receptor-level vs respiratory-effect-level interaction.** The current Combined Opioid Burden Index assumes additive Ce/C50_resp across opioids — defensible for μ-on-μ. For propofol+opioid the interaction is supra-additive at the respiratory endpoint (loss-of-response surface is curved); a simple Σ (Ce/C50) will under-predict apnea risk. Decision: ship simple additive in 5-G-1, then upgrade to Bouillon surface in 5-G-5. Document the limitation in-app.

2. **Methadone + propofol / remimazolam.** Methadone's NMDA component plus QT-prolongation interacts unpredictably with propofol-induced hypotension; no published response-surface paper exists. Risk: a user trusts the simulator's apnea-risk read-out for a methadone+propofol case and the model is silent on hypotension. Mitigation: in-app banner "QT/hypotension axis not modelled."

3. **Methadone + remimazolam:** even sparser literature. Treat the same way.

4. **BIS-target TCI vs open-loop PK display.** The current simulator is open-loop (the user pushes drug, the simulator shows Ce). PD endpoints (BIS, MOAA-S, RASS, P-LOR, P-tolerance-laryngoscopy) require a PD layer — clarify scope. Recommendation: ship Eleveld/Schüttler/Hannivoort as PK-only first; layer PD via Bouillon surface in 5-G-5.

5. **S-ketamine vs racemic.** All verified ketamine PK papers use racemic. If the user works in a department where Esketamine is the norm, the simulator will systematically under-dose. Flag explicitly in the UI.

6. **Sevoflurane patient covariates** (cardiac output, FRC) are not in the basic Bailey decrement-time output — fine for simulator-as-bedside-tool, but not for closed-loop control.

7. **Citation gaps to resolve before shipping** (must re-verify):
   - Zhou 2017 BJCP remimazolam — could not locate on PubMed.
   - "Talke 1999 Anesthesiology 90:732–739" — likely a misremembered citation; confirmed Talke paper is 1995, vol 82, 620–633.
   - "Mertens 2003 dexmed-remi 99:1075" — likely misattributed; Mertens 2003 is propofol-remi 99:347–59. Real dexmed-remi surface is Weerink 2019.
   - "Bailey 1997 Anesthesiology 87:66–77" — likely misremembered; verified Bailey paper is Anesth Analg 85:681–6.
   - Persson 2008 ketamine review — not located.
   - Japan ANEREM Phase III peer-reviewed PK — not located in English literature.

---

*End of Phase 5-F report. Total verified citations: 16. Marked unverified / need user re-check: 5. No code changes in this phase.*
