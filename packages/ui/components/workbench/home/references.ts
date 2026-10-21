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

/**
 * DSM3-goals, the generic piStar editor KAOS's and NFR's seeds come from:
 * its own welcome models, copied byte for byte (via istar-ts's
 * fixtures/dsm3/, read on 2026-10-16). No licence is stated on the site or
 * in its scripts; they are reproduced as data, with this attribution.
 */
const DSM3_GOALS = {
  text: 'J. Pimentel. DSM3-goals: KAOS, the NFR Framework and iStar 2.0 in one piStar editor (its welcome models; no licence stated).',
  url: 'https://www.cin.ufpe.br/~jhcp/dsm3goals/',
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
  tropos4as: [
    {
      text: 'M. Morandini, L. Penserini, A. Perini. Operational Semantics of Goal Models in Adaptive Agents. AAMAS 2009: the goal lifecycle the engine runs, and Fig. 1, the Cleaner Agent.',
      url: 'https://www.ifaamas.org/Proceedings/aamas09/pdf/01_Full%20Papers/02_11_FP_0633.pdf',
      examples: ['tropos4as/cleaner-agent'],
    },
    {
      text: 'M. Morandini, A. Perini, A. Marchetto. Empirical Evaluation of Tropos4AS Modelling. iStar 2011: Fig. 1, patient monitoring, its failure model.',
      url: 'https://ceur-ws.org/Vol-766/paper03.pdf',
      examples: ['tropos4as/patient-monitoring'],
    },
  ],
  cgm: [
    {
      text: 'R. Ali, F. Dalpiaz, P. Giorgini. A goal-based framework for contextual requirements modeling and analysis. Requirements Engineering 15 (2010): Fig. 2, the museum guide, Fig. 4, the context analysis of C1, and Fig. 13, its minimum-cost fragment.',
      url: 'https://doi.org/10.1007/s00766-010-0110-z',
      examples: ['cgm/museum-guide', 'cgm/museum-guide-costs'],
    },
    {
      text: 'R. Ali, F. Dalpiaz, P. Giorgini. Reasoning with contextual requirements: detecting inconsistency and conflicts. Information and Software Technology 55 (2013): Fig. 1, the smart home, its contexts and the analysis of ϕ1.',
      url: 'https://doi.org/10.1016/j.infsof.2012.06.013',
      examples: ['cgm/smart-home'],
    },
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
  kaos: [
    {
      text: 'A. Dardenne, A. van Lamsweerde, S. Fickas. Goal-directed requirements acquisition. Science of Computer Programming 20(1–2), 1993.',
      url: 'https://doi.org/10.1016/0167-6423(93)90021-G',
    },
    {
      text: 'A. van Lamsweerde. Requirements Engineering: From System Goals to UML Models to Software Specifications. Wiley, 2009.',
    },
    { ...DSM3_GOALS, examples: ['kaos/kaos-welcome.txt'] },
    // the KAOS stress test's seeds (goal-controller#181)
    {
      text: 'A. Cailliau, A. van Lamsweerde. A probabilistic framework for goal-oriented risk analysis. RE 2012.',
      url: 'https://doi.org/10.1109/RE.2012.6345805',
      examples: ['kaos/las', 'kaos/ambulance'],
    },
    {
      text: 'A. Cailliau, A. van Lamsweerde. Assessing requirements-related risks through probabilistic goals and obstacles. Requirements Engineering 18(2):129–146, 2013 (§6.3, re-keyed from its figures).',
      url: 'https://doi.org/10.1007/s00766-013-0168-5',
      examples: ['kaos/carpooling'],
    },
    {
      text: 'A. Cailliau, A. van Lamsweerde. Handling knowledge uncertainty in risk-based requirements engineering. RE 2015.',
      url: 'https://doi.org/10.1109/RE.2015.7320413',
      examples: ['kaos/ambulance', 'kaos/fire-alarm'],
    },
    {
      text: 'A. Cailliau, A. van Lamsweerde. Runtime monitoring and resolution of probabilistic obstacles to system goals. SEAMS 2017.',
      url: 'https://doi.org/10.1109/SEAMS.2017.5',
      examples: ['kaos/ambulance', 'kaos/flood'],
    },
    {
      text: 'M. Sabetzadeh, D. Falessi, L. Briand, S. Di Alesio, D. McGeorge, V. Åhjem, J. Borg. Combining Goal Models, Expert Elicitation, and Probabilistic Simulation for Qualification of New Technology. HASE 2011 (Fig. 2, re-keyed as far as it prints; Sec. V withholds the elicited quantities, goal-controller#199).',
      url: 'https://doi.org/10.1109/HASE.2011.25',
      examples: ['kaos/mooring'],
    },
    // quantitative goals (goal-controller#193)
    {
      text: "E. Letier, A. van Lamsweerde. Reasoning about partial goal satisfaction for requirements and design engineering. SIGSOFT'04/FSE-12 (§3.2–3.3's mine pump, re-keyed as far as it prints; goal-controller#208).",
      url: 'https://doi.org/10.1145/1029894.1029905',
      examples: ['kaos/mine-pump'],
    },
    {
      text: 'ancailliau/KAOSTools: KAOSTools and its London Ambulance model, las.kaos (MIT).',
      url: 'https://github.com/ancailliau/KAOSTools',
      examples: ['kaos/las'],
    },
    {
      text: 'ancailliau/ADS: the ambulance dispatching system and its KAOS models, las.kaos and obstacles.kaos (MIT).',
      url: 'https://github.com/ancailliau/ADS',
      examples: ['kaos/ambulance'],
    },
    // the fire alarm's estimates RE'15 doesn't print (goal-controller#197)
    {
      text: "ancailliau/phd-thesis: A. Cailliau's fire-alarm model, running-examples-others/firesystem.kaos at 6a9f5fd (used with the owner's approval; the repository states no licence).",
      url: 'https://github.com/ancailliau/phd-thesis/blob/6a9f5fd81ac0be560d30803f04702d23d5622893/running-examples-others/firesystem.kaos',
      examples: ['kaos/fire-alarm'],
    },
    // SEAMS'17's flood detection system (goal-controller#191, #200)
    {
      text: "ancailliau/phd-thesis: A. Cailliau's flood detection model, running-example-fds/model2.kaos at 6a9f5fd (used with the owner's approval; the repository states no licence).",
      url: 'https://github.com/ancailliau/phd-thesis/blob/6a9f5fd81ac0be560d30803f04702d23d5622893/running-example-fds/model2.kaos',
      examples: ['kaos/flood'],
    },
    {
      text: 'ancailliau/FloodingSimulator: the flood detection model with its conflicts, FloodingSimulator/Model.kaos at ef6db9f (MIT).',
      url: 'https://github.com/ancailliau/FloodingSimulator/blob/ef6db9fd8ac0e0a038c2006f4633ace84c41b725/FloodingSimulator/Model.kaos',
      examples: ['kaos/flood'],
    },
    // the CAIRIS corpus (goal-controller#192): its exemplars, one model per environment
    {
      text: 'S. Faily. Designing Usable and Secure Software with IRIS and CAIRIS. Springer, 2018.',
      url: 'https://doi.org/10.1007/978-3-319-75493-2',
      examples: [
        'kaos/cairis-acme-water-day',
        'kaos/cairis-acme-water-night',
        'kaos/cairis-balkan-rail-balkan-rail-corprate-hq',
        'kaos/cairis-balkan-rail-central-station',
        'kaos/cairis-balkan-rail-model',
        'kaos/cairis-neurogrid-core-technology',
        'kaos/cairis-neurogrid-psychosis',
        'kaos/cairis-neurogrid-stroke',
      ],
    },
    {
      text: 'cairis-platform/cairis: CAIRIS and its exemplars NeuroGrid, ACME Water and Balkan Rail, examples/exemplars at 44cc57d (Apache 2.0).',
      url: 'https://github.com/cairis-platform/cairis/tree/44cc57ddd08fb41a8d028411ec712847eefc9be5/examples/exemplars',
      examples: [
        'kaos/cairis-acme-water-day',
        'kaos/cairis-acme-water-night',
        'kaos/cairis-balkan-rail-balkan-rail-corprate-hq',
        'kaos/cairis-balkan-rail-central-station',
        'kaos/cairis-balkan-rail-model',
        'kaos/cairis-neurogrid-core-technology',
        'kaos/cairis-neurogrid-psychosis',
        'kaos/cairis-neurogrid-stroke',
      ],
    },
  ],
  nfr: [
    {
      text: 'L. Chung, B. A. Nixon, E. Yu, J. Mylopoulos. Non-Functional Requirements in Software Engineering. Kluwer, 2000.',
      url: 'https://doi.org/10.1007/978-1-4615-5269-7',
    },
    { ...DSM3_GOALS, examples: ['nfr/nfr-welcome.txt'] },
  ],
};
