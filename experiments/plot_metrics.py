#!/usr/bin/env python3
"""
Script to plot metrics from metrics.csv
Creates various scatter plots showing relationships between different variables

Requirements:
    pip install pandas matplotlib numpy

Usage:
    python3 plot_metrics.py                    # Display plots interactively
    python3 plot_metrics.py --save              # Save plots as PNG files
    python3 plot_metrics.py --save --output-dir my_plots  # Custom output directory
    python3 plot_metrics.py --stats             # Display min/max statistics for all metrics
    python3 plot_metrics.py --relationships     # Display min/max for total_nodes relationships
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import sys
import os
import re

def extract_label(model_name):
    """Extract simplified label from model name.
    
    Rules:
    - Extract the last word that starts with a capital letter
    - For number-dash patterns, work on the part after the dash
    """
    if not model_name:
        return ""
    
    # Check if starts with number-dash pattern (e.g., "1-minimal", "10-minimalMaintainResource", "2-OrVariation")
    match = re.match(r'^\d+-(.+)', model_name)
    if match:
        rest = match.group(1)
        # Work with the part after the dash
        text_to_process = rest
    else:
        text_to_process = model_name
    
    # Find all words that start with a capital letter
    # Split on capital letters: "minimalMaintainResource" -> ["minimal", "Maintain", "Resource"]
    words = re.findall(r'[A-Z][a-z]*', text_to_process)
    
    if words:
        # Return the last word that starts with a capital letter
        return words[-1]
    
    # If no capitalized words found, return the last word (split by any non-letter)
    all_words = re.findall(r'[a-zA-Z]+', text_to_process)
    if all_words:
        return all_words[-1]
    
    # Fallback: return the original string
    return text_to_process

def load_data(csv_file='metrics.csv'):
    """Load the metrics CSV file"""
    if not os.path.exists(csv_file):
        print(f"Error: {csv_file} not found!")
        sys.exit(1)
    
    df = pd.read_csv(csv_file)
    return df

def print_min_max_stats(df):
    """Print min and max values for each numeric metric in the dataframe."""
    print("\n" + "="*80)
    print("MIN/MAX STATISTICS FOR ALL METRICS")
    print("="*80)
    
    # Get all numeric columns (exclude non-numeric like model_name)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    if len(numeric_cols) == 0:
        print("No numeric columns found in the data.")
        return
    
    # Calculate statistics
    stats_data = []
    for col in numeric_cols:
        # Filter out NaN and negative values (for metrics that shouldn't be negative)
        valid_data = df[col].dropna()
        # For most metrics, negative values don't make sense, but we'll keep them for now
        # and let the user see if there are any
        
        if len(valid_data) == 0:
            continue
        
        min_val = valid_data.min()
        max_val = valid_data.max()
        mean_val = valid_data.mean()
        
        # Find which models have min and max values
        min_models = df[df[col] == min_val]['model_name'].tolist()
        max_models = df[df[col] == max_val]['model_name'].tolist()
        
        stats_data.append({
            'metric': col,
            'min': min_val,
            'max': max_val,
            'mean': mean_val,
            'min_models': min_models,
            'max_models': max_models
        })
    
    # Sort by metric name for better readability
    stats_data.sort(key=lambda x: x['metric'])
    
    # Print statistics in a formatted table
    print(f"\n{'Metric':<30} {'Min':<15} {'Max':<15} {'Mean':<15} {'Count':<10}")
    print("-" * 100)
    
    for stat in stats_data:
        metric = stat['metric']
        min_val = stat['min']
        max_val = stat['max']
        mean_val = stat['mean']
        count = len(df[metric].dropna())
        
        # Format values appropriately
        if abs(min_val) < 0.001 or abs(max_val) > 1000:
            min_str = f"{min_val:.4e}"
            max_str = f"{max_val:.4e}"
            mean_str = f"{mean_val:.4e}"
        else:
            min_str = f"{min_val:.4f}"
            max_str = f"{max_val:.4f}"
            mean_str = f"{mean_val:.4f}"
        
        print(f"{metric:<30} {min_str:<15} {max_str:<15} {mean_str:<15} {count:<10}")
    
    # Print details about which models have min/max values
    print("\n" + "="*80)
    print("MODELS WITH MIN/MAX VALUES")
    print("="*80)
    
    for stat in stats_data:
        metric = stat['metric']
        min_val = stat['min']
        max_val = stat['max']
        min_models = stat['min_models']
        max_models = stat['max_models']
        
        print(f"\n{metric}:")
        print(f"  Min ({min_val:.4f}): {', '.join(min_models[:5])}" + 
              (f" ... and {len(min_models)-5} more" if len(min_models) > 5 else ""))
        print(f"  Max ({max_val:.4f}): {', '.join(max_models[:5])}" + 
              (f" ... and {len(max_models)-5} more" if len(max_models) > 5 else ""))
    
    print("\n" + "="*80)

def print_relationship_stats(df):
    """Print min and max values for total_nodes relationships."""
    print("\n" + "="*80)
    print("MIN/MAX STATISTICS FOR TOTAL_NODES RELATIONSHIPS")
    print("="*80)
    
    # Check required columns exist
    required_cols = ['total_nodes', 'elapsed_time_ms', 'prism_lines']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        print(f"Error: Missing required columns: {', '.join(missing_cols)}")
        return
    
    # Relationship 1: total_nodes × elapsed_time_ms (translation time)
    print("\n" + "-"*80)
    print("RELATIONSHIP 1: total_nodes × translation_time (elapsed_time_ms)")
    print("-"*80)
    
    # Filter out NaN values
    data1 = df[['total_nodes', 'elapsed_time_ms', 'model_name']].dropna()
    
    if len(data1) == 0:
        print("No valid data for total_nodes × elapsed_time_ms")
    else:
        # Calculate the product
        data1 = data1.copy()
        data1['product'] = data1['total_nodes'] * data1['elapsed_time_ms']
        
        min_product = data1['product'].min()
        max_product = data1['product'].max()
        mean_product = data1['product'].mean()
        
        min_row = data1.loc[data1['product'].idxmin()]
        max_row = data1.loc[data1['product'].idxmax()]
        
        print(f"\nProduct Statistics:")
        print(f"  Min: {min_product:.4f} (total_nodes={min_row['total_nodes']:.0f}, elapsed_time_ms={min_row['elapsed_time_ms']:.2f})")
        print(f"  Max: {max_product:.4f} (total_nodes={max_row['total_nodes']:.0f}, elapsed_time_ms={max_row['elapsed_time_ms']:.2f})")
        print(f"  Mean: {mean_product:.4f}")
        print(f"\nModels:")
        print(f"  Min: {min_row['model_name']}")
        print(f"  Max: {max_row['model_name']}")
        
        # Show all data points
        print(f"\nAll data points (sorted by product):")
        data1_sorted = data1.sort_values('product')
        print(f"{'Model':<40} {'total_nodes':<15} {'elapsed_time_ms':<20} {'Product':<15}")
        print("-" * 90)
        for _, row in data1_sorted.iterrows():
            print(f"{row['model_name']:<40} {row['total_nodes']:<15.0f} {row['elapsed_time_ms']:<20.2f} {row['product']:<15.4f}")
    
    # Relationship 2: total_nodes × prism_lines
    print("\n" + "-"*80)
    print("RELATIONSHIP 2: total_nodes × prism_lines")
    print("-"*80)
    
    # Filter out NaN values
    data2 = df[['total_nodes', 'prism_lines', 'model_name']].dropna()
    
    if len(data2) == 0:
        print("No valid data for total_nodes × prism_lines")
    else:
        # Calculate the product
        data2 = data2.copy()
        data2['product'] = data2['total_nodes'] * data2['prism_lines']
        
        min_product = data2['product'].min()
        max_product = data2['product'].max()
        mean_product = data2['product'].mean()
        
        min_row = data2.loc[data2['product'].idxmin()]
        max_row = data2.loc[data2['product'].idxmax()]
        
        print(f"\nProduct Statistics:")
        print(f"  Min: {min_product:.4f} (total_nodes={min_row['total_nodes']:.0f}, prism_lines={min_row['prism_lines']:.0f})")
        print(f"  Max: {max_product:.4f} (total_nodes={max_row['total_nodes']:.0f}, prism_lines={max_row['prism_lines']:.0f})")
        print(f"  Mean: {mean_product:.4f}")
        print(f"\nModels:")
        print(f"  Min: {min_row['model_name']}")
        print(f"  Max: {max_row['model_name']}")
        
        # Show all data points
        print(f"\nAll data points (sorted by product):")
        data2_sorted = data2.sort_values('product')
        print(f"{'Model':<40} {'total_nodes':<15} {'prism_lines':<20} {'Product':<15}")
        print("-" * 90)
        for _, row in data2_sorted.iterrows():
            print(f"{row['model_name']:<40} {row['total_nodes']:<15.0f} {row['prism_lines']:<20.0f} {row['product']:<15.4f}")
    
    print("\n" + "="*80)

def create_plot(df, x_col, y_col, title, xlabel, ylabel, figsize=(8, 6)):
    """Create a scatter plot"""
    fig, ax = plt.subplots(figsize=figsize)
    
    # Filter out NaN values, but allow zeros (some metrics can legitimately be 0)
    data = df[[x_col, y_col]].dropna()
    # Only filter out negative values
    data = data[(data[x_col] >= 0) & (data[y_col] >= 0)]
    
    # Use log scale for num_transitions, num_states, construction_time, and cpu_time - filter out zeros since log(0) is undefined
    use_log_scale = (y_col == 'num_transitions' or y_col == 'num_states' or y_col == 'construction_time' or y_col == 'cpu_time')
    if use_log_scale:
        data = data[data[y_col] > 0]
    
    if len(data) == 0:
        print(f"Warning: No valid data for {x_col} vs {y_col}")
        plt.close(fig)
        return None
    
    x = data[x_col]
    y = data[y_col]
    
    # Set log scale for y-axis if needed
    if use_log_scale:
        ax.set_yscale('log')
    
    # Create scatter plot
    ax.scatter(x, y, alpha=0.6, s=100, edgecolors='black', linewidth=1)
    
    # Add labels for each point with simplified names
    for idx, row in data.iterrows():
        model_name = df.loc[idx, 'model_name']
        label = extract_label(model_name)
        ax.annotate(label, (row[x_col], row[y_col]), 
                   fontsize=8, alpha=0.7,
                   xytext=(5, 5), textcoords='offset points')
    
    ax.set_xlabel(xlabel, fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    return fig

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Plot metrics from metrics.csv')
    parser.add_argument('--save', action='store_true', 
                       help='Save plots as image files instead of displaying')
    parser.add_argument('--output-dir', default='plots', 
                       help='Directory to save plots (default: plots)')
    parser.add_argument('--csv', default='metrics.csv',
                       help='Input CSV file (default: metrics.csv)')
    parser.add_argument('--stats', action='store_true',
                       help='Display min/max statistics for all metrics and exit')
    parser.add_argument('--relationships', action='store_true',
                       help='Display min/max for total_nodes relationships and exit')
    args = parser.parse_args()
    
    # Load data
    print(f"Loading {args.csv}...")
    df = load_data(args.csv)
    print(f"Loaded {len(df)} models")
    
    # Convert parsing_time from seconds to milliseconds
    if 'parsing_time' in df.columns:
        df['parsing_time_ms'] = df['parsing_time'] * 1000.0
    
    # If stats mode is enabled, print statistics and exit
    if args.stats:
        print_min_max_stats(df)
        return
    
    # If relationships mode is enabled, print relationship statistics and exit
    if args.relationships:
        print_relationship_stats(df)
        return
    
    # Create output directory if saving
    if args.save:
        os.makedirs(args.output_dir, exist_ok=True)
        print(f"Plots will be saved to {args.output_dir}/")
    
    # Define validation metrics to plot against
    validation_metrics = [
        ('elapsed_time_ms', 'EDGE2PRISM Translation Time (ms)'),
        ('num_states', 'PRISM Number of States'),
        ('num_transitions', 'PRISM Number of Transitions'),
        ('parsing_time_ms', 'PRISM Parsing Time (ms)'),
        ('construction_time', 'PRISM Construction Time (s)'),
        ('peak_memory_mb', 'PRISM Peak Memory (MB)'),
        ('memory_usage_mb', 'EDGE2PRISM Memory Usage (MB)'),
        ('cpu_time', 'PRISM CPU Time (s)'),
        ('prism_lines', 'PRISM File Lines'),
    ]
    
    # Define construction metrics to plot
    construction_metrics = [
        ('total_nodes', 'Total Nodes'),
        ('total_goals', 'Total Goals'),
        ('total_tasks', 'Total Tasks'),
    ]
    
    # Create plots: construction metrics (x-axis) vs validation metrics (y-axis)
    plots = []
    
    for const_col, const_label in construction_metrics:
        for valid_col, valid_label in validation_metrics:
            if const_col in df.columns and valid_col in df.columns:
                title = f'{const_label} vs {valid_label}'
                plots.append((const_col, valid_col, title, const_label, valid_label))
    
    # Create all plots
    figures = []
    for x_col, y_col, title, xlabel, ylabel in plots:
        print(f"Creating plot: {title}...")
        fig = create_plot(df, x_col, y_col, title, xlabel, ylabel)
        if fig:
            figures.append((fig, title, x_col, y_col))
    
    # Save or display plots
    if args.save:
        print(f"\nSaving {len(figures)} plots to {args.output_dir}/...")
        for fig, title, x_col, y_col in figures:
            # Create filename from plot title
            filename = f"{x_col}_vs_{y_col}.png"
            filepath = os.path.join(args.output_dir, filename)
            fig.savefig(filepath, dpi=150, bbox_inches='tight')
            print(f"  Saved: {filepath}")
            plt.close(fig)
        print(f"\nAll plots saved to {args.output_dir}/")
    else:
        # Show all plots
        print(f"\nDisplaying {len(figures)} plots...")
        print("Close each window to view the next plot.")
        for fig, title, x_col, y_col in figures:
            print(f"Showing: {title}")
            plt.show(block=True)
            plt.close(fig)
        print("\nAll plots displayed!")

if __name__ == '__main__':
    main()

