FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye

RUN apt update
RUN apt install -y python3-pip
RUN pip install antlr4-tools
RUN ln -sf /usr/local/bin/antlr4 /usr/local/bin/antlr
ENV PATH="$PATH:/usr/local/go/bin"
RUN mkdir /tmp/go
COPY go1.21.3.linux-amd64.tar.gz /tmp/go
WORKDIR /tmp/go
RUN tar -C /usr/local -xzf go1.21.3.linux-amd64.tar.gz
RUN go install -v golang.org/x/tools/cmd/goimports@latest
WORKDIR /