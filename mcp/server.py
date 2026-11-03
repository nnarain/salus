"""MCP server for reading and logging Health Tracker data over streamable HTTP."""

import asyncio
import os
from datetime import date, datetime, timedelta
from statistics import mean
from typing import Any, Literal
from zoneinfo import ZoneInfo

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.environ.get("HEALTH_TRACKER_API_URL", "http://localhost:3000").rstrip("/")
TIMEZONE = ZoneInfo(os.environ.get("TZ", "UTC"))
KG_PER_LB = 0.45359237
KCAL_PER_KG = 7700
ACTIVITY_MULTIPLIERS = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "active": 1.725, "very_active": 1.9}

mcp = FastMCP(
    "health-tracker",
    instructions=(
        "Personal health tracker. Dates are YYYY-MM-DD; use get_current_date to resolve relative dates. "
            "Use edit_entry and delete_entry with the UUID returned by read tools to correct records. "
            "Nutrition accepts separate entries per day; mark incomplete days partial and uncertain values estimated. "
        "Weight is stored in kg. Use find_missing_data to spot gaps and ask the user to fill them. "
        "When logging from journal notes, put a short summary of the context (triggers, feelings) in notes."
    ),
    host=os.environ.get("MCP_HOST", "0.0.0.0"),
    port=int(os.environ.get("MCP_PORT", "8000")),
)


# --- API helpers ---------------------------------------------------------------

async def request(method: str, resource: str, body: dict | None = None) -> Any:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.request(method, f"{API_URL}/api/{resource}", json=body)
    if response.is_client_error:
        try:
            message = response.json().get("error")
        except ValueError:
            message = None
        raise ValueError(message or response.text)
    response.raise_for_status()
    return response.json()


async def fetch(resource: str) -> Any:
    return (await request("GET", resource))["data"]


async def post(resource: str, body: dict) -> Any:
    data = (await request("POST", resource, body))["data"]
    return data[0] if isinstance(data, list) and len(data) == 1 else data


async def load_all() -> dict[str, Any]:
    names = ["profile", "biometrics", "activities", "stress", "sleep", "nutrition"]
    results = await asyncio.gather(*(fetch(name) for name in names))
    return dict(zip(names, results))


# --- Date and math helpers ------------------------------------------------------

def today() -> date:
    return datetime.now(TIMEZONE).date()


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        raise ValueError(f"Invalid date '{value}', expected YYYY-MM-DD") from None


def window(start_date: str | None, end_date: str | None, default_days: int) -> tuple[date, date]:
    end = parse_date(end_date) if end_date else today()
    start = parse_date(start_date) if start_date else end - timedelta(days=max(default_days, 1) - 1)
    if start > end:
        raise ValueError("start_date must be on or before end_date")
    return start, end


def in_range(value: str, start: date | None, end: date | None) -> bool:
    day = parse_date(value)
    return (start is None or day >= start) and (end is None or day <= end)


def filter_range(rows: list[dict], field: str, start_date: str | None, end_date: str | None) -> list[dict]:
    start = parse_date(start_date) if start_date else None
    end = parse_date(end_date) if end_date else None
    return [row for row in rows if in_range(row[field], start, end)]


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def stats(values: list[float]) -> dict | None:
    if not values:
        return None
    return {"count": len(values), "average": round(mean(values), 2), "min": min(values), "max": max(values)}


def aggregate_nutrition(rows: list[dict]) -> list[dict]:
    days: dict[str, dict] = {}
    for row in rows:
        day = days.setdefault(row["date"], {
            "date": row["date"], "calories_kcal": None, "protein_grams": None, "water_ml": None,
            "estimated": False, "partial": False,
        })
        for field in ("calories_kcal", "protein_grams", "water_ml"):
            value = row.get(field)
            if value is not None:
                day[field] = (day[field] or 0) + float(value)
        day["estimated"] = day["estimated"] or bool(row.get("estimated", False))
        day["partial"] = day["partial"] or bool(row.get("partial", False))
    return [days[key] for key in sorted(days)]


