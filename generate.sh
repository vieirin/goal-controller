#!/bin/bash

# Script to generate PRISM model files for all experiment models
# Usage: ./generate.sh

OUTPUT_DIR="output"
INPUT_DIR="examples/experiments"
INPUT_DIR_ALT="examples"
LOGS_DIR="logs/examples/experiments"

# Array of model files (without extension)
models=(
    "labSamplesWithSideEffect"
    "goalModel_TAS_3"
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
mkdir -p "$LOGS_DIR"

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
    log_file="$LOGS_DIR/${model}.txt.log"
    
    echo "=========================================="
    echo "Generating model for: $model"
    echo "Input file: $input_file"
    echo "Output file: $output_file"
    echo "=========================================="
    
    # Create a temporary file to capture time output
    temp_time_file=$(mktemp)
    
    # Generate model and capture memory usage for entire node process tree
    if command -v /usr/bin/time &> /dev/null; then
        temp_stderr=$(mktemp)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS: -l measures entire process tree
            /usr/bin/time -l npx ts-node src/index.ts "$input_file" > /dev/null 2> "$temp_stderr"
            make_exit_code=$?
            max_rss=$(grep 'maximum resident set size' "$temp_stderr" | awk '{print $1}')
            if [ -n "$max_rss" ] && [ "$max_rss" -gt 0 ]; then
                max_rss_mb=$((max_rss / 1024 / 1024))
                echo "Memory usage: ${max_rss_mb} MB" > "$temp_time_file"
            else
                echo "Memory usage: Unable to determine" > "$temp_time_file"
            fi
        else
            # Linux: measures entire process tree
            /usr/bin/time -o "$temp_stderr" -f "%M" npx ts-node src/index.ts "$input_file" > /dev/null 2>&1
            make_exit_code=$?
            mem_kb=$(grep -o '^[0-9]*' "$temp_stderr" | head -1)
            if [ -n "$mem_kb" ] && [ "$mem_kb" -gt 0 ]; then
                mem_mb=$((mem_kb / 1024))
                echo "Memory usage: ${mem_mb} MB" > "$temp_time_file"
            else
                echo "Memory usage: Unable to determine" > "$temp_time_file"
            fi
        fi
        rm -f "$temp_stderr"
    else
        npx ts-node src/index.ts "$input_file" > /dev/null 2>&1
        make_exit_code=$?
        echo "Memory usage: Not available" > "$temp_time_file"
    fi
    
    # Check exit status
    if [ $make_exit_code -eq 0 ]; then
        # Verify output file was created
        if [ -f "$output_file" ]; then
            echo "✓ Successfully generated model for $model"
        else
            echo "⚠ Warning: Model generation completed but output file not found: $output_file"
        fi
    else
        echo "✗ Error generating model for $model (exit code: $make_exit_code)"
    fi
    
    # Append memory usage to log file if it exists
    if [ -f "$log_file" ]; then
        echo "" >> "$log_file"
        echo "==========================================" >> "$log_file"
        echo "MEMORY USAGE" >> "$log_file"
        echo "Generated at: $(date)" >> "$log_file"
        echo "----------------------------------------" >> "$log_file"
        cat "$temp_time_file" >> "$log_file"
        echo "==========================================" >> "$log_file"
        echo "Memory usage statistics appended to: $log_file"
    else
        echo "⚠ Warning: Log file not found: $log_file (memory usage not logged)"
    fi
    
    # Clean up temporary file
    rm -f "$temp_time_file"
    
    echo ""
done

echo "=========================================="
echo "All model generation completed!"
echo "Generated files saved in: $OUTPUT_DIR"
echo "=========================================="
echo ""

