# Metallurgical and Chemical Constants for MetalliSense

ELEMENTS = ['C', 'Si', 'Mn', 'Cr', 'Ni', 'Mo', 'Fe', 'Al', 'V', 'Ti', 'P', 'S']

ALLOY_MATERIALS = {
    'FeSi 75%': {'Si': 75.0, 'Fe': 25.0},
    'FeCr 65%': {'Cr': 65.0, 'Fe': 35.0},
    'Ni Metal': {'Ni': 99.5, 'Fe': 0.5},
    'FeMo 60%': {'Mo': 60.0, 'Fe': 40.0},
    'Mn Metal': {'Mn': 99.0, 'Fe': 1.0},
    'SiMn 65/15': {'Mn': 65.0, 'Si': 15.0, 'Fe': 20.0}
}

# Heat transfer efficiency defaults
DEFAULT_FURNACE_TEMP_MAX = 1650
DEFAULT_FURNACE_TEMP_TARGET = 1580
HEATING_GRADIENT = 12.5  # °C/min
DEFAULT_HOLDING_TIME = 40  # min
DEFAULT_ENERGY_PER_TON = 550.0  # kWh/ton
