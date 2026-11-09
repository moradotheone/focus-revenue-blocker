import os
from PIL import Image, ImageDraw

def create_icon(size, output_path):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer circle with gradient-like indigo background
    padding = max(1, int(size * 0.06))
    bbox = [padding, padding, size - padding, size - padding]
    
    # Rounded badge background
    corner_radius = int(size * 0.22)
    draw.rounded_rectangle(bbox, radius=corner_radius, fill=(79, 70, 229, 255)) # Indigo 600
    
    # Inner shield / focus target outline
    center = size // 2
    r_outer = int(size * 0.32)
    r_inner = int(size * 0.18)
    line_w = max(1, int(size * 0.07))
    
    # Outer focus ring
    draw.ellipse([center - r_outer, center - r_outer, center + r_outer, center + r_outer], 
                 outline=(255, 255, 255, 230), width=line_w)
    
    # Center bullseye / euro/dollar symbol representation
    draw.ellipse([center - r_inner, center - r_inner, center + r_inner, center + r_inner], 
                 fill=(250, 204, 21, 255)) # Gold / Amber 400
    
    img.save(output_path, 'PNG')
    print(f"Generated {output_path} ({size}x{size})")

out_dir = '/Users/moradotheone/.gemini/antigravity/scratch/focus-revenue-blocker/icons'
os.makedirs(out_dir, exist_ok=True)
create_icon(16, f'{out_dir}/icon16.png')
create_icon(32, f'{out_dir}/icon32.png')
create_icon(48, f'{out_dir}/icon48.png')
create_icon(128, f'{out_dir}/icon128.png')
