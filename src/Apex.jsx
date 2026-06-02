import { useState, useEffect, useCallback } from "react";
import {
  loadAllData,
  createFullWeek,
  toggleExercise,
  updateExercise,
  deleteExercise,
  insertExercise,
  resetDayExercises,
  updateWeekSchedule,
  upsertWeek,
} from "./lib/db";

// ─── PROTOCOL TEMPLATE ───────────────────────────────────────────────────────
const BASE_DAYS = {
  lun: {
    label: "Lunes", name: "Piernas", type: "Resistencia",
    warmup: true, isCardio: false,
    exercises: [
      { name: "Leg Curls",             muscle: "Cuádriceps · alargado",    weight: "", reps: "4×8" },
      { name: "Squat",                 muscle: "Cuádriceps · acortado",    weight: "", reps: "4×10" },
      { name: "Romanian Dead Lift",    muscle: "Isquiotibiales · alargado", weight: "", reps: "4×8" },
      { name: "Hamstring Curl",        muscle: "Isquiotibiales · acortado", weight: "", reps: "3×8" },
      { name: "Standing Calf Raise",   muscle: "Pantorrillas · alargado",  weight: "", reps: "3×15" },
      { name: "Seated Calf Raise",     muscle: "Pantorrillas · acortado",  weight: "", reps: "3×10" },
      { name: "Leg Raises",            muscle: "Abdominales",              weight: "—", reps: "3×15" },
    ],
  },
  mar: {
    label: "Martes", name: "Recuperación", type: "Calor & Frío",
    warmup: false, isCardio: true,
    exercises: [
      { name: "Ducha fría",            muscle: "Recuperación",  activity: "" },
      { name: "Caminata / Natación",   muscle: "Cardio suave",  activity: "15–20 min" },
      { name: "Movilidad dinámica",    muscle: "WGS · 90/90 · Cat-Cow · Deep Squat", activity: "" },
      { name: "Hidratación & Proteína", muscle: "Nutrición",    activity: "" },
    ],
  },
  mie: {
    label: "Miércoles", name: "Torso & Cuello", type: "Fuerza",
    warmup: true, isCardio: false,
    exercises: [
      { name: "Overhead Press",        muscle: "Hombros · base",           weight: "", reps: "3×8" },
      { name: "Flat Dumbbell Press",   muscle: "Pecho · base",             weight: "", reps: "4×10" },
      { name: "Incline Press",         muscle: "Pecho · alargado",         weight: "", reps: "3×8" },
      { name: "Seated Cable Row",      muscle: "Espalda · grosor",         weight: "", reps: "3×8" },
      { name: "Chin-up / Pull-up",     muscle: "Espalda · alargado",       weight: "", reps: "3×8" },
      { name: "Lateral Raise",         muscle: "Hombros · aislamiento",    weight: "", reps: "4×15" },
      { name: "Eye Level Pull",        muscle: "Hombros · acortado",       weight: "", reps: "3×12" },
      { name: "Plank / Dead Bug",      muscle: "Abdominales",              weight: "—", reps: "3×60s" },
    ],
  },
  jue: {
    label: "Jueves", name: "Cardio", type: "Zona 2",
    warmup: false, isCardio: true,
    exercises: [
      { name: "Cardio moderado",       muscle: "35 min · 75–80% esfuerzo", activity: "" },
    ],
  },
  vie: {
    label: "Viernes", name: "HIIT", type: "Alta intensidad",
    warmup: false, isCardio: true,
    exercises: [
      { name: "HIIT",                  muscle: "8–12 rondas · sprint 20–60s", activity: "" },
      { name: "V-Ups / Bicicleta",     muscle: "Abdominales",               activity: "3×20" },
    ],
  },
  sab: {
    label: "Sábado", name: "Brazos", type: "Fuerza",
    warmup: true, isCardio: false,
    exercises: [
      { name: "Incline Curl",          muscle: "Bíceps · alargado",        weight: "", reps: "3×6–8" },
      { name: "Hammer Curl",           muscle: "Bíceps · acortado",        weight: "", reps: "3×6–8" },
      { name: "Overhead Extension",    muscle: "Tríceps · alargado",       weight: "", reps: "3×6–8" },
      { name: "Triceps Dips",          muscle: "Tríceps · acortado",       weight: "", reps: "3×6–8" },
      { name: "Standing + Seated Raise", muscle: "Pantorrillas",           weight: "", reps: "3×8" },
      { name: "Tibialis Raise",        muscle: "Tibiales",                 weight: "", reps: "3×10–12" },
      { name: "Russian Twists",        muscle: "Abdominales",              weight: "—", reps: "3×20" },
    ],
  },
  dom: {
    label: "Domingo", name: "Zona 2 larga", type: "Resistencia",
    warmup: false, isCardio: true,
    exercises: [
      { name: "Cardio largo",          muscle: "60–75 min · Zona 2", activity: "" },
    ],
  },
};

