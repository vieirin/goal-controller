# goal-controller

[![PRISM Model Compilation](https://github.com/vieirin/goal-controller/actions/workflows/prism-test.yaml/badge.svg)](https://github.com/vieirin/goal-controller/actions/workflows/prism-test.yaml)
[![Tests](https://github.com/vieirin/goal-controller/actions/workflows/test.yaml/badge.svg)](https://github.com/vieirin/goal-controller/actions/workflows/test.yaml)

### FAQ

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

1. install antlr4 by running:
   - `pip install antlr4-tools`
   - `brew install antrl` (MacOS, check how to install for your distribution)
2. install nvm and setup node version

   - ```bash
       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
       nvm install --lts
     ```

### Execution

#### Interactive CLI

You can use the interactive CLI to select and run models:

- `make cli` - Launches the interactive CLI
- `make cli-clean` - Launches the interactive CLI with the `--clean` flag (generates clean System modules without preserving old transitions)

#### Generating the mdp model

1. In a new terminal run `npx ts-node src/index.ts $GOAL_MODEL_FILE [--clean|-c]`
   - where `$GOAL_MODEL_FILE` is the downloaded goal model from [pistar](https://www.cin.ufpe.br/~jhcp/pistar/tool/#).
   - The default clean room example is under `examples/edgeModel.txt`
   - E.g: `npx ts-node src/index.ts ./examples/edgeModel.txt`
   - Use `--clean` or `-c` flag to skip preserving old System module transitions (see below)
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

**Command line:**

```bash
npx ts-node src/index.ts ./examples/edgeModel.txt --clean
# or
npx ts-node src/index.ts ./examples/edgeModel.txt -c
```

**Make targets:**

```bash
make cli-clean  # Interactive CLI with --clean flag
```

This is useful when you want to start with a clean System module or when the old transitions are no longer relevant.

This process outputs a file in `output/<file>.prism` this is the MDP input for the PRISM model checker. To generate the controller and states files please refer to the [EDGE specification](https://github.com/Genaina/Formalise23/tree/main?tab=readme-ov-file#instructions-to-synthesize-the-edge-goal-controller)