def slope_per_day(points: list[tuple[date, float]]) -> float | None:
    """Least-squares slope of value per day; points must be sorted by date."""
    if len(points) < 2:
        return None
    xs = [(day - points[0][0]).days for day, _ in points]
    ys = [value for _, value in points]
    x_mean, y_mean = mean(xs), mean(ys)
    variance = sum((x - x_mean) ** 2 for x in xs)
    if variance == 0:
        return None
    return sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys)) / variance


def series(biometrics: list[dict], metric_type: str, start: date | None = None, end: date | None = None) -> list[tuple[date, float]]:
    points = {}
    for row in biometrics:
        if row["metric_type"] == metric_type and in_range(row["date"], start, end):
            points.setdefault(parse_date(row["date"]), float(row["value"]))
    return sorted(points.items())


def height_cm(profile: dict | None) -> float | None:
    if not profile or not profile.get("height") or not profile.get("height_unit"):
        return None
    factor = {"cm": 1, "inches": 2.54, "feet": 30.48}.get(profile["height_unit"])
    return float(profile["height"]) * factor if factor else None


def formula_maintenance(profile: dict | None, weight_kg: float | None) -> int | None:
    """Mifflin-St Jeor resting energy times activity multiplier, matching the app."""
    height = height_cm(profile)
    if not profile or not weight_kg or not height or (profile.get("age") or 0) < 18:
        return None
    if profile.get("biological_sex") not in ("male", "female") or profile.get("activity_level") not in ACTIVITY_MULTIPLIERS:
        return None
    sex_adjustment = 5 if profile["biological_sex"] == "male" else -161
    resting = 10 * weight_kg + 6.25 * height - 5 * profile["age"] + sex_adjustment
    return round(resting * ACTIVITY_MULTIPLIERS[profile["activity_level"]])


# --- Read tools -------------------------------------------------------------------

@mcp.tool()
async def get_current_date() -> dict:
    """Get today's date and weekday in the server's configured timezone."""
    now = today()
    return {"date": now.isoformat(), "weekday": now.strftime("%A"), "timezone": str(TIMEZONE)}


@mcp.tool()
async def get_profile() -> dict | None:
    """Get the user profile (height, age, biological sex, activity level, daily calorie target)."""
    return await fetch("profile")


@mcp.tool()
async def get_biometrics(
    metric_type: Literal["weight", "waistline", "body_fat_percentage", "visceral_fat_level", "muscle_mass"] | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Get biometric entries (weight and muscle mass in kg, waistline, body fat %), newest first. Dates inclusive."""
    rows = filter_range(await fetch("biometrics"), "date", start_date, end_date)
    return [row for row in rows if metric_type is None or row["metric_type"] == metric_type]


@mcp.tool()
async def get_activities(
    activity_type: Literal["strength", "cardio"] | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Get workout/activity entries (name, type, effort 1-10, duration minutes), newest first."""
    rows = filter_range(await fetch("activities"), "date", start_date, end_date)
    return [row for row in rows if activity_type is None or row["activity_type"] == activity_type]


@mcp.tool()
async def get_stress(start_date: str | None = None, end_date: str | None = None) -> list[dict]:
    """Get stress entries (level 1-10, higher is more stressed) with journal notes, newest first."""
    return filter_range(await fetch("stress"), "date", start_date, end_date)


@mcp.tool()
async def get_sleep(start_date: str | None = None, end_date: str | None = None) -> list[dict]:
    """Get sleep entries filtered by wake date (bedtime, wake time, duration minutes, restedness 1-5)."""
    return filter_range(await fetch("sleep"), "wake_date", start_date, end_date)


@mcp.tool()
async def get_nutrition(start_date: str | None = None, end_date: str | None = None) -> list[dict]:
    """Get daily nutrition entries (calories kcal, protein g, water ml), newest first."""
    return filter_range(await fetch("nutrition"), "date", start_date, end_date)


@mcp.tool()
async def get_summary(days: int = 7) -> dict:
    """Get averages across all tracked data for the last N days (including today)."""
    start, end = window(None, None, days)
    data = await load_all()
    biometrics = [r for r in data["biometrics"] if in_range(r["date"], start, end)]
    activities = [r for r in data["activities"] if in_range(r["date"], start, end)]
    stress = [r for r in data["stress"] if in_range(r["date"], start, end)]
    sleep = [r for r in data["sleep"] if in_range(r["wake_date"], start, end)]
    nutrition = aggregate_nutrition([r for r in data["nutrition"] if in_range(r["date"], start, end)])

    def metric(name: str) -> dict | None:
        return stats([float(r["value"]) for r in biometrics if r["metric_type"] == name])

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "weight_kg": metric("weight"),
        "waistline": metric("waistline"),
        "body_fat_percentage": metric("body_fat_percentage"),
        "activities": {
            "count": len(activities),
            "strength_count": sum(1 for r in activities if r["activity_type"] == "strength"),
            "cardio_count": sum(1 for r in activities if r["activity_type"] == "cardio"),
            "total_minutes": sum(r.get("duration_minutes") or 0 for r in activities),
            "effort_level": stats([float(r["effort_level"]) for r in activities]),
        },
        "stress_level": stats([float(r["stress_level"]) for r in stress]),
        "sleep_minutes": stats([float(r["sleep_duration_minutes"]) for r in sleep]),
        "restedness": stats([float(r["restedness"]) for r in sleep if r.get("restedness") is not None]),
        "calories_kcal": stats([float(r["calories_kcal"]) for r in nutrition
                     if r["calories_kcal"] is not None and not r["estimated"] and not r["partial"]]),
        "protein_grams": stats([float(r["protein_grams"]) for r in nutrition
                    if r["protein_grams"] is not None and not r["estimated"] and not r["partial"]]),
        "water_ml": stats([float(r["water_ml"]) for r in nutrition
                   if r["water_ml"] is not None and not r["estimated"] and not r["partial"]]),
    }


