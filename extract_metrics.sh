#!/bin/bash

# Script to extract metrics from log files and Storm results
# Usage: ./extract_metrics.sh [--storm|-s]
#   --storm, -s: Use Storm result files (default), otherwise use PRISM results

# Parse command line arguments
USE_STORM=true
if [[ "$1" == "--prism" ]] || [[ "$1" == "-p" ]]; then
    USE_STORM=false
fi

LOGS_DIR="logs"
RESULTS_DIR="examples/deliveryDrone/props/results"
CSV_OUTPUT="metrics.csv"

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

# Function to find log file for a model
find_log_file() {
    local model="$1"
    
    # Try different possible locations
    if [ -f "$LOGS_DIR/examples/deliveryDrone/${model}.txt.log" ]; then
        echo "$LOGS_DIR/examples/deliveryDrone/${model}.txt.log"
    elif [ -f "$LOGS_DIR/examples/labSamplesWithSideEffect.txt.log" ] && [ "$model" == "labSamplesWithSideEffect" ]; then
        echo "$LOGS_DIR/examples/labSamplesWithSideEffect.txt.log"
    elif [ -f "$LOGS_DIR/${model}.txt.log" ]; then
        echo "$LOGS_DIR/${model}.txt.log"
    else
        echo ""
    fi
}

# Function to extract metrics from log file
extract_log_metrics() {
    local log_file="$1"
    if [ ! -f "$log_file" ]; then
        echo "0,0,0,0,0,0,0"
        return
    fi
    
    # Extract elapsed time and convert to milliseconds
    elapsed_time_line=$(grep "^\[ELAPSED TIME\]" "$log_file" || echo "")
    elapsed_time_ms="0"
    if [ -n "$elapsed_time_line" ]; then
        # Check if format is "X.XXs (YYYYms)" or just "YYYms"
        if echo "$elapsed_time_line" | grep -q "s ("; then
            # Format: "1.234s (1234ms)" - extract milliseconds from parentheses
            elapsed_time_ms=$(echo "$elapsed_time_line" | sed -E 's/.*\[ELAPSED TIME\] [0-9.]+s \(([0-9]+)ms\).*/\1/' || echo "0")
        else
            # Format: "39ms" - extract just the number before "ms"
            elapsed_time_ms=$(echo "$elapsed_time_line" | sed -E 's/.*\[ELAPSED TIME\] ([0-9]+)ms.*/\1/' || echo "0")
        fi
        # Ensure we have a valid number
        if ! echo "$elapsed_time_ms" | grep -qE '^[0-9]+$'; then
            elapsed_time_ms="0"
        fi
    fi
    
    # Extract only the specified metrics from MODEL STRUCTURE SUMMARY
    total_goals=$(grep "^\[TOTAL GOALS\]" "$log_file" | sed 's/.*\[TOTAL GOALS\] \([0-9]*\).*/\1/' || echo "0")
    total_tasks=$(grep "^\[TOTAL TASKS\]" "$log_file" | sed 's/.*\[TOTAL TASKS\] \([0-9]*\).*/\1/' || echo "0")
    total_resources=$(grep "^\[TOTAL RESOURCES\]" "$log_file" | sed 's/.*\[TOTAL RESOURCES\] \([0-9]*\).*/\1/' || echo "0")
    total_nodes=$(grep "^\[TOTAL NODES\]" "$log_file" | sed 's/.*\[TOTAL NODES\] \([0-9]*\).*/\1/' || echo "0")
    total_variables=$(grep "^\[TOTAL VARIABLES\]" "$log_file" | sed 's/.*\[TOTAL VARIABLES\] \([0-9]*\).*/\1/' || echo "0")
    
    # Extract memory usage from MEMORY USAGE section (format: "Memory usage: 369 MB (...)")
    memory_usage_mb=$(grep "^Memory usage:" "$log_file" | sed -E 's/.*Memory usage:[[:space:]]*([0-9]+)[[:space:]]*MB.*/\1/' || echo "0")
    # Ensure we have a valid number
    if ! echo "$memory_usage_mb" | grep -qE '^[0-9]+$'; then
        memory_usage_mb="0"
    fi
    
    echo "$elapsed_time_ms,$total_goals,$total_tasks,$total_resources,$total_nodes,$total_variables,$memory_usage_mb"
}

