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

def create_plot(df, x_col, y_col, title, xlabel, ylabel, figsize=(8, 6)):
    """Create a scatter plot with regression line"""
    fig, ax = plt.subplots(figsize=figsize)
    
    # Filter out NaN values, but allow zeros (some metrics can legitimately be 0)
    data = df[[x_col, y_col]].dropna()
    # Only filter out negative values
    data = data[(data[x_col] >= 0) & (data[y_col] >= 0)]
    
    # Use log scale for num_transitions and num_states - filter out zeros since log(0) is undefined
    use_log_scale = (y_col == 'num_transitions' or y_col == 'num_states')
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
    
    # Add regression line (only if we have at least 2 points)
    # Skip regression line for log scale as it requires log-space fitting
    if len(data) >= 2 and not use_log_scale:
        try:
            z = np.polyfit(x, y, 1)
            p = np.poly1d(z)
            ax.plot(x, p(x), "r--", alpha=0.8, linewidth=2, 
                   label=f'Trend: y={z[0]:.4f}x+{z[1]:.4f}')
            ax.legend()
        except (np.linalg.LinAlgError, ValueError):
            # Skip regression line if it can't be computed
            pass
    
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
    args = parser.parse_args()
    
    # Load data
    print(f"Loading {args.csv}...")
    df = load_data(args.csv)
    print(f"Loaded {len(df)} models")
    
    # Convert parsing_time from seconds to milliseconds
    if 'parsing_time' in df.columns:
        df['parsing_time_ms'] = df['parsing_time'] * 1000.0
    
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