@mcp.tool()
async def find_missing_data(start_date: str | None = None, end_date: str | None = None) -> dict:
    """Find logging gaps so the user can be prompted to fill them in. Defaults to the last 28 days.

    Stress, sleep, and nutrition are expected daily. Weight, body fat, waistline, and activities
    are checked per week (weeks start Monday; listed by their Monday date).
    """
    start, end = window(start_date, end_date, 28)
    data = await load_all()
    all_days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    all_weeks = sorted({week_start(day) for day in all_days})

    def dates(rows: list[dict], field: str) -> set[date]:
        return {parse_date(row[field]) for row in rows}

    def daily(rows: list[dict], field: str) -> dict:
        logged = dates(rows, field)
        return {
            "cadence": "daily",
            "days_logged": sum(1 for day in all_days if day in logged),
            "days_expected": len(all_days),
            "missing_dates": [day.isoformat() for day in all_days if day not in logged],
            "last_logged": max(logged).isoformat() if logged else None,
        }

    def weekly(logged: set[date]) -> dict:
        logged_weeks = {week_start(day) for day in logged}
        return {
            "cadence": "weekly",
            "missing_weeks": [week.isoformat() for week in all_weeks if week not in logged_weeks],
            "last_logged": max(logged).isoformat() if logged else None,
        }

    def biometric_dates(metric_type: str) -> set[date]:
        return dates([r for r in data["biometrics"] if r["metric_type"] == metric_type], "date")

    profile = data["profile"] or {}
    missing_profile = [
        field for field in ("height", "age", "biological_sex", "activity_level", "daily_calorie_target")
        if profile.get(field) in (None, "")
    ]

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "stress": daily(data["stress"], "date"),
        "sleep": daily(data["sleep"], "wake_date"),
        "nutrition": daily([r for r in data["nutrition"] if not r.get("partial", False)], "date"),
        "weight": weekly(biometric_dates("weight")),
        "body_fat_percentage": weekly(biometric_dates("body_fat_percentage")),
        "waistline": weekly(biometric_dates("waistline")),
        "activities": weekly(dates(data["activities"], "date")),
        "missing_profile_fields": missing_profile,
    }


