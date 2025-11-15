# goal-controller

[![PRISM Model Test](https://github.com/vieirin/goal-controller/actions/workflows/prism-test.yaml/badge.svg)](https://github.com/vieirin/goal-controller/actions/workflows/prism-test.yaml)

### FAQ

## How to execute this repo?

### Installation

#### Alternative 1: VScode integrated environment (Recommended)

1. Open the repo on a new VSCode window
1. Make sure you have docker installed
1. Install the [devcontainer](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension, more info about it [here](https://code.visualstudio.com/docs/devcontainers/containers)
1. A dialog will ask you to reopen the repo in a container, accept it and wait for the build to finish
1. Once inside the dev container environment, hit `make exec` in the terminal to exec the translator

##### Alternative 2: Run manually from any terminal

1. install antlr4 by running:
   - `pip install antlr4-tools`
   - `brew install antrl` (MacOS, check how to install for your distribution)
2. install nvm and setup node version

   - ```bash
       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
       nvm install --lts
     ```

3. install go ([installation instruction](https://go.dev/doc/install))
   - Mac users can install it by running `brew install go`

### Execution

#### Generating the mdp model

1. In a new terminal run `npx ts-node src/index.ts $GOAL_MODEL_FILE`
   - where `$GOAL_MODEL_FILE` is the downloaded goal model from [pistar](https://www.cin.ufpe.br/~jhcp/pistar/tool/#).
   - The default clean room example is under `examples/edgeModel.txt`
   - E.g: `npx ts-node src/index.ts ./examples/edgeModel.txt`
2. If successful you should see the string `The file was saved!` in the terminal.
3. Add the goal model to the goalmngt folder
   - `cp $GOAL_MODEL_FILE goalmgmt/edgeModel.txt`
   - E.g: `cp examples/edgeModel.txt goalmgmt/edgeModel.txt`

This process outputs a file in `output/edge.mp` this is the MDP input for the PRISM model checker. To generate the controller and states files please refer to the [EDGE specification](https://github.com/Genaina/Formalise23/tree/main?tab=readme-ov-file#instructions-to-synthesize-the-edge-goal-controller)

#### Generating the controller and the execution plans

1. Go to the manager folder.
   - `cd goalmgmt`
2. Execute the GoalManagement providing the goal model, the states map and the states transition files
   - `go run main.go edgeModel.txt states/state_list states/controller.txt`
   - where `state_list` and `controller.txt` are the files exported from the PRISM model checker, you can name it whatever you want but it needs to be saved whithin the `goalmgmt` folder since go doesn't allow to access files outside its module root directory
3. You should see the plan execution after running ![Success output](goalmgmt/docs/successExec.png 'Success output')
4. To update the probability of the leaf goals you can update the file `goalmgmt/manager/config.go` ![](goalmgmt/manager/probabilityConfig.png 'Probability configuration')
