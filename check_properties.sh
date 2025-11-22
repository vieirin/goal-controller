#!/bin/bash

# Script to check PRISM/Storm properties for all delivery drone models
# Usage: ./check_properties.sh [--storm|-s]
#   --storm, -s: Use Storm instead of PRISM

# Parse command line arguments
USE_STORM=false
if [[ "$1" == "--storm" ]] || [[ "$1" == "-s" ]]; then
    USE_STORM=true
fi

PRISM_BIN="$HOME/Downloads/prism-4.8.1-mac64-arm/bin/prism"
STORM_BIN="storm"
OUTPUT_DIR="output"
PROPS_DIR="examples/deliveryDrone/props"
RESULTS_DIR="examples/deliveryDrone/props/results"

# Detect number of CPU cores and calculate cores-2
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

if [ "$USE_STORM" = true ]; then
    echo "Using Storm for property checking"
else
    # Note: PRISM doesn't have a direct command-line option for threads.
    # It uses the PRISM_THREADS environment variable instead.
    echo "Detected $TOTAL_CORES CPU cores, using $THREADS threads for PRISM"
    export PRISM_THREADS=$THREADS
fi

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
    if [ "$USE_STORM" = true ]; then
        result_file="$RESULTS_DIR/${model}.result.storm"
    else
        result_file="$RESULTS_DIR/${model}.result"
    fi
    
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
    
    # Run PRISM or Storm and save output
    if [ "$USE_STORM" = true ]; then
        "$STORM_BIN" --prism "$model_file" --buildfull --prop "$props_file" --timemem > "$result_file" 2>&1
    else
        "$PRISM_BIN" "$model_file" "$props_file" -cuddmaxmem 30g > "$result_file" 2>&1
    fi
    
    # Check exit status
    if [ $? -eq 0 ]; then
        echo "✓ Successfully checked properties for $model"
    else
        echo "✗ Error checking properties for $model (exit code: $?)"
    fi
    
    echo ""
done

echo "=========================================="
if [ "$USE_STORM" = true ]; then
    echo "All property checks completed using Storm!"
else
    echo "All property checks completed using PRISM!"
fi
echo "Results saved in: $RESULTS_DIR"
echo "=========================================="

