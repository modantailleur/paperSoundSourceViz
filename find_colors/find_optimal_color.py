import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import numpy as np
from itertools import product
from matplotlib.patches import Wedge
from skimage.color import rgb2lab

def rgb_distance(rgba1, rgba2):
    """
    Computes Euclidean distance between two RGBA colors in RGB space (0–255).
    Inputs:
        rgba1, rgba2: (R, G, B, A) tuples with values in 0–255
    Returns:
        Euclidean distance in RGB space (ignores alpha)
    """
    rgb1 = np.array(rgba1[:3], dtype=np.float32)
    rgb2 = np.array(rgba2[:3], dtype=np.float32)
    return np.linalg.norm(rgb1 - rgb2)


def lab_distance(rgba1, rgba2):
    """
    Computes Euclidean distance (CIE76) between two RGBA colors in CIE Lab space.
    Inputs:
        rgba1, rgba2: (R, G, B, A) tuples with values in 0–255
    Returns:
        Euclidean distance in Lab space
    """
    # Convert to [0,1] and drop alpha
    rgb1 = np.array(rgba1[:3], dtype=np.float32) / 255.0
    rgb2 = np.array(rgba2[:3], dtype=np.float32) / 255.0

    # Reshape for rgb2lab (expects shape (M, N, 3))
    rgb1 = rgb1.reshape((1, 1, 3))
    rgb2 = rgb2.reshape((1, 1, 3))

    lab1 = rgb2lab(rgb1)[0, 0, :]
    lab2 = rgb2lab(rgb2)[0, 0, :]

    return np.linalg.norm(lab1 - lab2)

def rgba_distance(c1, c2, include_alpha=False, premultiply_alpha=False):
    if premultiply_alpha:
        r1, g1, b1 = [c1[i] * c1[3] / 255 for i in range(3)]
        r2, g2, b2 = [c2[i] * c2[3] / 255 for i in range(3)]
    else:
        r1, g1, b1 = c1[:3]
        r2, g2, b2 = c2[:3]
    dist = np.sqrt((r2 - r1)**2 + (g2 - g1)**2 + (b2 - b1)**2)
    if include_alpha:
        dist += (c2[3] - c1[3])**2
    return dist

def order_colors_by_proximity(df_top, include_alpha=False, premultiply_alpha=False):
    colors_rgba = list(zip(df_top["R"], df_top["G"], df_top["B"], df_top["A"]))
    black = (0, 0, 0, 255)
    start_index = min(range(len(colors_rgba)),
                      key=lambda i: lab_distance(colors_rgba[i], black))
    indices = list(range(len(colors_rgba)))
    indices.remove(start_index)
    ordered = [start_index]
    while indices:
        last_color = colors_rgba[ordered[-1]]
        next_index = min(indices, key=lambda i: lab_distance(last_color, colors_rgba[i]))
        ordered.append(next_index)
        indices.remove(next_index)
    return df_top.iloc[ordered].reset_index(drop=True)

def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rgba_to_cie_ucs(rgba):
    r_lin = srgb_to_linear(rgba[0])
    g_lin = srgb_to_linear(rgba[1])
    b_lin = srgb_to_linear(rgba[2])
    
    # sRGB to XYZ (D65)
    X = 0.4124 * r_lin + 0.3576 * g_lin + 0.1805 * b_lin
    Y = 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin
    Z = 0.0193 * r_lin + 0.1192 * g_lin + 0.9505 * b_lin

    denom = (X + 15 * Y + 3 * Z)
    if denom == 0:
        return (0, 0)
    u_prime = 4 * X / denom
    v_prime = 9 * Y / denom
    return (u_prime, v_prime)

def cie_distance(color1, color2):
    """
    Compute the chromatic distance between two RGBA colors in CIE 1976 UCS (u′, v′) space.
    Inputs:
        color1, color2: tuples of (R, G, B, A)
    Returns:
        Euclidean distance between the chromaticities
    """
    u1, v1 = rgba_to_cie_ucs(color1)
    u2, v2 = rgba_to_cie_ucs(color2)
    return np.sqrt((u2 - u1)**2 + (v2 - v1)**2)

