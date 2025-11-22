#!/bin/bash

# Script to check PRISM properties for all delivery drone models
# Usage: ./check_properties.sh

PRISM_BIN="$HOME/Downloads/prism-4.8.1-mac64-arm/bin/prism"
OUTPUT_DIR="output"
PROPS_DIR="examples/deliveryDrone/props"
RESULTS_DIR="examples/deliveryDrone/props/results"

# Detect number of CPU cores and calculate cores-2
# Note: PRISM doesn't have a direct command-line option for threads.
# It uses the PRISM_THREADS environment variable instead.
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    TOTAL_CORES=$(sysctl -n hw.ncpu)
else
    # Linux
    TOTAL_CORES=$(nproc)
fi

# Calculate cores to use (max cores - 2)
if [ "$TOTAL_CORES" -le 2 ]; then
    THREADS=1
else
    THREADS=$((TOTAL_CORES - 2))
fi

echo "Detected $TOTAL_CORES CPU cores, using $THREADS threads for PRISM"
export PRISM_THREADS=$THREADS

# Create results directory if it doesn't exist
mkdir -p "$RESULTS_DIR"

# Array of model files (without extension)
models=(
    "1-minimal"
    "2-OrVariation"
    "3-interleavedPaltPseq"
    "7-minimalAll"
    "4-interleavedChoicePDegradation"
    "6-allnotationsReduced"
)

# Iterate over each model
for model in "${models[@]}"; do
    model_file="$OUTPUT_DIR/${model}.prism"
    props_file="$PROPS_DIR/${model}.props"
    result_file="$RESULTS_DIR/${model}.result"
    
    echo "=========================================="
    echo "Checking properties for: $model"
    echo "Model file: $model_file"
    echo "Properties file: $props_file"
    echo "Output file: $result_file"
    echo "=========================================="
    
    # Check if files exist
    if [ ! -f "$model_file" ]; then
        echo "ERROR: Model file not found: $model_file"
        continue
    fi
    
    if [ ! -f "$props_file" ]; then
        echo "ERROR: Properties file not found: $props_file"
        continue
    fi
    
    # Run PRISM and save output
    "$PRISM_BIN" "$model_file" "$props_file" -cuddmaxmem 30g > "$result_file" 2>&1
    
    # Check exit status
    if [ $? -eq 0 ]; then
        echo "✓ Successfully checked properties for $model"
    else
        echo "✗ Error checking properties for $model (exit code: $?)"
    fi
    
    echo ""
done

echo "=========================================="
echo "All property checks completed!"
echo "Results saved in: $RESULTS_DIR"
echo "=========================================="

