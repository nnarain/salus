<p align="center">
  <img src="salus-logo.png" alt="Salus logo" width="200" />
</p>

# Salus

[![Build and Publish Docker Images](https://github.com/nnarain/health-tracker/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/nnarain/health-tracker/actions/workflows/docker-publish.yml)

Self-hosted personal health tracker

> [!WARNING]
> This is an entirely vibe coded application. I made this to solve some specific problems I cared about. But otherwise there isn't much in the way of quality control.

## Concept

Ok so why does this exist?

Well I felt that there's a lot of health tracking app or workout trackers that will record primarily weight, but depending on what you are using might also have calories, activity, etc.

Well weight is not the main factor to consider. If you're a body builder you want your weight to go up.

So there's other significant factors:

* Body fat percentage
* Sleep
* Stress

On top of the expected calories in and out.

I had a few apps for different things and I wanted some view for everything.

So this project backend records data for:

* Weight
* Waist line
* Body fat
* Visceral fat level (with the device's proprietary scale range)
* Muscle mass
* Sleep
* Stress level

Using waist line and height you can calculate a ratio that can be used as a measure of health. Modern scales can record body fat percentage.

I normalize waist-to-height ratio, body fat percentage, and visceral fat level onto 0–1 scales, then equally average the available factors as a single health index to track meaningful progress (or that's the idea).

## Insights

TODO

## Calculations

- **Visceral fat card** — Uses the latest measurement's own device range: `(value - scale_min) / (scale_max - scale_min)`, clamped to 0–1. The border smoothly changes from green at 0 through yellow to red at 1, and the card shows the percentage of that range. Missing or invalid ranges remain neutral. This proprietary device-scale position contributes to the app-defined composite indicator but is not a clinical risk threshold.
- **Visceral fat plot** — Under Data, below body weight/composition, each reading uses the same normalization against its own range on a fixed 0–1 axis. Points use the card's green-to-red colors; tooltips show the original level and device range. The dashboard time-range control applies. Missing or invalid ranges are reported and shown as gaps, never filled from another entry. Multiple readings on the same date are normalized individually, not averaged.
- **Health Risk Indicator (0–1)** — Waist-to-height ratio, logged body fat %, and scaled visceral fat are normalized onto 0–1 scales (lower is better) and equally averaged across available factors. The hero and the normalized chart's composite line share the latest logged reading for each factor as of each measurement date, even when the factors are logged on different dates. A latest visceral reading without a valid range removes that factor until a scaled reading is logged; older ranges are never borrowed. Missing factors are excluded, not counted as zero; RFM and weight are excluded. The three-factor composite is app-defined, not clinically validated. WHtR < 0.5 threshold: [NICE NG246](https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity). Healthy body fat ranges: [Alberta Health Services](https://myhealth.alberta.ca/Health/aftercareinformation/pages/conditions.aspx?hwid=zp4369). Combined waist/body-fat assessment background (not validation of this composite): [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/healthy-weights/canadian-guidelines-body-weight-classification-adults/quick-reference-tool-professionals.html).
- **Health journey** — The composite indicator is divided into high (≥0.67), moderate (≥0.33), and low (<0.33) zones, with three evenly spaced waypoints per zone. A trend needs at least two comparable indicator dates at least 3 calendar days apart, each no more than 14 days old (age 0–14 inclusive); consecutive daily logging is not required. Monday/Thursday qualifies, while Monday/Tuesday/Wednesday spans only 2 days. Both dates use the same available factors, with carried readings and current factors no more than 30 days old. Individual changes compare each metric's own recent reading dates at least 3 days apart. The hero reports comparable-date coverage, missing elapsed time, stale factors, and stable/increasing trends; passed projected dates request fresh measurements. Body fat changes use percentage points and visceral fat changes use normalized device-range percentage points. Reloading or logging measurements re-evaluates these moving windows; demo data can age out. Dates require an improving pace and are extrapolations, not deadlines or clinical predictions. The composite zones and intermediate waypoints are app-defined, not clinical thresholds.
- **Normalized risk chart** — Trends (the default) shows the bold solid purple overall indicator with thinner dashed factor lines for comparing their pace. The Contributions toggle stacks each available factor's weighted share (`score / number of available factors`); the top edge equals the purple overall indicator. Straight segments and full-precision values keep the stack and total aligned. Translucent fills preserve the low/moderate/high-risk background zones, which apply to the total, not individual bands. Both views share the date range and tooltip showing each factor's latest reading date, normalized score, and contribution. Missing factors add no band and are excluded from the divisor. Displayed numbers are rounded; calculations use full precision.
- **Estimate readiness notice** — Coverage and missing-data guidance appear only when an outstanding milestone cannot be projected because a trend is not ready or not improving. The notice disappears when estimates are available or all waypoints are reached. General requirements remain available in the information modal.
- **Sleep target band** — 7–9 hours (ages 18–64), 7–8 hours (65+): [Canadian 24-Hour Movement Guidelines](https://csepguidelines.ca/guidelines/adults-18-64/).
- **Relative Fat Mass (RFM)** — Body fat % estimated from height and waist: `64 − 20 × (height / waist) [+ 12 if female]`: [Woolcott & Bergman, *Scientific Reports* 2018](https://www.nature.com/articles/s41598-018-29362-1).
- **Maintenance calories (TDEE)** — BMR from the [Mifflin-St Jeor equation](https://pubmed.ncbi.nlm.nih.gov/2305711/) (`10 × kg + 6.25 × cm − 5 × age + 5/−161`) multiplied by standard activity factors (1.2–1.9). When enough logged data exists, this is replaced by an estimate from actual intake and weight trend, using the ≈7,700 kcal/kg energy-to-weight convention ([Wishnofsky](https://pubmed.ncbi.nlm.nih.gov/13594881/)).
- **Protein target** — 0.8 g/kg body weight (RDA baseline): [Health Canada Dietary Reference Intakes](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html).


