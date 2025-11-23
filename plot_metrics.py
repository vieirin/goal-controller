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
    
    # Filter out zero or invalid values if needed
    data = df[[x_col, y_col]].dropna()
    data = data[(data[x_col] > 0) & (data[y_col] > 0)]
    
    if len(data) == 0:
        print(f"Warning: No valid data for {x_col} vs {y_col}")
        plt.close(fig)
        return None
    
    x = data[x_col]
    y = data[y_col]
    
    # Create scatter plot
    ax.scatter(x, y, alpha=0.6, s=100, edgecolors='black', linewidth=1)
    
    # Add regression line
    z = np.polyfit(x, y, 1)
    p = np.poly1d(z)
    ax.plot(x, p(x), "r--", alpha=0.8, linewidth=2, label=f'Trend: y={z[0]:.4f}x+{z[1]:.4f}')
    
    # Add labels for each point
    for idx, row in data.iterrows():
        model_name = df.loc[idx, 'model_name']
        ax.annotate(model_name, (row[x_col], row[y_col]), 
                   fontsize=8, alpha=0.7, xytext=(5, 5), textcoords='offset points')
    
    ax.set_xlabel(xlabel, fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3)
    ax.legend()
    
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
    
    # Create output directory if saving
    if args.save:
        os.makedirs(args.output_dir, exist_ok=True)
        print(f"Plots will be saved to {args.output_dir}/")
    
    # List of plots to create: (x_col, y_col, title, xlabel, ylabel)
    plots = [
        # Goals and tasks vs construction time
        ('num_goals', 'construction_time', 
         'Number of Goals vs Model Construction Time',
         'Number of Goals', 'Construction Time (seconds)'),
        
        ('num_tasks', 'construction_time',
         'Number of Tasks vs Model Construction Time',
         'Number of Tasks', 'Construction Time (seconds)'),
        
        # Goals and tasks vs memory
        ('num_goals', 'peak_memory_mb',
         'Number of Goals vs Peak Memory Usage',
         'Number of Goals', 'Peak Memory (MB)'),
        
        ('num_tasks', 'peak_memory_mb',
         'Number of Tasks vs Peak Memory Usage',
         'Number of Tasks', 'Peak Memory (MB)'),
        
        # States and transitions vs construction time
        ('num_states', 'construction_time',
         'Number of States vs Model Construction Time',
         'Number of States', 'Construction Time (seconds)'),
        
        ('num_transitions', 'construction_time',
         'Number of Transitions vs Model Construction Time',
         'Number of Transitions', 'Construction Time (seconds)'),
        
        # States and transitions vs memory
        ('num_states', 'peak_memory_mb',
         'Number of States vs Peak Memory Usage',
         'Number of States', 'Peak Memory (MB)'),
        
        ('num_transitions', 'peak_memory_mb',
         'Number of Transitions vs Peak Memory Usage',
         'Number of Transitions', 'Peak Memory (MB)'),
        
        # Goals and tasks vs states/transitions
        ('num_goals', 'num_states',
         'Number of Goals vs Number of States',
         'Number of Goals', 'Number of States'),
        
        ('num_tasks', 'num_states',
         'Number of Tasks vs Number of States',
         'Number of Tasks', 'Number of States'),
        
        ('num_goals', 'num_transitions',
         'Number of Goals vs Number of Transitions',
         'Number of Goals', 'Number of Transitions'),
        
        ('num_tasks', 'num_transitions',
         'Number of Tasks vs Number of Transitions',
         'Number of Tasks', 'Number of Transitions'),
        
        # Time metrics
        ('construction_time', 'total_checking_time',
         'Construction Time vs Total Checking Time',
         'Construction Time (seconds)', 'Total Checking Time (seconds)'),
        
        ('construction_time', 'cpu_time',
         'Construction Time vs CPU Time',
         'Construction Time (seconds)', 'CPU Time (seconds)'),
        
        ('construction_time', 'wallclock_time',
         'Construction Time vs Wallclock Time',
         'Construction Time (seconds)', 'Wallclock Time (seconds)'),
        
        # Properties vs time
        ('num_properties', 'total_checking_time',
         'Number of Properties vs Total Checking Time',
         'Number of Properties', 'Total Checking Time (seconds)'),
        
        ('num_properties', 'construction_time',
         'Number of Properties vs Construction Time',
         'Number of Properties', 'Construction Time (seconds)'),
    ]
    
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

