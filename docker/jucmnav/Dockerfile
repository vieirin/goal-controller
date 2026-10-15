# jUCMNav's own evaluation as goal-controller's GRL oracle (#105 D1):
# jUCMNavPlus built at a pinned commit, with OracleTest added to its test
# fragment and run alone under a virtual display, as its CI runs its tests.
# Never on the host: build and run with ./run.sh.
FROM maven:3.9-eclipse-temurin-21

RUN apt-get update \
 && apt-get install -y --no-install-recommends xvfb libgtk-3-0 curl git \
 && rm -rf /var/lib/apt/lists/*

# JUCMNAV/jUCMNavPlus, pinned; one commit of it, as Tycho's build qualifier
# (jgit) reads the last commit's time
ARG JUCMNAV_COMMIT=ffe86d6022d826611b4062a892c2eda65bfb1153
WORKDIR /jucmnav
RUN curl -sSL "https://codeload.github.com/JUCMNAV/jUCMNavPlus/tar.gz/${JUCMNAV_COMMIT}" \
  | tar -xz --strip-components=1 \
 && git init -q && git add -A \
 && git -c user.name=oracle -c user.email=oracle@localhost commit -qm "jUCMNavPlus ${JUCMNAV_COMMIT}"

# the build once, tests skipped: Eclipse, Tycho and the plugins in the image
RUN mvn -B -q -DskipTests -Dtycho.localArtifacts=ignore install

# the workbench's SVG icons load through AWT, which needs these X libraries
RUN apt-get update \
 && apt-get install -y --no-install-recommends libxtst6 libxi6 libxrender1 \
 && rm -rf /var/lib/apt/lists/*

COPY OracleTest.java seg.jUCMNav.tests/src/seg/jUCMNav/tests/oracle/OracleTest.java

# /seeds: the .jucm files; /out: a CSV per seed
CMD ["sh", "-c", "xvfb-run -a mvn -B -pl seg.jUCMNav.tests -Dtest=OracleTest -Dsurefire.failIfNoSpecifiedTests=false -DfailIfNoTests=false verify && ls -la /out"]
