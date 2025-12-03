FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye

RUN apt update
RUN apt install -y python3-pip
RUN pip install antlr4-tools
RUN ln -sf /usr/local/bin/antlr4 /usr/local/bin/antlr
WORKDIR /