@mcp.tool()
async def get_body_composition_trend(weeks: int = 12) -> dict:
    """Analyse weight, body fat, and waist trends over the last N weeks.

    Returns weekly rate of change (linear fit), fat vs lean mass change from days with both weight
    and body fat logged, and the latest waist-to-height ratio (healthy below 0.5, high risk above 0.6).
    """
    start, end = window(None, None, weeks * 7)
    data = await load_all()
    weights = series(data["biometrics"], "weight", start, end)
    body_fat = series(data["biometrics"], "body_fat_percentage", start, end)

    result: dict[str, Any] = {"start_date": start.isoformat(), "end_date": end.isoformat()}

    weight_slope = slope_per_day(weights)
    result["weight"] = {
        "readings": len(weights),
        "first": {"date": weights[0][0].isoformat(), "kg": weights[0][1]} if weights else None,
        "latest": {"date": weights[-1][0].isoformat(), "kg": weights[-1][1]} if weights else None,
        "trend_kg_per_week": round(weight_slope * 7, 3) if weight_slope is not None else None,
        "trend_percent_bodyweight_per_week": (
            round(weight_slope * 7 / weights[-1][1] * 100, 2) if weight_slope is not None else None
        ),
    }

    fat_slope = slope_per_day(body_fat)
    result["body_fat_percentage"] = {
        "readings": len(body_fat),
        "latest": {"date": body_fat[-1][0].isoformat(), "percent": body_fat[-1][1]} if body_fat else None,
        "trend_points_per_week": round(fat_slope * 7, 3) if fat_slope is not None else None,
    }

    weight_by_day = dict(weights)
    paired = [(day, weight_by_day[day], pct) for day, pct in body_fat if day in weight_by_day]
    composition = None
    if len(paired) >= 2:
        (first_day, first_w, first_pct), (last_day, last_w, last_pct) = paired[0], paired[-1]
        fat_change = last_w * last_pct / 100 - first_w * first_pct / 100
        lean_change = (last_w - first_w) - fat_change
        composition = {
            "from": first_day.isoformat(),
            "to": last_day.isoformat(),
            "weight_change_kg": round(last_w - first_w, 2),
            "fat_mass_change_kg": round(fat_change, 2),
            "lean_mass_change_kg": round(lean_change, 2),
            "fat_share_of_weight_change": (
                round(fat_change / (last_w - first_w), 2) if abs(last_w - first_w) > 0.1 else None
            ),
        }
    result["composition_change"] = composition

    waists = series(data["biometrics"], "waistline")
    waist_rows = {parse_date(r["date"]): r for r in data["biometrics"] if r["metric_type"] == "waistline"}
    height = height_cm(data["profile"])
    if waists and height:
        day, value = waists[-1]
        waist_cm = value * 2.54 if waist_rows[day]["unit"] in ("inches", "in") else value
        result["waist_to_height_ratio"] = {"date": day.isoformat(), "ratio": round(waist_cm / height, 3)}
    else:
        result["waist_to_height_ratio"] = None

    return result


