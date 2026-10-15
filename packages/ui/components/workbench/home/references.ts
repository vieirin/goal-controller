/**
 * What each engine's examples rest on, shown under its section of the start
 * screen: the engine's papers and tools, then where examples came from. By
 * examples/ folder; an entry naming `examples` is the source of those
 * (index paths), the others the engine's.
 */
export type Reference = {
  /** the citation: authors, title, venue, year */
  text: string;
  url?: string;
  /** the examples it is the source of (index paths) */
  examples?: readonly string[];
};

const EDGE = {
  text: 'R. Calinescu, G. N. Rodrigues. Goal Controller Synthesis for Self-Adaptive Systems. FormaliSE 2023, pp. 1–6.',
  url: 'https://ieeexplore.ieee.org/document/10164693/',
};
const PRISM = {
  text: 'M. Kwiatkowska, G. Norman, D. Parker. PRISM 4.0. CAV 2011.',
  url: 'https://doi.org/10.1007/978-3-642-22110-1_47',
};
const STORM = {
  text: 'C. Hensel, S. Junges, J.-P. Katoen, T. Quatmann, M. Volk. The probabilistic model checker Storm. STTT 2022.',
  url: 'https://www.stormchecker.org/',
};
const TAS = {
  text: 'D. Weyns, R. Calinescu. Tele Assistance: A self-adaptive service-based system exemplar. SEAMS 2015.',
  url: 'https://doi.org/10.1109/SEAMS.2015.27',
};

export const SECTION_REFERENCES: Readonly<
  Record<string, readonly Reference[]>
> = {
  edgeV2: [
    EDGE,
    PRISM,
    STORM,
    { ...TAS, examples: ['edgeV2/experiments/goalModel_TAS_3'] },
  ],
  edge: [
    EDGE,
    {
      text: 'M. V. Coelho Neto. Translating Extended Goal Models into Goal Management Controllers in PRISM. MSc dissertation, Universidade de Brasília, 2024.',
      url: 'https://repositorio.unb.br/bitstream/10482/54193/1/ManoelVieiraCoelhoNeto_DISSERT.pdf',
    },
    {
      text: 'EDGE case study: the hand-written PRISM model (Genaina/Formalise23).',
      url: 'https://github.com/Genaina/Formalise23/blob/main/EDGE-CaseStudy/EDGE_MDP.pm',
    },
    PRISM,
    STORM,
    { ...TAS, examples: ['edge/experiments/goalModel_TAS_3'] },
  ],
  goda: [
    {
      text: 'D. F. Mendonça, G. N. Rodrigues, R. Ali, V. Alves, L. Baresi. GODA: A goal-oriented requirements engineering framework for runtime dependability analysis. IST 2016.',
      url: 'https://www.sciencedirect.com/science/article/pii/S0950584916301471',
    },
    {
      text: 'G. Solano et al. Taming Uncertainty in the Assurance Process of SAS: a Goal-Oriented Approach. SEAMS 2019.',
      url: 'https://arxiv.org/abs/1905.02228',
    },
    {
      text: 'lesunb/pistarGODA-MDP: the GODA-MDP tool and its examples.',
      url: 'https://github.com/lesunb/pistarGODA-MDP',
      examples: ['goda/tas'],
    },
    {
      text: 'lesunb/bsn: the self-adaptive Body Sensor Network (SA-BSN).',
      url: 'https://github.com/lesunb/bsn',
      examples: ['goda/sa-bsn'],
    },
  ],
  mutrose: [
    {
      text: 'E. B. Gil, G. N. Rodrigues, P. Pelliccione, R. Calinescu. Mission specification and decomposition for multi-robot systems. RAS 163, 2023.',
      url: 'https://www.sciencedirect.com/science/article/pii/S0921889023000258',
    },
    {
      text: 'lesunb/MutRoSe-Repository: the MutRoSe decomposer.',
      url: 'https://github.com/lesunb/MutRoSe-Repository',
    },
    {
      text: 'ericbg27/MutRoSe-Docs: MutRoSe’s documentation.',
      url: 'https://github.com/ericbg27/MutRoSe-Docs',
    },
    {
      text: 'CPeluti/mutrose-vscode: LabSampleLogistics, its test model (MIT).',
      url: 'https://github.com/CPeluti/mutrose-vscode',
      examples: ['mutrose/lab-sample-logistics'],
    },
  ],
  grl: [
    {
      text: 'ITU-T Z.151: User Requirements Notation (URN), whose GRL this is.',
    },
    {
      text: 'JUCMNAV/jUCMNavPlus: the jUCMNav tool, whose evaluations the examples are checked against.',
      url: 'https://github.com/JUCMNAV/jUCMNavPlus',
    },
    {
      text: 'gmussbacher/seg.jUCMNav: modelExamples/SmartHome2.jucm (EPL 1.0).',
      url: 'https://github.com/gmussbacher/seg.jUCMNav',
      examples: ['grl/grl-smart-home'],
    },
  ],
  sleec: [
    {
      text: 'S. Getir Yaman et al. Specification and Validation of Normative Rules for Autonomous Agents. FASE 2023.',
      url: 'https://link.springer.com/chapter/10.1007/978-3-031-30826-0_13',
    },
    {
      text: 'Its extended version, JSS 2025.',
      url: 'https://arxiv.org/abs/2307.03697',
    },
    { text: 'SLEEC: the project.', url: 'https://sleec.github.io/' },
  ],
  'pistar-ext': [
    {
      text: 'J. Pimentel, J. Castro. piStar Tool: A Pluggable Online Tool for Goal Modeling. RE 2018.',
      url: 'https://github.com/jhcp/piStar/blob/master/RESEARCH.md',
    },
    {
      text: 'piStar-ext: Supporting the Creation of iStar Extensions with the piStar Tool. iStar 2020.',
      url: 'https://ceur-ws.org/Vol-2641/paper_06.pdf',
    },
    {
      text: 'F. Dalpiaz, X. Franch, J. Horkoff. iStar 2.0 Language Guide. 2016.',
      url: 'https://arxiv.org/abs/1605.07767',
    },
    {
      text: 'Gonçalves et al. iStar4RationalAgents. ER 2019.',
      examples: ['pistar-ext/iStar4RationalAgents.txt'],
    },
  ],
};
