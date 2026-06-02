/**
 * db.js — Capa de datos Supabase para APEX
 */
import { supabase } from './supabase'

// ─── PROFILE ─────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function upsertProfile(userId, name) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, name })
  if (error) throw error
}

// ─── WEEKS ───────────────────────────────────────────────────────────────────

export async function getWeeks(profileId) {
  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('profile_id', profileId)
    .order('week_number')
  if (error) throw error
  return data
}

export async function upsertWeek(profileId, weekNumber, schedule, date) {
  const { data, error } = await supabase
    .from('weeks')
    .upsert(
      { profile_id: profileId, week_number: weekNumber, schedule, date },
      { onConflict: 'profile_id,week_number' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWeekSchedule(weekId, schedule) {
  const { error } = await supabase
    .from('weeks')
    .update({ schedule })
    .eq('id', weekId)
  if (error) throw error
}

// ─── DAYS ────────────────────────────────────────────────────────────────────

export async function getDaysForWeek(weekId) {
  const { data, error } = await supabase
    .from('days')
    .select('*')
    .eq('week_id', weekId)
  if (error) throw error
  return data
}

export async function upsertDay(weekId, dayKey, completedWarmup = false) {
  const { data, error } = await supabase
    .from('days')
    .upsert(
      { week_id: weekId, day_key: dayKey, completed_warmup: completedWarmup },
      { onConflict: 'week_id,day_key' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── EXERCISES ───────────────────────────────────────────────────────────────

export async function getExercisesForDay(dayId) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('day_id', dayId)
    .order('position')
  if (error) throw error
  return data
}

export async function insertExercise(dayId, ex, position) {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      day_id: dayId,
      name: ex.name,
      muscle: ex.muscle,
      weight: ex.weight || null,
      reps: ex.reps || null,
      activity: ex.activity || null,
      done: false,
      position,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleExercise(id, done) {
  const { error } = await supabase
    .from('exercises')
    .update({ done })
    .eq('id', id)
  if (error) throw error
}

export async function updateExercise(id, fields) {
  const { error } = await supabase
    .from('exercises')
    .update(fields)
    .eq('id', id)
  if (error) throw error
}

export async function deleteExercise(id) {
  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function resetDayExercises(dayId) {
  const { error } = await supabase
    .from('exercises')
    .update({ done: false })
    .eq('day_id', dayId)
  if (error) throw error
}

// ─── FULL LOAD ────────────────────────────────────────────────────────────────

export async function loadAllData(userId) {
  const weeksRaw = await getWeeks(userId)
  if (!weeksRaw.length) return null

  const result = {}

  for (const week of weeksRaw) {
    const daysRaw = await getDaysForWeek(week.id)
    const days = {}

    for (const day of daysRaw) {
      const exsRaw = await getExercisesForDay(day.id)

      // Deduplicate: keep only the first occurrence of each exercise name
      const seen = new Set()
      const unique = exsRaw.filter(e => {
        if (seen.has(e.name)) return false
        seen.add(e.name)
        return true
      })

      days[day.day_key] = {
        _dayId: day.id,
        completed_warmup: day.completed_warmup,
        exercises: unique.map(e => ({
          id: e.id,
          name: e.name,
          muscle: e.muscle,
          weight: e.weight || '',
          reps: e.reps || '',
          activity: e.activity || '',
          done: e.done,
          position: e.position,
        })),
      }
    }

    result[week.week_number] = {
      _weekId: week.id,
      schedule: week.schedule,
      date: week.date,
      days,
    }
  }

  const maxWeek = Math.max(...weeksRaw.map(w => w.week_number))
  const currentSchedule = weeksRaw.find(w => w.week_number === maxWeek)?.schedule || 'A'

  return { currentWeekNum: maxWeek, schedule: currentSchedule, weeks: result }
}

export async function createFullWeek(userId, weekNumber, schedule, template) {
  const DAY_ORDER = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
  const date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  const week = await upsertWeek(userId, weekNumber, schedule, date)

  const weekDays = {}

  for (const dayKey of DAY_ORDER) {
    const tmpl = template[dayKey]
    const day = await upsertDay(week.id, dayKey)

    // Clear any existing exercises for this day before inserting
    // (prevents duplicates if createFullWeek is called multiple times)
    await supabase.from('exercises').delete().eq('day_id', day.id)

    const exercises = []
    for (let i = 0; i < tmpl.exercises.length; i++) {
      const ex = await insertExercise(day.id, tmpl.exercises[i], i)
      exercises.push({
        id: ex.id,
        name: ex.name,
        muscle: ex.muscle,
        weight: ex.weight || '',
        reps: ex.reps || '',
        activity: ex.activity || '',
        done: false,
        position: i,
      })
    }

    weekDays[dayKey] = {
      _dayId: day.id,
      completed_warmup: false,
      exercises,
    }
  }

  return { _weekId: week.id, schedule, date, days: weekDays }
}
