import math

def compute_rose_size_meters(zoom, latitude=0, desired_pixel_width=40):
    meters_per_pixel = 156543.03392 * math.cos(latitude * math.pi / 180) / (2 ** zoom)
    return meters_per_pixel * desired_pixel_width

def zoom_to_zoom_level(zoom):
    if zoom < 14:
        return 0
    if zoom < 15:
        return 1
    if zoom < 16:
        return 2
    if zoom < 17:
        return 3
    return 4  # Default case if zoom doesn't match

ZOOM_LEVEL_TO_ROSES_SIZE = {
    0: compute_rose_size_meters(15),
    1: compute_rose_size_meters(15),
    2: compute_rose_size_meters(16),
    3: compute_rose_size_meters(17),
    4: compute_rose_size_meters(18),
}