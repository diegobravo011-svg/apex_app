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

// ─── PROTOCOL CONTEXT PER DAY ─────────────────────────────────────────────────
const DAY_PROTOCOL = {
  lun: {
    scheduleNote: (s) => s === "A"
      ? { sets: "3–4 sets · 4–8 reps", rest: "Descanso 2–4 min entre sets" }
      : { sets: "2–3 sets · 8–15 reps", rest: "Descanso ~90 s entre sets" },
    tip1: "Ejercicio #1 → músculo en posición acortada (leg curl, seated calf, leg extension).",
    tip2: "Ejercicio #2 → resistencia en posición alargada (squat profundo, standing calf, RDL).",
    breath: "Entre sets: 2 inhales nasales + 1 exhale completo (suspiro fisiológico).",
    warmup: "Calentamiento dinámico 10 min antes de cargar.",
  },
  mar: {
    tip1: "Cardio suave (Zona 1) + movilidad dinámica: WGS, 90/90, Cat-Cow, Deep Squat.",
    tip2: "Ducha fría para acelerar recuperación muscular.",
    breath: "Respiración lenta y profunda — baja el sistema nervioso simpático.",
    warmup: null,
  },
  mie: {
    scheduleNote: (s) => s === "A"
      ? { sets: "3–4 sets · 4–8 reps", rest: "Descanso 2–4 min entre sets" }
      : { sets: "2–3 sets · 8–15 reps", rest: "Descanso ~90 s entre sets" },
    tip1: "Ejercicio #1 → músculo acortado (overhead press, lateral raise, cable crossover).",
    tip2: "Ejercicio #2 → resistencia en alargado (incline press, incline curl, pull-up).",
    breath: "Entre sets: suspiro fisiológico para bajar FC y optimizar recuperación.",
    warmup: "Calentamiento 10 min — movilidad de hombros y escápulas.",
  },
  jue: {
    tip1: "Zona 2: mantén 75–80% de esfuerzo percibido — puedes hablar en frases cortas.",
    tip2: "35 min continuos: bici, remo, trote o elíptica.",
    breath: "Respiración nasal en lo posible — señal de que estás en Zona 2.",
    warmup: null,
  },
  vie: {
    tip1: "HIIT: 8–12 rondas · sprint 20–60 s → recuperación activa 2 min.",
    tip2: "La alta intensidad eleva GH y BDNF — clave para función cognitiva.",
    breath: "Post-HIIT: 3–5 min de respiración lenta deliberada para bajar el sistema nervioso.",
    warmup: null,
  },
  sab: {
    scheduleNote: (s) => s === "A"
      ? { sets: "3 sets · 6–8 reps", rest: "Descanso 2–4 min entre sets" }
      : { sets: "2–3 sets · 8–15 reps", rest: "Descanso ~90 s entre sets" },
    tip1: "Bíceps: alargado (incline curl) + acortado (hammer/preacher curl).",
    tip2: "Tríceps: alargado (overhead extension) + acortado (dips/pushdown).",
    breath: "Suspiro fisiológico entre sets. Estiramiento estático 30–60 s post-entreno.",
    warmup: "Calentamiento 10 min — codo y muñeca.",
  },
  dom: {
    tip1: "Zona 2 larga: 60–75 min a intensidad baja-moderada (conversación posible).",
    tip2: "Óptimo para quema de grasa, salud cardiovascular y recuperación activa.",
    breath: "Respiración nasal. Al terminar: 3–5 min de respiración lenta deliberada.",
    warmup: null,
  },
};

// ─── PROTOCOL TEMPLATE — SCHEDULE A (4–8 reps / 3–4 sets) ───────────────────
const EXERCISES_A = {
  lun: [
    { name: "Leg Curls",             muscle: "Cuádriceps · acortado",    weight: "", reps: "4×6" },
    { name: "Squat",                 muscle: "Cuádriceps · alargado",    weight: "", reps: "4×6" },
    { name: "Romanian Dead Lift",    muscle: "Isquiotibiales · alargado", weight: "", reps: "4×6" },
    { name: "Hamstring Curl",        muscle: "Isquiotibiales · acortado", weight: "", reps: "3×6" },
    { name: "Standing Calf Raise",   muscle: "Pantorrillas · alargado",  weight: "", reps: "3×8" },
    { name: "Seated Calf Raise",     muscle: "Pantorrillas · acortado",  weight: "", reps: "3×6" },
    { name: "Leg Raises",            muscle: "Abdominales",              weight: "—", reps: "3×12" },
  ],
  mie: [
    { name: "Overhead Press",        muscle: "Hombros · base",           weight: "", reps: "4×6" },
    { name: "Flat Dumbbell Press",   muscle: "Pecho · base",             weight: "", reps: "4×8" },
    { name: "Incline Press",         muscle: "Pecho · alargado",         weight: "", reps: "3×6" },
    { name: "Seated Cable Row",      muscle: "Espalda · grosor",         weight: "", reps: "3×6" },
    { name: "Chin-up / Pull-up",     muscle: "Espalda · alargado",       weight: "", reps: "3×6" },
    { name: "Lateral Raise",         muscle: "Hombros · aislamiento",    weight: "", reps: "4×8" },
    { name: "Eye Level Pull",        muscle: "Hombros · acortado",       weight: "", reps: "3×8" },
    { name: "Plank / Dead Bug",      muscle: "Abdominales",              weight: "—", reps: "3×45s" },
  ],
  sab: [
    { name: "Incline Curl",          muscle: "Bíceps · alargado",        weight: "", reps: "3×6" },
    { name: "Hammer Curl",           muscle: "Bíceps · acortado",        weight: "", reps: "3×6" },
    { name: "Overhead Extension",    muscle: "Tríceps · alargado",       weight: "", reps: "3×6" },
    { name: "Triceps Dips",          muscle: "Tríceps · acortado",       weight: "", reps: "3×6" },
    { name: "Standing + Seated Raise", muscle: "Pantorrillas",           weight: "", reps: "3×8" },
    { name: "Tibialis Raise",        muscle: "Tibiales",                 weight: "", reps: "3×8" },
    { name: "Russian Twists",        muscle: "Abdominales",              weight: "—", reps: "3×16" },
  ],
};

// ─── PROTOCOL TEMPLATE — SCHEDULE B (8–15 reps / 2–3 sets) ──────────────────
const EXERCISES_B = {
  lun: [
    { name: "Leg Curls",             muscle: "Cuádriceps · acortado",    weight: "", reps: "3×12" },
    { name: "Squat",                 muscle: "Cuádriceps · alargado",    weight: "", reps: "3×12" },
    { name: "Romanian Dead Lift",    muscle: "Isquiotibiales · alargado", weight: "", reps: "3×12" },
    { name: "Hamstring Curl",        muscle: "Isquiotibiales · acortado", weight: "", reps: "2×12" },
    { name: "Standing Calf Raise",   muscle: "Pantorrillas · alargado",  weight: "", reps: "3×15" },
    { name: "Seated Calf Raise",     muscle: "Pantorrillas · acortado",  weight: "", reps: "3×12" },
    { name: "Leg Raises",            muscle: "Abdominales",              weight: "—", reps: "3×20" },
  ],
  mie: [
    { name: "Overhead Press",        muscle: "Hombros · base",           weight: "", reps: "3×12" },
    { name: "Flat Dumbbell Press",   muscle: "Pecho · base",             weight: "", reps: "3×12" },
    { name: "Incline Press",         muscle: "Pecho · alargado",         weight: "", reps: "3×10" },
    { name: "Seated Cable Row",      muscle: "Espalda · grosor",         weight: "", reps: "3×12" },
    { name: "Chin-up / Pull-up",     muscle: "Espalda · alargado",       weight: "", reps: "2×10" },
    { name: "Lateral Raise",         muscle: "Hombros · aislamiento",    weight: "", reps: "3×15" },
    { name: "Eye Level Pull",        muscle: "Hombros · acortado",       weight: "", reps: "3×12" },
    { name: "Plank / Dead Bug",      muscle: "Abdominales",              weight: "—", reps: "3×60s" },
  ],
  sab: [
    { name: "Incline Curl",          muscle: "Bíceps · alargado",        weight: "", reps: "3×10" },
    { name: "Hammer Curl",           muscle: "Bíceps · acortado",        weight: "", reps: "3×10" },
    { name: "Overhead Extension",    muscle: "Tríceps · alargado",       weight: "", reps: "3×10" },
    { name: "Triceps Dips",          muscle: "Tríceps · acortado",       weight: "", reps: "3×10" },
    { name: "Standing + Seated Raise", muscle: "Pantorrillas",           weight: "", reps: "3×12" },
    { name: "Tibialis Raise",        muscle: "Tibiales",                 weight: "", reps: "3×12" },
    { name: "Russian Twists",        muscle: "Abdominales",              weight: "—", reps: "3×20" },
  ],
};