def is_far_from_all_greys(rgba, min_distance=0.06):
    u1, v1 = rgba_to_cie_ucs(rgba)
    
    for i in range(256):
        grey = (i, i, i, 255)
        u2, v2 = rgba_to_cie_ucs(grey)
        dist = np.sqrt((u2 - u1)**2 + (v2 - v1)**2)
        if dist <= min_distance:
            print(f"{rgba} too close to grey: {grey} (distance: {dist})")
            return False  # Too close to some grey
    return True  # Far from all greys

def get_cie_uv(color):
    """
    Convert an (R, G, B) color to CIE 1976 UCS (u', v') chromaticity coordinates.
    """
    r, g, b = color
    return rgba_to_cie_ucs((r, g, b, 255))  # Full opacity

def get_lab(color):
    rgb = np.array(color[:3], dtype=np.float32) / 255.0
    rgb = rgb.reshape((1, 1, 3))
    return rgb2lab(rgb)[0, 0, :]

def filter_far_from_mean_lab(df, max_distance=30.0):
    # Weighted average RGB
    weights = df["Percentage"].values / 100
    avg_r = np.average(df["R"], weights=weights)
    avg_g = np.average(df["G"], weights=weights)
    avg_b = np.average(df["B"], weights=weights)
    avg_lab = get_lab((avg_r, avg_g, avg_b))

    def is_close(row):
        color_lab = get_lab((row["R"], row["G"], row["B"]))
        return np.linalg.norm(color_lab - avg_lab) <= max_distance

    return df[df.apply(is_close, axis=1)].copy()

def filter_far_from_mean_lab_percentile(df, percentile=25):
    weights = df["Percentage"].values / 100
    avg_r = np.average(df["R"], weights=weights)
    avg_g = np.average(df["G"], weights=weights)
    avg_b = np.average(df["B"], weights=weights)
    avg_lab = get_lab((avg_r, avg_g, avg_b))

    df["DistToMean"] = df.apply(
        lambda row: np.linalg.norm(get_lab((row["R"], row["G"], row["B"])) - avg_lab),
        axis=1
    )
    threshold = np.percentile(df["DistToMean"], percentile)
    return df[df["DistToMean"] <= threshold].copy()

def filter_far_from_mean_lab_stddev(df, max_sigma=1.0):
    weights = df["Percentage"].values / 100
    avg_r = np.average(df["R"], weights=weights)
    avg_g = np.average(df["G"], weights=weights)
    avg_b = np.average(df["B"], weights=weights)
    avg_lab = get_lab((avg_r, avg_g, avg_b))

    distances = df.apply(
        lambda row: np.linalg.norm(get_lab((row["R"], row["G"], row["B"])) - avg_lab),
        axis=1
    )
    weighted_mean_dist = np.average(distances, weights=weights)
    weighted_var = np.average((distances - weighted_mean_dist) ** 2, weights=weights)
    weighted_std = np.sqrt(weighted_var)

    df["DistToMean"] = distances
    return df[df["DistToMean"] <= weighted_mean_dist + max_sigma * weighted_std].copy()

def filter_far_from_mean_cie_stddev(df, max_sigma=1.0):
    weights = df["Percentage"].values / 100
    avg_r = np.average(df["R"], weights=weights)
    avg_g = np.average(df["G"], weights=weights)
    avg_b = np.average(df["B"], weights=weights)
    avg_u, avg_v = get_cie_uv((avg_r, avg_g, avg_b))
    avg_uv = np.array([avg_u, avg_v])

    def color_uv(row):
        u, v = get_cie_uv((row["R"], row["G"], row["B"]))
        return np.array([u, v])

    distances = df.apply(lambda row: np.linalg.norm(color_uv(row) - avg_uv), axis=1)
    weighted_mean_dist = np.average(distances, weights=weights)
    weighted_var = np.average((distances - weighted_mean_dist) ** 2, weights=weights)
    weighted_std = np.sqrt(weighted_var)

    df["DistToMean"] = distances
    return df[df["DistToMean"] <= weighted_mean_dist + max_sigma * weighted_std].copy()

