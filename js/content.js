// All educational content lives here so it can be reviewed in one place.

export const ORGANELLES = {
  membrane: {
    short: 'Membrane',
    name: 'Plasma membrane',
    role: 'An asymmetric phospholipid bilayer with cholesterol, embedded proteins, and a sugar-coated outer surface (glycocalyx).',
    facts: [
      'Na⁺/K⁺-ATPase pumps 3 Na⁺ out and 2 K⁺ in per ATP; digoxin inhibits it, raising intracellular Ca²⁺ in cardiac myocytes.',
      'Cholesterol buffers membrane fluidity across temperatures.',
    ],
  },
  microvilli: {
    name: 'Microvilli',
    role: 'Finger-like membrane projections with an actin core that multiply absorptive surface area (intestinal brush border, renal proximal tubule).',
    facts: [
      'Brush-border enzymes such as lactase sit on microvilli; lactase deficiency causes osmotic diarrhea after dairy.',
      'Unlike cilia, microvilli contain actin, not microtubules, and do not beat.',
    ],
  },
  nucleus: {
    name: 'Nucleus',
    role: 'Houses the genome and is the site of transcription and mRNA processing (5′ capping, splicing, poly-A tail).',
    facts: [
      'The outer nuclear membrane is continuous with the rough ER.',
      'Nuclear pores let mRNA out and imported proteins (with a nuclear localization signal) in.',
      'Lamin A mutations (LMNA) cause Hutchinson-Gilford progeria.',
    ],
  },
  nucleolus: {
    name: 'Nucleolus',
    role: 'Non-membrane-bound region where RNA polymerase I transcribes rRNA and ribosomal subunits are assembled.',
    facts: [
      'RNA polymerase I makes 28S, 18S, and 5.8S rRNA; 5S rRNA is made by RNA polymerase III outside the nucleolus.',
      'Large, prominent nucleoli signal heavy protein synthesis, as in many cancer cells.',
    ],
  },
  rer: {
    short: 'Rough ER',
    name: 'Rough endoplasmic reticulum',
    role: 'Ribosome-studded sheets that synthesize secretory, membrane, and lysosomal proteins and begin N-linked glycosylation.',
    facts: [
      'Abundant in cells that secrete protein: plasma cells (antibodies), goblet cells (mucus), pancreatic acinar cells (enzymes).',
      'Nissl bodies in neurons are rough ER; they are absent from the axon.',
      'Lysosomal enzymes start here, then travel to the Golgi to be tagged with mannose-6-phosphate.',
    ],
  },
  ribosome: {
    short: 'Ribosomes',
    name: 'Free ribosomes',
    role: 'Translate proteins that stay in the cytosol or go to peroxisomes, the nucleus, or mitochondria (nuclear-encoded).',
    facts: [
      'Eukaryotic ribosomes are 80S (60S + 40S); bacterial ribosomes are 70S (50S + 30S).',
      'That difference lets aminoglycosides, tetracyclines, and macrolides target bacteria selectively.',
    ],
  },
  ser: {
    short: 'Smooth ER',
    name: 'Smooth endoplasmic reticulum',
    role: 'Ribosome-free tubules that make steroids and phospholipids and detoxify drugs with cytochrome P450 enzymes.',
    facts: [
      'Abundant in hepatocytes and in steroid-producing cells of the adrenal cortex and gonads.',
      'Glucose-6-phosphatase sits in hepatocyte ER; its deficiency causes von Gierke disease (glycogen storage type I).',
      'Inducers such as rifampin and carbamazepine upregulate P450 enzymes and lower levels of other drugs.',
    ],
  },
  golgi: {
    short: 'Golgi',
    name: 'Golgi apparatus',
    role: 'Receives proteins from the ER at its cis face, modifies and sorts them, and ships them from its trans face.',
    facts: [
      'Modifies N-linked oligosaccharides, adds O-linked sugars to serine and threonine, and sulfates proteoglycans.',
      'Tags lysosomal enzymes with mannose-6-phosphate; failure of that tag causes I-cell disease.',
    ],
  },
  vesicle: {
    short: 'Vesicles',
    name: 'Transport vesicles',
    role: 'Membrane bubbles that carry cargo between compartments.',
    facts: [
      'COPII coats carry cargo forward from ER to Golgi; COPI coats carry it back from Golgi to ER.',
      'Clathrin coats carry cargo from the trans-Golgi to lysosomes and from the plasma membrane into endosomes.',
    ],
  },
  mitochondrion: {
    short: 'Mitochondrion',
    name: 'Mitochondria',
    role: 'Run the TCA cycle, fatty acid β-oxidation, and oxidative phosphorylation on the folded inner membrane (cristae).',
    facts: [
      'Have their own circular DNA, inherited only from the mother.',
      'Heteroplasmy (a mix of normal and mutant mtDNA) explains variable severity, as in MELAS.',
      'Cyanide and carbon monoxide halt the electron transport chain at complex IV.',
    ],
  },
  lysosome: {
    short: 'Lysosome',
    name: 'Lysosomes',
    role: 'Acidic sacs of hydrolases that break down macromolecules, worn-out organelles (autophagy), and engulfed material.',
    facts: [
      'Lysosomal storage diseases each lack one hydrolase: Tay-Sachs (hexosaminidase A), Gaucher (glucocerebrosidase), Fabry (α-galactosidase A).',
      'Hydrolases reach the lysosome only if the Golgi has tagged them with mannose-6-phosphate.',
    ],
  },
  peroxisome: {
    short: 'Peroxisome',
    name: 'Peroxisomes',
    role: 'Oxidize very-long-chain and branched-chain fatty acids, make plasmalogens, and break down hydrogen peroxide with catalase.',
    facts: [
      'Zellweger syndrome: failed peroxisome biogenesis (PEX genes) causes hypotonia, seizures, and hepatomegaly.',
      'X-linked adrenoleukodystrophy: an ABCD1 defect lets very-long-chain fatty acids build up in adrenal glands and white matter.',
      'Refsum disease: phytanic acid accumulates because α-oxidation fails.',
    ],
  },
  centrosome: {
    name: 'Centrosome',
    role: 'The main microtubule-organizing center: a pair of centrioles, each built from nine triplets of microtubules.',
    facts: [
      'Duplicates before mitosis to form the two spindle poles.',
      'Basal bodies at the base of cilia share the same 9 × 3 architecture.',
    ],
  },
  microtubule: {
    name: 'Microtubules',
    role: 'Hollow α/β-tubulin polymers that carry cargo, form the mitotic spindle, and make up cilia and flagella.',
    facts: [
      'Kinesin carries cargo toward the + end (anterograde); dynein carries it toward the − end (retrograde).',
      'Drugs: colchicine (gout) and vincristine/vinblastine block polymerization; paclitaxel locks them in place.',
      'Defective dynein arms cause primary ciliary dyskinesia (Kartagener syndrome when situs inversus is present).',
    ],
  },
  actin: {
    short: 'Actin',
    name: 'Actin microfilaments',
    role: 'Thin filaments that shape the cell cortex and drive cell movement, cytokinesis, and muscle contraction.',
    facts: [
      'Form the core of microvilli.',
      'Wiskott-Aldrich syndrome: loss of WAS protein disrupts actin reorganization in immune cells.',
    ],
  },
  intermediate: {
    short: 'Intermediate filaments',
    name: 'Intermediate filaments',
    role: 'Rope-like filaments that give the cell mechanical strength; their type depends on the tissue.',
    facts: [
      'Pathologists stain for them to identify a tumor’s tissue of origin.',
      'Vimentin (mesenchyme), desmin (muscle), cytokeratin (epithelium), GFAP (glia), neurofilaments (neurons).',
    ],
  },
};