// ─── BASE DAYS (non-resistance days are the same regardless of schedule) ────
const BASE_DAYS = {
  lun: { label: "Lunes",    name: "Piernas",      type: "Resistencia",     warmup: true,  isCardio: false },
  mar: { label: "Martes",   name: "Recuperación", type: "Calor & Frío",    warmup: false, isCardio: true,
    exercises: [
      { name: "Ducha fría",            muscle: "Recuperación",  activity: "", hint: "3 min · agua fría al final" },
      { name: "Caminata / Natación",   muscle: "Cardio suave",  activity: "" },
      { name: "Movilidad dinámica",    muscle: "WGS · 90/90 · Cat-Cow · Deep Squat", activity: "", hint: "15–20 min · estiramientos dinámicos" },
      { name: "Hidratación & Proteína", muscle: "Nutrición",    activity: "", hint: "~40 g proteína · ≥ 2 L agua" },
    ],
  },
  mie: { label: "Miércoles", name: "Torso & Cuello", type: "Fuerza",      warmup: true,  isCardio: false },
  jue: { label: "Jueves",   name: "Cardio",        type: "Zona 2",          warmup: false, isCardio: true,
    exercises: [
      { name: "Cardio moderado", muscle: "35 min · 75–80% esfuerzo", activity: "" },
    ],
  },
  vie: { label: "Viernes",  name: "HIIT",          type: "Alta intensidad", warmup: false, isCardio: true,
    exercises: [
      { name: "HIIT",          muscle: "8–12 rondas · sprint 20–60s", activity: "" },
      { name: "V-Ups / Bicicleta", muscle: "Abdominales",              activity: "3×20" },
    ],
  },
  sab: { label: "Sábado",   name: "Brazos",        type: "Fuerza",          warmup: true,  isCardio: false },
  dom: { label: "Domingo",  name: "Zona 2 larga",  type: "Resistencia",     warmup: false, isCardio: true,
    exercises: [
      { name: "Cardio largo", muscle: "60–75 min · Zona 2", activity: "" },
    ],
  },
};

const RESISTANCE_DAYS = ["lun", "mie", "sab"];
const DAY_ORDER = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
// Use local date to determine today's index (0=Mon … 6=Sun)
const _localDay = new Date().getDay(); // 0=Sun,1=Mon,…,6=Sat
const TODAY_IDX = _localDay === 0 ? 6 : _localDay - 1;

// ─── GET EXERCISES BY SCHEDULE ────────────────────────────────────────────────
const getExercisesForDay = (dayKey, scheduleStr) => {
  if (RESISTANCE_DAYS.includes(dayKey)) {
    const pool = scheduleStr === "A" ? EXERCISES_A : EXERCISES_B;
    return pool[dayKey] || [];
  }
  return BASE_DAYS[dayKey]?.exercises || [];
};

// ─── MERGE WITH TEMPLATE ──────────────────────────────────────────────────────
const mergeWithTemplate = (weekData) => {
  const merged = { ...weekData, days: {} };
  const sched = weekData.schedule || "A";
  DAY_ORDER.forEach(d => {
    const tmpl = BASE_DAYS[d];
    const stored = weekData.days?.[d] || {};
    merged.days[d] = {
      ...tmpl,
      ...stored,
      exercises: (stored.exercises?.length ? stored.exercises : getExercisesForDay(d, sched).map((e, i) => ({
        id: `${d}_${i}_local`,
        ...e,
        done: false,
      }))),
    };
  });
  return merged;
};

// ─── WEEK TEMPLATE HELPERS ────────────────────────────────────────────────────
// Returns a full template with resistance day exercises from pool A or B,
// and optionally pre-fills weights from the previous week.
const buildFullTemplate = (sched, prevWeights = {}) => {
  const pool = sched === "A" ? EXERCISES_A : EXERCISES_B;
  return Object.fromEntries(
    DAY_ORDER.map(dayKey => {
      const base = BASE_DAYS[dayKey];
      let exercises;
      if (RESISTANCE_DAYS.includes(dayKey)) {
        exercises = (pool[dayKey] || []).map(ex => ({
          ...ex,
          weight: prevWeights[dayKey]?.[ex.name] ?? ex.weight,
        }));
      } else {
        exercises = base.exercises || [];
      }
      return [dayKey, { ...base, exercises }];
    })
  );
};

// Extracts { dayKey: { exName: weight } } from a week's data (for carrying over weights)
const buildPrevWeights = (wkData) => {
  const result = {};
  for (const dayKey of RESISTANCE_DAYS) {
    result[dayKey] = {};
    const exs = wkData?.days?.[dayKey]?.exercises || [];
    for (const ex of exs) {
      if (ex.name && ex.weight) result[dayKey][ex.name] = ex.weight;
    }
  }
  return result;
};

// Get template reps for a given schedule — used in per-category volume calc
const getTemplateRepsFromPool = (dayKey, exName, sched) => {
  if (!RESISTANCE_DAYS.includes(dayKey)) return null;
  const pool = sched === "A" ? EXERCISES_A : EXERCISES_B;
  const tmpl = (pool[dayKey] || []).find(e => e.name === exName);
  return tmpl?.reps || null;
};

// ─── CARDIO DATA FORM ─────────────────────────────────────────────────────────
// Serializes cardio metrics to/from the activity string field as JSON
function parseCardioData(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {}
  // Legacy: plain text string
  return { notes: raw };
}

function serializeCardioData(data) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v !== null && v !== undefined));
  return Object.keys(clean).length ? JSON.stringify(clean) : "";
}

