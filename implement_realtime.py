import re

file_path = 'src/App.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add State for Current Time
state_insert = """  const [startTime, setStartTime] = useState("09:00");
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- EFFECT: Update Current Time ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);"""
content = content.replace('  const [startTime, setStartTime] = useState("09:00");', state_insert)

# 2. Add Calculation Logic
calc_insert = """  // --- REAL-TIME CALCULATION ---
  const currentSimMinutes = useMemo(() => {
    if (!isClockMode) return null;
    const now = currentTime;
    const [startH, startM] = startTime.split(':').map(Number);
    const start = new Date(now);
    start.setHours(startH, startM, 0, 0);
    
    // If start time is in future relative to now (e.g. set 09:00 when it's 08:00), 
    // usually implies previous day, but for sim simplicity we just take diff.
    // If diff is negative, it means we are before start time.
    const diffMs = now - start;
    return Math.floor(diffMs / 60000);
  }, [currentTime, startTime, isClockMode]);

  const currentValues = useMemo(() => {
    if (currentSimMinutes === null || simData.length === 0) return null;
    // Find closest data point
    const point = simData.find(d => d.time >= currentSimMinutes);
    return point || null;
  }, [currentSimMinutes, simData]);
"""
content = content.replace('  // --- EFFECT: Auto-Fill Stats on Age Change ---', calc_insert + '\n  // --- EFFECT: Auto-Fill Stats on Age Change ---')

# 3. Add ReferenceLine and Label to Chart
# We insert this inside LineChart, before Tooltip
chart_insert = """                {isClockMode && currentSimMinutes !== null && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
                  <ReferenceLine x={currentSimMinutes} stroke="#ef4444" strokeDasharray="3 3" />
                )}
                
                <Tooltip"""
content = content.replace('<Tooltip', chart_insert)

# 4. Add Status Box Overlay
# We insert this after ResponsiveContainer closing tag
overlay_insert = """            </ResponsiveContainer>
            
            {isClockMode && currentValues && currentSimMinutes >= 0 && currentSimMinutes <= simDuration && (
              <div className="absolute top-2 right-14 bg-white/90 p-2 rounded shadow border border-red-200 text-xs pointer-events-none">
                <div className="font-bold text-red-600 flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  {t('now')} ({currentTime.getHours().toString().padStart(2, '0')}:{currentTime.getMinutes().toString().padStart(2, '0')})
                </div>
                <div className="grid grid-cols-2 gap-x-2 mt-1 text-slate-600">
                  <span>Cp:</span> <span className="font-mono font-bold">{currentValues.cp}</span>
                  <span>Ce:</span> <span className="font-mono font-bold">{currentValues.ce}</span>
                </div>
              </div>
            )}
          </div>"""
content = content.replace('            </ResponsiveContainer>\n          </div>', overlay_insert)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully implemented Real-time Indicator in App.jsx")
