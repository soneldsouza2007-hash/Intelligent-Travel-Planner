import { useEffect, useMemo, useState } from 'react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  Map, Compass, CalendarDays, Wallet, Plus, Sparkles, MapPin, Clock3,
  Pencil, Trash2, X, TrainFront, BedDouble, Users, SlidersHorizontal,
  ArrowUpRight, RotateCcw, Check, Route as RouteIcon,
} from 'lucide-react';

type Activity = {
  id: string; name: string; category: string; area: string; durationHours: number;
  startHour: string; endHour: string; estimatedCost: number; preferenceTags: string[];
  description: string; transferMins: number; venueHours: string;
};
type DayPlan = { day: number; date: string; activities: Activity[] };
type Option = {
  id: string; providerName: string; category: 'transport' | 'stay'; price: number;
  duration?: string; rating?: number; location: string; sourceLabel: string; notes: string;
  availabilityNote?: string;
};
type Traveler = { id: string; name: string };
type Expense = {
  id: string; title: string; category: string; amount: number; paidBy: string;
  sharedWith: string[]; date: string;
};
type Trip = {
  destination: string; durationDays: number; budgetTotal: number; currency: string;
  groupSize: number; startDate: string; preferences: string[]; pace: string;
};
type AppState = { trip: Trip; travelers: Traveler[]; plans: DayPlan[]; options: Option[]; expenses: Expense[] };
type ModalType = 'activity' | 'option' | 'expense' | 'traveler' | null;