function CardioDataForm({ ex, onSave }) {
  const initial = parseCardioData(ex.activity);
  const [vals, setVals] = useState({
    duration: initial.duration || "",
    distance: initial.distance || "",
    hr_avg:   initial.hr_avg   || "",
    hr_max:   initial.hr_max   || "",
    calories: initial.calories || "",
    zone:     initial.zone     || "",
    notes:    initial.notes    || "",
  });

  const set = (k, v) => setVals(prev => ({ ...prev, [k]: v }));

  const handleBlur = () => {
    onSave(serializeCardioData(vals));
  };

  const hasData = Object.values(vals).some(v => v !== "");

  return (
    <div className="cardio-form" onClick={e => e.stopPropagation()}>
      <div className="cardio-metrics">
        <div className="cardio-field">
          <label>Duración</label>
          <input type="text" placeholder="ej: 35:22" value={vals.duration}
            onChange={e => set("duration", e.target.value)} onBlur={handleBlur} />
        </div>
        <div className="cardio-field">
          <label>Distancia (km)</label>
          <input type="text" placeholder="ej: 5.2" value={vals.distance}
            onChange={e => set("distance", e.target.value)} onBlur={handleBlur} />
        </div>
        <div className="cardio-field">
          <label>FC promedio (bpm)</label>
          <input type="number" placeholder="ej: 142" value={vals.hr_avg}
            onChange={e => set("hr_avg", e.target.value)} onBlur={handleBlur} />
        </div>
        <div className="cardio-field">
          <label>FC máx (bpm)</label>
          <input type="number" placeholder="ej: 168" value={vals.hr_max}
            onChange={e => set("hr_max", e.target.value)} onBlur={handleBlur} />
        </div>
        <div className="cardio-field">
          <label>Calorías</label>
          <input type="number" placeholder="ej: 310" value={vals.calories}
            onChange={e => set("calories", e.target.value)} onBlur={handleBlur} />
        </div>
        <div className="cardio-field">
          <label>Zona principal</label>
          <select value={vals.zone} onChange={e => { set("zone", e.target.value); }} onBlur={handleBlur}>
            <option value="">— elegir —</option>
            <option value="Zona 1">Zona 1 · recuperación</option>
            <option value="Zona 2">Zona 2 · aeróbico base</option>
            <option value="Zona 3">Zona 3 · umbral</option>
            <option value="Zona 4">Zona 4 · alta intensidad</option>
            <option value="HIIT">HIIT · sprints</option>
          </select>
        </div>
      </div>
      <textarea className="cardio-note"
        placeholder="Notas: tipo de actividad, sensaciones, clima…"
        value={vals.notes}
        onChange={e => set("notes", e.target.value)}
        onBlur={handleBlur}
        rows={2}
      />
      {hasData && (
        <div className="cardio-summary">
          {vals.duration  && <span className={`cardio-chip filled`}>⏱ {vals.duration}</span>}
          {vals.distance  && <span className={`cardio-chip filled`}>📍 {vals.distance} km</span>}
          {vals.hr_avg    && <span className={`cardio-chip filled`}>❤️ {vals.hr_avg} bpm</span>}
          {vals.calories  && <span className={`cardio-chip filled`}>🔥 {vals.calories} kcal</span>}
          {vals.zone      && <span className={`cardio-chip filled`}>{vals.zone}</span>}
        </div>
      )}
    </div>
  );
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
// ─── Creatine tracking: stored in localStorage keyed by "apex_creatine"
const loadCreatine = () => {
  try { return JSON.parse(localStorage.getItem("apex_creatine") || "{}"); } catch { return {}; }
};

// ─── Bilateral flag: stored in localStorage keyed by exercise name ("apex_bilateral")
// { "Lateral Raise": true, "Incline Curl": true, … }
const loadBilateral = () => {
  try { return JSON.parse(localStorage.getItem("apex_bilateral") || "{}"); } catch { return {}; }
};
const saveBilateral = (map) => localStorage.setItem("apex_bilateral", JSON.stringify(map));

export default function Apex({ user, onSignOut }) {
  const [screen, setScreen]       = useState("tracker");
  const [activeDay, setActiveDay] = useState(DAY_ORDER[TODAY_IDX]);
  const [editId, setEditId]       = useState(null);
  const [editVals, setEditVals]   = useState({});
  const [showAdd, setShowAdd]     = useState(false);
  const [newEx, setNewEx]         = useState({ name: "", muscle: "", weight: "", reps: "", activity: "" });
  const [newExType, setNewExType]  = useState("resistance"); // "resistance" | "cardio"
  const [chartEx, setChartEx]     = useState("Squat");
  const [toast, setToast]         = useState(null);
  const [protocolOpen, setProtocolOpen] = useState(true);
  const [progressTab, setProgressTab]   = useState("calendar");
  // creatine: { "2026-06-03": true, … }
  const [creatine, setCreatine]     = useState(loadCreatine);
  // bilateral: { "Lateral Raise": true, … } — stored in localStorage, keyed by exercise name
  const [bilateralMap, setBilateralMap] = useState(loadBilateral);

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
          const weekData = await createFullWeek(user.id, 1, "A", buildFullTemplate("A"));
          data = { currentWeekNum: 1, schedule: "A", weeks: { 1: weekData } };
        }

        // ── Repair: resistance days with no exercises in DB get fake local IDs
        // which break toggle/saveEdit.  Insert real rows so every exercise
        // has a genuine Supabase UUID before we set state.
        for (const [, wk] of Object.entries(data.weeks)) {
          const sched = wk.schedule || data.schedule || "A";
          const pool  = sched === "A" ? EXERCISES_A : EXERCISES_B;
          for (const dayKey of RESISTANCE_DAYS) {
            const day = wk.days?.[dayKey];
            if (!day?._dayId) continue;           // day not in DB yet
            if (day.exercises?.length > 0) continue; // already has real rows

            const exTemplates = pool[dayKey] || [];
            const inserted = [];
            for (let i = 0; i < exTemplates.length; i++) {
              try {
                const ex = await insertExercise(day._dayId, exTemplates[i], i);
                inserted.push({
                  id:       ex.id,
                  name:     ex.name,
                  muscle:   ex.muscle   || exTemplates[i].muscle,
                  weight:   ex.weight   || "",
                  reps:     ex.reps     || "",
                  activity: ex.activity || "",
                  done:     false,
                  position: i,
                });
              } catch (e) {
                console.warn("repair insert failed:", dayKey, exTemplates[i].name, e);
              }
            }
            if (inserted.length) day.exercises = inserted;
          }
        }

        setCurrentWeekNum(data.currentWeekNum);
        setSchedule(data.schedule);
        setWeeks(() => {
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

  // ─── Ensure an exercise has a real Supabase UUID before DB operations.
  // If the id looks like a local placeholder (e.g. "lun_0_local"), insert the
  // exercise right now to get a real row, update local state, and return the
  // real id.  Completely transparent to the user.
  const ensureRealId = async (ex, dayKey = activeDay, weekNum = currentWeekNum) => {
    if (!String(ex.id).includes("_local") && !String(ex.id).startsWith("temp_")) {
      return ex.id; // already a real UUID
    }
    const day = weeks[weekNum]?.days?.[dayKey];
    if (!day?._dayId) throw new Error("day not in DB");
    const position = (day.exercises || []).findIndex(e => e.id === ex.id);
    const saved = await insertExercise(day._dayId, ex, position >= 0 ? position : 0);
    // Replace the local id with the real one in state
    updateLocal(w => {
      const exs = w[weekNum]?.days?.[dayKey]?.exercises;
      const found = exs?.find(e => e.id === ex.id);
      if (found) found.id = saved.id;
    });
    return saved.id;
  };

  // ─── Toggle exercise done
  const toggle = async (id) => {
    const ex = exercises.find(e => e.id === id);
    if (!ex) return;
    const newDone = !ex.done;
    updateLocal(w => {
      const e = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(x => x.id === id);
      if (e) e.done = newDone;
    });
    try {
      const realId = await ensureRealId(ex);
      await toggleExercise(realId, newDone);
    } catch {
      updateLocal(w => {
        const e = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(x => x.id === id);
        if (e) e.done = !newDone;
      });
      showToast("Error al guardar");
    }
  };

  // ─── Save edit (weight/reps/bilateral)
  const saveEdit = async (id) => {
    // Persist bilateral flag in localStorage by exercise name
    const ex = exercises.find(e => e.id === id);
    if (ex && editVals.bilateral !== undefined) {
      setBilateralMap(prev => {
        const next = { ...prev, [ex.name]: !!editVals.bilateral };
        saveBilateral(next);
        return next;
      });
    }
    // Only send weight & reps to DB (bilateral lives in localStorage)
    const dbFields = {};
    if (editVals.weight !== undefined) dbFields.weight = editVals.weight;
    if (editVals.reps   !== undefined) dbFields.reps   = editVals.reps;
    updateLocal(w => {
      const ex = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(e => e.id === id);
      if (ex) Object.assign(ex, dbFields);
    });
    setEditId(null);
    if (Object.keys(dbFields).length) {
      try {
        const realId = await ensureRealId(ex);
        await updateExercise(realId, dbFields);
      } catch { showToast("Error al guardar"); }
    }
  };

  // ─── Delete exercise
  const delEx = async (id) => {
    const ex = exercises.find(e => e.id === id);
    updateLocal(w => {
      const day = w[currentWeekNum]?.days?.[activeDay];
      if (day) day.exercises = day.exercises.filter(e => e.id !== id);
    });
    setEditId(null);
    // Skip DB delete for local-only placeholder IDs (nothing to delete)
    if (String(id).includes("_local") || String(id).startsWith("temp_")) return;
    try { await deleteExercise(id); }
    catch { showToast("Error al eliminar"); }
  };

  // ─── Save activity (cardio notes)
  const saveActivity = async (id, val) => {
    const ex = exercises.find(e => e.id === id);
    updateLocal(w => {
      const e = w[currentWeekNum]?.days?.[activeDay]?.exercises?.find(e => e.id === id);
      if (e) e.activity = val;
    });
    try {
      const realId = ex ? await ensureRealId(ex) : id;
      await updateExercise(realId, { activity: val });
    } catch { showToast("Error al guardar actividad"); }
  };

  // ─── Add new exercise
  const addEx = async () => {
    if (!newEx.name.trim()) return;
    const day = weekData?.days?.[activeDay];
    if (!day?._dayId) return;
    const position = exercises.length;
    const tempId = `temp_${Date.now()}`;
    updateLocal(w => {
      w[currentWeekNum]?.days?.[activeDay]?.exercises?.push({ id: tempId, ...newEx, done: false, position });
    });
    setNewEx({ name: "", muscle: "", weight: "", reps: "", activity: "" });
    setShowAdd(false);
    try {
      const saved = await insertExercise(day._dayId, newEx, position);
      updateLocal(w => {
        const exs = w[currentWeekNum]?.days?.[activeDay]?.exercises;
        const i = exs?.findIndex(e => e.id === tempId);
        if (i !== undefined && i >= 0) exs[i].id = saved.id;
      });
    } catch {
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
    catch { showToast("Error al reiniciar día"); }
  };

  // ─── New week
  const newWeek = async () => {
    const next = currentWeekNum + 1;
    setLoading(true);
    try {
      const prevWeights = buildPrevWeights(weekData);
      const template = buildFullTemplate(schedule, prevWeights);
      const wd = await createFullWeek(user.id, next, schedule, template);
      setWeeks(prev => ({ ...prev, [next]: mergeWithTemplate(wd) }));
      setCurrentWeekNum(next);
      setActiveDay(DAY_ORDER[0]);
      showToast(`Semana ${next} creada con pesos heredados ✓`, "info");
    } catch (err) {
      showToast("Error al crear semana: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Toggle schedule A/B (with advisory)
  const toggleSchedule = async () => {
    const newSched = schedule === "A" ? "B" : "A";
    const label = newSched === "A" ? "A · Fuerza (4–8 reps)" : "B · Hipertrofia (8–15 reps)";
    setSchedule(newSched);
    showToast(`Horario ${label} — aplica a toda la semana`, "info");
    const wk = weekData;
    if (wk?._weekId) {
      try {
        await updateWeekSchedule(wk._weekId, newSched);
        updateLocal(w => { if (w[currentWeekNum]) w[currentWeekNum].schedule = newSched; });
      } catch { showToast("Error al cambiar horario"); }
    }
  };

  // ─── Navigate weeks
  const navWeek = async (dir) => {
    const next = currentWeekNum + dir;
    if (next < 1) return;
    if (!weeks[next] && dir > 0) {
      setLoading(true);
      try {
        const prevWk = weeks[currentWeekNum];
        const prevWeights = buildPrevWeights(prevWk);
        const template = buildFullTemplate(schedule, prevWeights);
        const wd = await createFullWeek(user.id, next, schedule, template);
        setWeeks(prev => ({ ...prev, [next]: mergeWithTemplate(wd) }));
        setCurrentWeekNum(next);
      } catch {
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

  // ─── Creatine helpers
  // Get today's local date key "YYYY-MM-DD"
  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  // Get the date key for a day in the current week (relative to today)
  const getDayKey = (dayIdx) => {
    const todayLocal = new Date();
    const todayDayIdx = todayLocal.getDay() === 0 ? 6 : todayLocal.getDay() - 1;
    const diff = dayIdx - todayDayIdx;
    const d = new Date(todayLocal);
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const toggleCreatine = (dayIdx) => {
    const key = getDayKey(dayIdx);
    setCreatine(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("apex_creatine", JSON.stringify(next));
      return next;
    });
  };
  // Get the reps for an exercise using the current schedule template
  const getTemplateReps = (dayKey, exName) => {
    if (!RESISTANCE_DAYS.includes(dayKey)) return null;
    const pool = (weekData?.schedule || schedule) === "A" ? EXERCISES_A : EXERCISES_B;
    const tmpl = (pool[dayKey] || []).find(e => e.name === exName);
    return tmpl?.reps || null;
  };

  // ─── Volumen total levantado (VTL = kg × sets × reps) ───────────────────────────
  // Parses "4×6" or "3x12" from reps string
  const parseRepsString = (str) => {
    if (!str) return null;
    const m = str.match(/(\d+)[\u00d7xX](\d+)/);
    if (!m) return null;
    return { sets: parseInt(m[1]), reps: parseInt(m[2]) };
  };

  const calcDayVolume = (dayKey) => {
    const exs = weekData?.days?.[dayKey]?.exercises || [];
    return exs.reduce((sum, ex) => {
      const w = parseFloat(ex.weight);
      if (!w || isNaN(w) || ex.weight === '—') return sum;
      // Prefer user-saved reps over template (they may have customized due to failure)
      const tmplReps = getTemplateReps(dayKey, ex.name);
      const repsStr = ex.reps || tmplReps || '';
      const parsed = parseRepsString(repsStr);
      if (!parsed) return sum;
      // Bilateral dumbbell exercises: multiply by 2 for accurate total mechanical work
      const mult = bilateralMap[ex.name] ? 2 : 1;
      return sum + w * parsed.sets * parsed.reps * mult;
    }, 0);
  };

  const weeklyVolume = RESISTANCE_DAYS.reduce((acc, d) => acc + calcDayVolume(d), 0);
  const fmtVolume = (kg) => {
    if (kg === 0) return '0';
    if (kg >= 1000) return `${(kg / 1000).toFixed(1).replace('.', ',')} t`;
    return `${Math.round(kg).toLocaleString('es-ES')} kg`;
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
      --proto-bg: #1A1917;
      --proto-text: #F0EDE8;
      --proto-muted: rgba(240,237,232,0.55);
      --proto-border: rgba(240,237,232,0.12);
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
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 16px; background: var(--bg); font-family: 'DM Sans', sans-serif;
    }
    .loading-logo { font-size: 32px; font-weight: 300; letter-spacing: -1px; color: var(--text); }
    .loading-dot { display: flex; gap: 6px; }
    .loading-dot span {
      width: 5px; height: 5px; border-radius: 50%; background: var(--muted);
      animation: pulse 1s infinite;
    }
    .loading-dot span:nth-child(2) { animation-delay: 0.15s; }
    .loading-dot span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes pulse { 0%,80%,100% { opacity: 0.2; } 40% { opacity: 1; } }

    /* ── TOAST ── */
    .toast {
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
      background: var(--text); color: var(--bg);
      font-size: 12px; font-family: 'DM Mono', monospace;
      padding: 10px 20px; border-radius: 20px;
      z-index: 999; animation: fadeIn 0.2s ease; white-space: nowrap; max-width: 90vw;
      text-align: center; word-break: break-word; white-space: normal;
    }
    .toast.info { background: #27AE60; }
    @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

    /* ── TOP BAR ── */
    .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 0; }
    .top-logo { font-size: 22px; font-weight: 300; letter-spacing: -1px; color: var(--text); }
    .top-right { display: flex; align-items: center; gap: 10px; }
    .top-name { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; }
    .top-switch {
      font-size: 11px; color: var(--muted); background: var(--pill);
      border: none; border-radius: 20px; padding: 5px 10px;
      cursor: pointer; font-family: 'DM Sans', sans-serif;
    }

    /* ── DAY STRIP ── */
    .day-strip { display: flex; gap: 6px; padding: 18px 20px 0; overflow-x: auto; scrollbar-width: none; }
    .day-strip::-webkit-scrollbar { display: none; }
    .day-btn {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 8px 0 6px; width: 44px; border-radius: 22px;
      border: 1px solid transparent; background: transparent;
      cursor: pointer; flex-shrink: 0; transition: all 0.15s; position: relative;
    }
    .day-btn.active { background: var(--text); border-color: var(--text); }
    .day-lbl { font-size: 11px; font-weight: 500; color: var(--muted); letter-spacing: 0.5px; font-family: 'DM Mono', monospace; }
    .day-btn.active .day-lbl { color: #F0EDE8; }
    .day-pip { width: 4px; height: 4px; border-radius: 50%; background: var(--border); }
    .day-pip.full { background: var(--text); }
    .day-btn.active .day-pip { background: rgba(240,237,232,0.4); }
    .day-btn.active .day-pip.full { background: #F0EDE8; }
    .day-pip.partial { background: var(--muted); opacity: 0.4; }
    /* creatine mini checkbox */
    .day-creatine {
      width: 14px; height: 14px; border-radius: 4px;
      border: 1.5px solid var(--border); background: transparent;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    .day-creatine.checked { background: #4CAF50; border-color: #4CAF50; }
    .day-btn.active .day-creatine { border-color: rgba(240,237,232,0.35); }
    .day-btn.active .day-creatine.checked { background: #4CAF50; border-color: #4CAF50; }
    .day-creatine-mark { font-size: 8px; color: white; line-height: 1; }
    .day-date-num { font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace; line-height: 1; }
    .day-btn.active .day-date-num { color: rgba(240,237,232,0.6); }
    .day-btn.today-btn .day-lbl { color: var(--text); }
    .day-btn.today-btn:not(.active) .day-lbl { text-decoration: underline; text-underline-offset: 2px; }

    /* ── TRACKER BODY ── */
    .body { padding: 24px 20px 100px; }

    .day-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .day-title { font-size: 28px; font-weight: 300; letter-spacing: -0.5px; color: var(--text); }
    .day-meta  { font-size: 12px; color: var(--muted); margin-top: 3px; }
    .progress-ring { flex-shrink: 0; }

    /* ── SCHEDULE ROW ── */
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

    /* ── PROTOCOL CARD ── */
    .protocol-card {
      background: var(--proto-bg); border-radius: 16px;
      padding: 16px 18px; margin-bottom: 20px; overflow: hidden;
    }
    .proto-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;
    }
    .proto-label {
      font-size: 9px; font-family: 'DM Mono', monospace;
      color: var(--proto-muted); letter-spacing: 1px; text-transform: uppercase;
    }
    .proto-toggle-btn {
      background: none; border: none; cursor: pointer; padding: 0;
      font-size: 12px; color: var(--proto-muted); line-height: 1;
    }
    .proto-body { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
    .proto-sets-row {
      display: flex; gap: 8px;
    }
    .proto-badge {
      background: rgba(240,237,232,0.1); border: 1px solid var(--proto-border);
      border-radius: 8px; padding: 8px 12px; flex: 1;
    }
    .proto-badge-val {
      font-size: 13px; font-weight: 500; color: var(--proto-text); line-height: 1.2;
      font-family: 'DM Mono', monospace;
    }
    .proto-badge-lbl {
      font-size: 9px; color: var(--proto-muted); margin-top: 3px; font-family: 'DM Mono', monospace;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .proto-divider {
      height: 1px; background: var(--proto-border); margin: 2px 0;
    }
    .proto-tip {
      font-size: 11px; color: var(--proto-muted); line-height: 1.6;
      font-family: 'DM Sans', sans-serif;
    }
    .proto-tip strong { color: rgba(240,237,232,0.8); font-weight: 500; }
    .proto-collapsed { margin-top: 8px; }
    .proto-collapsed-text {
      font-size: 11px; font-family: 'DM Mono', monospace; color: var(--proto-muted);
    }

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

    .ex-chips { display: flex; gap: 6px; margin-top: 10px; align-items: center; }
    .chip {
      font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted);
      background: var(--pill); border-radius: 6px; padding: 4px 8px; cursor: pointer;
    }
    .chip.editing { background: var(--text); color: var(--bg); }
    /* chip with user-overridden value */
    .chip-custom { border: 1px solid var(--text); }

    /* Weight input with fixed "kg" */
    .weight-chip-edit {
      display: flex; align-items: center; gap: 4px;
      background: var(--text); border-radius: 6px; padding: 4px 8px;
    }
    .weight-chip-edit input {
      background: transparent; border: none; outline: none; color: var(--bg);
      font-family: 'DM Mono', monospace; font-size: 11px; width: 50px;
      -moz-appearance: textfield;
    }
    .weight-chip-edit input::-webkit-outer-spin-button,
    .weight-chip-edit input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .weight-kg-label { font-size: 11px; font-family: 'DM Mono', monospace; color: rgba(240,237,232,0.55); }

    .reps-chip-edit {
      background: var(--text); border-radius: 6px; padding: 4px 8px;
    }
    .reps-chip-edit input {
      background: transparent; border: none; outline: none; color: var(--bg);
      font-family: 'DM Mono', monospace; font-size: 11px; width: 70px;
    }

    .activity-input {
      margin-top: 10px; width: 100%; background: var(--pill);
      border: none; border-radius: 8px; padding: 9px 12px; font-size: 12px;
      color: var(--text); font-family: 'DM Sans', sans-serif; outline: none;
    }
    .activity-input::placeholder { color: var(--muted); }

    /* ── CARDIO DATA FORM ── */
    .cardio-form {
      margin-top: 10px; background: var(--pill);
      border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;
    }
    .cardio-metrics {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    }
    .cardio-field {
      display: flex; flex-direction: column; gap: 3px;
    }
    .cardio-field label {
      font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .cardio-field input, .cardio-field select {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 7px 10px; font-size: 12px;
      color: var(--text); font-family: 'DM Mono', monospace; outline: none;
      width: 100%; transition: border-color 0.15s;
    }
    .cardio-field input:focus, .cardio-field select:focus { border-color: var(--text); }
    .cardio-field input::placeholder { color: var(--muted); }
    .cardio-note {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px 10px; font-size: 12px;
      color: var(--text); font-family: 'DM Sans', sans-serif; outline: none;
      width: 100%; resize: none; min-height: 48px; transition: border-color 0.15s;
    }
    .cardio-note:focus { border-color: var(--text); }
    .cardio-note::placeholder { color: var(--muted); }
    .cardio-summary {
      margin-top: 8px; padding: 8px 10px;
      background: var(--pill); border-radius: 8px;
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .cardio-chip {
      font-size: 10px; font-family: 'DM Mono', monospace; color: var(--muted);
      background: var(--surface); border-radius: 6px; padding: 3px 8px;
      border: 1px solid var(--border);
    }
    .cardio-chip.filled { color: var(--text); border-color: var(--text); }

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
    .add-type-row { display: flex; gap: 6px; margin-bottom: 10px; }
    .add-type-btn {
      flex: 1; font-size: 12px; font-family: 'DM Sans', sans-serif; color: var(--muted);
      background: var(--pill); border: 1px solid var(--border); border-radius: 10px;
      padding: 8px 0; cursor: pointer; transition: all 0.15s; font-weight: 400;
    }
    .add-type-btn.active { background: var(--text); color: var(--bg); border-color: var(--text); }

    /* ── HINT CHIP (reminder-only exercises: ducha fría, movilidad, etc.) ── */
    .hint-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--pill); border: 1px solid var(--border);
      border-radius: 8px; padding: 5px 10px; margin-top: 6px;
      cursor: pointer; transition: background 0.15s;
    }
    .hint-chip:active { background: var(--border); }
    .hint-chip-icon { font-size: 11px; opacity: 0.7; }
    .hint-chip-text { font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 0.2px; }

    /* ── WEEK VIEW ── */
    .week-body { padding: 24px 20px 100px; }
    .section-title { font-size: 22px; font-weight: 300; letter-spacing: -0.5px; margin-bottom: 20px; color: var(--text); }

    .stats-row { display: flex; gap: 10px; margin-bottom: 12px; }
    .stat-card {
      flex: 1; background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; padding: 16px 14px; text-align: center;
    }
    .stat-num { font-size: 32px; font-weight: 300; letter-spacing: -1px; color: var(--text); line-height: 1; }
    .stat-lbl { font-size: 10px; color: var(--muted); margin-top: 4px; font-family: 'DM Mono', monospace; }

    /* VTL card */
    .vtl-card {
      background: var(--text); border-radius: 14px; padding: 18px 20px;
      margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;
    }
    .vtl-left {}
    .vtl-label { font-size: 9px; font-family: 'DM Mono', monospace; color: rgba(240,237,232,0.5);
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .vtl-value { font-size: 36px; font-weight: 300; letter-spacing: -1.5px; color: #F0EDE8; line-height: 1; }
    .vtl-sub { font-size: 10px; color: rgba(240,237,232,0.45); font-family: 'DM Mono', monospace; margin-top: 4px; }
    .vtl-breakdown { display: flex; flex-direction: column; gap: 5px; align-items: flex-end; }
    .vtl-day-row { display: flex; gap: 8px; align-items: center; }
    .vtl-day-name { font-size: 9px; color: rgba(240,237,232,0.4); font-family: 'DM Mono', monospace;
      text-transform: uppercase; width: 26px; text-align: right; }
    .vtl-day-bar-bg { width: 60px; height: 3px; background: rgba(240,237,232,0.12); border-radius: 2px; }
    .vtl-day-bar-fill { height: 100%; background: rgba(240,237,232,0.55); border-radius: 2px; transition: width 0.4s; }
    .vtl-day-kg { font-size: 9px; color: rgba(240,237,232,0.55); font-family: 'DM Mono', monospace; width: 40px; }

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
    .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; }
    .nav-icon { font-size: 18px; }
    .nav-lbl { font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace; letter-spacing: 0.5px; transition: color 0.15s; }
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

    /* ── PROGRESS TABS ── */
    .prog-tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
    .prog-tab {
      flex: 1; font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted);
      background: transparent; border: none; border-bottom: 2px solid transparent;
      padding: 10px 0; cursor: pointer; transition: all 0.15s; margin-bottom: -1px;
    }
    .prog-tab.active { color: var(--text); border-bottom-color: var(--text); }

    /* ── CALENDAR ── */
    .cal-summary { display: flex; gap: 10px; margin-bottom: 16px; }
    .cal-sum-card { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 10px; text-align: center; }
    .cal-sum-val { font-size: 26px; font-weight: 300; letter-spacing: -1px; color: var(--text); line-height: 1; }
    .cal-sum-lbl { font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace; margin-top: 4px; }
    .cal-legend { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
    .cal-legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; }
    .cal-legend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .cal-month { margin-bottom: 20px; }
    .cal-month-hdr { font-size: 12px; font-weight: 500; color: var(--text); margin-bottom: 8px; text-transform: capitalize; letter-spacing: 0.2px; }
    .cal-dow-row { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
    .cal-dow { font-size: 8px; color: var(--muted); font-family: 'DM Mono', monospace; text-align: center; }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal-cell { aspect-ratio: 1; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: var(--pill); }
    .cal-empty { background: transparent; }
    .cal-future { opacity: 0.35; }
    .cal-today { outline: 1.5px solid var(--text); outline-offset: 1px; }
    .cal-num { font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace; line-height: 1; }
    .cal-dot { width: 5px; height: 5px; border-radius: 50%; }
    .cal-dot-full { background: #1A1917; }
    .cal-dot-partial { background: #9E9A94; }
    .cal-dot-planned { background: var(--border); }

    /* ── CATEGORIES ── */
    .cat-list { display: flex; flex-direction: column; gap: 12px; }
    .cat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
    .cat-hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .cat-emoji { font-size: 22px; line-height: 1; }
    .cat-name { font-size: 16px; font-weight: 500; color: var(--text); }
    .cat-desc { font-size: 10px; color: var(--muted); font-family: 'DM Mono', monospace; margin-top: 2px; }
    .cat-stats { display: flex; padding: 12px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); margin-bottom: 14px; }
    .cat-stat { flex: 1; text-align: center; border-right: 1px solid var(--border); }
    .cat-stat:last-child { border-right: none; }
    .cat-val { font-size: 22px; font-weight: 300; letter-spacing: -0.5px; color: var(--text); line-height: 1; }
    .cat-val-sm { font-size: 16px; }
    .cat-lbl { font-size: 9px; color: var(--muted); font-family: 'DM Mono', monospace; margin-top: 3px; }
    .cat-bars { display: flex; gap: 3px; align-items: flex-end; height: 44px; }
    .cat-bar-col { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; height: 100%; }
    .cat-bar-bg { flex: 1; width: 100%; background: var(--pill); border-radius: 3px; overflow: hidden; display: flex; align-items: flex-end; }
    .cat-bar-fill { width: 100%; border-radius: 3px; transition: height 0.4s; min-height: 2px; }
    .cat-bar-lbl { font-size: 7px; color: var(--muted); font-family: 'DM Mono', monospace; }
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

  // ─── PROTOCOL CARD COMPONENT ──────────────────────────────────────────────
  const renderProtocolCard = () => {
    const proto = DAY_PROTOCOL[activeDay];
    if (!proto) return null;
    const isResistance = RESISTANCE_DAYS.includes(activeDay);
    const sched = weekData?.schedule || schedule;
    const schedNote = isResistance && proto.scheduleNote ? proto.scheduleNote(sched) : null;

    if (!protocolOpen) {
      return (
        <div className="protocol-card">
          <div className="proto-header">
            <span className="proto-label">Protocolo Huberman</span>
            <button className="proto-toggle-btn" onClick={() => setProtocolOpen(true)}>+</button>
          </div>
          <div className="proto-collapsed">
            <span className="proto-collapsed-text">
              {schedNote ? `${schedNote.sets} · ${schedNote.rest}` : proto.tip1?.slice(0, 50) + "…"}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="protocol-card">
        <div className="proto-header">
          <span className="proto-label">Protocolo Huberman</span>
          <button className="proto-toggle-btn" onClick={() => setProtocolOpen(false)}>−</button>
        </div>
        <div className="proto-body">
          {schedNote && (
            <div className="proto-sets-row">
              <div className="proto-badge">
                <div className="proto-badge-val">{schedNote.sets}</div>
                <div className="proto-badge-lbl">Horario {sched}</div>
              </div>
              <div className="proto-badge">
                <div className="proto-badge-val">{schedNote.rest}</div>
                <div className="proto-badge-lbl">Descanso</div>
              </div>
            </div>
          )}
          <div className="proto-divider" />
          {proto.tip1 && (
            <p className="proto-tip">
              <strong>↑</strong> {proto.tip1}
            </p>
          )}
          {proto.tip2 && (
            <p className="proto-tip">
              <strong>↑</strong> {proto.tip2}
            </p>
          )}
          {proto.breath && (
            <p className="proto-tip">
              <strong>Respiración —</strong> {proto.breath}
            </p>
          )}
          {proto.warmup && (
            <p className="proto-tip">
              <strong>Calentamiento —</strong> {proto.warmup}
            </p>
          )}
        </div>
      </div>
    );
  };

  // ─── RENDER EXERCISE ROW ──────────────────────────────────────────────────
  const renderExRow = (ex) => {
    const isEditing = editId === ex.id;
    const isCardioDay = dayData?.isCardio;
    const isFixedWeight = ex.weight === "—"; // abs exercises with fixed weight marker
    // Look up hint from template (not stored in DB) — recovery day reminders
    const templateHint = BASE_DAYS[activeDay]?.exercises?.find(t => t.name === ex.name)?.hint;
    const isHint = !!templateHint;

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

          {isHint ? (
            // Reminder-only chip: tap the row to tick, no editable form
            <div className="hint-chip" onClick={() => toggle(ex.id)}>
              <span className="hint-chip-icon">⏱</span>
              <span className="hint-chip-text">{templateHint}</span>
            </div>
          ) : isCardioDay ? (
            <CardioDataForm
              ex={ex}
              onSave={(data) => saveActivity(ex.id, data)}
            />
          ) : isEditing ? (
            <>
              <div className="ex-chips">
                {/* Weight input: number only, "kg" fixed — unless it's a bodyweight/marker exercise */}
                {isFixedWeight ? (
                  <div className="chip editing" style={{ opacity: 0.5, cursor: "default" }}>— kg</div>
                ) : (
                  <div className="weight-chip-edit">
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="0.5"
                      value={editVals.weight ?? ex.weight}
                      onChange={e => setEditVals(v => ({ ...v, weight: e.target.value }))}
                      placeholder="0"
                    />
                    <span className="weight-kg-label">kg</span>
                  </div>
                )}
                {/* Reps input: editable text — pre-fill with saved value, hint shows template */}
                <div className="reps-chip-edit">
                  <input
                    type="text"
                    value={editVals.reps ?? ex.reps}
                    onChange={e => setEditVals(v => ({ ...v, reps: e.target.value }))}
                    placeholder={getTemplateReps(activeDay, ex.name) || "sets×reps"}
                  />
                </div>
              </div>
              {/* Bilateral toggle for dumbbell exercises */}
              {!isCardioDay && !isFixedWeight && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    className={`chip ${(editVals.bilateral ?? bilateralMap[ex.name]) ? 'editing' : ''}`}
                    style={{ cursor: 'pointer', fontSize: 10 }}
                    onClick={e => { e.stopPropagation(); setEditVals(v => ({ ...v, bilateral: !(v.bilateral ?? bilateralMap[ex.name]) })); }}
                  >
                    {(editVals.bilateral ?? bilateralMap[ex.name]) ? '×2 bilateral ✓' : '×2 bilateral (mancuernas)'}
                  </button>
                  <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'DM Mono' }}>para VTL correcto</span>
                </div>
              )}
              <div className="edit-actions">
                <button className="save-btn"   onClick={() => saveEdit(ex.id)}>Guardar</button>
                <button className="cancel-btn" onClick={() => setEditId(null)}>Cancelar</button>
                <button className="del-btn"    onClick={() => delEx(ex.id)}>Eliminar</button>
              </div>
            </>
          ) : (
            <div className="ex-chips"
              onClick={() => { setEditId(ex.id); setEditVals({ weight: ex.weight, reps: ex.reps, bilateral: bilateralMap[ex.name] ?? false }); }}>
              <div className="chip">
                {isFixedWeight ? "— kg" : (ex.weight ? `${ex.weight} kg` : "— kg")}
                {bilateralMap[ex.name] && <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.65 }}>×2</span>}
              </div>
              {(() => {
                const tmplReps = getTemplateReps(activeDay, ex.name);
                const savedReps = ex.reps;
                // If user has saved a custom value that differs from template, show it with marker
                const isCustom = savedReps && tmplReps && savedReps !== tmplReps;
                const display = savedReps || tmplReps || "—";
                return (
                  <div className={`chip ${isCustom ? 'chip-custom' : ''}`}>
                    {display}
                    {isCustom && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.6 }}>✎</span>}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── RENDER TRACKER ───────────────────────────────────────────────────────
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
          {DAY_ORDER.map((d, idx) => {
            const p = getProgress(d);
            const dayKey = getDayKey(idx);
            const creatineTaken = !!creatine[dayKey];
            const isToday = idx === TODAY_IDX;
            // Get day-of-month number from the dayKey (YYYY-MM-DD)
            const dayNum = parseInt(dayKey.split('-')[2], 10);
            return (
              <button key={d}
                className={`day-btn ${activeDay === d ? "active" : ""} ${isToday ? "today-btn" : ""}`}
                onClick={() => { setActiveDay(d); setEditId(null); setShowAdd(false); }}>
                <span className="day-lbl">{d.toUpperCase()}</span>
                <span className="day-date-num">{dayNum}</span>
                <div className={`day-pip ${p === 100 ? "full" : p > 0 ? "partial" : ""}`} />
                <div
                  className={`day-creatine ${creatineTaken ? "checked" : ""}`}
                  title={creatineTaken ? "Creatina ✓" : "Marcar creatina"}
                  onClick={e => { e.stopPropagation(); toggleCreatine(idx); }}
                >
                  {creatineTaken && <span className="day-creatine-mark">✓</span>}
                </div>
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
                {(() => {
                  const activeDayIdx = DAY_ORDER.indexOf(activeDay);
                  const dk = getDayKey(activeDayIdx);
                  const [y, m, d] = dk.split('-');
                  const dateObj = new Date(Number(y), Number(m)-1, Number(d));
                  const label = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                  return <span style={{ opacity: 0.55, marginLeft: 4 }}>· {label}</span>;
                })()}
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

          {/* Schedule A/B — informative with week-wide advisory */}
          <div className="schedule-row">
            <button className={`sched-pill ${schedule === "A" ? "active" : ""}`} onClick={toggleSchedule}>
              A · fuerza
            </button>
            <button className={`sched-pill ${schedule === "B" ? "active" : ""}`} onClick={toggleSchedule}>
              B · hipertrofia
            </button>
            {dayData?.warmup && <span className="warmup-tag">calentamiento 10 min</span>}
          </div>

          {/* Protocol context card */}
          {renderProtocolCard()}

          <div className="action-row">
            <button className="ghost-btn" onClick={() => {
              setNewExType(dayData?.isCardio ? "cardio" : "resistance");
              setShowAdd(s => !s);
            }}>+ agregar</button>
            <button className="ghost-btn" onClick={resetDay}>reiniciar día</button>
          </div>

          {showAdd && (
            <div className="add-panel">
              <div className="add-title">Nuevo ejercicio</div>

              {/* Type toggle */}
              <div className="add-type-row">
                <button
                  className={`add-type-btn ${newExType === 'resistance' ? 'active' : ''}`}
                  onClick={() => { setNewExType('resistance'); setNewEx(v => ({ ...v, activity: '' })); }}
                >🏋️ Fuerza</button>
                <button
                  className={`add-type-btn ${newExType === 'cardio' ? 'active' : ''}`}
                  onClick={() => { setNewExType('cardio'); setNewEx(v => ({ ...v, weight: '', reps: '' })); }}
                >🏃 Cardio</button>
              </div>

              <input className="add-input" placeholder="Nombre (ej: Trote, HIIT, Squat…)" value={newEx.name}
                onChange={e => setNewEx(v => ({ ...v, name: e.target.value }))} />
              <input className="add-input" placeholder="Músculo / grupo (ej: Cardio · Zona 2)"
                value={newEx.muscle} onChange={e => setNewEx(v => ({ ...v, muscle: e.target.value }))} />

              {newExType === 'cardio' ? (
                <CardioDataForm
                  ex={{ activity: newEx.activity }}
                  onSave={(data) => setNewEx(v => ({ ...v, activity: data }))}
                />
              ) : (
                <div className="add-row">
                  <input className="add-input" placeholder="Peso (kg)" type="number" min="0" step="0.5"
                    value={newEx.weight} onChange={e => setNewEx(v => ({ ...v, weight: e.target.value }))} />
                  <input className="add-input" placeholder="Series×Reps (ej: 3×12)"
                    value={newEx.reps} onChange={e => setNewEx(v => ({ ...v, reps: e.target.value }))} />
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

  // ─── RENDER WEEK ──────────────────────────────────────────────────────────
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

        {/* ── VTL CARD ── */}
        {(() => {
          const dayVols = RESISTANCE_DAYS.map(d => ({ d, vol: calcDayVolume(d) }));
          const maxVol = Math.max(...dayVols.map(x => x.vol), 1);
          const labels = { lun: 'Lun', mie: 'Mié', sab: 'Sáb' };
          return (
            <div className="vtl-card">
              <div className="vtl-left">
                <div className="vtl-label">Volumen semanal</div>
                <div className="vtl-value">{fmtVolume(weeklyVolume)}</div>
                <div className="vtl-sub">
                  {weeklyVolume === 0 ? 'agrega pesos para calcular' : 'kg totales levantados · fuerza'}
                </div>
              </div>
              <div className="vtl-breakdown">
                {dayVols.map(({ d, vol }) => (
                  <div key={d} className="vtl-day-row">
                    <span className="vtl-day-name">{labels[d]}</span>
                    <div className="vtl-day-bar-bg">
                      <div className="vtl-day-bar-fill"
                        style={{ width: maxVol > 0 ? `${(vol / maxVol) * 100}%` : '0%' }} />
                    </div>
                    <span className="vtl-day-kg">{vol > 0 ? fmtVolume(vol) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

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


  // ─── RENDER PROGRESS ──────────────────────────────────────────────────────
  const renderProgress = () => {
    // ── Calendar date helpers ─────────────────────────────────────────────────
    const getWeekMonday = (weekNum) => {
      const today = new Date();
      const d = today.getDay();
      const offset = d === 0 ? 6 : d - 1;
      const thisMon = new Date(today);
      thisMon.setDate(today.getDate() - offset);
      thisMon.setHours(0, 0, 0, 0);
      const wMon = new Date(thisMon);
      wMon.setDate(thisMon.getDate() - (currentWeekNum - weekNum) * 7);
      return wMon;
    };
    const dayDateOf = (weekNum, dayKey) => {
      const mon = getWeekMonday(weekNum);
      const d = new Date(mon);
      d.setDate(mon.getDate() + DAY_ORDER.indexOf(dayKey));
      return d;
    };
    const toDS = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const todayStr = toDS(new Date());

    // Build dateStatus map: dateStr → 'full' | 'partial' | 'planned' | 'rest'
    const dateStatusMap = {};
    Object.entries(weeks).forEach(([wn, wk]) => {
      DAY_ORDER.forEach(dayKey => {
        if (!wk.days?.[dayKey]) return;
        const date = dayDateOf(parseInt(wn), dayKey);
        const ds = toDS(date);
        const exs = wk.days[dayKey].exercises || [];
        if (exs.length === 0) { dateStatusMap[ds] = 'rest'; return; }
        const done = exs.filter(e => e.done).length;
        dateStatusMap[ds] = done === exs.length ? 'full' : done > 0 ? 'partial' : 'planned';
      });
    });

    // ── Calendar tab ─────────────────────────────────────────────────────
    const renderCalTab = () => {
      const week1Mon = getWeekMonday(1);
      const today = new Date();
      const months = [];
      const cur = new Date(week1Mon.getFullYear(), week1Mon.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      while (cur < end) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }

      const allStatuses = Object.values(dateStatusMap).filter(s => s !== 'rest');
      const fullDays  = allStatuses.filter(s => s === 'full').length;
      const partDays  = allStatuses.filter(s => s === 'partial').length;
      const rate      = allStatuses.length ? Math.round(fullDays / allStatuses.length * 100) : 0;

      return (
        <div>
          <div className="cal-summary">
            <div className="cal-sum-card">
              <div className="cal-sum-val">{fullDays}</div>
              <div className="cal-sum-lbl">completados</div>
            </div>
            <div className="cal-sum-card">
              <div className="cal-sum-val">{partDays}</div>
              <div className="cal-sum-lbl">parciales</div>
            </div>
            <div className="cal-sum-card">
              <div className="cal-sum-val">{rate}%</div>
              <div className="cal-sum-lbl">tasa éxito</div>
            </div>
          </div>

          <div className="cal-legend">
            <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:'#1A1917'}}/><span>Completo</span></div>
            <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:'#9E9A94'}}/><span>Parcial</span></div>
            <div className="cal-legend-item"><div className="cal-legend-dot" style={{background:'var(--border)'}}/><span>Sin realizar</span></div>
          </div>

          {months.map(month => {
            const y = month.getFullYear(), m = month.getMonth();
            const monthName = month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            const firstDow = new Date(y, m, 1).getDay();
            const startOff = firstDow === 0 ? 6 : firstDow - 1;
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const cells = [...Array(startOff).fill(null)];
            for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(y, m, day));
            return (
              <div key={`${y}-${m}`} className="cal-month">
                <div className="cal-month-hdr">{monthName}</div>
                <div className="cal-dow-row">
                  {['L','M','X','J','V','S','D'].map(lbl => <span key={lbl} className="cal-dow">{lbl}</span>)}
                </div>
                <div className="cal-grid">
                  {cells.map((date, i) => {
                    if (!date) return <div key={`e${i}`} className="cal-cell cal-empty" />;
                    const ds = toDS(date);
                    const status = dateStatusMap[ds];
                    const isToday = ds === todayStr;
                    const isFuture = date > new Date();
                    return (
                      <div key={ds} className={`cal-cell${isToday ? ' cal-today' : ''}${isFuture ? ' cal-future' : ''}`}>
                        <span className="cal-num">{date.getDate()}</span>
                        {status && status !== 'rest' && !isFuture &&
                          <div className={`cal-dot cal-dot-${status}`} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    // ── Categories tab ──────────────────────────────────────────────────
    const CATS = [
      { id: 'lower', label: 'Lower Body', emoji: '🦵', desc: 'Piernas · Cuádriceps · Isquiotibiales', days: ['lun'], isRes: true },
      { id: 'upper', label: 'Upper Body', emoji: '💪', desc: 'Torso · Pecho · Hombros · Espalda', days: ['mie'], isRes: true },
      { id: 'arms',  label: 'Arms',       emoji: '🏋️', desc: 'Brazos · Bíceps · Tríceps', days: ['sab'], isRes: true },
      { id: 'cardio',label: 'Cardio',     emoji: '❤️', desc: 'Recuperación · Zona 2 · HIIT · Dom', days: ['mar','jue','vie','dom'], isRes: false },
    ];
    const renderCatTab = () => {
      const sorted = Object.entries(weeks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
      return (
        <div className="cat-list">
          {CATS.map(cat => {
            let totalDays = 0, doneDays = 0, vol = 0;
            const bars = [];
            sorted.forEach(([wn, wk]) => {
              let cd = 0, ct = 0;
              cat.days.forEach(dk => {
                const dd = wk.days?.[dk];
                if (!dd) return;
                const exs = dd.exercises || [];
                if (exs.length === 0) return;
                totalDays++; ct++;
                const done = exs.filter(e => e.done).length;
                if (done === exs.length) { doneDays++; cd++; }
                if (cat.isRes) {
                  exs.forEach(ex => {
                    const w = parseFloat(ex.weight);
                    if (!w || isNaN(w) || ex.weight === '—') return;
                    const tr = getTemplateRepsFromPool(dk, ex.name, wk.schedule || schedule);
                    const parsed = parseRepsString(ex.reps || tr || '');
                    if (!parsed) return;
                    vol += w * parsed.sets * parsed.reps * (bilateralMap[ex.name] ? 2 : 1);
                  });
                }
              });
              if (ct > 0) bars.push({ wn, pct: Math.round(cd / ct * 100) });
            });
            const avg = totalDays ? Math.round(doneDays / totalDays * 100) : 0;
            const maxBar = Math.max(...bars.map(b => b.pct), 1);
            return (
              <div key={cat.id} className="cat-card">
                <div className="cat-hdr">
                  <span className="cat-emoji">{cat.emoji}</span>
                  <div>
                    <div className="cat-name">{cat.label}</div>
                    <div className="cat-desc">{cat.desc}</div>
                  </div>
                </div>
                <div className="cat-stats">
                  <div className="cat-stat">
                    <div className="cat-val">{doneDays}</div>
                    <div className="cat-lbl">días ✓</div>
                  </div>
                  <div className="cat-stat">
                    <div className="cat-val">{avg}%</div>
                    <div className="cat-lbl">promedio</div>
                  </div>
                  {cat.isRes && vol > 0 && (
                    <div className="cat-stat">
                      <div className="cat-val cat-val-sm">{fmtVolume(vol)}</div>
                      <div className="cat-lbl">vol. acum.</div>
                    </div>
                  )}
                </div>
                {bars.length > 0 && (
                  <div className="cat-bars">
                    {bars.map(({ wn, pct }) => (
                      <div key={wn} className="cat-bar-col">
                        <div className="cat-bar-bg">
                          <div className="cat-bar-fill" style={{ height: `${pct / maxBar * 100}%`, background: pct === 100 ? '#1A1917' : '#C8C4BE' }} />
                        </div>
                        <span className="cat-bar-lbl">S{wn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    // ── Exercises tab (per-exercise weight chart) ─────────────────────────────
    const renderExTab = () => {
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
      return trackedList.length === 0 ? (
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
            <div className="chart-range">{chartData.length} registros · {chartData[0]?.week} – {chartData[chartData.length-1]?.week}</div>
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
                    <path d={pathD} fill="none" stroke="#1A1917" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    {chartData.map((d, i) => (
                      <g key={i}>
                        <circle cx={toX(i)} cy={toY(d.weight)} r="3.5" fill="#1A1917" />
                        <text x={toX(i)} y={toY(d.weight)-8} textAnchor="middle" fill="#9E9A94" fontFamily="DM Mono,monospace" fontSize="8">{d.weight}kg</text>
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
                  <div className="cstat"><div className="cstat-val">{first}kg</div><div className="cstat-lbl">inicio</div></div>
                  <div className="cstat"><div className="cstat-val">{last}kg</div><div className="cstat-lbl">actual</div></div>
                  <div className="cstat">
                    <div className={`cstat-val ${Number(gain)>0?"up":Number(gain)<0?"dn":""}`}>{gain > 0 ? "+" : ""}{gain}%</div>
                    <div className="cstat-lbl">progreso</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-data">Registra al menos 2 semanas<br />para ver la curva.</div>
            )}
          </div>
        </>
      );
    };

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
          <div className="prog-tabs">
            <button className={`prog-tab ${progressTab === 'calendar' ? 'active' : ''}`} onClick={() => setProgressTab('calendar')}>Calendario</button>
            <button className={`prog-tab ${progressTab === 'categories' ? 'active' : ''}`} onClick={() => setProgressTab('categories')}>Categorías</button>
            <button className={`prog-tab ${progressTab === 'exercises' ? 'active' : ''}`} onClick={() => setProgressTab('exercises')}>Ejercicios</button>
          </div>
          {progressTab === 'calendar'   && renderCalTab()}
          {progressTab === 'categories' && renderCatTab()}
          {progressTab === 'exercises'  && renderExTab()}
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
      {toast && <div className={`toast ${toast.type === "info" ? "info" : ""}`}>{toast.msg}</div>}
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