export const QUESTION = {
  stem: [
    'A 10-month-old boy is brought to the clinic because he is not yet sitting without support and has gained little weight over the past 3 months. He was born at term after an uncomplicated pregnancy.',
    'Examination shows coarse facial features, enlarged gums, and clouded corneas. Range of motion is restricted at the shoulders, elbows, and hips. Laboratory studies show markedly increased plasma activity of multiple lysosomal hydrolases. Fibroblasts cultured from a skin biopsy contain numerous large cytoplasmic inclusions.',
  ],
  prompt: 'A defect in which of the following processes is the most likely cause of this patient’s condition?',
  choices: [
    { id: 'A', text: 'Addition of mannose-6-phosphate to proteins in the Golgi apparatus' },
    { id: 'B', text: 'Cotranslational translocation of proteins into the rough endoplasmic reticulum' },
    { id: 'C', text: 'Import of matrix proteins into peroxisomes' },
    { id: 'D', text: 'Retrograde transport of vesicles from the Golgi apparatus to the ER' },
    { id: 'E', text: 'Ubiquitin tagging of misfolded proteins for proteasomal degradation' },
  ],
  answer: 'A',
  explanation: [
    'This child has <b>I-cell disease</b> (mucolipidosis type II), an autosomal recessive disorder caused by deficiency of <b>N-acetylglucosamine-1-phosphotransferase</b> (encoded by <i>GNPTAB</i>).',
    'Lysosomal hydrolases are made on the rough ER and travel to the <b>cis-Golgi</b>, where this enzyme starts the mannose-6-phosphate (M6P) tag. In the <b>trans-Golgi</b>, M6P receptors capture tagged enzymes and send them to lysosomes.',
    'Without the tag, the hydrolases follow the default secretory pathway and leave the cell, which explains the <b>high plasma enzyme levels</b>. Lysosomes, now empty of working enzymes, fill with undigested material and appear as the <b>inclusions</b> that give the disease its name.',
  ],
  whyNot: {
    B: 'Failed entry into the rough ER would block secretory and membrane proteins broadly; hydrolases could not be secreted at high levels.',
    C: 'Defective peroxisomal import causes Zellweger syndrome: hypotonia, seizures, hepatomegaly, and very-long-chain fatty acid buildup, not secreted lysosomal enzymes.',
    D: 'COPI-mediated retrograde transport returns escaped ER proteins; its loss does not specifically divert lysosomal enzymes out of the cell.',
    E: 'Impaired ubiquitin–proteasome tagging leads to accumulation of misfolded cytosolic proteins, not loss of lysosomal enzyme targeting.',
  },
  objective: 'Lysosomal enzymes need a mannose-6-phosphate tag, added in the cis-Golgi, to be routed to lysosomes. Without it (I-cell disease), they are secreted into the blood and lysosomes fill with undigested substrates.',
};