@mcp.tool()
async def get_energy_balance(days: int = 28) -> dict:
    """Compare calorie intake to estimated maintenance and actual weight change over the last N days.

    Maintenance is estimated from logged intake and weight trend when there is enough data
    (14+ days, 4+ weigh-ins, 70%+ of days with nutrition logged), otherwise from the profile formula.
    Use this to judge whether the current deficit/surplus and calorie target need adjusting.
    """
    start, end = window(None, None, days)
    data = await load_all()
    profile = data["profile"]
    nutrition_rows = [r for r in data["nutrition"] if in_range(r["date"], start, end)]
    nutrition = [r for r in aggregate_nutrition(nutrition_rows) if not r["estimated"] and not r["partial"]]
    weights = series(data["biometrics"], "weight", start, end)
    all_weights = series(data["biometrics"], "weight")
    latest_weight = all_weights[-1][1] if all_weights else None

    calorie_days = [r for r in nutrition if r["calories_kcal"] is not None]
    protein_days = [r for r in nutrition if r["protein_grams"] is not None]
    avg_calories = mean(float(r["calories_kcal"]) for r in calorie_days) if calorie_days else None
    avg_protein = mean(float(r["protein_grams"]) for r in protein_days) if protein_days else None
    weight_slope = slope_per_day(weights)

    from_history = None
    if calorie_days and len(weights) >= 4 and weight_slope is not None:
        first_evidence = max(min(parse_date(r["date"]) for r in calorie_days), weights[0][0])
        covered = (end - first_evidence).days + 1
        span = (weights[-1][0] - weights[0][0]).days
        if covered >= 14 and span >= 14 and len(calorie_days) / covered >= 0.7:
            estimate = round(avg_calories - weight_slope * KCAL_PER_KG)
            from_history = estimate if 500 <= estimate <= 8000 else None

    from_formula = formula_maintenance(profile, latest_weight)
    maintenance = from_history or from_formula
    target = (profile or {}).get("daily_calorie_target")

    def balance(intake: float | None) -> dict | None:
        if intake is None or maintenance is None:
            return None
        kcal = round(intake - maintenance)
        return {"kcal_per_day": kcal, "expected_kg_per_week": round(kcal * 7 / KCAL_PER_KG, 3)}

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "nutrition_days_logged": len(calorie_days),
        "nutrition_entries_logged": len(nutrition_rows),
        "average_calories_kcal": round(avg_calories) if avg_calories is not None else None,
        "average_protein_grams": round(avg_protein, 1) if avg_protein is not None else None,
        "average_protein_g_per_kg": (
            round(avg_protein / latest_weight, 2) if avg_protein is not None and latest_weight else None
        ),
        "latest_weight_kg": latest_weight,
        "maintenance_kcal": {
            "used": maintenance,
            "source": "logged_data" if from_history else ("formula" if from_formula else None),
            "from_logged_data": from_history,
            "from_formula": from_formula,
        },
        "daily_calorie_target": target,
        "actual_intake_balance": balance(avg_calories),
        "target_balance": balance(target),
        "actual_weight_trend_kg_per_week": round(weight_slope * 7, 3) if weight_slope is not None else None,
    }


# --- Write tools ------------------------------------------------------------------

@mcp.tool()
async def add_weigh_in(
    date: str,
    weight: float,
    weight_unit: Literal["kg", "lbs"] = "kg",
    body_fat_percentage: float | None = None,
    waistline: float | None = None,
    waistline_unit: Literal["cm", "inches"] = "cm",
    notes: str | None = None,
) -> list[dict]:
    """Log a scale weigh-in: weight plus optional body fat % and waistline for the same date."""
    day = parse_date(date).isoformat()
    entries = [{"metric_type": "weight", "value": weight, "unit": weight_unit}]
    if body_fat_percentage is not None:
        entries.append({"metric_type": "body_fat_percentage", "value": body_fat_percentage, "unit": "%"})
    if waistline is not None:
        entries.append({"metric_type": "waistline", "value": waistline, "unit": waistline_unit})
    return [await post("biometrics", {**entry, "date": day, "notes": notes}) for entry in entries]


@mcp.tool()
async def add_biometric(
    date: str,
    metric_type: Literal["weight", "waistline", "body_fat_percentage", "visceral_fat_level", "muscle_mass"],
    value: float,
    unit: Literal["kg", "lbs", "cm", "inches", "%", "level"],
    notes: str | None = None,
    scale_min: float | None = None,
    scale_max: float | None = None,
) -> dict:
    """Log a single biometric. Units: weight kg/lbs (stored as kg), muscle mass kg, waistline cm/inches, body fat %."""
    return await post("biometrics", {
        "date": parse_date(date).isoformat(), "metric_type": metric_type, "value": value, "unit": unit,
        "scale_min": scale_min, "scale_max": scale_max, "notes": notes,
    })


@mcp.tool()
async def add_activity(
    date: str,
    activity_name: str,
    activity_type: Literal["strength", "cardio"],
    effort_level: int,
    duration_minutes: int | None = None,
    notes: str | None = None,
) -> dict:
    """Log a workout or activity. effort_level is 1-10 (perceived exertion)."""
    return await post("activities", {
        "date": parse_date(date).isoformat(), "activity_name": activity_name, "activity_type": activity_type,
        "effort_level": effort_level, "duration_minutes": duration_minutes, "notes": notes,
    })


@mcp.tool()
async def add_stress(date: str, stress_level: int, notes: str | None = None) -> dict:
    """Log a stress rating (1 = very low, 10 = very high).

    Use notes for a brief journal summary: the situation, triggers, and how the user felt.
    """
    return await post("stress", {"date": parse_date(date).isoformat(), "stress_level": stress_level, "notes": notes})


