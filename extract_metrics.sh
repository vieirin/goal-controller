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
        echo "0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0"
        return
    fi
    
    # Extract metrics from LOGGER SUMMARY section
    goal_modules=$(grep "^\[GOAL MODULES\]" "$log_file" | sed 's/.*\[GOAL MODULES\] \([0-9]*\).*/\1/' || echo "0")
    goal_variables=$(grep "^\[GOAL VARIABLES\]" "$log_file" | sed 's/.*\[GOAL VARIABLES\] \([0-9]*\).*/\1/' || echo "0")
    goal_pursue_lines=$(grep "^\[GOAL PURSUE LINES\]" "$log_file" | sed 's/.*\[GOAL PURSUE LINES\] \([0-9]*\).*/\1/' || echo "0")
    goal_achieved_lines=$(grep "^\[GOAL ACHIEVED LINES\]" "$log_file" | sed 's/.*\[GOAL ACHIEVED LINES\] \([0-9]*\).*/\1/' || echo "0")
    goal_skipped_lines=$(grep "^\[GOAL SKIPPED LINES\]" "$log_file" | sed 's/.*\[GOAL SKIPPED LINES\] \([0-9]*\).*/\1/' || echo "0")
    goal_achievability_formulas=$(grep "^\[GOAL ACHIEVABILITY FORMULAS\]" "$log_file" | sed 's/.*\[GOAL ACHIEVABILITY FORMULAS\] \([0-9]*\).*/\1/' || echo "0")
    goal_maintain_formulas=$(grep "^\[GOAL MAINTAIN FORMULAS\]" "$log_file" | sed 's/.*\[GOAL MAINTAIN FORMULAS\] \([0-9]*\).*/\1/' || echo "0")
    
    tasks_variables=$(grep "^\[TASKS VARIABLES\]" "$log_file" | sed 's/.*\[TASKS VARIABLES\] \([0-9]*\).*/\1/' || echo "0")
    tasks_labels=$(grep "^\[TASKS LABELS\]" "$log_file" | sed 's/.*\[TASKS LABELS\] \([0-9]*\).*/\1/' || echo "0")
    tasks_try_lines=$(grep "^\[TASKS TRY LINES\]" "$log_file" | sed 's/.*\[TASKS TRY LINES\] \([0-9]*\).*/\1/' || echo "0")
    tasks_failed_lines=$(grep "^\[TASKS FAILED LINES\]" "$log_file" | sed 's/.*\[TASKS FAILED LINES\] \([0-9]*\).*/\1/' || echo "0")
    tasks_achieved_lines=$(grep "^\[TASKS ACHIEVED LINES\]" "$log_file" | sed 's/.*\[TASKS ACHIEVED LINES\] \([0-9]*\).*/\1/' || echo "0")
    tasks_skipped_lines=$(grep "^\[TASKS SKIPPED LINES\]" "$log_file" | sed 's/.*\[TASKS SKIPPED LINES\] \([0-9]*\).*/\1/' || echo "0")
    tasks_achievability_constants=$(grep "^\[TASKS ACHIEVABILITY CONSTANTS\]" "$log_file" | sed 's/.*\[TASKS ACHIEVABILITY CONSTANTS\] \([0-9]*\).*/\1/' || echo "0")
    
    system_variables=$(grep "^\[SYSTEM VARIABLES\]" "$log_file" | sed 's/.*\[SYSTEM VARIABLES\] \([0-9]*\).*/\1/' || echo "0")
    system_resources=$(grep "^\[SYSTEM RESOURCES\]" "$log_file" | sed 's/.*\[SYSTEM RESOURCES\] \([0-9]*\).*/\1/' || echo "0")
    system_context_variables=$(grep "^\[SYSTEM CONTEXT VARIABLES\]" "$log_file" | sed 's/.*\[SYSTEM CONTEXT VARIABLES\] \([0-9]*\).*/\1/' || echo "0")
    
    echo "$goal_modules,$goal_variables,$goal_pursue_lines,$goal_achieved_lines,$goal_skipped_lines,$goal_achievability_formulas,$goal_maintain_formulas,$tasks_variables,$tasks_labels,$tasks_try_lines,$tasks_failed_lines,$tasks_achieved_lines,$tasks_skipped_lines,$tasks_achievability_constants,$system_variables,$system_resources,$system_context_variables"
}

# Function to extract metrics from Storm result file
extract_storm_metrics() {
    local result_file="$1"
    if [ ! -f "$result_file" ]; then
        echo "DTMC,0,0,0,0,0,0,0,0,0"
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
    
    # Count number of properties checked
    num_properties=$(grep -c "^Model checking property" "$result_file" 2>/dev/null || echo "0")
    
    # Calculate total checking time (sum of all property checking times)
    total_checking_time=$(grep "Time for model checking:" "$result_file" | sed 's/.*checking:[[:space:]]*\([0-9.]*\)s.*/\1/' | awk '{sum+=$1} END {if (sum > 0) print sum; else print "0"}' || echo "0")
    
    echo "$model_type,$num_states,$num_transitions,$parsing_time,$construction_time,$total_checking_time,$peak_memory,$cpu_time,$wallclock_time,$num_properties"
}

# Create CSV header
echo "model_name,goal_modules,goal_variables,goal_pursue_lines,goal_achieved_lines,goal_skipped_lines,goal_achievability_formulas,goal_maintain_formulas,tasks_variables,tasks_labels,tasks_try_lines,tasks_failed_lines,tasks_achieved_lines,tasks_skipped_lines,tasks_achievability_constants,system_variables,system_resources,system_context_variables,model_type,num_states,num_transitions,parsing_time,construction_time,total_checking_time,peak_memory_mb,cpu_time,wallclock_time,num_properties" > "$CSV_OUTPUT"

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
        log_metrics="0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0"
    else
        log_metrics=$(extract_log_metrics "$log_file")
    fi
    
    if [ ! -f "$result_file" ]; then
        echo "  WARNING: Result file not found: $result_file"
        # Use zeros for storm metrics
        storm_metrics="DTMC,0,0,0,0,0,0,0,0,0"
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
