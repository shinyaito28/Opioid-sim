import re

file_path = 'src/App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add to THERAPEUTIC_RANGES
ranges_insert = """    label: 'Analgesia (4.0-15.0)'
  },
  'Methadone': {
    analgesiaMin: 50,
    analgesiaMax: 100,
    respiratoryRisk: 200, 
    label: 'Analgesia (50-100) / Resp Risk > 200'
  }
};"""
content = content.replace("    label: 'Analgesia (4.0-15.0)'\n  }\n};", ranges_insert)

# 2. Add to CLINICAL_DEFAULTS
defaults_insert = """  'Morphine': { bolus: 5, rate: 2, duration: 120, unit: 'mg' },
  'Hydromorphone': { bolus: 1, rate: 0.5, duration: 120, unit: 'mg' },
  'Methadone': { bolus: 5, rate: 2, duration: 60, unit: 'mg' }
};"""
content = content.replace("  'Morphine': { bolus: 5, rate: 2, duration: 120, unit: 'mg' },\n  'Hydromorphone': { bolus: 1, rate: 0.5, duration: 120, unit: 'mg' }\n};", defaults_insert)

# 3. Add to AVAILABLE_MODELS
models_insert = """  'Morphine': ['Maitre (Adult)', 'McFarlan (Pediatric)'],
  'Hydromorphone': ['Jeleazcov (2014) Adult', 'Balyan (2020) Pediatric', 'Standard (Adult)', 'Pediatric (Scaled)'],
  'Methadone': ['Standard (Adult)']
};"""
content = content.replace("  'Morphine': ['Maitre (Adult)', 'McFarlan (Pediatric)'],\n  'Hydromorphone': ['Jeleazcov (2014) Adult', 'Balyan (2020) Pediatric', 'Standard (Adult)', 'Pediatric (Scaled)']\n};", models_insert)

# 4. Update getModelRequirements
req_insert = """  if (drug === 'Fentanyl' && model.includes('Shafer')) return [];
  if (drug === 'Methadone') return ['weight'];
  return ['weight'];"""
content = content.replace("  if (drug === 'Fentanyl' && model.includes('Shafer')) return [];\n  return ['weight'];", req_insert)

# 5. Update getBestModel
best_insert = """  if (drug === 'Morphine') return isPeds ? 'McFarlan (Pediatric)' : 'Maitre (Adult)';
  if (drug === 'Hydromorphone') return isPeds ? 'Balyan (2020) Pediatric' : 'Jeleazcov (2014) Adult';
  if (drug === 'Methadone') return 'Standard (Adult)';
  return 'Bae (2020) Adult';"""
content = content.replace("  if (drug === 'Morphine') return isPeds ? 'McFarlan (Pediatric)' : 'Maitre (Adult)';\n  if (drug === 'Hydromorphone') return isPeds ? 'Balyan (2020) Pediatric' : 'Jeleazcov (2014) Adult';\n  return 'Bae (2020) Adult';", best_insert)

# 6. Update getPKParameters
pk_insert = """      params.V1 = 3.35 * wRatio; params.V2 = 13.9 * wRatio; params.V3 = 145.0 * wRatio; params.Cl = 1.01 * (wRatio ** 0.75); params.Q2 = 1.47 * (wRatio ** 0.75); params.Q3 = 1.41 * (wRatio ** 0.75); params.ke0 = 0.02;
    }
  }
  // --- METHADONE ---
  else if (drug === 'Methadone') {
     // Standardized to 70kg: V1=21.5, V2=75.1, V3=484, CL=9.45 L/h, Q2=325 L/h, Q3=136 L/h
     // Converted to L/min for CL, Q2, Q3
     const wRatio = weight / 70;
     params.V1 = 21.5 * wRatio;
     params.V2 = 75.1 * wRatio;
     params.V3 = 484.0 * wRatio;
     params.Cl = (9.45 / 60) * (wRatio ** 0.75); 
     params.Q2 = (325.0 / 60) * (wRatio ** 0.75);
     params.Q3 = (136.0 / 60) * (wRatio ** 0.75);
     params.ke0 = 0.05; // Estimated, slow equilibration
  }"""
content = content.replace("      params.V1 = 3.35 * wRatio; params.V2 = 13.9 * wRatio; params.V3 = 145.0 * wRatio; params.Cl = 1.01 * (wRatio ** 0.75); params.Q2 = 1.47 * (wRatio ** 0.75); params.Q3 = 1.41 * (wRatio ** 0.75); params.ke0 = 0.02;\n    }\n  }", pk_insert)

# 7. Update simulateConcentration scaling
scale_insert = """  const k31 = (V3 > 0) ? Q3 / V3 : 0;

  const isMgDrug = drugType === 'Morphine' || drugType === 'Hydromorphone' || drugType === 'Methadone';
  const scaleFactor = isMgDrug ? 1000 : 1;"""
content = content.replace("  const k31 = (V3 > 0) ? Q3 / V3 : 0;\n\n  const isMgDrug = drugType === 'Morphine' || drugType === 'Hydromorphone';\n  const scaleFactor = isMgDrug ? 1000 : 1;", scale_insert)

# 8. Update UI Dropdown
ui_insert = """                    <option value="Remifentanil">Remifentanil (mcg)</option>
                    <option value="Morphine">Morphine (mg)</option>
                    <option value="Hydromorphone">Hydromorphone (mg)</option>
                    <option value="Methadone">Methadone (mg)</option>
                  </select>"""
content = content.replace('                    <option value="Remifentanil">Remifentanil (mcg)</option>\n                    <option value="Morphine">Morphine (mg)</option>\n                    <option value="Hydromorphone">Hydromorphone (mg)</option>\n                  </select>', ui_insert)

# 9. Update UI Model Dropdown
model_ui_insert = """                      <option>Standard (Adult)</option>
                      <option>Pediatric (Scaled)</option>
                    </>}
                    {drug === 'Methadone' && <>
                      <option>Standard (Adult)</option>
                    </>}
                  </select>"""
content = content.replace('                      <option>Standard (Adult)</option>\n                      <option>Pediatric (Scaled)</option>\n                    </>}\n                  </select>', model_ui_insert)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated App.jsx with Methadone support")
