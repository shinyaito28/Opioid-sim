import re

file_path = 'src/App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replacements
replacements = [
    # Header buttons
    (r'<div className="flex items-center gap-3">\s*<button\s*onClick=\{\(\) => setShowRanges\(!showRanges\)\}\s*className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1\.5 rounded flex items-center gap-1"\s*>\s*\{showRanges \? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />\}\s*<span className="hidden sm:inline">Ranges</span>\s*</button>\s*<div className="text-xs bg-red-900/50 text-red-200 px-2 py-1 rounded border border-red-800 hidden sm:block">\s*For Research/Edu Only\s*</div>\s*</div>',
     '''<div className="flex items-center gap-3">
             <div className="flex bg-slate-700 rounded p-1 gap-1">
                <button 
                  onClick={() => i18n.changeLanguage('en')}
                  className={`px-2 py-0.5 text-xs rounded ${i18n.language === 'en' ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
                >
                  EN
                </button>
                <button 
                  onClick={() => i18n.changeLanguage('ja')}
                  className={`px-2 py-0.5 text-xs rounded ${i18n.language === 'ja' ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-600'}`}
                >
                  JP
                </button>
             </div>
             <button 
               onClick={() => setShowRanges(!showRanges)}
               className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded flex items-center gap-1"
             >
               {showRanges ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>} 
               <span className="hidden sm:inline">{t('ranges')}</span>
             </button>
             <div className="text-xs bg-red-900/50 text-red-200 px-2 py-1 rounded border border-red-800 hidden sm:block">
               {t('forResearchOnly')}
             </div>
          </div>'''),

    # Chart Title
    (r'<h2 className="font-bold text-slate-700 text-lg">濃度推移 \(Cp & Ce\)</h2>',
     '<h2 className="font-bold text-slate-700 text-lg">{t(\'chartTitle\')}</h2>'),

    # Chart Legend
    (r'<p className="text-xs text-slate-500">\s*実線: 現在のモデル \| 点線: 比較対象\s*</p>',
     '<p className="text-xs text-slate-500">\n                {t(\'chartLegend\')}\n              </p>'),

    # Add to Compare
    (r'比較に追加', "{t('addToCompare')}"),

    # Compare All
    (r'全モデル比較', "{t('compareAll')}"),
    (r'title="現在の薬剤の全モデルを一括で比較に追加します"', "title={t('compareAllTooltip')}"),

    # Clear
    (r'クリア', "{t('clear')}"),

    # Time Axis
    (r'時間軸 \(分\):', "{t('timeAxis')}"),

    # Auto Y
    (r'<span>Auto Y</span>', "<span>{t('autoY')}</span>"),
    (r"isAutoY \? 'Auto \(Ce\)'", "isAutoY ? t('autoCe')"),

    # Drug/Model Selection
    (r'<h3 className="font-bold text-sm">薬剤・モデル選択</h3>', '<h3 className="font-bold text-sm">{t(\'drugModelSelection\')}</h3>'),
    (r'<label className="text-slate-500 text-xs block mb-1">Drug</label>', '<label className="text-slate-500 text-xs block mb-1">{t(\'drug\')}</label>'),
    (r'<label className="text-slate-500 text-xs block mb-1">PK Model</label>', '<label className="text-slate-500 text-xs block mb-1">{t(\'pkModel\')}</label>'),
    (r'<span>Pediatric Model Active</span>', "<span>{t('pediatricModelActive')}</span>"),
    (r'<span>Ref: Verscheijden 2021 PD insights used for target ranges.</span>', "<span>{t('morphineRef')}</span>"),
    (r'<span>青枠の項目のみが現在のモデル計算に使用されます</span>', "<span>{t('modelParamsNote')}</span>"),

    # Patient Settings
    (r'<h3 className="font-bold text-sm">患者設定</h3>', '<h3 className="font-bold text-sm">{t(\'patientSettings\')}</h3>'),
    (r'<span>自動調整</span>', "<span>{t('autoAdjust')}</span>"),
    (r'<span>年齢 \(Age\)</span>', "<span>{t('age')}</span>"),
    (r'<span>性別</span>', "<span>{t('gender')}</span>"),
    (r'<span>体重 \(kg\)</span>', "<span>{t('weight')}</span>"),
    (r'<span>身長 \(cm\)</span>', "<span>{t('height')}</span>"),

    # Bolus
    (r"editingId === 'bolus' \? 'ボーラス編集中\.\.\.' : 'ボーラス投与'", "editingId === 'bolus' ? t('bolusEditing') : t('bolusDose')"),
    (r'<label className="text-\[10px\] uppercase text-slate-400 font-bold">Dose \(\{getDoseUnit\(\)\}\)</label>', '<label className="text-[10px] uppercase text-slate-400 font-bold">{t(\'dose\')} ({getDoseUnit()})</label>'),
    (r'<label className="text-\[10px\] uppercase text-slate-400 font-bold">Time</label>', '<label className="text-[10px] uppercase text-slate-400 font-bold">{t(\'time\')}</label>'),

    # Infusion
    (r"editingId === 'infusion' \? '持続静注 編集中\.\.\.' : '持続静注 \(Infusion\)'", "editingId === 'infusion' ? t('infusionEditing') : t('infusion')"),
    (r'<label className="text-\[10px\] uppercase text-slate-400 font-bold">Rate \(\{getDoseUnit\(\)\}/hr\)</label>', '<label className="text-[10px] uppercase text-slate-400 font-bold">{t(\'rate\')} ({getDoseUnit()}/hr)</label>'),
    (r'<label className="text-\[10px\] uppercase text-slate-400 font-bold">Start</label>', '<label className="text-[10px] uppercase text-slate-400 font-bold">{t(\'start\')}</label>'),
    (r'<label className="text-\[10px\] uppercase text-slate-400 font-bold">Dur</label>', '<label className="text-[10px] uppercase text-slate-400 font-bold">{t(\'duration\')}</label>'),

    # Event List
    (r'<h3 className="font-bold text-sm text-slate-600">現在の投与スケジュール</h3>', '<h3 className="font-bold text-sm text-slate-600">{t(\'currentSchedule\')}</h3>'),
    (r'>Clear All</button>', '>{t(\'clearAll\')}</button>'),
    (r'>まだ投与履歴がありません</div>', '>{t(\'noHistory\')}</div>'),
    (r"title=\"編集 \(リストから削除してフォームに移動\)\"", "title={t('editTooltip')}"),
    (r"title=\"削除\"", "title={t('deleteTooltip')}"),
    
    # Dynamic List Item
    (r"`Bolus: \$\{evt\.amount\} \$\{getDoseUnit\(\)\}`", "`{}: ${evt.amount} ${getDoseUnit()}`".format(r"${t('bolusLabel')}")),
    (r"`Infusion: \$\{evt\.rate\} \$\{getDoseUnit\(\)\}/hr \(\$\{evt\.duration\}min\)`", "`{}: ${evt.rate} ${getDoseUnit()}/hr (${evt.duration}min)`".format(r"${t('infusionLabel')}")),
    
    # Ranges
    (r"label=\{\{ value: 'Analgesia Max',", "label={{ value: t('analgesiaMax'),"),
    (r"label=\{\{ value: 'Analgesia Min',", "label={{ value: t('analgesiaMin'),"),
    (r"value: `Resp Risk > \$\{currentRange\.respiratoryRisk\}`", "value: `${t('respRisk')} ${currentRange.respiratoryRisk}`"),
    (r"label=\{\{ value: 'Conc \(ng/mL\)',", "label={{ value: t('concLabel'),"),
]

for pattern, replacement in replacements:
    # Use re.sub for regex replacement
    # We need to be careful with escaping in pattern
    try:
        content = re.sub(pattern, replacement, content)
    except Exception as e:
        print(f"Error replacing {pattern}: {e}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated App.jsx")
