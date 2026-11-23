#!/usr/bin/env python3
"""
Generates official Chrome Web Store graphic assets:
1. Small promo tile (440x280 px)
2. Store showcase screenshot banner (1280x800 px)
"""

from PIL import Image, ImageDraw, ImageFont
import os

docs_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Generate Promo Tile (440x280)
w, h = 440, 280
img_promo = Image.new('RGB', (w, h), color=(5, 7, 10))
draw = ImageDraw.Draw(img_promo)

# Draw subtle grid lines
for x in range(0, w, 20):
    draw.line([(x, 0), (x, h)], fill=(16, 26, 38))
for y in range(0, h, 20):
    draw.line([(0, y), (w, y)], fill=(16, 26, 38))

# Outer glowing border
draw.rectangle([(1, 1), (w-2, h-2)], outline=(0, 229, 255), width=2)

# Central glowing beacon
cx, cy = w // 2, 85
for r in range(35, 5, -5):
    alpha = int(255 * (1 - r/35))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 229, 255))
draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(0, 245, 155))

# Text
draw.text((cx, 150), "FOCUS//REVENUE", fill=(255, 255, 255), anchor="mm")
draw.text((cx, 180), "THE REVENUE SHIELD", fill=(0, 229, 255), anchor="mm")
draw.text((cx, 210), "Block distractions until revenue hits Stripe", fill=(122, 139, 158), anchor="mm")
draw.text((cx, 245), "STARLINK HUD // MANIFEST V3", fill=(0, 245, 155), anchor="mm")

promo_path = os.path.join(docs_dir, 'promo_marquee_440x280.png')
img_promo.save(promo_path)
print(f"Generated: {promo_path}")

# 2. Generate Store Screenshot (1280x800)
sw, sh = 1280, 800
img_shot = Image.new('RGB', (sw, sh), color=(5, 7, 10))
draw_shot = ImageDraw.Draw(img_shot)

for x in range(0, sw, 40):
    draw_shot.line([(x, 0), (x, sh)], fill=(16, 26, 38))
for y in range(0, sh, 40):
    draw_shot.line([(0, y), (sw, y)], fill=(16, 26, 38))

# Header simulation
draw_shot.rectangle([(60, 50), (sw - 60, 130)], fill=(10, 14, 22), outline=(0, 229, 255), width=1)
draw_shot.text((90, 80), "FOCUS//REVENUE MISSION CONTROL", fill=(255, 255, 255), anchor="lm")
draw_shot.text((90, 105), "TELEMETRÍA EN TIEMPO REAL · ESTADO: ESCUDO ACTIVO", fill=(0, 229, 255), anchor="lm")
draw_shot.text((sw - 100, 90), "STRIPE LIVE CONNECTED", fill=(0, 245, 155), anchor="rm")

# Card 1: Goal Progress
draw_shot.rectangle([(60, 160), (sw // 2 - 20, 460)], fill=(10, 14, 22), outline=(22, 34, 50), width=1)
draw_shot.text((90, 190), "META DIARIA DE FACTURACIÓN // PROGRESS", fill=(0, 229, 255), anchor="lm")
draw_shot.text((90, 250), "0.00 € / 200.00 €", fill=(255, 255, 255), anchor="lm")
# Progress Bar
draw_shot.rectangle([(90, 310), (sw // 2 - 50, 325)], fill=(20, 30, 45), outline=(0, 229, 255), width=1)
draw_shot.rectangle([(90, 310), (90 + 200, 325)], fill=(0, 245, 155))
draw_shot.text((90, 370), "DELTA RESTANTE: 200.00 € PARA DESACTIVAR ESCUDO", fill=(255, 170, 0), anchor="lm")

# Card 2: Gateways
draw_shot.rectangle([(sw // 2 + 20, 160), (sw - 60, 460)], fill=(10, 14, 22), outline=(22, 34, 50), width=1)
draw_shot.text((sw // 2 + 50, 190), "PASARELAS CONECTADAS // AUDITORÍA 15 MIN", fill=(0, 229, 255), anchor="lm")
draw_shot.text((sw // 2 + 50, 250), "STRIPE API (RESTRICTED KEY)  ● ONLINE", fill=(0, 245, 155), anchor="lm")
draw_shot.text((sw // 2 + 50, 310), "PAYPAL REST API              ● STANDBY", fill=(122, 139, 158), anchor="lm")
draw_shot.text((sw // 2 + 50, 370), "CERO ACCESO A DATOS DE COMPRADORES (ZERO-PII)", fill=(0, 229, 255), anchor="lm")

# Card 3: Commercial Model & Commitment
draw_shot.rectangle([(60, 490), (sw - 60, 740)], fill=(10, 14, 22), outline=(0, 229, 255), width=1)
draw_shot.text((90, 525), "MODELO COMERCIAL // COMPROMISO PROACTIVO (SKIN IN THE GAME)", fill=(255, 170, 0), anchor="lm")
draw_shot.text((90, 580), "COMPROMISO SELECCIONADO: 9.99 € / DÍA O 49.99 € / SEMANA", fill=(255, 255, 255), anchor="lm")
draw_shot.text((90, 630), "CUOTA POR ÉXITO (3%): SOLO CUANDO FACTURAS REALMENTE", fill=(0, 229, 255), anchor="lm")
draw_shot.text((90, 680), "PASARELA OFICIAL: STRIPE CHECKOUT (buy.stripe.com/6oUcN50Xyfty6s83OVb3q05)", fill=(0, 245, 155), anchor="lm")

shot_path = os.path.join(docs_dir, 'screenshot_1280x800.png')
img_shot.save(shot_path)
print(f"Generated: {shot_path}")
