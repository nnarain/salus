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
* Muscle mass
* Sleep
* Stress level

Using waist line and height you can calculate a ratio that can be used as a measure of health. Modern scales can record body fat percentage.

I normalize these on the scale of what is ideal and what is "at risk" then average them together as a single health index to track meaningful progress (or that's the idea).

## Insights

TODO

## Calculations

- **Health Risk Indicator (0–1)** — Waist-to-height ratio and body fat % are each normalized onto a 0–1 scale (0 = ideal, 1 = high risk) and averaged. WHtR < 0.5 threshold: [NICE NG246](https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity). Healthy body fat ranges: [Alberta Health Services](https://myhealth.alberta.ca/Health/aftercareinformation/pages/conditions.aspx?hwid=zp4369). Combined two-measurement assessment: [Health Canada](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/healthy-weights/canadian-guidelines-body-weight-classification-adults/quick-reference-tool-professionals.html).
- **Sleep target band** — 7–9 hours (ages 18–64), 7–8 hours (65+): [Canadian 24-Hour Movement Guidelines](https://csepguidelines.ca/guidelines/adults-18-64/).
- **Relative Fat Mass (RFM)** — Body fat % estimated from height and waist: `64 − 20 × (height / waist) [+ 12 if female]`: [Woolcott & Bergman, *Scientific Reports* 2018](https://www.nature.com/articles/s41598-018-29362-1).
- **Maintenance calories (TDEE)** — BMR from the [Mifflin-St Jeor equation](https://pubmed.ncbi.nlm.nih.gov/2305711/) (`10 × kg + 6.25 × cm − 5 × age + 5/−161`) multiplied by standard activity factors (1.2–1.9). When enough logged data exists, this is replaced by an estimate from actual intake and weight trend, using the ≈7,700 kcal/kg energy-to-weight convention ([Wishnofsky](https://pubmed.ncbi.nlm.nih.gov/13594881/)).
- **Protein target** — 0.8 g/kg body weight (RDA baseline): [Health Canada Dietary Reference Intakes](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html).