@mcp.tool()
async def add_sleep(
    wake_date: str,
    bedtime: str,
    wake_time: str,
    restedness: int | None = None,
    sleep_duration_minutes: int | None = None,
    notes: str | None = None,
) -> dict:
    """Log a night of sleep, keyed by the date the user woke up.

    bedtime/wake_time are 24h HH:MM; rough estimates are fine. Duration defaults to the time
    between them; pass it explicitly if the user was awake for part of the night.
    restedness is 1 (exhausted) to 5 (fully rested).
    """
    if sleep_duration_minutes is None:
        bed = datetime.strptime(bedtime, "%H:%M")
        wake = datetime.strptime(wake_time, "%H:%M")
        sleep_duration_minutes = int((wake - bed).total_seconds() // 60) % 1440 or 1440
    return await post("sleep", {
        "wake_date": parse_date(wake_date).isoformat(), "bedtime": bedtime, "wake_time": wake_time,
        "sleep_duration_minutes": sleep_duration_minutes, "restedness": restedness, "notes": notes,
    })


@mcp.tool()
async def add_nutrition(
    date: str,
    calories_kcal: int | None = None,
    protein_grams: float | None = None,
    water_ml: int | None = None,
    estimated: bool = False,
    partial: bool = False,
    notes: str | None = None,
) -> dict:
    """Add a nutrition entry; any metric may be omitted, but at least one is required.

    Entries on the same date are summed in daily summaries. Mark estimated values and incomplete
    days explicitly. Use notes to describe the meal or what remains unknown.
    """
    if calories_kcal is None and protein_grams is None and water_ml is None:
        raise ValueError("At least one of calories_kcal, protein_grams, or water_ml is required")
    return await post("nutrition", {
        "date": parse_date(date).isoformat(), "calories_kcal": calories_kcal,
        "protein_grams": protein_grams, "water_ml": water_ml, "estimated": estimated,
        "partial": partial, "notes": notes,
    })


@mcp.tool()
async def edit_entry(
    resource: Literal["activities", "biometrics", "nutrition", "sleep", "stress"],
    entry_id: str,
    changes: dict[str, Any],
) -> dict:
    """Edit an existing entry by UUID. Use the id field returned by its get tool."""
    return (await request("PATCH", f"{resource}/{entry_id}", changes))["data"]


@mcp.tool()
async def delete_entry(
    resource: Literal["activities", "biometrics", "nutrition", "sleep", "stress"],
    entry_id: str,
) -> dict:
    """Permanently delete an existing entry by UUID. Use the id returned by its get tool."""
    return (await request("DELETE", f"{resource}/{entry_id}"))["data"]


@mcp.tool()
async def update_profile(
    height: float | None = None,
    height_unit: Literal["cm", "inches", "feet"] | None = None,
    age: int | None = None,
    biological_sex: Literal["male", "female"] | None = None,
    activity_level: Literal["sedentary", "light", "moderate", "active", "very_active"] | None = None,
    daily_calorie_target: int | None = None,
    notes: str | None = None,
) -> dict:
    """Update profile fields. Only the fields passed are changed; others keep their current values."""
    current = await fetch("profile") or {}
    updates = {
        "height": height, "height_unit": height_unit, "age": age, "biological_sex": biological_sex,
        "activity_level": activity_level, "daily_calorie_target": daily_calorie_target, "notes": notes,
    }
    body = {key: value if value is not None else current.get(key) for key, value in updates.items()}
    return await post("profile", {key: value for key, value in body.items() if value is not None})


@mcp.tool()
async def import_csv(data_type: Literal["biometric", "activity", "stress"], csv_data: str) -> dict:
    """Bulk import rows from CSV text (e.g. a pasted spreadsheet). Header rows:
    biometric: date,metric_type,value,unit,notes
    activity: date,activity_name,activity_type,effort_level,duration_minutes,notes
    stress: date,stress_level,notes
    Commas inside values are not supported. Returns imported/skipped counts and errors.
    """
    return await request("POST", "import", {"dataType": data_type, "csvData": csv_data})


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
