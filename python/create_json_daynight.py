import subprocess

# Define the scripts and arguments
scripts = [
    "python/format_output_for_visu_json_avg.py",
    "python/format_output_for_visu_json_dow.py",
    "python/format_output_for_visu_json_tod_60min.py"
]

start_time = "2020-01-01"
end_time = "2020-05-11"
daytime_period = "day"

# Launch each script with the specified arguments
for script in scripts:
    print(script)
    subprocess.run(["python3", script, start_time, end_time, "--daytime_period", daytime_period])

daytime_period = "night"

# Launch each script with the specified arguments
for script in scripts:
    print(script)
    subprocess.run(["python3", script, start_time, end_time, "--daytime_period", daytime_period])