export const SPOT_IT = [
  {
    prompt: 'Click the site of ribosomal RNA synthesis.',
    answer: 'nucleolus',
    feedback: 'RNA polymerase I in the nucleolus transcribes most rRNA, and ribosomal subunits are assembled here.',
  },
  {
    prompt: 'A patient with acute gout is given a drug that binds tubulin and prevents polymerization. Click the structure it acts on.',
    answer: 'microtubule',
    feedback: 'Colchicine blocks microtubule polymerization, which impairs neutrophil migration and degranulation in the gouty joint.',
  },
  {
    prompt: 'Click where very-long-chain fatty acids undergo β-oxidation.',
    answer: 'peroxisome',
    feedback: 'Very-long-chain fatty acids are shortened in peroxisomes; their buildup marks X-linked adrenoleukodystrophy and Zellweger syndrome.',
  },
  {
    prompt: 'Hepatocytes inactivate many drugs with cytochrome P450 enzymes. Click the organelle where those enzymes sit.',
    answer: 'ser',
    feedback: 'Cytochrome P450 enzymes are embedded in the smooth ER membrane, which is why hepatocytes have so much of it.',
  },
  {
    prompt: 'Click where mannose-6-phosphate is added to lysosomal enzymes.',
    answer: 'golgi',
    feedback: 'The tag is added in the cis-Golgi; the trans-Golgi then sorts tagged enzymes to lysosomes.',
  },
  {
    prompt: 'Cyanide poisoning stops ATP production by inhibiting complex IV. Click where complex IV sits.',
    answer: 'mitochondrion',
    feedback: 'Complex IV (cytochrome c oxidase) is part of the electron transport chain on the inner mitochondrial membrane.',
  },
];
