"use client";

import { useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { getRiskJourney, RISK_MILESTONES } from '@/lib/riskJourney';
import type { BiometricEntry, UserProfile } from '@/lib/types';

interface ZoneMilestoneCardProps {
  biometrics: BiometricEntry[];
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

function formatEstimate(days: number | null, asOf: string): string {
  if (days === null) return 'Estimate unavailable';
  const date = new Date(`${asOf}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime())) return 'Estimate unavailable';
  const duration = days < 14 ? `${days} ${days === 1 ? 'day' : 'days'}`
    : days < 365 ? `${Math.round(days / 7)} weeks` : `${(days / 365).toFixed(1)} years`;
  return `~${duration} · ${date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

function formatChange(change: number, unit: string, days: number): string {
  const rounded = Number(change.toFixed(2));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded)} ${unit} over ${days} days`;
}

export default function ZoneMilestoneCard({ biometrics, profile, loading, error }: ZoneMilestoneCardProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const journey = useMemo(() => getRiskJourney(biometrics, profile), [biometrics, profile]);
  const badge = journey?.zone === 'High Risk'
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : journey?.zone === 'Moderate Risk'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  const nextPosition = journey?.nextMilestone === null || journey?.nextMilestone === undefined
    ? null : (1 - journey.nextMilestone) * 100;

  return (
    <section aria-labelledby="risk-journey-title" className="mb-8 rounded-xl border border-blue-100 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 id="risk-journey-title" className="text-2xl font-bold text-gray-900 dark:text-white">Health Progression</h2>
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400"
            aria-label="More information about health progression"
            title="More information"
          >
            <svg className="h-4 w-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        {journey && !loading && !error && (
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${badge}`}>{journey.zone}</span>
        )}
      </div>
      {loading ? (
        <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">Loading your health journey…</p>
      ) : error ? (
        <p role="alert" className="mt-5 text-sm text-red-700 dark:text-red-400">{error}</p>
      ) : !journey ? (
        <p className="mt-5 text-sm text-gray-600 dark:text-gray-400">Add a body fat measurement or a waist measurement and height to see your journey.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Health risk indicator <span className="text-xs">(lower is better)</span></p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{journey.score.toFixed(2)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ 1.00</span></p>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 sm:text-right">
              {journey.trend ? (
                <>
                  <p className="font-semibold">{journey.trend.change < -0.0001 ? '↓ Improving' : journey.trend.change > 0.0001 ? '↑ Increasing' : '→ Stable'}</p>
                </>
              ) : <p>Keep logging to see a trend</p>}
              {journey.waist && (
                <p>Waist: {journey.waistTrend
                  ? formatChange(journey.waistTrend.change / (journey.waist.unit === 'inches' ? 2.54 : 1), journey.waist.unit === 'inches' ? 'in' : 'cm', journey.waistTrend.days)
                  : 'Not enough recent readings'}</p>
              )}
              {journey.bodyFat && (
                <p>Body fat: {journey.bodyFatTrend
                  ? formatChange(journey.bodyFatTrend.change, 'percentage points', journey.bodyFatTrend.days)
                  : 'Not enough recent readings'}</p>
              )}
            </div>
          </div>

          <div className="mt-7 px-2">
            <div className="relative h-5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500" aria-hidden="true">
              {[33, 67].map((position) => <span key={position} className="absolute top-0 h-full w-0.5 bg-white/80" style={{ left: `${position}%` }} />)}
              {RISK_MILESTONES.map((score) => (
                <span key={score} className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${score >= journey.score ? 'bg-gray-800' : 'bg-white/60'}`}
                  style={{ left: `${Math.min(99, (1 - score) * 100)}%` }} />
              ))}
              {nextPosition !== null && <span className="absolute -top-1 h-7 w-7 -translate-x-1/2 rounded-full border-2 border-dashed border-blue-700 dark:border-blue-200" style={{ left: `${Math.min(98, nextPosition)}%` }} />}
              <span className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-blue-700 bg-white shadow-md dark:border-blue-300"
                style={{ left: `${Math.max(1, Math.min(99, (1 - journey.score) * 100))}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-3 text-xs font-semibold uppercase tracking-wide">
              <span className="text-red-700 dark:text-red-400">High risk</span>
              <span className="text-center text-amber-700 dark:text-amber-400">Moderate</span>
              <span className="text-right text-emerald-700 dark:text-emerald-400">Low risk</span>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-gray-100 pt-5 dark:border-gray-700 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Next milestone{journey.nextMilestone !== null ? ` · ${journey.nextMilestone.toFixed(2)}` : ''}</dt>
              <dd className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-400">{journey.nextMilestone === null ? 'All waypoints reached' : formatEstimate(journey.milestoneDays, journey.today)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Next zone</dt>
              <dd className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{journey.nextZone ? formatEstimate(journey.nextZoneDays, journey.today) : 'Low risk'}</dd>
              {journey.nextZone && <p className="text-xs text-gray-500 dark:text-gray-400">to {journey.nextZone.label}</p>}
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Low risk</dt>
              <dd className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400">{journey.zone === 'Low Risk' ? 'Current zone' : formatEstimate(journey.lowRiskDays, journey.today)}</dd>
            </div>
          </dl>
        </>
      )}
      <Modal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} title="Health Progression">
        <div className="space-y-5 text-gray-700 dark:text-gray-300">
          <section>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Health risk indicator</h3>
            <p>Waist-to-height ratio and logged body fat percentage are normalized to a 0–1 scale and averaged when both are available. If only one is available, the indicator uses that measurement alone. Lower scores represent lower risk on this scale; weight and other tracked metrics are not included.</p>
            {journey && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Current indicator based on {[
                  journey.waist && `waist-to-height (${journey.waist.date})`,
                  journey.bodyFat && `logged body fat (${journey.bodyFat.date})`,
                ].filter(Boolean).join(' and ')}.
              </p>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Zones and milestones</h3>
            <p>The indicator is divided into high, moderate, and low risk zones, with three evenly spaced waypoints in each zone. The outlined dot marks the next milestone. These app-defined zones and waypoints are intended to show progress, not to diagnose health.</p>
          </section>
          <section>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Trend and estimates</h3>
            <p>The indicator trend compares recent readings using the same available measurements. Waist and body fat changes compare each measure&apos;s own readings from the last 14 days, over at least 3 days. Body fat change is shown in percentage points. Estimates extrapolate an improving indicator pace from the latest reading; they are not deadlines. They may be unavailable when readings are too sparse or old, the trend is not improving, or an estimated date has passed.</p>
          </section>
        </div>
      </Modal>
    </section>
  );
}
