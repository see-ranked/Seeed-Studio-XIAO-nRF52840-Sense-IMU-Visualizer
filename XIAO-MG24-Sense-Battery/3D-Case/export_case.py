"""
Export script for XIAO-MG24-Sense-Battery case
Generates STEP, STL, and OBJ files for 3D printing

Usage:
    python export_case.py
"""

import sys
import os

# Add parent directory to path to import case_design
sys.path.insert(0, os.path.dirname(__file__))

try:
    import cadquery as cq
    from cadquery import exporters
except ImportError:
    print("Error: CadQuery is not installed.")
    print("Please install it with: pip install cadquery")
    sys.exit(1)

# Import the case design
print("Generating case model...")

# Execute the case_design.py script
with open('case_design.py', 'r', encoding='utf-8') as f:
    code = f.read()
    # Remove the show_object line as it's not needed for export
    code = code.replace('show_object(result)', '# show_object(result)')
    exec(code, globals())

# Create output directory if it doesn't exist
os.makedirs('output', exist_ok=True)

print("\nExporting files...")

# Export to STEP format (for JLCPCB)
print("  - Exporting STEP file (for JLCPCB)...")
try:
    exporters.export(result, "output/XIAO_MG24_Case.step")
    print("    ✓ output/XIAO_MG24_Case.step")
except Exception as e:
    print(f"    ✗ Error: {e}")

# Export to STL format (for 3D printing preview)
print("  - Exporting STL file (for preview)...")
try:
    exporters.export(result, "output/XIAO_MG24_Case.stl")
    print("    ✓ output/XIAO_MG24_Case.stl")
except Exception as e:
    print(f"    ✗ Error: {e}")

# Export to OBJ format (for Blender)
print("  - Exporting OBJ file (for Blender)...")
try:
    exporters.export(result, "output/XIAO_MG24_Case.obj")
    print("    ✓ output/XIAO_MG24_Case.obj")
except Exception as e:
    print(f"    ✗ Error: {e}")

print("\n✓ Export complete!")
print("\nGenerated files:")
print("  - output/XIAO_MG24_Case.step  (for JLCPCB)")
print("  - output/XIAO_MG24_Case.stl   (for preview)")
print("  - output/XIAO_MG24_Case.obj   (for Blender)")
print("\nNext steps:")
print("  1. Open STEP file in FreeCAD or Blender to verify")
print("  2. Follow JLCPCB_ORDER_GUIDE.md to order")