def filter_far_from_mean_rgb_stddev(df, max_sigma=1.0):
    """
    Removes colors that are too far from the weighted average RGB color,
    using standard deviation thresholding in RGB space.

    Parameters:
        df: DataFrame with columns R, G, B, Percentage
        max_sigma: threshold in terms of standard deviations

    Returns:
        Filtered DataFrame
    """
    weights = df["Percentage"].values / 100
    avg_r = np.average(df["R"], weights=weights)
    avg_g = np.average(df["G"], weights=weights)
    avg_b = np.average(df["B"], weights=weights)
    avg_rgb = np.array([avg_r, avg_g, avg_b])

    def color_rgb(row):
        return np.array([row["R"], row["G"], row["B"]])

    distances = df.apply(lambda row: np.linalg.norm(color_rgb(row) - avg_rgb), axis=1)
    weighted_mean_dist = np.average(distances, weights=weights)
    weighted_var = np.average((distances - weighted_mean_dist) ** 2, weights=weights)
    weighted_std = np.sqrt(weighted_var)

    df["DistToMean"] = distances
    return df[df["DistToMean"] <= weighted_mean_dist + max_sigma * weighted_std].copy()

def plot_all_pie_charts_and_best_colors(column_counts_dict, best_combo, column_order):
    gap = 0.05               # Gap between pie chart and color block
    gap_title_pie = 0.03     # Gap between title and pie chart
    fontsize = 22
    n = len(column_order)

    label_width = 0.07       # horizontal space for "Final choice"
    available_width = 1.0 - label_width
    circle_width = available_width / n
    circle_height = circle_width

    # Color block position and height
    bottom_color = 0.4
    height_color = 0.05
    bottom_pie = bottom_color + height_color + gap

    # 🔧 Dynamically compute total layout height
    total_height = bottom_pie + circle_height + gap_title_pie
    fig = plt.figure(figsize=(n * 3, total_height * 10))  # 10 = scale factor (inches per unit height)

    for i, col in enumerate(column_order):
        left = label_width + i * circle_width
        left_pie_only = i * circle_width  # for centering titles

        # Prepare data
        counts_df = column_counts_dict[col]
        df = counts_df[counts_df["Percentage"] > 2].copy()
        df = df.sort_values(by="Percentage", ascending=False).reset_index(drop=True)
        df_top = order_colors_by_proximity(df)

        top_total = df_top["Percentage"].sum()
        remainder = 100 - top_total
        percentages = df_top["Percentage"].tolist()
        if remainder > 0:
            percentages.append(remainder)

        colors = [(r / 255, g / 255, b / 255, a / 255)
                  for r, g, b, a in zip(df_top["R"], df_top["G"], df_top["B"], df_top["A"])]
        if remainder > 0:
            colors.append("white")

        # === Pie chart ===
        ax = fig.add_axes([left, bottom_pie, circle_width, circle_height])
        ax.set_xlim(-1, 1)
        ax.set_ylim(-1, 1)
        ax.set_aspect('equal')
        ax.axis('off')

        start_angle = 90
        for idx, (pct, color) in enumerate(zip(percentages, colors)):
            end_angle = start_angle - pct * 360 / 100
            wedge = Wedge(
                center=(0, 0), r=1.0,
                theta1=end_angle, theta2=start_angle,
                facecolor=color,
                edgecolor=color,
                linewidth=0
            )
            if remainder > 0 and idx == len(percentages) - 1:
                wedge.set_hatch("//")
                wedge.set_edgecolor("gray")
                wedge.set_linewidth(0.5)
            ax.add_artist(wedge)
            start_angle = end_angle

        # === Color block ===
        ax_color = fig.add_axes([
            left + 0.2 * circle_width,
            bottom_color,
            0.6 * circle_width,
            height_color
        ])
        rgba_norm = tuple(c / 255 for c in best_combo[i][:4])
        ax_color.axis('off')
        ax_color.add_patch(Rectangle((0, 0), 1, 1, facecolor=rgba_norm))
        ax_color.add_patch(Rectangle((0, 0), 1, 1, facecolor='none', edgecolor='black', linewidth=0.5))

        # === Title above pie chart ===
        fig.text(
            label_width + left_pie_only + circle_width / 2,
            bottom_pie + circle_height + gap_title_pie,
            col,
            ha='center',
            va='bottom',
            fontsize=fontsize,
            fontname='Times New Roman',
            fontweight='normal'
        )

    # === Final choice label ===
    ax_label = fig.add_axes([0, bottom_color, label_width, height_color])
    ax_label.axis('off')
    ax_label.text(
        1.0, 0.5, "Chosen\ncolor:",
        fontsize=fontsize,
        fontname='Times New Roman',
        fontweight='normal',
        ha='center',
        va='center'
    )

    # ✅ Save cropped to content with slight padding to avoid clipping
    fig.savefig("./find_colors/FIG_color_pie_charts.pdf", bbox_inches='tight', pad_inches=0.05)

