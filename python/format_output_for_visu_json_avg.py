import json
import pandas as pd
import os
import argparse
from datetime import datetime
from pytz import timezone

def main(args):
    # File paths
    input_file = "./data/json/soundscape_data.json"
    
    filename_parts = [
        "soundscape_data_avg",
        f"start_{args.start_time}",
        f"end_{args.end_time}"
    ]

    if args.daytime_period is not None:
        filename_parts.append(args.daytime_period)
    
    if args.weektime_period is not None:
        filename_parts.append(args.weektime_period)

    output_file = "./data/json/" + "_".join(filename_parts) + ".json"

    # Convert start_time and end_time to datetime objects
    tz = timezone("Europe/Paris")  # UTC+1 timezone
    start_datetime = tz.localize(datetime.strptime(args.start_time, "%Y-%m-%d"))
    end_datetime = tz.localize(datetime.strptime(args.end_time, "%Y-%m-%d"))

    # Load JSON data
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Initialize processed data
    processed_data = {}

    # Process data for each sensor
    for sensor, sensor_data in data.items():
        if "presence" not in sensor_data:
            continue
        
        # Extract presence data
        df = pd.DataFrame(sensor_data["presence"])
        
        # Ensure required columns exist
        if not {"epoch", "leq", "laeq", "t", "v", "b"}.issubset(df.columns):
            continue  # Skip if missing data
        
        # Convert epoch to datetime and filter data within range
        df["datetime"] = pd.to_datetime(df["epoch"], unit="s").dt.tz_localize("UTC").dt.tz_convert(tz)
        df = df[(df["datetime"] >= start_datetime) & (df["datetime"] < end_datetime)]
        
        if df.empty:
            continue  # Skip sensors with no data in range

        # Apply weektime filtering if specified
        if args.weektime_period is not None:
            if args.weektime_period == "workday":
                df = df[df["datetime"].dt.weekday < 5]  # Monday (0) to Friday (4)
            elif args.weektime_period == "saturday":
                df = df[df["datetime"].dt.weekday == 5]  # Saturday only

            if df.empty:
                continue  # Skip sensors if no data remains after filtering

        # Apply day/night filtering if specified
        if args.daytime_period is not None:
            if args.daytime_period == "day":
                df = df[(df["datetime"].dt.hour >= 6) & (df["datetime"].dt.hour < 18)]
            elif args.daytime_period == "night":
                df = df[(df["datetime"].dt.hour < 6) | (df["datetime"].dt.hour >= 18)]
            
            if df.empty:
                continue  # Skip sensors if no data remains after filtering

        # Normalize leq and laeq values for visualization (between 0 and 1)
        min_laeq = 40
        max_laeq = 100
        df["leq"] = (df["leq"] - min_laeq) / (max_laeq - min_laeq)
        df["laeq"] = (df["laeq"] - min_laeq) / (max_laeq - min_laeq)
        df["leq"] = df["leq"].clip(lower=0, upper=1)
        df["laeq"] = df["laeq"].clip(lower=0, upper=1)

        # Compute mean values for the presence data over the whole period
        avg_values = df[["leq", "laeq", "t", "v", "b"]].mean().to_dict()
        
        # Store in processed data
        processed_data[sensor] = {
            "location": sensor_data.get("location", {}),
            "presence": avg_values
        }

    # Save processed data to JSON
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(processed_data, f, indent=4)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process soundscape data.")
    parser.add_argument("start_time", type=str, help="Start time in YYYY-MM-DD format")
    parser.add_argument("end_time", type=str, help="End time in YYYY-MM-DD format")
    parser.add_argument("--daytime_period", type=str, choices=["day", "night"], default=None, help="Optional: Filter by 'day' (6 AM - 6 PM) or 'night' (6 PM - 6 AM)")
    parser.add_argument("--weektime_period", type=str, choices=["workday", "saturday"], default=None, help="Optional: Filter by 'workday' (Mon-Fri) or 'saturday'")
    args = parser.parse_args()

    main(args)
