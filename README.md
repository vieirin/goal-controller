# goal-controller

[![PRISM Model Compilation](https://github.com/vieirin/goal-controller/actions/workflows/prism-test.yaml/badge.svg)](https://github.com/vieirin/goal-controller/actions/workflows/prism-test.yaml)
[![Tests](https://github.com/vieirin/goal-controller/actions/workflows/test.yaml/badge.svg)](https://github.com/vieirin/goal-controller/actions/workflows/test.yaml)

### FAQ

## Monorepo Structure

This repository is organized as a pnpm monorepo with the following structure:

```
goal-controller/
├── packages/
│   ├── lib/          # Core transformation engines (PRISM/SLEEC) + CLI tools
│   │   ├── src/
│   │   │   └── engines/               # Transformation engines
│   │   │       ├── edge/              # PRISM/Edge model generator
│   │   │       │   ├── mapper.ts      # iStar to Edge property mapper
│   │   │       │   ├── types.ts       # Edge-specific types
│   │   │       │   ├── template/      # PRISM model generation templates
│   │   │       │   ├── validator/     # PRISM model validation
│   │   │       │   ├── logger/        # Generation logging & metrics
│   │   │       │   └── mdp/           # MDP common utilities
│   │   │       └── sleec/             # SLEEC specification generator
│   │   │           ├── mapper.ts      # iStar to SLEEC property mapper
│   │   │           ├── types.ts       # SLEEC-specific types
│   │   │           └── template/      # SLEEC specification templates
│   │   │               └── README.md  # SLEEC engine architecture & documentation
│   │   └── out/      # Compiled JavaScript
│   ├── goal-tree/    # Goal model data structures
│   └── ui/           # Next.js web application for transformations
├── examples/         # Example goal models
├── experiments/      # Experiment infrastructure (Docker, scripts, metrics)
└── output/          # Generated PRISM/SLEEC models
```

### Transformation Engines

This repository includes two transformation engines for converting goal models:

1. **Edge/PRISM Engine** (`packages/lib/src/engines/edge/`) - Generates PRISM models for probabilistic verification
   - `mapper.ts` - Maps iStar model properties to Edge-specific properties
   - `template/` - Contains PRISM model generation templates
2. **SLEEC Engine** (`packages/lib/src/engines/sleec/`) - Generates SLEEC specifications for runtime monitoring
   - `mapper.ts` - Maps iStar model properties to SLEEC-specific properties
   - `template/` - Contains SLEEC specification templates
   - See [SLEEC Engine Documentation](packages/lib/src/engines/sleec/template/README.md) for architecture and implementation details

### Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Generate ANTLR parsers:**
   ```bash
   make grammar
   ```

3. **Build the library:**
   ```bash
   pnpm run build:lib
   ```

4. **Run transformations:**
   ```bash
   make run FILE=examples/simpleChoice.txt
   ```

5. **Launch the web UI:**
   ```bash
   pnpm run dev:ui
   # Open http://localhost:3000
   ```

## How to execute this repo?

### Installation

#### Alternative 1: VScode integrated environment (Recommended)

1. Open the repo on a new VSCode window
1. Make sure you have docker installed
1. Install the [devcontainer](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension, more info about it [here](https://code.visualstudio.com/docs/devcontainers/containers)
1. A dialog will ask you to reopen the repo in a container, accept it and wait for the build to finish
1. Once inside the dev container environment, you can use:
   - `make exec` to run the translator with the default example
   - `make cli` to launch the interactive CLI
   - `make cli-clean` to launch the interactive CLI with the `--clean` flag (skips preserving old System module transitions)

##### Alternative 2: Run manually from any terminal

1. **Install pnpm:**
   ```bash
   npm install -g pnpm
   ```

2. **Install antlr4:**
   - `pip install antlr4-tools`
   - `brew install antlr` (MacOS, check how to install for your distribution)

3. **Install Node.js 22.6.0:**
   ```bash
   # Using nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   nvm install 22.6.0
   nvm use 22.6.0
   ```

4. **Install dependencies:**
   ```bash
   pnpm install
   ```

### Execution

#### Interactive CLI

You can use the interactive CLI to select and run models:

- `make cli` - Launches the interactive CLI
- `make cli-clean` - Launches the interactive CLI with the `--clean` flag (generates clean System modules without preserving old transitions)

#### Generating the PRISM model

1. Build the library package first:
   ```bash
   make grammar  # Generate ANTLR parsers
   pnpm run build:lib  # Build the library
   ```

2. Generate the model using one of these methods:

   **Using Makefile (Recommended):**
   ```bash
   make run FILE=examples/simpleChoice.txt
   # or
   make generate FILE=examples/simpleChoice.txt
   ```

   **Using Node directly:**
   ```bash
   node packages/lib/out/index.js examples/simpleChoice.txt
   ```

   Where `$GOAL_MODEL_FILE` is the downloaded goal model from [pistar](https://www.cin.ufpe.br/~jhcp/pistar/tool/#).
   
   **Note:** The `--clean` flag is not currently supported in the CLI entry point. Use the interactive CLI (`make cli`) for clean mode.
2. If successful you should see the string `The file was saved!` in the terminal.
3. Add the goal model to the goalmngt folder
   - `cp $GOAL_MODEL_FILE goalmgmt/edgeModel.txt`
   - E.g: `cp examples/edgeModel.txt goalmgmt/edgeModel.txt`

##### System Module Transition Preservation

By default, when generating a PRISM model, the System module will automatically preserve transitions from a previously generated PRISM file (if it exists in the `output/` directory). This allows you to maintain custom transitions in the System module across model regenerations.

**How it works:**

- When generating a PRISM model, the system looks for an existing PRISM file with the same base name in the `output/` directory
- If found, it extracts all transition lines (including any preceding comments) from the System module
- These transitions are then included in the newly generated System module alongside the automatically generated context and resource variables

**Example:**
If you have a file `output/myModel.prism` with custom System module transitions:

```prism
module System
  myVar: bool init false;

  // Custom transition
  [achieved_T1] true -> (myVar'=true);
endmodule
```

When you regenerate the model, these transitions will be preserved in the new System module.

**Using the `--clean` flag:**
To skip this behavior and generate a completely fresh System module without preserving old transitions, use the `--clean` or `-c` flag:

**Make targets:**

```bash
make cli-clean  # Interactive CLI with --clean flag
```

**Note:** The direct command-line `--clean` flag is not available. Use the interactive CLI for clean mode.

This is useful when you want to start with a clean System module or when the old transitions are no longer relevant.

This process outputs a file in `output/<file>.prism` this is the MDP input for the PRISM model checker. To generate the controller and states files please refer to the [EDGE specification](https://github.com/Genaina/Formalise23/tree/main?tab=readme-ov-file#instructions-to-synthesize-the-edge-goal-controller)

## Running Experiments

This section describes how to run experiments to collect metrics and analyze the performance of goal model translations.

### Prerequisites

- Docker and Docker Compose installed
- The experiment Docker container (built automatically on first run)

### Step-by-Step Guide

#### 1. Add the Goal Model

Add your goal model file (`.txt` format) to the `examples/experiments/` directory:

```bash
cp your-goal-model.txt examples/experiments/your-goal-model.txt
```

The goal model should be in the PiStar format, as exported from the [PiStar tool](https://www.cin.ufpe.br/~jhcp/pistar/tool/#).

#### 2. Add PCTL Properties

Create a properties file (`.props` format) with PCTL formulas to verify against your model. Place it in `examples/experiments/props/`:

```bash
# Create the props directory if it doesn't exist
mkdir -p examples/experiments/props

# Add your properties file
# The filename should match your goal model name (e.g., if your model is "myModel.txt",
# create "myModel.props")
cp your-properties.props examples/experiments/props/your-goal-model.props
```

**Example properties file format:**

```prism
// Example properties for goal model verification
P=? [F "goal_achieved"]
P>=0.9 [G "system_safe"]
```

#### 3. Launch the Experiment Container

Start the Docker container with all necessary dependencies:

```bash
make experiment
```

This command will:

- Build the experiment Docker image (if not already built)
- Start the container in detached mode
- Open an interactive bash session inside the container

The container includes:

- Node.js 22.6.0
- Storm model checker
- Python 3 with required packages
- All project files mounted at `/workspace`

#### 4. Run the Experiment

Inside the Docker container, run the experiment pipeline:

```bash
make run-experiment
```

This command executes the following steps:

1. **Generate PRISM models**: Converts all goal models in `examples/experiments/` to PRISM format
2. **Check properties**: Validates all properties using Storm model checker
3. **Extract metrics**: Collects performance and model statistics

The results are saved to:

- PRISM models: `output/*.prism`
- Property check results: `examples/experiments/props/results/*.result.storm`
- Metrics: `metrics.csv`

#### 5. Collect the Data

Exit the Docker container (type `exit` or press `Ctrl+D`) and collect the results:

**Metrics CSV file:**
The `metrics.csv` file contains comprehensive metrics for each model, including:

- Translation time and memory usage
- Model structure (goals, tasks, resources, nodes, variables)
- PRISM model characteristics (states, transitions, lines)
- Model checking performance (parsing time, construction time, checking time)
- Memory and CPU usage

**View the metrics:**

```bash
cat metrics.csv
# or
head -n 20 metrics.csv
```

#### 6. Plot the Results

Use the provided Python script to visualize the collected metrics:

**Display plots interactively:**

```bash
python3 experiments/plot_metrics.py
```

**Save plots as PNG files:**

```bash
python3 experiments/plot_metrics.py --save
```

**Save to a custom directory:**

```bash
python3 experiments/plot_metrics.py --save --output-dir result_plots
```

**View statistics:**

```bash
# Display min/max statistics for all metrics
python3 experiments/plot_metrics.py --stats

# Display relationship statistics for total_nodes
python3 experiments/plot_metrics.py --relationships
```

**Customize the plots:**
You can modify `experiments/plot_metrics.py` to:

- Add new metrics to visualize
- Change plot types (scatter, line, bar, etc.)
- Adjust plot styling and labels
- Add regression analysis or trend lines

### Experiment Workflow Summary

```bash
# 1. Add your files
cp my-model.txt examples/experiments/
cp my-properties.props examples/experiments/props/my-model.props

# 2. Launch container
make experiment

# 3. Inside container: run experiment
make run-experiment

# 4. Exit container
exit

# 5. View results
cat metrics.csv

# 6. Plot results
python3 experiments/plot_metrics.py --save
```

### Troubleshooting

**Container won't start:**

- Ensure Docker is running: `docker ps`
- Check if container already exists: `docker ps -a | grep experiment-container`
- Remove old container: `docker rm experiment-container`

**Experiment fails:**

- Check that goal model files are valid PiStar format
- Verify properties files are in correct PCTL syntax
- Check container logs: `docker logs experiment-container`

**Missing dependencies:**

- The container should have all dependencies pre-installed
- If issues occur, rebuild: `docker-compose -f experiments/docker-compose.storm.yml build experiment`

### Additional Resources

- [PRISM Model Checker Documentation](https://www.prismmodelchecker.org/manual/)
- [Storm Model Checker Documentation](https://www.stormchecker.org/)
- [PCTL Property Specification](https://www.prismmodelchecker.org/manual/PropertySpecification/PropertiesFiles)