# === Load Data ===

file_path = '/home/user/Documents/Thèse/Code/8-SoundscapeVisu/find_colors/Couleur vs Perception Sonore.xlsx'
color_file_path = './find_colors/Extracted_Cell_Colors_RGBA.csv'

df = pd.read_excel(file_path)
df_colors = pd.read_csv(color_file_path)
df_colors['Cell'] = df_colors['Cell'].str.lower()
df = df[[col for col in df.columns if col.startswith("Avec")]]

df.columns = [
    "Road Traffic Presence" if "routière" in col.lower() else 
    "Human Presence" if "humaine" in col.lower() else 
    "Nature Presence" if "nature" in col.lower() else col
    for col in df.columns
]
df = df[["Road Traffic Presence", "Human Presence", "Nature Presence"]]

column_counts_dict = {}
for col in df.columns:
    counts = df[col].str.lower().str.split('[;,. ]').explode().value_counts()
    counts = counts[counts.index.str.strip() != ""]
    counts = 100 * (counts / counts.sum())
    counts_df = counts.reset_index()
    counts_df.columns = ['Cell', 'Percentage']
    counts_df = counts_df.merge(df_colors, on='Cell', how='left')
    counts_df = counts_df.dropna()
    column_counts_dict[col] = counts_df

# === Compute Best Color Combination ===

MIN_DIST_TO_BLACK_WHITE = 0.06
top_colors_per_column = {}
for col, df in column_counts_dict.items():
    df_filtered = df[
        df.apply(lambda row: is_far_from_all_greys((row["R"], row["G"], row["B"], row["A"]),
                                                   min_distance=MIN_DIST_TO_BLACK_WHITE), axis=1)
    ]
    
    # 🚫 Remove colors far from average in Lab space
    df_filtered = filter_far_from_mean_rgb_stddev(df_filtered)
    
    top_df = df_filtered.sort_values(by="Percentage", ascending=False).head(10).copy()
    top_colors_per_column[col] = top_df.reset_index(drop=True)

# top_colors_per_column = {}
# for col, df in column_counts_dict.items():
#     df_filtered = df[
#         df.apply(lambda row: is_far_from_all_greys((row["R"], row["G"], row["B"], row["A"]),
#                                                      min_distance=MIN_DIST_TO_BLACK_WHITE), axis=1)
#     ]
#     top_df = df_filtered.sort_values(by="Percentage", ascending=False).head(10).copy()
#     top_colors_per_column[col] = top_df.reset_index(drop=True)

columns = list(top_colors_per_column.keys())
color_options = [
    top_colors_per_column[col][["R", "G", "B", "A", "Percentage"]].values
    for col in columns
]
all_combinations = list(product(*color_options))

def combination_weighted_min_distance(combo):
    min_weighted_dist = float("inf")
    for i, c1 in enumerate(combo):
        for j, c2 in enumerate(combo):
            if i < j:
                rgba1, p1 = c1[:4], c1[4]
                rgba2, p2 = c2[:4], c2[4]
                dist = rgb_distance(rgba1, rgba2)
                weight = (p1 * p2) / (100*100)
                weighted_dist = dist * weight
                min_weighted_dist = min(min_weighted_dist, weighted_dist)
    return min_weighted_dist

best_combo = max(all_combinations, key=combination_weighted_min_distance)

# def combination_weighted_min_distance(combo, color_options, columns):
#     sum_weighted_dist = 0

#     for i, (r1, g1, b1, a1, p1) in enumerate(combo):
#         rgba1 = (r1, g1, b1, a1)
#         other_indices = [j for j in range(len(columns)) if j != i]
#         for j in other_indices:
#             other_colors = color_options[j]
#             for r2, g2, b2, a2, p2 in other_colors:
#                 rgba2 = (r2, g2, b2, a2)
#                 dist = lab_distance(rgba1, rgba2)
#                 weighted_dist = dist * (p1 * p2) / (100 * 100)
#                 sum_weighted_dist = sum_weighted_dist + weighted_dist

#     return sum_weighted_dist

# best_combo = max(
#     all_combinations,
#     key=lambda combo: combination_weighted_min_distance(combo, color_options, columns)
# )

# === Final Plot ===

plot_all_pie_charts_and_best_colors(column_counts_dict, best_combo, column_order=columns)
