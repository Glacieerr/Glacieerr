// The "What if…" lab on the interactive page's Storewright app (idea #169) runs one store day of
// Storewright's own simulation in the browser. This module is the entry point that
// scripts/bundle_storewright_sim.sh bundles, together with the Storewright code it imports
// (https://github.com/Glacieerr/storewright, AGPL-3.0), into pages/src/storewright-sim.js, the
// global StorewrightSim. The page runs it only when asked (Rerun or a slider), never at load.
//
// The day is the one scripts/store_day.mjs simulates for the store-day card, the same as
// `npm run sim -- --seed YYYYMMDD`: the medium template, the optimized policy, catalog seed 7 and
// the date as the random seed. With the knobs at their defaults nothing in the scenario changes,
// so the result is the card's own day. Each knob changes a real field of that scenario:
//   pickers  scenario.staffing.pick, pickers on shift per hour: the busiest hour gets this many
//            (12 by default) and every other hour with pickers gains or loses as many, never
//            fewer than one
//   volume   scenario.demand.ordersPerDay, as a percentage of the template's 260 orders a day
//   peak     scenario.demand.hourlyProfile, the relative weight of orders by hour: the busiest
//            hours (a weight of 1.1 or more: 11 AM to 1 PM and 4 to 7 PM) are multiplied by this,
//            so more (or fewer) of the day's orders fall in them; the expected total stays the
//            same, as generateOrders() shares the day's orders out by these weights
// Every store, item, order and customer is synthetic, and the results describe this model only.
import { createTemplate, StoreModel } from '@storewright/store-config';
import { generateCatalog, generateOrders } from '@storewright/synth';
import { OPTIMIZED, defaultScenario, simulateDay } from '@storewright/sim-engine';

const TEMPLATE = 'medium';
const CATALOG_SEED = 7;
const PEAK_WEIGHT = 1.1;
const round1 = (v) => Math.round(v * 10) / 10;

/** The scenario as the CLI builds it, and what the knobs start from. */
export function defaults() {
  const s = defaultScenario(TEMPLATE);
  const w = s.demand.hourlyProfile;
  return {
    template: TEMPLATE,
    pickers: Math.max(...s.staffing.pick),
    pickHours: s.staffing.pick.slice(),
    volume: 100,
    ordersPerDay: s.demand.ordersPerDay,
    peak: 1,
    peakHours: w.map((v, h) => (v >= PEAK_WEIGHT ? h : -1)).filter((h) => h >= 0),
  };
}

/**
 * One simulated store day: {seed, pickers, volume, peak} in, the store-day card's numbers out.
 * Same inputs, same outputs: the store and its catalog are built afresh for every run, and every
 * random draw comes from the seed.
 */
export function runDay({ seed, pickers, volume = 100, peak = 1 } = {}) {
  if (!Number.isInteger(seed)) throw new Error('runDay needs a whole-number seed (the date as YYYYMMDD)');
  const model = new StoreModel(createTemplate(TEMPLATE));
  const scenario = defaultScenario(TEMPLATE);
  const most = Math.max(...scenario.staffing.pick);
  if (pickers != null && pickers !== most) {
    const delta = Math.round(pickers) - most;
    scenario.staffing = { ...scenario.staffing, pick: scenario.staffing.pick.map((n) => (n > 0 ? Math.max(1, n + delta) : 0)) };
  }
  if (volume !== 100) scenario.demand = { ...scenario.demand, ordersPerDay: Math.max(1, Math.round((scenario.demand.ordersPerDay * volume) / 100)) };
  if (peak !== 1) scenario.demand = { ...scenario.demand, hourlyProfile: scenario.demand.hourlyProfile.map((v) => (v >= PEAK_WEIGHT ? v * peak : v)) };
  const catalog = generateCatalog(model, { seed: CATALOG_SEED });
  const orders = generateOrders(model, catalog, scenario.demand, { seed });
  const { metrics: m } = simulateDay({ model, items: catalog.byId, orders, scenario, policy: OPTIMIZED, seed });
  return {
    onTime: round1(100 - m.lateOrderPct),
    waitMin: round1(m.avgWaitMin),
    orders: m.orders,
    fulfilled: m.orders - m.unfinishedOrders,
    pickers: Math.max(...scenario.staffing.pick),
    ordersPerDay: scenario.demand.ordersPerDay,
  };
}
