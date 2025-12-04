import re

file_path = 'src/App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert Helpers
helpers_code = """
const timeToMinutes = (timeStr, startStr) => {
  if (!timeStr || !startStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  const [sh, sm] = startStr.split(':').map(Number);
  return (h * 60 + m) - (sh * 60 + sm);
};

const minutesToTime = (minutes, startStr) => {
  if (!startStr) return "00:00";
  const [sh, sm] = startStr.split(':').map(Number);
  const totalMin = sh * 60 + sm + minutes;
  let h = Math.floor(totalMin / 60) % 24;
  if (h < 0) h += 24;
  const m = Math.floor(totalMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
"""
# Insert before 'const calculateLBM'
content = content.replace("const calculateLBM", helpers_code + "\nconst calculateLBM")

# 2. Insert State
state_code = """  const [isClockMode, setIsClockMode] = useState(false);
  const [startTime, setStartTime] = useState("09:00");"""
content = content.replace("const [isAutoY, setIsAutoY] = useState(true);", "const [isAutoY, setIsAutoY] = useState(true);\n" + state_code)

# 3. Insert Toggle UI
toggle_code = """              <label className="flex items-center gap-1 text-xs cursor-pointer select-none bg-slate-200 px-2 py-1 rounded hover:bg-slate-300 transition-colors mr-2">
                <Clock className="w-3 h-3 text-slate-600" />
                <input
                  type="checkbox"
                  checked={isClockMode}
                  onChange={(e) => setIsClockMode(e.target.checked)}
                  className="accent-blue-600 w-3 h-3"
                />
                <span className="font-semibold text-slate-600">{t('clockMode')}</span>
              </label>
              
              {isClockMode && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-1 mr-2"
                />
              )}
"""
content = content.replace('<span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t(\'timeAxis\')}</span>', '<span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t(\'timeAxis\')}</span>\n' + toggle_code)

# 4. Update Bolus Input
bolus_input_old = '<input type="number" min="0" value={bolusTime} onChange={e => setBolusTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-center" />'
bolus_input_new = """{isClockMode ? (
                      <input 
                        type="time" 
                        value={minutesToTime(bolusTime, startTime)} 
                        onChange={e => setBolusTime(timeToMinutes(e.target.value, startTime))} 
                        className="w-full border rounded p-2 text-center text-sm" 
                      />
                    ) : (
                      <input type="number" min="0" value={bolusTime} onChange={e => setBolusTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-center" />
                    )}"""
content = content.replace(bolus_input_old, bolus_input_new)

# 5. Update Infusion Start Input
infusion_start_old = '<input type="number" min="0" value={infusionStartTime} onChange={e => setInfusionStartTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-center" />'
infusion_start_new = """{isClockMode ? (
                      <input 
                        type="time" 
                        value={minutesToTime(infusionStartTime, startTime)} 
                        onChange={e => setInfusionStartTime(timeToMinutes(e.target.value, startTime))} 
                        className="w-full border rounded p-2 text-center text-sm" 
                      />
                    ) : (
                      <input type="number" min="0" value={infusionStartTime} onChange={e => setInfusionStartTime(Math.max(0, Number(e.target.value)))} className="w-full border rounded p-2 text-center" />
                    )}"""
content = content.replace(infusion_start_old, infusion_start_new)

# 6. Update Chart XAxis
xaxis_old = """                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, simDuration]}
                  tickCount={10}
                  allowDataOverflow
                />"""
xaxis_new = """                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, simDuration]}
                  tickCount={10}
                  allowDataOverflow
                  tickFormatter={(val) => isClockMode ? minutesToTime(val, startTime) : val}
                />"""
content = content.replace(xaxis_old, xaxis_new)

# 7. Update Tooltip
tooltip_old = """                <Tooltip
                  labelFormatter={(v) => `${v} min`}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                />"""
tooltip_new = """                <Tooltip
                  labelFormatter={(v) => isClockMode ? `${minutesToTime(v, startTime)} (${v} min)` : `${v} min`}
                  contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                />"""
content = content.replace(tooltip_old, tooltip_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully implemented Clock Mode in App.jsx")