const DAY_ORDER = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
const TODAY_IDX = Math.min(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1, 6);

// Merge week data from Supabase with the template (labels, types, isCardio, warmup)
const mergeWithTemplate = (weekData) => {
  const merged = { ...weekData, days: {} };
  DAY_ORDER.forEach(d => {
    const tmpl = BASE_DAYS[d];
    const stored = weekData.days?.[d] || {};
    merged.days[d] = {
      ...tmpl,
      ...stored,
      exercises: stored.exercises || tmpl.exercises.map((e, i) => ({
        id: `${d}_${i}_local`,
        ...e,
        done: false,
      })),
    };
  });
  return merged;
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function Apex({ user, onSignOut }) {
  const [screen, setScreen]       = useState("tracker");
  const [activeDay, setActiveDay] = useState(DAY_ORDER[TODAY_IDX]);
  const [editId, setEditId]       = useState(null);
  const [editVals, setEditVals]   = useState({});
  const [showAdd, setShowAdd]     = useState(false);
  const [newEx, setNewEx]         = useState({ name: "", muscle: "", weight: "", reps: "", activity: "" });
  const [chartEx, setChartEx]     = useState("Squat");
  const [toast, setToast]         = useState(null);

  // ─── Remote state
  const [weeks, setWeeks]             = useState({});
  const [currentWeekNum, setCurrentWeekNum] = useState(1);
  const [schedule, setSchedule]       = useState("A");
  const [loading, setLoading]         = useState(true);

  // ─── Show toast briefly
  const showToast = (msg, type = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Load all data from Supabase on mount
  useEffect(() => {
    async function init() {
      try {
        let data = await loadAllData(user.id);
        if (!data) {
          // First time — create week 1
          const weekData = await createFullWeek(user.id, 1, "A", BASE_DAYS);
          data = { currentWeekNum: 1, schedule: "A", weeks: { 1: weekData } };
        }
        setCurrentWeekNum(data.currentWeekNum);
        setSchedule(data.schedule);
        setWeeks(prevWeeks => {
          const merged = {};
          for (const [wn, wd] of Object.entries(data.weeks)) {
            merged[wn] = mergeWithTemplate(wd);
          }
          return merged;
        });
      } catch (err) {
        showToast("Error cargando datos: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user.id]);

  // ─── Derived
  const weekData  = weeks[currentWeekNum];
  const dayData   = weekData?.days?.[activeDay];
  const exercises = dayData?.exercises || [];
  const doneCount = exercises.filter(e => e.done).length;
  const pct       = exercises.length ? Math.round(doneCount / exercises.length * 100) : 0;
  const totalDays = DAY_ORDER.filter(d => {
    const exs = weekData?.days?.[d]?.exercises || [];
    return exs.length && exs.every(e => e.done);
  }).length;

  // ─── Local optimistic update helper
  const updateLocal = useCallback((updater) => {
    setWeeks(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      updater(next);
      return next;
    });
  }, []);

  // ─── Toggle exercise done
  const toggle = async (id) => {
    const ex = exercises.find(e => e.id === id);
    if (!ex) return;
    const newDone = !ex.done;
    // Optimistic
    updateLocal(w => {
      const e = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(x => x.id === id);
      if (e) e.done = newDone;
    });
    try { await toggleExercise(id, newDone); }
    catch (err) {
      // Revert
      updateLocal(w => {
        const e = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(x => x.id === id);
        if (e) e.done = !newDone;
      });
      showToast("Error al guardar");
    }
  };

  // ─── Save edit (weight/reps)
  const saveEdit = async (id) => {
    updateLocal(w => {
      const ex = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(e => e.id === id);
      if (ex) Object.assign(ex, editVals);
    });
    setEditId(null);
    try { await updateExercise(id, editVals); }
    catch (err) { showToast("Error al guardar peso"); }
  };

  // ─── Delete exercise
  const delEx = async (id) => {
    updateLocal(w => {
      const day = w[currentWeekNum]?.days?.[activeDay];
      if (day) day.exercises = day.exercises.filter(e => e.id !== id);
    });
    setEditId(null);
    try { await deleteExercise(id); }
    catch (err) { showToast("Error al eliminar"); }
  };

  // ─── Save activity (cardio notes)
  const saveActivity = async (id, val) => {
    updateLocal(w => {
      const ex = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(e => e.id === id);
      if (ex) ex.activity = val;
    });
    try { await updateExercise(id, { activity: val }); }
    catch (err) { showToast("Error al guardar actividad"); }
  };

  // ─── Add new exercise
  const addEx = async () => {
    if (!newEx.name.trim()) return;
    const day = weekData?.days?.[activeDay];
    if (!day?._dayId) return;
    const position = exercises.length;
    // Optimistic with temp ID
    const tempId = `temp_${Date.now()}`;
    updateLocal(w => {
      w[currentWeekNum]?.days?.[activeDay]?.exercises?.push({ id: tempId, ...newEx, done: false, position });
    });
    setNewEx({ name: "", muscle: "", weight: "", reps: "", activity: "" });
    setShowAdd(false);
    try {
      const saved = await insertExercise(day._dayId, newEx, position);
      // Replace temp ID with real ID
      updateLocal(w => {
        const exs = w[currentWeekNum]?.days?.[activeDay]?.exercises;
        const i = exs?.findIndex(e => e.id === tempId);
        if (i !== undefined && i >= 0) exs[i].id = saved.id;
      });
    } catch (err) {
      updateLocal(w => {
        const day = w[currentWeekNum]?.days?.[activeDay];
        if (day) day.exercises = day.exercises.filter(e => e.id !== tempId);
      });
      showToast("Error al agregar ejercicio");
    }
  };

  // ─── Reset day
  const resetDay = async () => {
    const day = weekData?.days?.[activeDay];
    if (!day?._dayId) return;
    updateLocal(w => {
      w[currentWeekNum]?.days?.[activeDay]?.exercises?.forEach(e => e.done = false);
    });
    try { await resetDayExercises(day._dayId); }
    catch (err) { showToast("Error al reiniciar día"); }
  };

  // ─── New week
  const newWeek = async () => {
    const next = currentWeekNum + 1;
    setLoading(true);
    try {
      const weekData = await createFullWeek(user.id, next, schedule, BASE_DAYS);
      setWeeks(prev => ({ ...prev, [next]: mergeWithTemplate(weekData) }));
      setCurrentWeekNum(next);
      setActiveDay(DAY_ORDER[0]);
    } catch (err) {
      showToast("Error al crear semana: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Toggle schedule A/B
  const toggleSchedule = async () => {
    const newSched = schedule === "A" ? "B" : "A";
    setSchedule(newSched);
    const wk = weekData;
    if (wk?._weekId) {
      try {
        await updateWeekSchedule(wk._weekId, newSched);
        updateLocal(w => { if (w[currentWeekNum]) w[currentWeekNum].schedule = newSched; });
      } catch (err) { showToast("Error al cambiar horario"); }
    }
  };

  // ─── Navigate weeks
  const navWeek = async (dir) => {
    const next = currentWeekNum + dir;
    if (next < 1) return;
    if (!weeks[next] && dir > 0) {
      // Create it
      setLoading(true);
      try {
        const wd = await createFullWeek(user.id, next, schedule, BASE_DAYS);
        setWeeks(prev => ({ ...prev, [next]: mergeWithTemplate(wd) }));
        setCurrentWeekNum(next);
      } catch (err) {
        showToast("Error al crear semana");
      } finally {
        setLoading(false);
      }
    } else if (weeks[next]) {
      setCurrentWeekNum(next);
    }
  };

  const getProgress = (dayId) => {
    const exs = weekData?.days?.[dayId]?.exercises || [];
    if (!exs.length) return 0;
    return Math.round(exs.filter(e => e.done).length / exs.length * 100);
  };

  // ─── Chart data
  const getChartData = (exName) => {
    const points = [];
    Object.entries(weeks).sort((a, b) => a[0] - b[0]).forEach(([wn, wk]) => {
      DAY_ORDER.forEach(d => {
        const ex = (wk.days?.[d]?.exercises || []).find(e => e.name === exName && e.weight && parseFloat(e.weight) > 0);
        if (ex) points.push({ week: `S${wn}`, weight: parseFloat(ex.weight) });
      });
    });
    return points;
  };

  const allTrackedNames = () => {
    const names = new Set();
    Object.values(weeks).forEach(wk =>
      DAY_ORDER.forEach(d =>
        (wk.days?.[d]?.exercises || []).forEach(e => {
          if (e.weight && parseFloat(e.weight) > 0) names.add(e.name);
        })
      )
    );
    return [...names];
  };

  const chartData   = getChartData(chartEx);
  const trackedList = allTrackedNames();

  // ─── STYLES ──────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body { background: #F0EDE8; }

    :root {
      --bg: #F0EDE8;
      --surface: #FFFFFF;
      --border: #E5E1DA;
      --text: #1A1917;
      --muted: #9E9A94;
      --accent: #1A1917;
      --pill: #ECEAE5;
    }

    .app {
      min-height: 100dvh;
      background: var(--bg);
      color: var(--text);
      font-family: 'DM Sans', sans-serif;
      max-width: 430px;
      margin: 0 auto;
    }

    /* ── LOADING ── */
    .loading-screen {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: var(--bg);
      font-family: 'DM Sans', sans-serif;
    }
    .loading-logo { font-size: 32px; font-weight: 300; letter-spacing: -1px; color: var(--text); }
    .loading-dot {
      display: flex; gap: 6px;
    }
    .loading-dot span {
      width: 5px; height: 5px; border-radius: 50%; background: var(--muted);
      animation: pulse 1s infinite;
    }
    .loading-dot span:nth-child(2) { animation-delay: 0.15s; }
    .loading-dot span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes pulse { 0%,80%,100% { opacity: 0.2; } 40% { opacity: 1; } }

    /* ── TOAST ── */
    .toast {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--text);
      color: var(--bg);
      font-size: 12px;
      font-family: 'DM Mono', monospace;
      padding: 10px 20px;
      border-radius: 20px;
      z-index: 999;
      animation: fadeIn 0.2s ease;
      white-space: nowrap;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

    /* ── TOP BAR ── */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 20px 0;
    }
    .top-logo { font-size: 22px; font-weight: 300; letter-spacing: -1px; color: var(--text); }
    .top-right { display: flex; align-items: center; gap: 10px; }
    .top-name { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; }
    .top-switch {
      font-size: 11px; color: var(--muted); background: var(--pill);
      border: none; border-radius: 20px; padding: 5px 10px;
      cursor: pointer; font-family: 'DM Sans', sans-serif;
    }

    /* ── DAY STRIP ── */
    .day-strip {
      display: flex; gap: 6px; padding: 18px 20px 0;
      overflow-x: auto; scrollbar-width: none;
    }
    .day-strip::-webkit-scrollbar { display: none; }
    .day-btn {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 10px 0; width: 44px; border-radius: 22px;
      border: 1px solid transparent; background: transparent;
      cursor: pointer; flex-shrink: 0; transition: all 0.15s;
    }
    .day-btn.active { background: var(--text); border-color: var(--text); }
    .day-lbl { font-size: 11px; font-weight: 500; color: var(--muted); letter-spacing: 0.5px; font-family: 'DM Mono', monospace; }
    .day-btn.active .day-lbl { color: #F0EDE8; }
    .day-pip { width: 4px; height: 4px; border-radius: 50%; background: var(--border); }
    .day-pip.full { background: var(--text); }
    .day-btn.active .day-pip { background: rgba(240,237,232,0.4); }
    .day-btn.active .day-pip.full { background: #F0EDE8; }
    .day-pip.partial { background: var(--muted); opacity: 0.4; }

    /* ── TRACKER BODY ── */
    .body { padding: 24px 20px 100px; }

    .day-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;
    }
    .day-title { font-size: 28px; font-weight: 300; letter-spacing: -0.5px; color: var(--text); }
    .day-meta  { font-size: 12px; color: var(--muted); margin-top: 3px; }

    .progress-ring { flex-shrink: 0; }

    .schedule-row { display: flex; gap: 8px; margin-bottom: 20px; align-items: center; }
    .sched-pill {
      font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted);
      background: var(--pill); border: none; border-radius: 20px; padding: 5px 12px;
      cursor: pointer; transition: all 0.15s;
    }
    .sched-pill.active { background: var(--text); color: var(--bg); }
    .warmup-tag {
      font-size: 11px; color: var(--muted); background: var(--pill);
      border-radius: 20px; padding: 5px 12px; font-family: 'DM Mono', monospace;
    }
    .action-row { display: flex; gap: 8px; margin-bottom: 20px; }
    .ghost-btn {
      font-size: 12px; color: var(--muted); background: transparent;
      border: 1px solid var(--border); border-radius: 20px; padding: 6px 14px;
      cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
    }
    .ghost-btn:active { border-color: var(--text); color: var(--text); }

    /* ── EXERCISE LIST ── */
    .ex-list { display: flex; flex-direction: column; }
    .ex-row {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 16px 0; border-bottom: 1px solid var(--border); cursor: pointer;
    }
    .ex-row:last-child { border-bottom: none; }
    .ex-check-wrap { padding-top: 2px; flex-shrink: 0; }
    .ex-check {
      width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--border);
      display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0;
    }
    .ex-check.done { background: var(--text); border-color: var(--text); }
    .check-mark { font-size: 10px; color: var(--bg); }
    .ex-body { flex: 1; min-width: 0; }
    .ex-name { font-size: 15px; font-weight: 500; color: var(--text); transition: color 0.15s; }
    .ex-name.done { color: var(--muted); text-decoration: line-through; text-decoration-color: var(--border); }
    .ex-muscle { font-size: 11px; color: var(--muted); margin-top: 2px; font-family: 'DM Mono', monospace; }

    .ex-chips { display: flex; gap: 6px; margin-top: 10px; }
    .chip {
      font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted);
      background: var(--pill); border-radius: 6px; padding: 4px 8px; cursor: pointer;
    }
    .chip.editing { background: var(--text); color: var(--bg); }
    .chip input {
      background: transparent; border: none; outline: none; color: var(--bg);
      font-family: 'DM Mono', monospace; font-size: 11px; width: 70px;
    }

    .activity-input {
      margin-top: 10px; width: 100%; background: var(--pill);
      border: none; border-radius: 8px; padding: 9px 12px; font-size: 12px;
      color: var(--text); font-family: 'DM Sans', sans-serif; outline: none;
    }
    .activity-input::placeholder { color: var(--muted); }

    .edit-actions { display: flex; gap: 6px; margin-top: 10px; }
    .save-btn {
      font-size: 11px; background: var(--text); color: var(--bg);
      border: none; border-radius: 20px; padding: 6px 14px;
      cursor: pointer; font-family: 'DM Sans', sans-serif;
    }
    .cancel-btn {
      font-size: 11px; background: var(--pill); color: var(--muted);
      border: none; border-radius: 20px; padding: 6px 14px;
      cursor: pointer; font-family: 'DM Sans', sans-serif;
    }
    .del-btn {
      font-size: 11px; background: transparent; color: #C0392B;
      border: 1px solid #EDCFCC; border-radius: 20px; padding: 6px 12px;
      cursor: pointer; font-family: 'DM Sans', sans-serif; margin-left: auto;
    }

    /* ── ADD EXERCISE ── */
    .add-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; padding: 18px; margin-bottom: 16px;
    }
    .add-title { font-size: 14px; font-weight: 500; margin-bottom: 14px; color: var(--text); }
    .add-input {
      width: 100%; background: var(--pill); border: none; border-radius: 8px;
      padding: 10px 12px; font-size: 13px; color: var(--text);
      font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 8px;
    }
    .add-input::placeholder { color: var(--muted); }
    .add-row { display: flex; gap: 8px; }
    .add-row .add-input { margin-bottom: 0; }

    /* ── WEEK VIEW ── */
    .week-body { padding: 24px 20px 100px; }
    .section-title { font-size: 22px; font-weight: 300; letter-spacing: -0.5px; margin-bottom: 20px; color: var(--text); }

    .stats-row { display: flex; gap: 10px; margin-bottom: 24px; }
    .stat-card {
      flex: 1; background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; padding: 16px 14px; text-align: center;
    }
    .stat-num { font-size: 32px; font-weight: 300; letter-spacing: -1px; color: var(--text); line-height: 1; }
    .stat-lbl { font-size: 10px; color: var(--muted); margin-top: 4px; font-family: 'DM Mono', monospace; }

    .day-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; padding: 16px; margin-bottom: 8px;
      cursor: pointer; transition: border-color 0.15s;
    }
    .day-card:active { border-color: var(--text); }
    .day-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .day-card-name { font-size: 17px; font-weight: 400; color: var(--text); }
    .day-card-pct { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; }
    .bar-bg { height: 2px; background: var(--border); border-radius: 2px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--text); border-radius: 2px; transition: width 0.4s; }
    .day-card-sub { display: flex; justify-content: space-between; margin-top: 8px; }
    .day-card-type { font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; }
    .day-card-count { font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; }

    .new-week-btn {
      width: 100%; margin-top: 16px; padding: 14px;
      background: var(--text); color: var(--bg); border: none; border-radius: 14px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      font-family: 'DM Sans', sans-serif; letter-spacing: 0.3px;
    }

    /* ── PROGRESS VIEW ── */
    .progress-body { padding: 24px 20px 100px; }

    .chart-pills {
      display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
      margin-bottom: 20px; padding-bottom: 2px;
    }
    .chart-pills::-webkit-scrollbar { display: none; }
    .cpill {
      font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted);
      background: var(--pill); border: none; border-radius: 20px; padding: 6px 12px;
      cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
    }
    .cpill.active { background: var(--text); color: var(--bg); }

    .chart-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; padding: 20px; margin-bottom: 16px;
    }
    .chart-name { font-size: 18px; font-weight: 400; color: var(--text); margin-bottom: 2px; }
    .chart-range { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; margin-bottom: 20px; }
    .chart-area { position: relative; height: 130px; }
    .chart-svg { width: 100%; height: 100%; overflow: visible; }
    .chart-x-labels { display: flex; justify-content: space-between; margin-top: 6px; }
    .chart-x-lbl { font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace; }

    .chart-stats {
      display: flex; gap: 0; margin-top: 20px;
      padding-top: 16px; border-top: 1px solid var(--border);
    }
    .cstat { flex: 1; text-align: center; border-right: 1px solid var(--border); }
    .cstat:last-child { border-right: none; }
    .cstat-val { font-size: 22px; font-weight: 300; letter-spacing: -0.5px; color: var(--text); }
    .cstat-lbl { font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace; margin-top: 2px; }
    .cstat-val.up { color: #27AE60; }
    .cstat-val.dn { color: #C0392B; }

    .no-data { text-align: center; padding: 40px 0; font-size: 13px; color: var(--muted); line-height: 2; }

    /* ── NAV BAR ── */
    .nav-bar {
      position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
      width: 100%; max-width: 430px;
      background: rgba(240,237,232,0.92); backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      display: flex; padding: 12px 0 24px; z-index: 100;
    }
    .nav-item {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;
    }
    .nav-icon { font-size: 18px; }
    .nav-lbl {
      font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace;
      letter-spacing: 0.5px; transition: color 0.15s;
    }
    .nav-item.active .nav-lbl { color: var(--text); }
    .nav-dot { width: 4px; height: 4px; border-radius: 50%; background: transparent; margin-top: 2px; }
    .nav-item.active .nav-dot { background: var(--text); }

    .hint { font-size: 10px; color: var(--border); text-align: center; margin-top: 20px; font-family: 'DM Mono', monospace; }

    /* ── WEEK SELECTOR ── */
    .week-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .week-nav-btn {
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--border);
      background: transparent; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center; transition: all 0.15s;
    }
    .week-nav-btn:active { background: var(--text); color: var(--bg); border-color: var(--text); }
    .week-nav-label { font-size: 14px; font-weight: 400; color: var(--text); }
    .week-nav-sub { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; }
  `;

  // ─── LOADING STATE ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div className="loading-screen">
          <div className="loading-logo">apex</div>
          <div className="loading-dot"><span/><span/><span/></div>
        </div>
      </>
    );
  }

  // ─── RENDER HELPERS ───────────────────────────────────────────────────────

  const renderExRow = (ex) => {
    const isEditing = editId === ex.id;
    const isCardio  = dayData?.isCardio;

    return (
      <div key={ex.id} className="ex-row" onClick={() => !isEditing && toggle(ex.id)}>
        <div className="ex-check-wrap">
          <div className={`ex-check ${ex.done ? "done" : ""}`}>
            {ex.done && <span className="check-mark">✓</span>}
          </div>
        </div>

        <div className="ex-body" onClick={e => e.stopPropagation()}>
          <div className={`ex-name ${ex.done ? "done" : ""}`} onClick={() => toggle(ex.id)}>{ex.name}</div>
          <div className="ex-muscle">{ex.muscle}</div>

          {isCardio ? (
            <input className="activity-input"
              placeholder="¿Qué hiciste? ej: trote 35 min, bici 16 km…"
              defaultValue={ex.activity || ""}
              onBlur={e => saveActivity(ex.id, e.target.value)}
            />
          ) : isEditing ? (
            <>
              <div className="ex-chips">
                <div className="chip editing">
                  <input autoFocus
                    value={editVals.weight ?? ex.weight}
                    onChange={e => setEditVals(v => ({ ...v, weight: e.target.value }))}
                    placeholder="peso"
                  />
                </div>
                <div className="chip editing">
                  <input
                    value={editVals.reps ?? ex.reps}
                    onChange={e => setEditVals(v => ({ ...v, reps: e.target.value }))}
                    placeholder="series×reps"
                    style={{ width: 90 }}
                  />
                </div>
              </div>
              <div className="edit-actions">
                <button className="save-btn"   onClick={() => saveEdit(ex.id)}>Guardar</button>
                <button className="cancel-btn" onClick={() => setEditId(null)}>Cancelar</button>
                <button className="del-btn"    onClick={() => delEx(ex.id)}>Eliminar</button>
              </div>
            </>
          ) : (
            <div className="ex-chips"
              onClick={() => { setEditId(ex.id); setEditVals({ weight: ex.weight, reps: ex.reps }); }}>
              <div className="chip">{ex.weight || "— kg"}</div>
              <div className="chip">{ex.reps || "—"}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTracker = () => {
    const ringR   = 26;
    const ringC   = 2 * Math.PI * ringR;
    const ringOff = ringC - (pct / 100) * ringC;

    return (
      <>
        <div className="top-bar">
          <div className="top-logo">apex</div>
          <div className="top-right">
            <span className="top-name">{user.email?.split('@')[0]}</span>
            <button className="top-switch" onClick={onSignOut}>salir</button>
          </div>
        </div>

        <div className="day-strip">
          {DAY_ORDER.map(d => {
            const p = getProgress(d);
            return (
              <button key={d} className={`day-btn ${activeDay === d ? "active" : ""}`}
                onClick={() => { setActiveDay(d); setEditId(null); setShowAdd(false); }}>
                <span className="day-lbl">{d.toUpperCase()}</span>
                <div className={`day-pip ${p === 100 ? "full" : p > 0 ? "partial" : ""}`} />
              </button>
            );
          })}
        </div>

        <div className="body">
          <div className="day-header">
            <div>
              <div className="day-title">{dayData?.name}</div>
              <div className="day-meta">
                {dayData?.label} · {dayData?.type} · S{currentWeekNum}
                {weekData?.date && <span style={{ opacity: 0.55, marginLeft: 4 }}>· {weekData.date}</span>}
              </div>
            </div>
            <svg className="progress-ring" width="68" height="68" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r={ringR} fill="none" stroke="#E5E1DA" strokeWidth="3" />
              <circle cx="34" cy="34" r={ringR} fill="none" stroke="#1A1917" strokeWidth="3"
                strokeDasharray={ringC} strokeDashoffset={ringOff} strokeLinecap="round"
                transform="rotate(-90 34 34)" style={{ transition: "stroke-dashoffset 0.4s" }} />
              <text x="34" y="39" textAnchor="middle" fill="#1A1917"
                fontFamily="DM Mono, monospace" fontWeight="500" fontSize="13">{pct}%</text>
            </svg>
          </div>

          <div className="schedule-row">
            <button className={`sched-pill ${schedule === "A" ? "active" : ""}`} onClick={toggleSchedule}>A · fuerza</button>
            <button className={`sched-pill ${schedule === "B" ? "active" : ""}`} onClick={toggleSchedule}>B · hipertrofia</button>
            {dayData?.warmup && <span className="warmup-tag">calentamiento 10 min</span>}
          </div>

          <div className="action-row">
            <button className="ghost-btn" onClick={() => setShowAdd(s => !s)}>+ agregar</button>
            <button className="ghost-btn" onClick={resetDay}>reiniciar día</button>
          </div>

          {showAdd && (
            <div className="add-panel">
              <div className="add-title">Nuevo ejercicio</div>
              <input className="add-input" placeholder="Nombre" value={newEx.name}
                onChange={e => setNewEx(v => ({ ...v, name: e.target.value }))} />
              <input className="add-input" placeholder="Músculo / grupo"
                value={newEx.muscle} onChange={e => setNewEx(v => ({ ...v, muscle: e.target.value }))} />
              {dayData?.isCardio ? (
                <input className="add-input" placeholder="Actividad / duración"
                  value={newEx.activity} onChange={e => setNewEx(v => ({ ...v, activity: e.target.value }))} />
              ) : (
                <div className="add-row">
                  <input className="add-input" placeholder="Peso" value={newEx.weight}
                    onChange={e => setNewEx(v => ({ ...v, weight: e.target.value }))} />
                  <input className="add-input" placeholder="Series×Reps" value={newEx.reps}
                    onChange={e => setNewEx(v => ({ ...v, reps: e.target.value }))} />
                </div>
              )}
              <div className="edit-actions" style={{ marginTop: 12 }}>
                <button className="cancel-btn" onClick={() => setShowAdd(false)}>Cancelar</button>
                <button className="save-btn" onClick={addEx}>Agregar</button>
              </div>
            </div>
          )}

          <div className="ex-list">{exercises.map(renderExRow)}</div>
          <div className="hint">toca el peso para editar</div>
        </div>
      </>
    );
  };

  const renderWeek = () => (
    <>
      <div className="top-bar">
        <div className="top-logo">apex</div>
        <div className="top-right">
          <span className="top-name">{user.email?.split('@')[0]}</span>
          <button className="top-switch" onClick={onSignOut}>salir</button>
        </div>
      </div>
      <div className="week-body">
        <div className="week-nav">
          <button className="week-nav-btn" onClick={() => navWeek(-1)}>‹</button>
          <div>
            <div className="week-nav-label">Semana {currentWeekNum}</div>
            <div className="week-nav-sub">horario {weekData?.schedule} · {weekData?.date}</div>
          </div>
          <button className="week-nav-btn" onClick={() => navWeek(1)}>›</button>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-num">{totalDays}</div>
            <div className="stat-lbl">días ✓</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{DAY_ORDER.reduce((a, d) => a + (weekData?.days?.[d]?.exercises || []).filter(e => e.done).length, 0)}</div>
            <div className="stat-lbl">ejercicios</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{7 - totalDays}</div>
            <div className="stat-lbl">restantes</div>
          </div>
        </div>

        {DAY_ORDER.map(d => {
          const dd  = weekData?.days?.[d];
          const p   = getProgress(d);
          const exs = dd?.exercises || [];
          return (
            <div key={d} className="day-card"
              onClick={() => { setActiveDay(d); setScreen("tracker"); }}>
              <div className="day-card-top">
                <div className="day-card-name">{dd?.label} — {dd?.name}</div>
                <div className="day-card-pct">{p}%</div>
              </div>
              <div className="bar-bg"><div className="bar-fill" style={{ width: `${p}%` }} /></div>
              <div className="day-card-sub">
                <span className="day-card-type">{dd?.type}</span>
                <span className="day-card-count">{exs.filter(e => e.done).length}/{exs.length}</span>
              </div>
            </div>
          );
        })}

        <button className="new-week-btn" onClick={newWeek}>
          Comenzar semana {currentWeekNum + 1} →
        </button>
      </div>
    </>
  );

  const renderProgress = () => {
    const W = 320, H = 110, pad = { l: 24, r: 8, t: 12, b: 8 };
    const hasData = chartData.length > 1;
    const wMax = hasData ? Math.max(...chartData.map(d => d.weight)) : 50;
    const wMin = hasData ? Math.min(...chartData.map(d => d.weight)) : 0;
    const yRange = (wMax - wMin) || 1;
    const xStep  = hasData ? (W - pad.l - pad.r) / (chartData.length - 1) : 0;
    const toX    = i => pad.l + i * xStep;
    const toY    = w => pad.t + (H - pad.t - pad.b) * (1 - (w - wMin) / yRange);
    const pathD  = hasData ? chartData.map((d, i) => `${i===0?"M":"L"}${toX(i)},${toY(d.weight)}`).join(" ") : "";
    const areaD  = hasData ? `${pathD} L${toX(chartData.length-1)},${H} L${toX(0)},${H} Z` : "";
    const first  = chartData[0]?.weight;
    const last   = chartData[chartData.length-1]?.weight;
    const gain   = first ? ((last - first) / first * 100).toFixed(1) : 0;

    return (
      <>
        <div className="top-bar">
          <div className="top-logo">apex</div>
          <div className="top-right">
            <span className="top-name">{user.email?.split('@')[0]}</span>
            <button className="top-switch" onClick={onSignOut}>salir</button>
          </div>
        </div>
        <div className="progress-body">
          <div className="section-title">Progreso</div>

          {trackedList.length === 0 ? (
            <div className="no-data">
              Aún no hay pesos registrados.<br />
              Agrega pesos en cada ejercicio<br />
              y aparecerán aquí.
            </div>
          ) : (
            <>
              <div className="chart-pills">
                {trackedList.map(n => (
                  <button key={n} className={`cpill ${chartEx === n ? "active" : ""}`}
                    onClick={() => setChartEx(n)}>{n}</button>
                ))}
              </div>

              <div className="chart-card">
                <div className="chart-name">{chartEx}</div>
                <div className="chart-range">{chartData.length} registros · semanas {chartData[0]?.week} – {chartData[chartData.length-1]?.week}</div>

                {hasData ? (
                  <>
                    <div className="chart-area">
                      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1A1917" stopOpacity="0.08" />
                            <stop offset="100%" stopColor="#1A1917" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={areaD} fill="url(#g)" />
                        <path d={pathD} fill="none" stroke="#1A1917" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                        {chartData.map((d, i) => (
                          <g key={i}>
                            <circle cx={toX(i)} cy={toY(d.weight)} r="3.5" fill="#1A1917" />
                            <text x={toX(i)} y={toY(d.weight)-8} textAnchor="middle"
                              fill="#9E9A94" fontFamily="DM Mono,monospace" fontSize="8">{d.weight}kg</text>
                          </g>
                        ))}
                        <text x="0" y={pad.t+4} fill="#C8C4BE" fontFamily="DM Mono" fontSize="8">{Math.round(wMax)}</text>
                        <text x="0" y={H-2}    fill="#C8C4BE" fontFamily="DM Mono" fontSize="8">{Math.round(wMin)}</text>
                      </svg>
                    </div>
                    <div className="chart-x-labels">
                      {chartData.map((d, i) => <span key={i} className="chart-x-lbl">{d.week}</span>)}
                    </div>
                    <div className="chart-stats">
                      <div className="cstat">
                        <div className="cstat-val">{first}kg</div>
                        <div className="cstat-lbl">inicio</div>
                      </div>
                      <div className="cstat">
                        <div className="cstat-val">{last}kg</div>
                        <div className="cstat-lbl">actual</div>
                      </div>
                      <div className="cstat">
                        <div className={`cstat-val ${Number(gain)>0?"up":Number(gain)<0?"dn":""}`}>
                          {gain > 0 ? "+" : ""}{gain}%
                        </div>
                        <div className="cstat-lbl">progreso</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-data">Registra al menos 2 semanas<br />para ver la curva.</div>
                )}
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  const NAV = [
    { id: "tracker",  icon: "○", label: "hoy"     },
    { id: "week",     icon: "◫", label: "semana"  },
    { id: "progress", icon: "↗", label: "progreso" },
  ];

  return (
    <>
      <style>{css}</style>
      {toast && <div className="toast">{toast.msg}</div>}
      <div className="app">
        {screen === "tracker"  ? renderTracker()  :
         screen === "week"     ? renderWeek()     :
         screen === "progress" ? renderProgress() : null}

        <div className="nav-bar">
          {NAV.map(n => (
            <div key={n.id} className={`nav-item ${screen === n.id ? "active" : ""}`}
              onClick={() => setScreen(n.id)}>
              <span className="nav-icon" style={{ opacity: screen === n.id ? 1 : 0.3 }}>{n.icon}</span>
              <span className="nav-lbl">{n.label}</span>
              <div className="nav-dot" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