const PREFS = ['Food & wine', 'History', 'Design', 'Coast', 'Local life', 'Outdoors'];
const STORAGE_KEY = 'wayfarer-trip-v1';
const uid = () => Math.random().toString(36).slice(2, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const hourNumber = (time: string) => {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) + Number(minute) / 60;
};
const hoursBetween = (start: string, end: string) => {
  const startMinutes = Math.round(hourNumber(start) * 60);
  let endMinutes = Math.round(hourNumber(end) * 60);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return Number(((endMinutes - startMinutes) / 60).toFixed(2));
};
const asTime = (minutes: number) => {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayNumber = (short: string) => weekdays.findIndex(day => day.toLowerCase() === short.slice(0, 3).toLowerCase());
function venueOpenOn(venueHours: string, date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  const range = venueHours.match(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s*[–-]\s*(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/i);
  if (range) {
    const start = weekdayNumber(range[1]);
    const end = weekdayNumber(range[2]);
    const inRange = start <= end ? day >= start && day <= end : day >= start || day <= end;
    if (!inRange) return false;
  }
  const closedDays = [...venueHours.matchAll(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b(?:day)?s?\s+closed\b|\bclosed\s+(?:on\s+)?(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/gi)];
  return !closedDays.some(match => weekdayNumber(match[1] || match[2]) === day);
}
function venueWindow(venueHours: string) {
  const match = venueHours.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  return match ? {
    open: Number(match[1]) * 60 + Number(match[2]),
    close: Number(match[3]) * 60 + Number(match[4]),
  } : null;
}
function neighborhoodTransfer(from: string, to: string, fallback = 15) {
  const zone = (area: string) => {
    const value = area.toLowerCase();
    if (/cascais|estoril/.test(value)) return 'coast';
    if (/bel[eé]m|alc[aâ]ntara/.test(value)) return 'west';
    if (/alfama|gra[cç]a|mouraria|xabregas/.test(value)) return 'hills';
    if (/baixa|cais do sodr[eé]|chiado|pr[ií]ncipe real|campo de ourique|estrel/.test(value)) return 'center';
    return value;
  };
  const fromZone = zone(from);
  const toZone = zone(to);
  if (from.toLowerCase() === to.toLowerCase()) return 8;
  if (fromZone === toZone) return 12;
  if (fromZone === 'coast' || toZone === 'coast') return 38;
  if ([fromZone, toZone].includes('west') && [fromZone, toZone].includes('hills')) return 28;
  if ([fromZone, toZone].includes('west') && [fromZone, toZone].includes('center')) return 20;
  if ([fromZone, toZone].includes('hills') && [fromZone, toZone].includes('center')) return 16;
  return Math.max(10, fallback);
}
const money = (value: number, currency = 'EUR') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const shortDate = (date: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));

function buildActivity(name: string, category: string, area: string, startHour: string, endHour: string, estimatedCost: number, preferenceTags: string[], description: string, transferMins: number, venueHours: string): Activity {
  return { id: uid(), name, category, area, startHour, endHour, durationHours: hoursBetween(startHour, endHour), estimatedCost, preferenceTags, description, transferMins, venueHours };
}
const lisbonCatalog: Activity[] = [
  buildActivity('Coffee & a pastel de nata', 'Food', 'Baixa', '09:00', '10:00', 9, ['Food & wine', 'Local life'], 'Start gently at a neighborhood pastelaria before the city wakes up.', 0, 'Most cafés open from 08:00'),
  buildActivity('Alfama lanes & Sé Cathedral', 'History', 'Alfama', '10:30', '12:30', 6, ['History', 'Local life'], 'Follow the tiled lanes uphill, with time to pause at the cathedral and viewpoints.', 18, 'Cathedral typically 10:00–18:00'),
  buildActivity('Lunch at Mercado da Ribeira', 'Food', 'Cais do Sodré', '13:00', '14:15', 22, ['Food & wine', 'Local life'], 'A lively market hall for a flexible, low-fuss lunch together.', 16, 'Daily, roughly 10:00–00:00'),
  buildActivity('MAAT riverside galleries', 'Design', 'Belém', '15:00', '17:00', 15, ['Design', 'History'], 'Contemporary architecture and rotating exhibitions beside the Tagus.', 22, 'Wed–Mon, 10:00–19:00'),
  buildActivity('Sunset at Miradouro da Graça', 'Outdoors', 'Graça', '18:00', '19:00', 0, ['Outdoors', 'Local life'], 'A wide city view as the rooftops turn amber; bring a light layer.', 20, 'Open public viewpoint'),
  buildActivity('Fado supper in Mouraria', 'Food', 'Mouraria', '20:00', '22:00', 38, ['Food & wine', 'Local life', 'History'], 'Reserve a small table for dinner and live fado in its historic quarter.', 12, 'Evening service; reserve ahead'),
  buildActivity('Belém riverside walk', 'Outdoors', 'Belém', '09:30', '11:00', 0, ['Coast', 'Outdoors'], 'A breezy walk past the marina and monument-lined waterfront.', 8, 'Open public promenade'),
  buildActivity('Jerónimos Monastery', 'History', 'Belém', '11:15', '13:00', 18, ['History', 'Design'], 'Manueline stonework worth a slow visit; book a timed ticket if available.', 10, 'Tue–Sun, 09:30–17:30'),
  buildActivity('Seafood lunch in Belém', 'Food', 'Belém', '13:15', '14:30', 25, ['Food & wine'], 'A relaxed seafood stop close to the river, with room to linger.', 5, 'Lunch service varies'),
  buildActivity('LX Factory studios & bookshop', 'Design', 'Alcântara', '15:00', '17:00', 8, ['Design', 'Local life'], 'Independent shops and studios inside a former industrial complex.', 18, 'Shops usually open from 10:00'),
  buildActivity('Tram 28 through the old town', 'Local ride', 'Graça to Estrela', '09:30', '10:30', 4, ['History', 'Local life'], 'Ride one section early, then walk the quieter streets nearby.', 0, 'Service subject to local operations'),
  buildActivity('Tile Museum', 'Design', 'Xabregas', '11:00', '13:00', 10, ['Design', 'History'], 'A compact, beautiful history of azulejo from convent to contemporary work.', 18, 'Tue–Sun, 10:00–18:00'),
  buildActivity('A slow lunch in Campo de Ourique', 'Food', 'Campo de Ourique', '13:30', '15:00', 24, ['Food & wine', 'Local life'], 'Neighborhood tables and market stalls away from the busiest center.', 18, 'Market generally open until 23:00'),
  buildActivity('Cascais by train & Atlantic air', 'Coast', 'Cascais', '09:00', '13:00', 14, ['Coast', 'Outdoors'], 'Take the coastal train for sea views, then explore the old harbor on foot.', 35, 'Train journey about 40 minutes each way'),
  buildActivity('Cascais lunch by the harbor', 'Food', 'Cascais', '13:15', '14:30', 28, ['Food & wine', 'Coast'], 'Fresh fish and a long lunch before heading back to Lisbon.', 8, 'Lunch service varies'),
  buildActivity('Estoril coastal path', 'Outdoors', 'Cascais coast', '15:00', '17:00', 0, ['Coast', 'Outdoors'], 'An easy oceanfront walk; turn back whenever the pace feels right.', 12, 'Open public path'),
  buildActivity('Príncipe Real garden & shops', 'Local life', 'Príncipe Real', '10:00', '12:00', 6, ['Local life', 'Design'], 'A leafy square, independent shops and a slower start to the day.', 15, 'Shops generally open 10:00–19:00'),
  buildActivity('Museum of São Roque', 'History', 'Chiado', '12:15', '13:45', 8, ['History', 'Design'], 'A surprisingly rich church museum tucked beside the Bairro Alto.', 12, 'Tue–Sun, 10:00–18:00'),
  buildActivity('Chiado lunch & bookshops', 'Food', 'Chiado', '14:00', '15:30', 20, ['Food & wine', 'Local life'], 'Classic cafés and independent bookshops make a good final afternoon.', 8, 'Most shops open until 19:00'),
];
const seedOptions: Option[] = [
  { id: uid(), providerName: 'Metro + occasional taxi', category: 'transport', price: 34, duration: 'Local travel · 4 days', rating: 0, location: 'Lisbon city', sourceLabel: 'Planning estimate', notes: 'Allow for a reloadable transit card and a few short rides.' },
  { id: uid(), providerName: 'Lisbon Airport transfer', category: 'transport', price: 18, duration: '25–40 min', rating: 0, location: 'LIS → Baixa', sourceLabel: 'Planning estimate', notes: 'Per group, one-way estimate. Compare with metro and taxi on the day.' },
  { id: uid(), providerName: 'Casa do Pátio guesthouse', category: 'stay', price: 168, duration: 'per night · 2 rooms', rating: 4.7, location: 'Alfama · walkable base', sourceLabel: 'Planning estimate', notes: 'Illustrative nightly budget for a comfortable central stay; not availability.', availabilityNote: 'Not checked — illustrative entry only.' },
  { id: uid(), providerName: 'Avenida apartment', category: 'stay', price: 205, duration: 'per night · 2 bedrooms', rating: 4.8, location: 'Avenida da Liberdade', sourceLabel: 'Planning estimate', notes: 'A roomy group-stay placeholder. Verify actual prices and occupancy independently.', availabilityNote: 'Not checked — illustrative entry only.' },
];
const seedState: AppState = {
  trip: { destination: 'Lisbon, Portugal', durationDays: 4, budgetTotal: 2200, currency: 'EUR', groupSize: 2, startDate: '2026-10-01', preferences: ['Food & wine', 'History', 'Design', 'Local life'], pace: 'Balanced' },
  travelers: [{ id: 'trav-1', name: 'You' }, { id: 'trav-2', name: 'Alex' }],
  plans: [],
  options: seedOptions,
  expenses: [
    { id: uid(), title: 'Apartment deposit', category: 'Stay', amount: 160, paidBy: 'trav-1', sharedWith: ['trav-1', 'trav-2'], date: '2026-10-01' },
    { id: uid(), title: 'Museum tickets', category: 'Activities', amount: 28, paidBy: 'trav-2', sharedWith: ['trav-1', 'trav-2'], date: '2026-10-01' },
  ],
};
function generatePlans(trip: Trip, current: DayPlan[] = []): DayPlan[] {
  const isLisbon = /lisbon/i.test(trip.destination);
  const catalog = isLisbon ? lisbonCatalog : [
    buildActivity(`Walk the old quarter`, 'Local life', 'Historic center', '09:30', '11:00', 0, ['Local life', 'History'], `A gentle first look at ${trip.destination}'s historic streets.`, 0, 'Open public streets'),
    buildActivity('Local market & coffee', 'Food', 'Central market', '11:30', '13:00', 18, ['Food & wine', 'Local life'], 'Try a local specialty and see what is in season.', 14, 'Check current opening times'),
    buildActivity('Art, architecture & a long lunch', 'Design', 'Museum district', '14:30', '17:00', 24, ['Design', 'History'], 'A flexible afternoon combining one cultural stop with time to wander.', 16, 'Check venue opening times'),
    buildActivity('Park or waterfront at golden hour', 'Outdoors', 'Riverside', '17:30', '19:00', 0, ['Outdoors', 'Coast'], 'Leave room for fresh air and a spontaneous detour.', 12, 'Open public space'),
  ];
  const perDay = trip.pace === 'Easy' ? 3 : trip.pace === 'Full' ? 5 : 4;
  const dayLimitMinutes = trip.pace === 'Easy' ? 300 : trip.pace === 'Full' ? 540 : 420;
  const usedNames = new Set<string>();
  const plans: DayPlan[] = [];
  for (let i = 0; i < trip.durationDays; i++) {
    const date = addDays(trip.startDate, i);
    const dayNames = new Set<string>();
    const scheduled: Activity[] = [];
    let elapsedMinutes = 0;
    let clock = 8 * 60;
    let previousArea = '';
    while (scheduled.length < perDay) {
      const candidates = catalog.filter(activity => !dayNames.has(activity.name.toLowerCase()));
      if (!candidates.length) break;
      const evaluate = (pool: Activity[]) => pool.map(activity => {
        const transferMins = previousArea ? neighborhoodTransfer(previousArea, activity.area, activity.transferMins) : 0;
        const durationMins = Math.round(hoursBetween(activity.startHour, activity.endHour) * 60);
        if (!venueOpenOn(activity.venueHours, date)) return null;
        const window = venueWindow(activity.venueHours);
        const preferredStart = Math.round(hourNumber(activity.startHour) * 60);
        let start = Math.max(clock + transferMins, preferredStart);
        if (window && start < window.open) start = window.open;
        const end = start + durationMins;
        if (window && (start < window.open || end > window.close)) return null;
        if (end > 21 * 60 || elapsedMinutes + transferMins + durationMins > dayLimitMinutes) return null;
        const preferenceFit = activity.preferenceTags.filter(tag => trip.preferences.includes(tag)).length;
        const sameArea = previousArea && previousArea.toLowerCase() === activity.area.toLowerCase() ? 5 : 0;
        const sameZone = previousArea && neighborhoodTransfer(previousArea, activity.area) <= 12 ? 2 : 0;
        const latenessPenalty = Math.max(0, start - preferredStart) / 80;
        const score = preferenceFit * 12 + sameArea + sameZone - latenessPenalty - durationMins / 240;
        return { activity, transferMins, start, end, durationMins, score };
      }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
      let choices = evaluate(candidates.filter(activity => !usedNames.has(activity.name.toLowerCase())));
      // Reuse only after exhausting eligible, not-yet-planned activities across the trip.
      if (!choices.length) choices = evaluate(candidates.filter(activity => usedNames.has(activity.name.toLowerCase())));
      choices.sort((a, b) => b.score - a.score);
      const pick = choices[0];
      if (!pick) break;
      const activity: Activity = {
        ...pick.activity,
        id: uid(),
        startHour: asTime(pick.start),
        endHour: asTime(pick.end),
        durationHours: Number((pick.durationMins / 60).toFixed(2)),
        transferMins: pick.transferMins,
      };
      scheduled.push(activity);
      dayNames.add(activity.name.toLowerCase());
      usedNames.add(activity.name.toLowerCase());
      elapsedMinutes += pick.transferMins + pick.durationMins;
      clock = pick.end;
      previousArea = activity.area;
    }
    plans.push({ day: i + 1, date, activities: scheduled });
  }
  return plans;
}
function readState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...seedState, plans: generatePlans(seedState.trip) };
    const parsed = JSON.parse(stored) as Partial<AppState>;
    const savedTrip = { ...seedState.trip, ...parsed.trip };
    const migrateSampleDate = /lisbon/i.test(savedTrip.destination) && savedTrip.startDate === '2025-06-12';
    const trip = { ...savedTrip, startDate: migrateSampleDate ? '2026-10-01' : savedTrip.startDate };
    const travelers = Array.isArray(parsed.travelers) && parsed.travelers.length ? parsed.travelers : seedState.travelers;
    const options = Array.isArray(parsed.options) ? parsed.options : seedOptions;
    const expenses = Array.isArray(parsed.expenses) ? parsed.expenses.map(expense => migrateSampleDate && expense.date === '2025-06-12' ? { ...expense, date: '2026-10-01' } : expense) : [];
    const storedPlans = Array.isArray(parsed.plans) ? parsed.plans : [];
    const plans = storedPlans.length
      ? storedPlans.map((day, index) => ({ ...day, date: migrateSampleDate ? addDays(trip.startDate, index) : day.date }))
      : generatePlans(trip);
    return { trip, travelers, options, expenses, plans };
  } catch {
    return { ...seedState, plans: generatePlans(seedState.trip) };
  }
}
function timeLabel(hour: string) {
  const [h, m] = hour.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`;
}

function App() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<AppState>(readState);
  const [modal, setModal] = useState<ModalType>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  const [activeSection, setActiveSection] = useState('workspace');
  const { trip, travelers, plans, options, expenses } = state;
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { setToast('Could not save locally. Check browser storage settings.'); } }, [state]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const tripSpend = useMemo(() => {
    const activityEstimates = plans.flatMap(p => p.activities).reduce((sum, activity) => sum + activity.estimatedCost, 0);
    const transportPrices = options.filter(option => option.category === 'transport').map(option => option.price);
    const stayPrices = options.filter(option => option.category === 'stay').map(option => option.price);
    const lowestTransportEstimate = transportPrices.length ? Math.min(...transportPrices) : 0;
    const lowestNightlyStay = stayPrices.length ? Math.min(...stayPrices) : 0;
    return activityEstimates + lowestTransportEstimate + lowestNightlyStay * Math.max(0, trip.durationDays - 1);
  }, [plans, options, trip.durationDays]);
  const dayActivitySpend = (day: DayPlan) => day.activities.reduce((sum, a) => sum + a.estimatedCost, 0);
  const costPerPerson = (expense: Expense) => expense.amount / Math.max(expense.sharedWith.length, 1);
  const balances = useMemo(() => travelers.map(person => {
    const paid = expenses.filter(e => e.paidBy === person.id).reduce((sum, e) => sum + e.amount, 0);
    const share = expenses.filter(e => e.sharedWith.includes(person.id)).reduce((sum, e) => sum + costPerPerson(e), 0);
    return { ...person, balance: paid - share };
  }), [travelers, expenses]);
  const updateTrip = <K extends keyof Trip>(key: K, value: Trip[K]) => setState(old => {
    const nextTrip = { ...old.trip, [key]: value } as Trip;
    if (key === 'durationDays') return { ...old, trip: nextTrip, plans: generatePlans(nextTrip, old.plans) };
    if (key === 'startDate') return { ...old, trip: nextTrip, plans: old.plans.map((day, index) => ({ ...day, date: addDays(String(value), index) })) };
    return { ...old, trip: nextTrip };
  });
  const changeGroupSize = (requestedSize: number) => {
    if (requestedSize > travelers.length) {
      const additions = Array.from({ length: requestedSize - travelers.length }, (_, index) => ({
        id: uid(), name: `Traveler ${travelers.length + index + 1}`,
      }));
      setState(old => ({ ...old, travelers: [...old.travelers, ...additions], trip: { ...old.trip, groupSize: requestedSize } }));
      setToast(`${additions.length} traveler${additions.length === 1 ? '' : 's'} added`);
      return;
    }
    if (requestedSize < travelers.length) {
      const removed = travelers.slice(requestedSize);
      const removedIds = new Set(removed.map(person => person.id));
      const payerExpense = expenses.find(expense => removedIds.has(expense.paidBy));
      if (payerExpense) {
        window.alert(`${currentTravelerName(payerExpense.paidBy)} is the payer for “${payerExpense.title}”. Reassign or remove that expense before reducing the group.`);
        return;
      }
      const includedInSplits = expenses.some(expense => expense.sharedWith.some(id => removedIds.has(id)));
      if (includedInSplits && !window.confirm(`Remove ${removed.map(person => person.name).join(', ')} from the group and from existing expense splits?`)) return;
      setState(old => ({
        ...old,
        travelers: old.travelers.filter(person => !removedIds.has(person.id)),
        expenses: old.expenses.map(expense => ({ ...expense, sharedWith: expense.sharedWith.filter(id => !removedIds.has(id)) })),
        trip: { ...old.trip, groupSize: requestedSize },
      }));
      setToast('Group size updated; remaining expense splits recalculated');
      return;
    }
    updateTrip('groupSize', requestedSize);
  };
  const togglePref = (pref: string) => updateTrip('preferences', trip.preferences.includes(pref) ? trip.preferences.filter(p => p !== pref) : [...trip.preferences, pref]);
  const goSection = (section: string) => {
    setActiveSection(section);
    const id = section === 'planner' ? 'itinerary' : section === 'comparisons' ? 'comparisons' : section === 'expenses' ? 'expenses' : 'workspace';
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openModal = (type: ModalType, record?: Activity | Option | Expense) => {
    setEditingId(record?.id ?? null);
    if (type === 'activity' && record) {
      const activity = record as Activity;
      setForm({ ...activity, estimatedCost: String(activity.estimatedCost), durationHours: String(activity.durationHours), transferMins: String(activity.transferMins), preferenceTags: activity.preferenceTags.join(', ') });
    } else if (type === 'option' && record) {
      const option = record as Option;
      setForm({ ...option, price: String(option.price), rating: String(option.rating ?? ''), duration: option.duration ?? '', availabilityNote: option.availabilityNote ?? '' });
    } else if (type === 'expense' && record) {
      const expense = record as Expense;
      setForm({ ...expense, amount: String(expense.amount), sharedWith: expense.sharedWith.join(',') });
    } else setForm({ category: type === 'option' ? 'transport' : type === 'expense' ? 'Food' : 'Food', startHour: '10:00', endHour: '11:30', durationHours: '1.5', transferMins: '10', estimatedCost: '12', date: trip.startDate, paidBy: travelers[0]?.id ?? '', sharedWith: travelers.map(t => t.id).join(','), sourceLabel: 'Planning estimate', venueHours: 'Check opening hours', availabilityNote: '' });
    setModal(type);
  };
  const closeModal = () => { setModal(null); setEditingId(null); };
  const saveModal = () => {
    if (modal === 'activity') {
      const activity: Activity = {
        id: editingId ?? uid(), name: form.name || 'New activity', category: form.category || 'Local life',
        area: form.area || trip.destination, startHour: form.startHour || '10:00', endHour: form.endHour || '11:00',
        durationHours: hoursBetween(form.startHour || '10:00', form.endHour || '11:00'),
        estimatedCost: Number(form.estimatedCost) || 0, preferenceTags: (form.preferenceTags || '').split(',').map(s => s.trim()).filter(Boolean),
        description: form.description || 'A stop selected for your trip.', transferMins: Number(form.transferMins) || 0, venueHours: form.venueHours || 'Check opening hours',
      };
      const dayNum = Number(form.day) || 1;
      setState(old => {
        const matching = old.plans.find(p => p.activities.some(a => a.id === editingId));
        if (editingId && matching) return { ...old, plans: old.plans.map(p => ({ ...p, activities: p.activities.map(a => a.id === editingId ? activity : a).sort((a, b) => a.startHour.localeCompare(b.startHour)) })) };
        const plansNext = [...old.plans];
        const index = Math.min(Math.max(dayNum - 1, 0), plansNext.length - 1);
        plansNext[index] = { ...plansNext[index], activities: [...plansNext[index].activities, activity].sort((a, b) => a.startHour.localeCompare(b.startHour)) };
        return { ...old, plans: plansNext };
      });
      setToast(editingId ? 'Activity updated' : `Added to day ${dayNum}`);
    } else if (modal === 'option') {
      const option: Option = {
        id: editingId ?? uid(),
        providerName: form.providerName || 'New comparison',
        category: form.category === 'stay' ? 'stay' : 'transport',
        price: Number(form.price) || 0,
        duration: form.duration,
        rating: form.rating?.trim() ? Math.min(5, Math.max(0, Number(form.rating))) : undefined,
        location: form.location || trip.destination,
        sourceLabel: 'Planning estimate',
        notes: form.notes || 'User-entered estimate; verify independently.',
        availabilityNote: form.availabilityNote?.trim() || 'Not checked.',
      };
      setState(old => ({ ...old, options: editingId ? old.options.map(o => o.id === editingId ? option : o) : [...old.options, option] }));
      setToast(editingId ? 'Estimate updated' : 'Estimate added');
    } else if (modal === 'expense') {
      const expense: Expense = { id: editingId ?? uid(), title: form.title || 'Trip expense', category: form.category || 'Other', amount: Number(form.amount) || 0, paidBy: form.paidBy || travelers[0]?.id || '', sharedWith: (form.sharedWith || '').split(',').filter(Boolean), date: form.date || trip.startDate };
      setState(old => ({ ...old, expenses: editingId ? old.expenses.map(e => e.id === editingId ? expense : e) : [...old.expenses, expense] }));
      setToast(editingId ? 'Expense updated' : 'Expense recorded');
    } else if (modal === 'traveler') {
      if (form.name?.trim()) {
        setState(old => ({ ...old, travelers: [...old.travelers, { id: uid(), name: form.name.trim() }], trip: { ...old.trip, groupSize: old.travelers.length + 1 } }));
        setToast('Traveler added');
      }
    }
    closeModal();
  };
  const removeActivity = (activityId: string) => {
    if (!window.confirm('Remove this stop from the itinerary?')) return;
    setState(old => ({ ...old, plans: old.plans.map(p => ({ ...p, activities: p.activities.filter(a => a.id !== activityId) })) }));
    setToast('Activity removed');
  };
  const deleteOption = (id: string) => {
    if (!window.confirm('Delete this planning estimate?')) return;
    setState(old => ({ ...old, options: old.options.filter(o => o.id !== id) }));
    setToast('Estimate deleted');
  };
  const deleteExpense = (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    setState(old => ({ ...old, expenses: old.expenses.filter(e => e.id !== id) }));
    setToast('Expense deleted');
  };
  const regenerate = () => { setState(old => ({ ...old, plans: generatePlans(old.trip, old.plans) })); setToast('Itinerary refreshed around your trip preferences'); };
  const resetTrip = () => {
    if (!window.confirm('Restore the sample Lisbon trip? This replaces your saved trip.')) return;
    setState({ ...seedState, plans: generatePlans(seedState.trip) });
    setToast('Sample Lisbon plan restored');
  };
  const categories = options.filter(o => o.category === 'transport').length || options.filter(o => o.category === 'stay').length ? ['transport', 'stay'] as const : ['transport', 'stay'] as const;
  const currentTravelerName = (id: string) => travelers.find(t => t.id === id)?.name ?? 'Traveler';
  const navItems = [
    { id: 'workspace', label: 'Trip overview', icon: Compass },
    { id: 'planner', label: 'Day-by-day plan', icon: CalendarDays },
    { id: 'comparisons', label: 'Travel estimates', icon: TrainFront },
    { id: 'expenses', label: 'Shared expenses', icon: Wallet },
  ];
  return (
    <div className="app-shell" data-testid="page-trip-workspace">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Map size={19} /></div><div><div className="brand-name">wayfarer</div><div className="brand-kicker">travel, considered</div></div></div>
        <div><div className="nav-label">YOUR WORKSPACE</div>{navItems.map(item => <button key={item.id} className={`side-link ${activeSection === item.id ? 'active' : ''}`} onClick={() => goSection(item.id)} data-testid={`nav-${item.id}`}><item.icon size={16} />{item.label}</button>)}</div>
        <div className="trip-mini"><div className="eyebrow" style={{ color: '#b9c8bb' }}>CURRENT TRIP</div><div style={{ fontFamily: 'var(--app-font-serif)', fontSize: 19, marginTop: 8 }}>{trip.destination.split(',')[0]}</div><div style={{ fontSize: 10, color: '#c6d1c8', marginTop: 4 }}>{trip.durationDays} days · {travelers.length} travelers</div><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 15, fontSize: 10, color: '#b9c8bb' }}><span style={{ width: 7, height: 7, borderRadius: 99, background: '#e99479' }} /> Saved on this device</div></div>
        <button className="side-link" onClick={resetTrip} data-testid="button-reset-trip"><RotateCcw size={15} />Restore sample trip</button>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="eyebrow">PERSONAL TRAVEL WORKSPACE <span style={{ opacity: .5 }}> / </span> {shortDate(trip.startDate).toUpperCase()}</div><div className="profile"><span>Saved locally</span><div className="avatar">{travelers[0]?.name.slice(0, 1).toUpperCase() ?? 'Y'}</div><span>{travelers[0]?.name ?? 'You'}</span></div></header>
        <section id="workspace">
          <div className="page-head"><div><div className="eyebrow">A TRIP THAT FITS YOU</div><h1>{trip.destination.split(',')[0]}<span style={{ color: '#dc8368' }}>.</span></h1><p>Made for your pace, your people, and the places you care about.</p></div><div className="head-actions"><button className="btn" onClick={() => openModal('traveler')} data-testid="button-add-traveler"><Users size={15} /> Add traveler</button><button className="btn btn-primary" onClick={regenerate} data-testid="button-build-itinerary"><Sparkles size={15} /> Refresh my plan</button></div></div>
          <div className="workspace-grid">
            <div className="left-stack">
              <section className="panel" aria-label="Trip parameters" data-testid="panel-trip-settings">
                  <div className="panel-head"><div><div className="panel-title"><SlidersHorizontal size={15} />Shape this trip</div><div className="panel-sub">Refresh your plan to apply changes to your preferences and pace.</div></div><span className="eyebrow">01 / SET UP</span></div>
                <div className="trip-controls">
                  <div className="field"><label htmlFor="destination">Destination</label><input id="destination" value={trip.destination} onChange={e => updateTrip('destination', e.target.value)} placeholder="City, country" data-testid="input-destination" /></div>
                  <div className="field"><label htmlFor="startDate">Start date</label><input id="startDate" type="date" value={trip.startDate} onChange={e => updateTrip('startDate', e.target.value)} data-testid="input-start-date" /></div>
                  <div className="field"><label htmlFor="duration">Days</label><input id="duration" type="number" min="1" max="21" value={trip.durationDays} onChange={e => updateTrip('durationDays', Math.min(21, Math.max(1, Number(e.target.value))))} data-testid="input-duration" /></div>
                  <div className="field"><label htmlFor="budget">Total budget · {trip.currency}</label><input id="budget" type="number" min="0" value={trip.budgetTotal} onChange={e => updateTrip('budgetTotal', Number(e.target.value))} data-testid="input-budget" /></div>
                  <div className="field"><label htmlFor="group">Group size</label><select id="group" value={trip.groupSize} onChange={e => changeGroupSize(Number(e.target.value))} data-testid="select-group-size">{Array.from({ length: Math.max(8, trip.groupSize) }, (_, index) => index + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'traveler' : 'travelers'}</option>)}</select></div>
                  <div className="field"><label htmlFor="currency">Currency</label><select id="currency" value={trip.currency} onChange={e => updateTrip('currency', e.target.value)} data-testid="select-currency">{['EUR', 'USD', 'GBP', 'CAD', 'AUD'].map(c => <option key={c}>{c}</option>)}</select></div>
                  <div className="field" style={{ gridColumn: 'span 2' }}><label>Day pace</label><div className="pace-wrap">{['Easy', 'Balanced', 'Full'].map(pace => <button key={pace} className={trip.pace === pace ? 'selected' : ''} onClick={() => updateTrip('pace', pace)} data-testid={`button-pace-${pace.toLowerCase()}`}>{pace}</button>)}</div></div>
                  <div className="pref-row"><span className="pref-label">More of</span>{PREFS.map(pref => <button key={pref} className={`chip ${trip.preferences.includes(pref) ? 'selected' : ''}`} onClick={() => togglePref(pref)} data-testid={`chip-preference-${pref.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{trip.preferences.includes(pref) && <Check size={10} style={{ marginRight: 4, verticalAlign: -1 }} />}{pref}</button>)}</div>
                </div>
                <div className="budget-strip"><div className="budget-meta">EST. TRIP TOTAL</div><div className="budget-track"><div className="budget-fill" style={{ width: `${Math.min(100, tripSpend / Math.max(trip.budgetTotal, 1) * 100)}%` }} /></div><div className="budget-meta">{money(tripSpend, trip.currency)} / {money(trip.budgetTotal, trip.currency)}</div></div>
              </section>
              <section className="panel" id="itinerary" data-testid="section-itinerary">
                <div className="panel-head"><div><div className="panel-title"><CalendarDays size={15} />Your day-by-day plan</div><div className="panel-sub">A sensible route, with breathing room built in.</div></div><div style={{ display: 'flex', gap: 6 }}><button className="btn btn-quiet" onClick={regenerate} title="Rebuild itinerary" data-testid="button-regenerate-plan"><RotateCcw size={15} /></button><button className="btn btn-primary" onClick={() => openModal('activity')} data-testid="button-add-activity"><Plus size={14} /> Add a stop</button></div></div>
                <div style={{ padding: '10px 19px 2px', display: 'flex', gap: 7, flexWrap: 'wrap' }}><span className="tag"><RouteIcon size={10} style={{ verticalAlign: -2, marginRight: 3 }} />Heuristic route suggestions</span><span className="tag"><Clock3 size={10} style={{ verticalAlign: -2, marginRight: 3 }} />Venue hours considered when known</span><span className="tag"><Sparkles size={10} style={{ verticalAlign: -2, marginRight: 3 }} />Preference fit: {trip.preferences.length ? trip.preferences.join(' · ') : 'open exploration'}</span><span className="tag">{trip.pace} pace</span></div>
                {plans.length === 0 ? <div className="side-card"><div className="side-card-title">A fresh page</div><div className="side-card-sub">Choose trip details and refresh your plan to sketch the first route.</div><button className="btn btn-primary" onClick={regenerate} data-testid="button-generate-empty">Generate an itinerary</button></div> : plans.map(day => <div className="itinerary-day" key={day.day} data-testid={`day-plan-${day.day}`}>
                  <div className="day-header"><div className="day-number"><strong>Day {day.day}</strong><span>{shortDate(day.date)}</span></div><div className="day-totals"><span>{day.activities.length} stops</span><span>{money(dayActivitySpend(day), trip.currency)} est.</span></div></div>
                  {day.activities.length ? day.activities.map((activity, index) => <div key={activity.id}>
                    {index > 0 && <div className="transfer"><RouteIcon size={10} style={{ verticalAlign: -2 }} /> {activity.transferMins ? `~${activity.transferMins} min neighborhood transfer estimate` : 'Nearby · easy walk'}</div>}
                    <div className="activity-row" data-testid={`activity-${activity.id}`}>
                      <div className="activity-time">{timeLabel(activity.startHour)}<br /><span style={{ color: '#a5aaa0' }}>{timeLabel(activity.endHour)}</span></div><div className="timeline-dot" />
                      <div><div className="activity-name">{activity.name}</div><div className="activity-meta"><span><MapPin size={10} style={{ verticalAlign: -2 }} /> {activity.area}</span><span>{activity.durationHours}h</span><span className="tag">{activity.category}</span></div><div className="activity-desc">{activity.description}</div><div className="activity-meta" style={{ marginTop: 7 }}><span><Clock3 size={10} style={{ verticalAlign: -2 }} /> {activity.venueHours}</span><span style={{ color: '#ad7f5d' }}>Fit: {activity.preferenceTags.filter(t => trip.preferences.includes(t)).length ? activity.preferenceTags.filter(t => trip.preferences.includes(t)).join(', ') : 'explore'}</span></div></div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}><span className="activity-cost">{money(activity.estimatedCost, trip.currency)}</span><div className="activity-actions"><button className="btn btn-quiet" aria-label="Edit activity" onClick={() => openModal('activity', activity)} data-testid={`button-edit-activity-${activity.id}`}><Pencil size={13} /></button><button className="btn btn-quiet btn-danger" aria-label="Remove activity" onClick={() => removeActivity(activity.id)} data-testid={`button-delete-activity-${activity.id}`}><Trash2 size={13} /></button></div></div>
                    </div>
                  </div>) : <div style={{ padding: '15px 0', color: '#839189', fontSize: 11 }}>No stops yet. Add one that makes this day yours.</div>}
                  <button className="btn btn-quiet" style={{ marginLeft: 68, marginBottom: 8 }} onClick={() => { openModal('activity'); setForm(old => ({ ...old, day: String(day.day) })); }} data-testid={`button-add-activity-day-${day.day}`}><Plus size={12} /> Add to day {day.day}</button>
                </div>)}
                <div style={{ padding: '4px 19px 16px', fontSize: 9, color: '#9b9d91', lineHeight: 1.45 }}>This itinerary is a heuristic suggestion based on preference fit, activity durations, approximate neighborhood transfers, pacing, and recorded venue-hour notes. Always verify opening hours and transit times locally before you go.</div>
              </section>
            </div>
            <aside className="right-stack">
              <section className="panel side-card" id="comparisons" data-testid="section-comparisons">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}><div><h2 className="side-card-title">Getting there & staying</h2><p className="side-card-sub">Compare the shape of your trip costs.</p></div><button className="btn btn-quiet" onClick={() => openModal('option')} data-testid="button-add-option" title="Add estimate"><Plus size={16} /></button></div>
                <div className="estimate-notice"><strong>Planning estimates only.</strong> These are editable placeholders, not live availability, quotes, or bookings. Verify prices directly before you commit.</div>
                {categories.map(category => <div key={category}><div className="eyebrow" style={{ margin: '13px 0 2px' }}>{category === 'transport' ? 'TRANSPORT' : 'ACCOMMODATION'} · {category === 'stay' ? 'PER NIGHT' : 'ESTIMATES'} · LOWEST PRICE FIRST</div>{options.filter(o => o.category === category).sort((a, b) => a.price - b.price).map(option => <div className="option" key={option.id} data-testid={`option-${option.id}`}><div><div className="option-name">{category === 'transport' ? <TrainFront size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> : <BedDouble size={12} style={{ verticalAlign: -2, marginRight: 4 }} />}{option.providerName}</div><div className="option-sub">{option.location}</div><div className="option-sub">User note / unverified · rating {option.rating == null || option.rating <= 0 ? 'not entered' : `${option.rating.toFixed(1)} / 5`}</div><div className="option-sub">Availability-check note / unverified · {option.availabilityNote || 'Not checked.'}</div><div className="option-sub">{option.duration} · {option.notes}</div><div className="option-foot"><span className="tag">{option.sourceLabel}</span><span className="activity-actions"><button className="btn btn-quiet" onClick={() => openModal('option', option)} aria-label="Edit estimate" data-testid={`button-edit-option-${option.id}`}><Pencil size={12} /></button><button className="btn btn-quiet btn-danger" onClick={() => deleteOption(option.id)} aria-label="Delete estimate" data-testid={`button-delete-option-${option.id}`}><Trash2 size={12} /></button></span></div></div><div className="option-price">{money(option.price, trip.currency)}<div className="option-sub">{category === 'stay' ? 'night' : 'est.'}</div></div></div>)}</div>)}
              </section>
              <section className="panel side-card" id="expenses" data-testid="section-expenses">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}><div><h2 className="side-card-title">Shared tab</h2><p className="side-card-sub">Keep the group spend clear and easy.</p></div><button className="btn btn-quiet" onClick={() => openModal('expense')} data-testid="button-add-expense" title="Add expense"><Plus size={16} /></button></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 0 4px' }}><span className="eyebrow">RECORDED SPEND</span><span className="font-mono-ui" style={{ fontSize: 12 }}>{money(expenses.reduce((s, e) => s + e.amount, 0), trip.currency)}</span></div>
                <div className="expense-list">{expenses.length ? expenses.map(expense => <div className="expense-row" key={expense.id} data-testid={`expense-${expense.id}`}><div><div className="expense-title">{expense.title}</div><div className="expense-detail">{expense.category} · {currentTravelerName(expense.paidBy)} paid · split {expense.sharedWith.length || 1} ways</div><div className="activity-actions"><button className="btn btn-quiet" onClick={() => openModal('expense', expense)} data-testid={`button-edit-expense-${expense.id}`}><Pencil size={11} />Edit</button><button className="btn btn-quiet btn-danger" onClick={() => deleteExpense(expense.id)} data-testid={`button-delete-expense-${expense.id}`}><Trash2 size={11} /></button></div></div><div className="expense-amount">{money(expense.amount, trip.currency)}</div></div>) : <div className="side-card-sub" style={{ padding: '13px 0' }}>No shared costs yet. Add the first receipt when you have one.</div>}</div>
                <div className="eyebrow" style={{ marginTop: 13 }}>NET BALANCE · PAID MINUS FAIR SHARE</div>{balances.map(person => <div className="balance-line" key={person.id} data-testid={`balance-${person.id}`}><span>{person.name}</span><span className="balance-value" style={{ color: person.balance > .01 ? '#477d60' : person.balance < -.01 ? '#ad6652' : '#829087' }}>{person.balance > .01 ? '+' : ''}{money(person.balance, trip.currency)}</span></div>)}
                <div style={{ color: '#929b90', fontSize: 9, lineHeight: 1.45, marginTop: 9 }}>Equal shares are used among selected travelers. Positive means owed back; balances are a guide, not a payment or settlement.</div>
              </section>
              <section className="panel side-card" data-testid="panel-trip-snapshot"><div className="side-card-title">A little trip math</div><p className="side-card-sub">Your current plan, at a glance.</p><div className="balance-line"><span>Budget per person</span><span className="balance-value">{money(trip.budgetTotal / Math.max(trip.groupSize, 1), trip.currency)}</span></div><div className="balance-line"><span>Trip length</span><span className="balance-value">{trip.durationDays} days</span></div><div className="balance-line"><span>Interests matched</span><span className="balance-value">{trip.preferences.length} selected</span></div><button className="btn" style={{ width: '100%', marginTop: 13 }} onClick={() => { setLocation('/'); goSection('planner'); }} data-testid="button-review-plan"><ArrowUpRight size={14} /> Review itinerary</button></section>
            </aside>
          </div>
        </section>
        <footer style={{ marginTop: 22, paddingTop: 15, borderTop: '1px solid #ded9cc', display: 'flex', justifyContent: 'space-between', color: '#8a948b', fontSize: 9 }}><span>Wayfarer · A companion for making the days count.</span><span>Trip details stay in this browser.</span></footer>
      </main>
      <nav className="mobile-nav" aria-label="Workspace navigation">{navItems.map(item => <button key={item.id} className={activeSection === item.id ? 'active' : ''} onClick={() => goSection(item.id)} data-testid={`mobile-nav-${item.id}`}><item.icon size={17} />{item.label.split(' ')[0]}</button>)}</nav>
      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><h2 id="modal-title">{modal === 'activity' ? (editingId ? 'Edit this stop' : 'Add a stop') : modal === 'option' ? (editingId ? 'Edit estimate' : 'Add a comparison') : modal === 'expense' ? (editingId ? 'Edit expense' : 'Record a shared expense') : 'Add a traveler'} </h2><button className="btn btn-quiet" onClick={closeModal} aria-label="Close" data-testid="button-close-modal"><X size={17} /></button></div>
        <div className="modal-body">
          {modal === 'activity' && <div className="form-grid">
            <div className="field wide"><label>Activity name</label><input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Riverside market" data-testid="input-activity-name" /></div>
            <div className="field"><label>Category</label><select value={form.category ?? 'Food'} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-activity-category">{['Food', 'History', 'Design', 'Outdoors', 'Coast', 'Local life', 'Culture', 'Rest'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label>Area</label><input value={form.area ?? ''} onChange={e => setForm({ ...form, area: e.target.value })} placeholder="Neighborhood" data-testid="input-activity-area" /></div>
            <div className="field"><label>Start</label><input type="time" value={form.startHour ?? '10:00'} onChange={e => setForm({ ...form, startHour: e.target.value })} data-testid="input-activity-start" /></div>
            <div className="field"><label>End</label><input type="time" value={form.endHour ?? '11:30'} onChange={e => setForm({ ...form, endHour: e.target.value })} data-testid="input-activity-end" /></div>
            <div className="field"><label>Estimated cost · {trip.currency}</label><input type="number" min="0" value={form.estimatedCost ?? '0'} onChange={e => setForm({ ...form, estimatedCost: e.target.value })} data-testid="input-activity-cost" /></div>
            <div className="field"><label>Day</label><select value={form.day ?? '1'} onChange={e => setForm({ ...form, day: e.target.value })} data-testid="select-activity-day">{plans.map(d => <option key={d.day} value={d.day}>Day {d.day}</option>)}</select></div>
            <div className="field wide"><label>Interest tags · comma separated</label><input value={form.preferenceTags ?? ''} onChange={e => setForm({ ...form, preferenceTags: e.target.value })} placeholder="Food & wine, Local life" data-testid="input-activity-tags" /></div>
            <div className="field wide"><label>Why it fits / notes</label><textarea rows={2} value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} data-testid="input-activity-description" /></div>
            <div className="field"><label>Transfer minutes</label><input type="number" min="0" value={form.transferMins ?? '0'} onChange={e => setForm({ ...form, transferMins: e.target.value })} data-testid="input-activity-transfer" /></div>
            <div className="field"><label>Venue hours note</label><input value={form.venueHours ?? ''} onChange={e => setForm({ ...form, venueHours: e.target.value })} data-testid="input-activity-hours" /></div>
          </div>}
          {modal === 'option' && <div className="form-grid">
            <div className="field"><label>Type</label><select value={form.category ?? 'transport'} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-option-category"><option value="transport">Transport</option><option value="stay">Accommodation</option></select></div>
            <div className="field"><label>Estimate · {trip.currency}</label><input type="number" min="0" value={form.price ?? ''} onChange={e => setForm({ ...form, price: e.target.value })} data-testid="input-option-price" /></div>
            <div className="field wide"><label>Provider / option name</label><input value={form.providerName ?? ''} onChange={e => setForm({ ...form, providerName: e.target.value })} placeholder="Name this comparison" data-testid="input-option-name" /></div>
            <div className="field"><label>Area / route</label><input value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} data-testid="input-option-location" /></div>
            <div className="field"><label>Duration / pricing basis</label><input value={form.duration ?? ''} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="per night / 35 min" data-testid="input-option-duration" /></div>
            <div className="field"><label>User rating note · unverified / 5</label><input type="number" min="0" max="5" step=".1" value={form.rating ?? ''} onChange={e => setForm({ ...form, rating: e.target.value })} placeholder="Leave blank if unknown" data-testid="input-option-rating" /></div>
            <div className="field"><label>Availability-check note · unverified</label><input value={form.availabilityNote ?? ''} onChange={e => setForm({ ...form, availabilityNote: e.target.value })} placeholder="Not checked, or your own note" data-testid="input-option-availability-note" /></div>
            <div className="field wide"><label>Notes</label><textarea rows={2} value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-option-notes" /></div>
            <div className="wide estimate-notice"><strong>Editable planning estimate.</strong> Rating and availability notes are user-entered and unverified. There is no live inventory, live availability, provider pricing, or booking connected.</div>
          </div>}
          {modal === 'expense' && <div className="form-grid">
            <div className="field wide"><label>What was it?</label><input value={form.title ?? ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Dinner, tickets, taxi…" data-testid="input-expense-title" /></div>
            <div className="field"><label>Amount · {trip.currency}</label><input type="number" min="0" step=".01" value={form.amount ?? ''} onChange={e => setForm({ ...form, amount: e.target.value })} data-testid="input-expense-amount" /></div>
            <div className="field"><label>Category</label><select value={form.category ?? 'Food'} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-expense-category">{['Food', 'Stay', 'Transport', 'Activities', 'Contribution', 'Other'].map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="field"><label>Paid by</label><select value={form.paidBy ?? travelers[0]?.id} onChange={e => setForm({ ...form, paidBy: e.target.value })} data-testid="select-expense-payer">{travelers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="field"><label>Date</label><input type="date" value={form.date ?? trip.startDate} onChange={e => setForm({ ...form, date: e.target.value })} data-testid="input-expense-date" /></div>
            <div className="field wide"><label>Split equally between</label><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{travelers.map(person => { const selected = (form.sharedWith ?? '').split(',').includes(person.id); return <button key={person.id} className={`chip ${selected ? 'selected' : ''}`} onClick={() => setForm({ ...form, sharedWith: selected ? (form.sharedWith ?? '').split(',').filter(id => id !== person.id).join(',') : [...(form.sharedWith ?? '').split(',').filter(Boolean), person.id].join(',') })} data-testid={`chip-expense-share-${person.id}`}>{selected && <Check size={10} style={{ marginRight: 4, verticalAlign: -1 }} />}{person.name}</button>; })}</div></div>
            <div className="field wide"><span style={{ fontSize: 10, color: '#829087' }}>Each selected traveler is assigned an equal share. Record contributions as an expense paid by the contributing traveler.</span></div>
          </div>}
          {modal === 'traveler' && <div className="form-grid"><div className="field wide"><label>Traveler name</label><input value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" autoFocus data-testid="input-traveler-name" /></div><div className="wide" style={{ fontSize: 10, color: '#829087' }}>Add a person to your shared expense splits. The list stays on this device.</div></div>}
        </div>
        <div className="modal-actions"><button className="btn" onClick={closeModal} data-testid="button-cancel-modal">Cancel</button><button className="btn btn-primary" onClick={saveModal} data-testid="button-save-modal">{editingId ? 'Save changes' : modal === 'traveler' ? 'Add traveler' : 'Save to trip'}</button></div>
      </div></div>}
      {toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}
    </div>
  );
}

function Router() {
  return <Switch><Route path="/" component={App} /><Route><div style={{ padding: 40, color: '#24443d' }}>This trip workspace is available at <a href="/">/</a>.</div></Route></Switch>;
}

function RoutedApp() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>;
}

export default RoutedApp;