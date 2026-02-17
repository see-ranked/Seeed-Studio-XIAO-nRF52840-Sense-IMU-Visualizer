"""
XIAO-MG24-Sense-Battery 3D Printable Case
==========================================

Wearable case with belt attachment for XIAO-MG24 Sense PCB.

PCB Specifications:
- Dimensions: 44.5mm x 53mm
- Mounting holes (M3): 
  ① (202, 30)  ② (202, 74)
  ③ (238.5, 74)  ④ (238.5, 30)

Case Features:
- Rounded rectangle shape
- Belt slots for 40mm wide rubber band (2-3mm thick)
- M3 hex nut recesses
- Internal height: 20mm
- External height: 25mm
"""

import cadquery as cq

# ============================================================================
# PARAMETERS - Adjust these values to customize the case
# ============================================================================

# PCB dimensions
PCB_WIDTH = 44.5  # X-axis (mm)
PCB_LENGTH = 53.0  # Y-axis (mm)

# Mounting hole positions (relative to PCB origin at 202, 30)
# Converting absolute coordinates to relative positions
HOLE_POSITIONS = [
    (0, 0),           # ① (202, 30) -> origin
    (0, 44),          # ② (202, 74) -> 74-30 = 44mm in Y
    (36.5, 44),       # ③ (238.5, 74) -> 238.5-202 = 36.5mm in X, 44mm in Y
    (36.5, 0),        # ④ (238.5, 30) -> 36.5mm in X, 0 in Y
]

# Case dimensions
WALL_THICKNESS = 2.5  # Wall thickness (mm)
INTERNAL_HEIGHT = 20.0  # Internal cavity height (mm)
BOTTOM_THICKNESS = 2.5  # Bottom plate thickness (mm)
TOTAL_HEIGHT = 25.0  # Total external height (mm)

# Rounded corners
CORNER_RADIUS = 8.0  # Radius for rounded corners (mm)

# Belt slot parameters
BELT_WIDTH = 40.0  # Belt width (mm)
BELT_THICKNESS = 3.0  # Belt thickness (mm)
BELT_CLEARANCE = 0.5  # Extra clearance for belt (mm)
SLOT_WIDTH = BELT_WIDTH + BELT_CLEARANCE
SLOT_HEIGHT = BELT_THICKNESS + BELT_CLEARANCE

# M3 screw parameters
SCREW_HOLE_DIAMETER = 3.2  # M3 clearance hole (mm)
HEX_NUT_ACROSS_FLATS = 5.5  # M3 hex nut width (mm)
HEX_NUT_THICKNESS = 2.4  # M3 hex nut height (mm)
HEX_NUT_DEPTH = HEX_NUT_THICKNESS + 0.5  # Recess depth with clearance

# Calculated dimensions
CASE_WIDTH = PCB_WIDTH + 2 * WALL_THICKNESS
CASE_LENGTH = PCB_LENGTH + 2 * WALL_THICKNESS

# ============================================================================
# CASE GENERATION
# ============================================================================

def create_case():
    """Create the main case body with rounded corners."""
    
    # Create base rounded rectangle
    case = (
        cq.Workplane("XY")
        .box(CASE_WIDTH, CASE_LENGTH, TOTAL_HEIGHT, centered=(True, True, False))
        .edges("|Z")
        .fillet(CORNER_RADIUS)
    )
    
    # Create internal cavity
    cavity_width = PCB_WIDTH
    cavity_length = PCB_LENGTH
    cavity_height = INTERNAL_HEIGHT
    
    case = (
        case
        .faces(">Z")
        .workplane()
        .rect(cavity_width, cavity_length)
        .cutBlind(-cavity_height)
    )
    
    return case


def add_mounting_holes(case):
    """Add screw clearance holes and hex nut recesses."""
    
    # Calculate offset to center the PCB mounting holes
    offset_x = -PCB_WIDTH / 2
    offset_y = -PCB_LENGTH / 2
    
    for x, y in HOLE_POSITIONS:
        # Position relative to case center
        hole_x = offset_x + x
        hole_y = offset_y + y
        
        # Add screw clearance hole (through hole)
        case = (
            case
            .faces("<Z")
            .workplane()
            .pushPoints([(hole_x, hole_y)])
            .circle(SCREW_HOLE_DIAMETER / 2)
            .cutThruAll()
        )
        
        # Add hex nut recess on bottom
        case = (
            case
            .faces("<Z")
            .workplane()
            .pushPoints([(hole_x, hole_y)])
            .polygon(6, HEX_NUT_ACROSS_FLATS / 0.866)  # Circumradius from across-flats
            .cutBlind(HEX_NUT_DEPTH)
        )
    
    return case


def add_belt_slots(case):
    """Add horizontal and vertical belt slots on opposite sides."""
    
    # Horizontal belt slots (left and right sides)
    # Position at mid-height of the case
    slot_z_position = BOTTOM_THICKNESS + INTERNAL_HEIGHT / 2
    
    # Left side slot (negative X)
    horizontal_slot_left = (
        cq.Workplane("YZ")
        .workplane(offset=-CASE_WIDTH / 2 - 1)
        .rect(SLOT_WIDTH, SLOT_HEIGHT)
        .extrude(WALL_THICKNESS + 2)
    )
    
    # Right side slot (positive X)
    horizontal_slot_right = (
        cq.Workplane("YZ")
        .workplane(offset=CASE_WIDTH / 2 - WALL_THICKNESS - 1)
        .rect(SLOT_WIDTH, SLOT_HEIGHT)
        .extrude(WALL_THICKNESS + 2)
    )
    
    # Vertical belt slots (front and back sides)
    # Front side slot (negative Y)
    vertical_slot_front = (
        cq.Workplane("XZ")
        .workplane(offset=-CASE_LENGTH / 2 - 1)
        .rect(SLOT_WIDTH, SLOT_HEIGHT)
        .extrude(WALL_THICKNESS + 2)
    )
    
    # Back side slot (positive Y)
    vertical_slot_back = (
        cq.Workplane("XZ")
        .workplane(offset=CASE_LENGTH / 2 - WALL_THICKNESS - 1)
        .rect(SLOT_WIDTH, SLOT_HEIGHT)
        .extrude(WALL_THICKNESS + 2)
    )
    
    # Position all slots at the same Z height
    horizontal_slot_left = horizontal_slot_left.translate((0, 0, slot_z_position))
    horizontal_slot_right = horizontal_slot_right.translate((0, 0, slot_z_position))
    vertical_slot_front = vertical_slot_front.translate((0, 0, slot_z_position))
    vertical_slot_back = vertical_slot_back.translate((0, 0, slot_z_position))
    
    # Cut all slots from the case
    case = case.cut(horizontal_slot_left)
    case = case.cut(horizontal_slot_right)
    case = case.cut(vertical_slot_front)
    case = case.cut(vertical_slot_back)
    
    return case


# ============================================================================
# MAIN ASSEMBLY
# ============================================================================

# Create the complete case
result = create_case()
result = add_mounting_holes(result)
result = add_belt_slots(result)

# Show the result (for CQ-Editor)
show_object(result)

# ============================================================================
# EXPORT FUNCTIONS (uncomment to export files)
# ============================================================================

# Export to STEP format (for JLCPCB)
# cq.exporters.export(result, "XIAO_MG24_Case.step")

# Export to STL format (for 3D printing preview)
# cq.exporters.export(result, "XIAO_MG24_Case.stl")

# Export to OBJ format (for Blender)
# cq.exporters.export(result, "XIAO_MG24_Case.obj")