# Function to extract metrics from Storm result file
extract_storm_metrics() {
    local result_file="$1"
    if [ ! -f "$result_file" ]; then
        echo "DTMC,0,0,0,0,0,0,0,0"
        return
    fi
    
    # Extract model type
    model_type=$(grep "^Model type:" "$result_file" | sed 's/.*Model type:[[:space:]]*\([^(]*\).*/\1/' | tr -d '[:space:]' || echo "DTMC")
    
    # Extract states
    num_states=$(grep "^States:" "$result_file" | sed 's/.*States:[[:space:]]*\([0-9]*\).*/\1/' || echo "0")
    
    # Extract transitions
    num_transitions=$(grep "^Transitions:" "$result_file" | sed 's/.*Transitions:[[:space:]]*\([0-9]*\).*/\1/' || echo "0")
    
    # Extract parsing time
    parsing_time=$(grep "^Time for model input parsing:" "$result_file" | sed 's/.*parsing:[[:space:]]*\([0-9.]*\)s.*/\1/' || echo "0")
    
    # Extract construction time
    construction_time=$(grep "^Time for model construction:" "$result_file" | sed 's/.*construction:[[:space:]]*\([0-9.]*\)s.*/\1/' || echo "0")
    
    # Extract peak memory (in MB)
    peak_memory=$(grep "peak memory usage:" "$result_file" | sed 's/.*peak memory usage:[[:space:]]*\([0-9.]*\)MB.*/\1/' || echo "0")
    
    # Extract CPU time
    cpu_time=$(grep "CPU time:" "$result_file" | sed 's/.*CPU time:[[:space:]]*\([0-9.]*\)s.*/\1/' || echo "0")
    
    # Extract wallclock time
    wallclock_time=$(grep "wallclock time:" "$result_file" | sed 's/.*wallclock time:[[:space:]]*\([0-9.]*\)s.*/\1/' || echo "0")
    
    # Calculate total checking time (sum of all property checking times)
    total_checking_time=$(grep "Time for model checking:" "$result_file" | sed 's/.*checking:[[:space:]]*\([0-9.]*\)s.*/\1/' | awk '{sum+=$1} END {if (sum > 0) print sum; else print "0"}' || echo "0")
    
    echo "$model_type,$num_states,$num_transitions,$parsing_time,$construction_time,$total_checking_time,$peak_memory,$cpu_time,$wallclock_time"
}

# Create CSV header
echo "model_name,elapsed_time_ms,total_goals,total_tasks,total_resources,total_nodes,total_variables,memory_usage_mb,model_type,num_states,num_transitions,parsing_time,construction_time,total_checking_time,peak_memory_mb,cpu_time,wallclock_time" > "$CSV_OUTPUT"

# Iterate over each model
for model in "${models[@]}"; do
    log_file=$(find_log_file "$model")
    
    if [ "$USE_STORM" = true ]; then
        result_file="$RESULTS_DIR/${model}.result.storm"
    else
        result_file="$RESULTS_DIR/${model}.result"
    fi
    
    echo "Processing: $model"
    
    # Check if files exist
    if [ -z "$log_file" ] || [ ! -f "$log_file" ]; then
        echo "  WARNING: Log file not found for: $model"
        # Use zeros for log metrics
        log_metrics="0,0,0,0,0,0,0"
    else
        log_metrics=$(extract_log_metrics "$log_file")
    fi
    
    if [ ! -f "$result_file" ]; then
        echo "  WARNING: Result file not found: $result_file"
        # Use zeros for storm metrics
        storm_metrics="DTMC,0,0,0,0,0,0,0,0"
    else
        storm_metrics=$(extract_storm_metrics "$result_file")
    fi
    
    # Combine metrics
    echo "$model,$log_metrics,$storm_metrics" >> "$CSV_OUTPUT"
    
    echo "  ✓ Extracted metrics for $model"
done

echo ""
echo "=========================================="
echo "Metrics extraction completed!"
echo "Results saved in: $CSV_OUTPUT"
echo "=========================================="
