# XIAO MG24 Sense KiCad Library

KiCad schematic symbol and footprint for the **Seeed Studio XIAO MG24 Sense** development board.

## 📋 Overview

The XIAO MG24 Sense is a compact development board featuring:
- **MCU**: Silicon Labs EFR32MG24 (ARM Cortex-M33 @ 78MHz)
- **Wireless**: BLE 5.3, Matter, Thread, Zigbee
- **Sensors**: LSM6DS3 6-axis IMU, MSM381ACT001 MEMS Microphone
- **Memory**: 256KB RAM, 1536KB Flash + 4MB onboard Flash
- **Dimensions**: 21.0mm × 17.8mm
- **GPIO**: 14 pins (7 per side) with I2C, SPI, UART, ADC, PWM support

## 📦 Files Included

- **XIAO-MG24-Sense.kicad_sym** - Schematic symbol
- **XIAO-MG24-Sense.kicad_mod** - PCB footprint (dual mounting: through-hole + SMD)
- **XIAO-MG24-Sense-Battery-PogoPin.kicad_mod** - Pogo pin contact for battery pads
- **README.md** - This documentation
- **README_Battery_PogoPin.md** - Battery pogo pin documentation

## 🚀 Installation

### Method 1: Add to Project Library

1. Copy the `XIAO-MG24-Sense` folder to your KiCad project directory
2. Open your KiCad project
3. **For Symbol**:
   - Go to `Preferences` → `Manage Symbol Libraries`
   - Click the folder icon (Project Specific Libraries)
   - Click `+` to add a new library
   - Browse to `XIAO-MG24-Sense/XIAO-MG24-Sense.kicad_sym`
   - Set Nickname to `XIAO-MG24-Sense`
4. **For Footprint**:
   - Go to `Preferences` → `Manage Footprint Libraries`
   - Click the folder icon (Project Specific Libraries)
   - Click `+` to add a new library
   - Browse to `XIAO-MG24-Sense` folder
   - Set Nickname to `XIAO-MG24-Sense`

### Method 2: Add to Global Library

Follow the same steps as Method 1, but use the globe icon (Global Libraries) instead of the folder icon.

## 📌 Pin Assignment

| Pin | Name | GPIO | Function | Notes |
|-----|------|------|----------|-------|
| 1 | D0 | PA08 | GPIO, ADC | Analog input capable |
| 2 | D1 | PA09 | GPIO, ADC | Analog input capable |
| 3 | D2 | PB00 | GPIO, ADC | Analog input capable |
| 4 | D3 | PB01 | GPIO, ADC | Analog input capable |
| 5 | D4 | PC04 | GPIO, I2C SDA | Default I2C data line |
| 6 | D5 | PC05 | GPIO, I2C SCL | Default I2C clock line |
| 7 | D6 | PC06 | GPIO, UART TX | Default UART transmit |
| 8 | 5V | - | Power Input | USB 5V or external power |
| 9 | D7 | PC07 | GPIO, UART RX | Default UART receive |
| 10 | D8 | PA03 | GPIO, SPI SCK | SPI clock |
| 11 | D9 | PA04 | GPIO, SPI MISO | SPI data in |
| 12 | D10 | PA00 | GPIO, SPI MOSI | SPI data out |
| 13 | 3V3 | - | Power Output | 3.3V regulated output |
| 14 | GND | - | Ground | Common ground |

## 🔧 Footprint Details

### Dual Mounting Support

The footprint supports **two mounting methods**:

#### 1. Through-Hole Mounting
- **Pad Type**: Through-hole with plating
- **Pad Size**: 2.0mm diameter
- **Drill Size**: 1.2mm
- **Pitch**: 2.54mm (0.1")
- **Row Spacing**: 17.78mm (0.7")
- **Use Case**: Traditional PCB mounting with pin headers

#### 2. Surface Mount (SMD)
- **Pad Type**: Rectangular SMD pads (castellated holes)
- **Pad Size**: 2.0mm × 1.2mm
- **Position**: On board edges
- **Pitch**: 2.54mm (0.1")
- **Row Spacing**: 17.78mm (0.7")
- **Use Case**: Direct surface mounting to carrier PCB

### Board Outline
- **Width**: 21.0mm
- **Height**: 17.8mm
- **Courtyard**: 22.0mm × 18.8mm (1mm clearance)

### Layers
- **F.Cu / B.Cu**: Copper pads
- **F.SilkS**: Silkscreen with pin labels and board name
- **F.Fab**: Fabrication layer with board outline
- **F.CrtYd**: Courtyard for DRC clearance checking
- **F.Paste / F.Mask**: Solder paste and mask for SMD pads

## 💡 Usage Example

### In Schematic Editor

1. Open your schematic in KiCad
2. Press `A` to add a symbol
3. Search for `XIAO-MG24-Sense`
4. Place the symbol
5. Assign the footprint: `XIAO-MG24-Sense:XIAO-MG24-Sense`

### In PCB Editor

1. Update PCB from schematic (`Tools` → `Update PCB from Schematic`)
2. The footprint will appear with both through-hole and SMD pads
3. Choose your mounting method:
   - **Through-hole**: Solder pin headers to the through-hole pads
   - **SMD**: Reflow solder the SMD pads directly to your PCB

## ⚠️ Design Considerations

### I2C Pull-up Resistors
The XIAO MG24 Sense **does not have onboard I2C pull-up resistors**. You must add external pull-ups (typically 4.7kΩ to 10kΩ) on SDA (D4) and SCL (D5) lines.

### Power Supply
- **5V Pin**: Can be used as input (from external 5V source) or output (when powered via USB)
- **3V3 Pin**: Regulated 3.3V output, max current depends on input source
- **Battery**: Supports 3.7V Li-Po battery connection (separate pads on bottom)

### Onboard Sensors
The LSM6DS3 IMU is connected to the internal I2C bus. If using external I2C devices on D4/D5, be aware of address conflicts:
- **LSM6DS3 I2C Address**: 0x6A (default)

### PWM Capability
All GPIO pins (D0-D10) support PWM output.

### ADC Pins
Pins D0-D3 have 12-bit ADC capability with 1Msps sampling rate.

## 📚 References

- [Official Wiki](https://wiki.seeedstudio.com/xiao_mg24_getting_started/)
- [Product Page](https://www.seeedstudio.com/Seeed-XIAO-MG24-Sense-p-6248.html)
- [EFR32MG24 Datasheet](https://www.silabs.com/wireless/zigbee/efr32mg24-series-2-socs)
- [LSM6DS3 IMU Datasheet](https://www.st.com/resource/en/datasheet/lsm6ds3.pdf)

## 📝 License

This KiCad library is provided as-is for use with the Seeed Studio XIAO MG24 Sense.

## 🤝 Contributing

If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## 📧 Support

For questions about the XIAO MG24 Sense hardware, please refer to the [Seeed Studio Wiki](https://wiki.seeedstudio.com/xiao_mg24_getting_started/) or contact Seeed Studio support.

---

**Created for KiCad v9.0**
