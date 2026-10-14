export const getModelRequirements = (drug, model) => {
  if (drug === 'Remifentanil' && model.includes('Minto')) return ['age', 'weight', 'height', 'gender'];
  if (drug === 'Hydromorphone' && model.includes('Jeleazcov')) return ['age', 'weight'];
  if (drug === 'Fentanyl' && model.includes('Shafer')) return [];
  if (drug === 'Methadone') return ['weight'];
  if (drug === 'Sufentanil') return ['weight'];
  if (drug === 'Propofol') return ['age', 'weight', 'height', 'gender']; // Eleveld uses all four covariates
  if (drug === 'Remimazolam') return ['weight']; // Eleveld 2025 simplified to weight-only here
  if (drug === 'Ketamine') return ['weight']; // Noppers 2011 allometric W/70
  if (drug === 'Dexmedetomidine') return ['weight']; // Hannivoort 2015 — weight is the only covariate
  return ['weight'];
};

// --- BEST MODEL SELECTOR HELPER ---
export const getBestModel = (drug, age) => {
  const isPeds = age < 12;
  if (drug === 'Fentanyl') return isPeds ? 'Ginsberg (Pediatric)' : 'Bae (2020) Adult';
  if (drug === 'Remifentanil') return isPeds ? 'Rigby-Jones (Pediatric)' : 'Minto (Adult)';
  if (drug === 'Morphine') {
    if (age < 1) return 'Anand (2008) Neonate'; // Under 1 year used as proxy for neonate/infant focus
    if (isPeds) return 'Bouwmeester (2004) Pediatric';
    return 'Mazoit (2007) Adult';
  }
  if (drug === 'Hydromorphone') return isPeds ? 'Balyan (2020) Pediatric' : 'Jeleazcov (2014) Adult';
  if (drug === 'Methadone') return 'Standard (Adult)';
  if (drug === 'Sufentanil') return isPeds ? 'Bartkowska-Sniatkowska (2016) PICU' : 'Gepts (1995) Adult';
  if (drug === 'Propofol') return 'Eleveld (2018) General-purpose'; // Eleveld covers all ages
  if (drug === 'Remimazolam') return 'Eleveld (2025) Adult';
  if (drug === 'Ketamine') return 'Noppers (2011) S-ketamine';
  if (drug === 'Dexmedetomidine') return 'Hannivoort (2015) Adult';
  return 'Bae (2020) Adult';
};

export const resolveModel = (drug,age,modelByDrug={}) => modelByDrug[drug]||getBestModel(drug,age);
export function chooseModel(modelByDrug,drug,choice) {
  const next={...modelByDrug};
  if(choice==='auto')delete next[drug];
  else next[drug]=choice;
  return next;
}
