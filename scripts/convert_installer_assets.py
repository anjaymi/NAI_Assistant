from PIL import Image, ImageOps
import os

source_dialog = r"C:\Users\anjaymi\.gemini\antigravity\brain\a758a62c-734c-4cfa-942e-11cf0a772441\installer_dialog_1771941929508.png"
source_banner = r"C:\Users\anjaymi\.gemini\antigravity\brain\a758a62c-734c-4cfa-942e-11cf0a772441\installer_banner_1771942211524.png"

output_dir = r"g:\nai4\NAI_Assistant\src-tauri\icons\installer"
os.makedirs(output_dir, exist_ok=True)

def process_img(src, out_name, size):
    try:
        img = Image.open(src).convert("RGB")
        # ImageOps.fit crops from the center automatically to match exact size
        img = ImageOps.fit(img, size, Image.Resampling.LANCZOS)
        img.save(os.path.join(output_dir, out_name), format="BMP")
        print(f"✅ Saved {out_name} at {size}")
    except Exception as e:
        print(f"❌ Failed to process {out_name}: {e}")

if __name__ == "__main__":
    process_img(source_dialog, "nsis_sidebar.bmp", (164, 314))
    process_img(source_dialog, "wix_dialog.bmp", (493, 312))
    
    process_img(source_banner, "nsis_header.bmp", (150, 57))
    process_img(source_banner, "wix_banner.bmp", (493, 58))
    
    print("Done!")
