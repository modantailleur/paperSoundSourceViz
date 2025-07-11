from PIL import Image, ImageDraw
import pandas as pd

# Load image
img_path = "./find_colors/color_card.jpg"
image = Image.open(img_path).convert("RGB")

# Make a copy to draw crosses
image_drawable = image.copy()
draw = ImageDraw.Draw(image_drawable)

# Constants for grid layout
cell_width = 100
cell_height = 100
offset_x = 42
offset_y = 48

columns = [chr(i) for i in range(ord('A'), ord('T') + 1)]  # A–T
rows = range(5)

# Extract and mark colors
color_data = []

for row_idx in rows:
    for col_idx, col_letter in enumerate(columns):
        cell_id = f"{col_letter}{row_idx}"
        x = offset_x + col_idx * cell_width + cell_width // 2
        y = offset_y + row_idx * cell_height + cell_height // 2

        # Get RGB and set alpha = 255
        r, g, b = image.getpixel((x, y))
        a = 255

        # Store RGBA
        color_data.append({
            "Cell": cell_id,
            "R": r,
            "G": g,
            "B": b,
            "A": a
        })

        # Draw a red cross at (x, y)
        cross_len = 5
        draw.line((x - cross_len, y, x + cross_len, y), fill=(255, 0, 0), width=1)
        draw.line((x, y - cross_len, x, y + cross_len), fill=(255, 0, 0), width=1)

# Save marked image
image_drawable.save("./find_colors/color_card_with_crosses.jpg")

# Save CSV with RGBA
df_rgba = pd.DataFrame(color_data)
df_rgba.to_csv("./find_colors/Extracted_Cell_Colors_RGBA.csv", index=False)
