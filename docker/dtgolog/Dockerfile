# DT-Golog as goal-controller's iStar-DT oracle (#117 D1.2): SWI-Prolog with
# Soutchanski's DT-Golog interpreter, downloaded here at build time and
# patched as RLGen's README says, and dtg2sim's interface to it at a pinned
# commit. DT-Golog.pl's licence forbids redistribution: it is never
# committed, and this image is never pushed. Never on the host: build and
# run with ./run.sh.
FROM swipl:9.2.9

WORKDIR /oracle

# Soutchanski's interpreter (October 1999), as its author's page serves it;
# RLGen's patches for SWI-Prolog: no `pragma(debug)`, `not` as an operator,
# a `cputime/1` (README, "Make the following changes")
ADD https://www.cs.ryerson.ca/~mes/publications/appendix/appendixC/dtgolog DT-Golog.pl
# in place of the pragma, so `not` is an operator before its first use
RUN sed -i 's|^\(:- pragma(debug).*\)$|/* \1 */\n:- op(900, fy, [not]).\n(not X) := (\\+ X).\ncputime(5).|' DT-Golog.pl \
 && grep -q '^:- op(900, fy, \[not\])' DT-Golog.pl

# dtg2sim's interface (it consults DT-Golog.pl and DT-Golog-Ext.pl beside it)
ARG DTG2SIM_COMMIT=ed424ff804e330cacb90daa08b3446d95d202157
ADD https://raw.githubusercontent.com/cmg-york/dtg2sim/${DTG2SIM_COMMIT}/scripts/QE/DT-Golog-Iface.pl DT-Golog-Iface.pl
ADD https://raw.githubusercontent.com/cmg-york/dtg2sim/${DTG2SIM_COMMIT}/scripts/QE/DT-Golog-Ext.pl DT-Golog-Ext.pl

COPY shim.pl oracle.pl run.pl ./

# /specs: the .pl files; /out: one result per spec
CMD ["swipl", "/oracle/oracle.pl", "/specs", "/out"]
