# goal-controller

### FAQ

> #### How to execute this repo?

##### Alternative 1: VScode integrated environment (Recommended)

1. Open the repo on a new VSCode window
1. Make sure you have docker installed
1. Install the [devcontainer](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension, more info about it [here](https://code.visualstudio.com/docs/devcontainers/containers)
1. A dialog will ask you to reopen the repo in a container, accept it and wait for the build to finish
1. Once inside the dev container environment, hit `make exec` in the terminal to exec the translator

##### Alternative 2: Run manually from any terminal

1. install antlr4 by running: `pip install antlr4-tools`
2. run `make exec` in the project's root
