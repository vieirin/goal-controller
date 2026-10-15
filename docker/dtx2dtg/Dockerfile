# dtx2dtg's validator as the iStarDT-X writer's oracle (goal-controller#144
# item 2): cmg-york/istardt built at the commit the stress test pins, with
# nina2dv/xml-validation (which it validates with; published only to GitHub
# Packages, which needs a token) built from source first. Each file is run
# through `dtx2dtg -v`: the XSD, then the Schematron. Nothing of either is
# committed, and this image is never pushed. Never on the host: build and run
# with ./run.sh.
FROM maven:3.9-eclipse-temurin-17

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# nina2dv/xml-validation, pinned, into the image's local repository
ARG XML_VALIDATION_COMMIT=60b60601e84a288c4ff0c971e0e6893d3dab1bf2
WORKDIR /xml-validation
RUN curl -sSL "https://codeload.github.com/nina2dv/xml-validation/tar.gz/${XML_VALIDATION_COMMIT}" \
  | tar -xz --strip-components=1 \
 && mvn -B -q -DskipTests install

# cmg-york/istardt at the stress test's commit (scripts/istardt-stress/fetch.cjs)
ARG ISTARDT_COMMIT=649c9be2a0a45ee42d2056d9fed68016ac4f3689
WORKDIR /istardt
RUN curl -sSL "https://codeload.github.com/cmg-york/istardt/tar.gz/${ISTARDT_COMMIT}" \
  | tar -xz --strip-components=1 \
 && mvn -B -q -DskipTests package \
 && mvn -B -q dependency:build-classpath -Dmdep.outputFile=/istardt/classpath.txt

COPY validate.sh /validate.sh

# /models: the iStarDT-X files; /out: one result per file. dtx2dtg finds its
# XSD and Schematron from its own folder, so it runs from /istardt.
CMD ["sh", "/validate.sh", "/models", "/out"]
