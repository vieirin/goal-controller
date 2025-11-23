#!/bin/bash

# Script to generate PRISM model files for all delivery drone models
# Usage: ./generate.sh

OUTPUT_DIR="output"
INPUT_DIR="examples/deliveryDrone"
INPUT_DIR_ALT="examples"

# Array of model files (without extension)
models=(
    "labSamplesWithSideEffect"
    "1-minimal"
    "2-OrVariation"
    "3-interleavedPaltPseq"
    "6-allnotationsReduced"
    "4-interleavedChoicePDegradation"
    "7-minimalAll"
    "8-minimalMaintain"
    "9-minimalMaintainContext"
    "10-minimalMaintainResource"
)

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Iterate over each model
for model in "${models[@]}"; do
    # Check input file in default location first, then alternative location
    if [ -f "$INPUT_DIR/${model}.txt" ]; then
        input_file="$INPUT_DIR/${model}.txt"
    elif [ -f "$INPUT_DIR_ALT/${model}.txt" ]; then
        input_file="$INPUT_DIR_ALT/${model}.txt"
    else
        echo "ERROR: Input file not found for: $model"
        echo "  Checked: $INPUT_DIR/${model}.txt"
        echo "  Checked: $INPUT_DIR_ALT/${model}.txt"
        continue
    fi
    
    output_file="$OUTPUT_DIR/${model}.prism"
    
    echo "=========================================="
    echo "Generating model for: $model"
    echo "Input file: $input_file"
    echo "Output file: $output_file"
    echo "=========================================="
    
    # Generate model using make generate-file
    make generate-file FILE="$input_file"
    
    # Check exit status
    if [ $? -eq 0 ]; then
        # Verify output file was created
        if [ -f "$output_file" ]; then
            echo "✓ Successfully generated model for $model"
        else
            echo "⚠ Warning: Model generation completed but output file not found: $output_file"
        fi
    else
        echo "✗ Error generating model for $model (exit code: $?)"
    fi
    
    echo ""
done

echo "=========================================="
echo "All model generation completed!"
echo "Generated files saved in: $OUTPUT_DIR"
echo "=========================================="
echo ""

