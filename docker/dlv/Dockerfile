# DLV 2 and z3 as goal-controller's oracle for contextual goal models
# (#151 D1.2, #153): DLV runs RE-Context's encoding of a model and gives
# its answer sets (the variants), z3 re-checks the analyses' satisfiability
# and implication verdicts. DLV 2's binaries are free for academic and
# non-commercial use and not redistributable: DLV is downloaded here at
# build time, never committed, and this image is never pushed. Never on the
# host: build and run with ./run.sh.
FROM --platform=linux/amd64 python:3.12-slim

WORKDIR /oracle

# DLV 2.1.2's static Linux binary, as the DLV system's release page serves it
ARG DLV_VERSION=2.1.2
ADD https://www.mat.unical.it/DLV2/releases/${DLV_VERSION}/dlv-${DLV_VERSION}-linux-x86_64 /usr/local/bin/dlv
RUN chmod +x /usr/local/bin/dlv && dlv --version

# z3 (MIT), pinned
RUN pip install --no-cache-dir z3-solver==4.13.4.0

COPY oracle.py ./

# /jobs: the .dlv programs and checks.json; /out: a result per job
CMD ["python3", "/oracle/oracle.py", "/jobs", "/out"]
