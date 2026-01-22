"use client";

import { useMemo, useState } from "react";

const TAX_DATA_BY_YEAR = {
  "2024": {
    federalBrackets: [
      { upTo: 55867, rate: 0.15 },
      { upTo: 111733, rate: 0.205 },
      { upTo: 173205, rate: 0.26 },
      { upTo: 246752, rate: 0.29 },
      { upTo: Infinity, rate: 0.33 },
    ],
    quebecBrackets: [
      { upTo: 51780, rate: 0.14 },
      { upTo: 103545, rate: 0.19 },
      { upTo: 127020, rate: 0.24 },
      { upTo: Infinity, rate: 0.2575 },
    ],
    federalBpa: 15000,
    quebecBpa: 18056,
    federalCreditRate: 0.15,
    quebecCreditRate: 0.14,
  },
  "2025": {
    federalBrackets: [
      { upTo: 57375, rate: 0.15 },
      { upTo: 114750, rate: 0.205 },
      { upTo: 177882, rate: 0.26 },
      { upTo: 253414, rate: 0.29 },
      { upTo: Infinity, rate: 0.33 },
    ],
    quebecBrackets: [
      { upTo: 53255, rate: 0.14 },
      { upTo: 106495, rate: 0.19 },
      { upTo: 129590, rate: 0.24 },
      { upTo: Infinity, rate: 0.2575 },
    ],
    federalBpa: 16129,
    quebecBpa: 18571,
    federalCreditRate: 0.15,
    quebecCreditRate: 0.14,
  },
};

type TaxYear = keyof typeof TAX_DATA_BY_YEAR;
const getTaxData = (year: string) =>
  TAX_DATA_BY_YEAR[year as TaxYear] ?? TAX_DATA_BY_YEAR["2024"];

const currency = new Intl.NumberFormat("fr-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("fr-CA", {
  style: "percent",
  maximumFractionDigits: 1,
});

type FormState = {
  taxYear: string;
  province: string;
  employmentIncome: string;
  otherIncome: string;
  incomeTaxDeducted: string;
  quebecIncomeTaxDeducted: string;
  cppContrib: string;
  eiPremium: string;
  rrqQpipContrib: string;
  rqapContrib: string;
  rrsp: string;
  otherDeductions: string;
  otherCredits: string;
  otherQuebecCredits: string;
  includeBPA: boolean;
};

type AssistanceProfile = "salarie" | "etudiant" | "autonome" | "mixte";

const defaultState: FormState = {
  taxYear: "2025",
  province: "qc",
  employmentIncome: "0",
  otherIncome: "0",
  incomeTaxDeducted: "0",
  quebecIncomeTaxDeducted: "0",
  cppContrib: "0",
  eiPremium: "0",
  rrqQpipContrib: "0",
  rqapContrib: "0",
  rrsp: "0",
  otherDeductions: "0",
  otherCredits: "0",
  otherQuebecCredits: "0",
  includeBPA: true,
};

const assistanceSteps = [
  {
    id: "docs",
    title: "Rassembler les documents",
    description:
      "T4, Releve 1 (si Quebec), feuillets de placements, recus REER, frais medicaux, frais de garde.",
  },
  {
    id: "revenus",
    title: "Verifier les revenus",
    description:
      "Saisir les montants des feuillets (revenu d'emploi, autres revenus, revenus de placement).",
  },
  {
    id: "deductions",
    title: "Appliquer les deductions",
    description:
      "REER, frais admissibles, pensions alimentaires et autres deductions autorisees.",
  },
  {
    id: "credits",
    title: "Ajouter les credits",
    description:
      "Montant personnel de base, cotisations sociales, credits provinciaux, et credits personnels.",
  },
  {
    id: "validation",
    title: "Verifier les incoherences",
    description:
      "Comparer les retenues a la source avec l'impot estime et verifier les cases manquantes.",
  },
  {
    id: "soumission",
    title: "Soumettre la declaration",
    description:
      "Choisir la methode (impotnet/logiciel), conserver les preuves et confirmer l'avis de cotisation.",
  },
];

const assistanceNotes: Record<AssistanceProfile, string> = {
  salarie:
    "Profil salarie : concentrez-vous sur T4, RL-1 et les credits de base. Les deductions sont souvent limitees.",
  etudiant:
    "Profil etudiant : ajoutez les credits pour etudes, interets sur pret et frais de scolarite.",
  autonome:
    "Profil travailleur autonome : conservez un registre des revenus/depenses, TPS/TVQ, et ajustez les acomptes.",
  mixte:
    "Profil mixte : combinez T4 et revenus autonomes, et assurez-vous de separer les depenses admissibles.",
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};


const normalizeNumber = (value: string) => {
  const cleaned = value.replace(/[^\d,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  const splitCentsMatch = value.match(/(\d{1,3})\s+(\d{2})\b/);
  if (splitCentsMatch) {
    return `${splitCentsMatch[1]}.${splitCentsMatch[2]}`;
  }

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }

  return normalized;
};

const stripLeadingBoxNumber = (value: string) =>
  value.replace(
    /^\s*(?:case|boite|box|rl-1|rl 1|releve 1|releve)?\s*(?:10|14|16|17|18|22|B|E)\s*[:\-]?\s*/i,
    ""
  );

const extractNumber = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }
  const withoutBox = stripLeadingBoxNumber(value);
  const withoutPrefix = withoutBox.replace(/^[^\d-]+/, "");
  const parsed = Number(normalizeNumber(withoutPrefix));
  return Number.isFinite(parsed) ? String(parsed) : undefined;
};

const matchFirstNumber = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return extractNumber(match[1]);
    }
  }
  return undefined;
};

const matchSplitCents = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return `${match[1]}.${match[2]}`;
    }
  }
  return undefined;
};

const extractNumberFromFragment = (fragment: string) => {
  const splitCents = fragment.match(/(\d[\d ]*)\s+(\d{2})\b/);
  if (splitCents?.[1] && splitCents?.[2]) {
    return extractNumber(`${splitCents[1]} ${splitCents[2]}`);
  }

  const decimal = fragment.match(/(\d[\d ]*)[,.](\d{2})\b/);
  if (decimal?.[1] && decimal?.[2]) {
    return extractNumber(`${decimal[1]}.${decimal[2]}`);
  }

  const integer = fragment.match(/(\d[\d ]*)/);
  if (integer?.[1]) {
    return extractNumber(integer[1]);
  }

  return undefined;
};

const matchNumberAfterLabel = (text: string, labels: string[]) => {
  for (const label of labels) {
    const pattern = new RegExp(
      `${label}[\\s\\S]{0,30}?(\\d+\\s+\\d{2}|\\d[\\d\\s,.$]*)`
    );
    const match = text.match(pattern);
    if (match?.[1]) {
      return extractNumber(match[1]);
    }
  }
  return undefined;
};

const isNumericLine = (line: string) =>
  /^[\d\s,.\-$]+$/.test(line.trim());

const matchNumberInLines = (text: string, labels: string[]) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const label = labels.find((item) => line.includes(item));
    if (!label) {
      continue;
    }
    const afterLabel = line.slice(line.indexOf(label) + label.length);
    const fromSameLine = extractNumberFromFragment(afterLabel);
    if (fromSameLine) {
      return fromSameLine;
    }
    const nextLine = lines[i + 1];
    if (nextLine && isNumericLine(nextLine)) {
      const fromNextLine = extractNumberFromFragment(nextLine);
      if (fromNextLine) {
        return fromNextLine;
      }
    }
  }
  return undefined;
};

const matchRl1CaseValue = (
  text: string,
  code: string,
  labels: string[]
) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const codePattern = code.replace(".", "\\.");
  const labelPatterns = labels.map((label) => ({
    raw: label,
    regex: new RegExp(
      `^\\s*${codePattern}\\s*[-–—]?\\s*${label}\\b`,
      ""
    ),
  }));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const normalizedLine = line.replace(/\s+/g, " ").replace(/[–—]/g, "-");
    const pattern = labelPatterns.find(({ regex }) =>
      regex.test(normalizedLine)
    );
    if (!pattern) {
      continue;
    }
    const afterLabel = normalizedLine
      .replace(pattern.regex, "")
      .trim();
    const fromSameLine = extractNumberFromFragment(afterLabel);
    if (fromSameLine) {
      return fromSameLine;
    }
    const nextLine = lines[i + 1];
    if (nextLine && isNumericLine(nextLine)) {
      return extractNumberFromFragment(nextLine);
    }
    return undefined;
  }

  return undefined;
};

const parsePdfText = (text: string) => {
  const normalized = text.replace(/\u00a0/g, " ");
  const taxYearMatch = normalized.match(/(20\d{2})/);
  const hasQuebecContext = /(?:Releve|RELEVE|Relevé|RELEVÉ|RL-1|RL 1|Quebec|Québec|RQ|RRQ|QPIP)/.test(
    normalized
  );

  const rl1EmploymentIncome = hasQuebecContext
    ? matchRl1CaseValue(normalized, "A", [
        "Revenus d'emploi",
        "Revenus d emploi",
      ])
    : undefined;
  const rl1Rrq = hasQuebecContext
    ? matchRl1CaseValue(normalized, "B.A", [
        "Cotisation au RRQ",
        "Cotisation au RRO",
      ])
    : undefined;
  const rl1Ei = hasQuebecContext
    ? matchRl1CaseValue(normalized, "C", [
        "Cotisation à l'assurance emploi",
        "Cotisation a l'assurance emploi",
        "Cotisation a l assurance emploi",
      ])
    : undefined;
  const rl1QuebecTax = hasQuebecContext
    ? matchRl1CaseValue(normalized, "E", [
        "Impôt du Québec retenu",
        "Impot du Quebec retenu",
      ])
    : undefined;
  const rl1Rqap = hasQuebecContext
    ? matchRl1CaseValue(normalized, "H", [
        "Cotisation au RQAP",
        "Cotisation au QPIP",
      ])
    : undefined;

  return {
    taxYear: taxYearMatch?.[1],
    employmentIncome:
      matchFirstNumber(normalized, [
        /(?:Box|Case|Boite)\s*14[^\d]*([\d\s,.\$]+)/,
        /(?:^|\n)\s*14\s*[:\-]?\s*([\d\s,.\$]+)/m,
        /Employment income[^\d]*([\d\s,.\$]+)/,
        /Revenu d'emploi[^\d]*([\d\s,.\$]+)/,
      ]) ?? rl1EmploymentIncome,
    incomeTaxDeducted: matchFirstNumber(normalized, [
      /(?:Box|Case|Boite)\s*22[^\d]*([\d\s,.\$]+)/,
      /(?:^|\n)\s*22\s*[:\-]?\s*([\d\s,.\$]+)/m,
      /Income tax deducted[^\d]*([\d\s,.\$]+)/,
      /Impot sur le revenu[^\d]*([\d\s,.\$]+)/,
    ]),
    cppContrib: matchFirstNumber(normalized, [
      /(?:Box|Case|Boite)\s*16[^\d]*([\d\s,.\$]+)/,
      /(?:^|\n)\s*16\s*[:\-]?\s*([\d\s,.\$]+)/m,
      /CPP contributions[^\d]*([\d\s,.\$]+)/,
      /Cotisations RPC[^\d]*([\d\s,.\$]+)/,
    ]),
    eiPremium:
      matchFirstNumber(normalized, [
        /(?:Box|Case|Boite)\s*18[^\d]*([\d\s,.\$]+)/,
        /(?:^|\n)\s*18\s*[:\-]?\s*([\d\s,.\$]+)/m,
        /EI premiums[^\d]*([\d\s,.\$]+)/,
        /Assurance-emploi[^\d]*([\d\s,.\$]+)/,
      ]) ?? rl1Ei,
    quebecIncomeTaxDeducted: hasQuebecContext
      ? rl1QuebecTax
      : undefined,
    rrqQpipContrib: hasQuebecContext
      ? matchFirstNumber(normalized, [
          /(?:Releve|RL-1|RL 1)[^\d]*(?:Case|Boite)?\s*B[^\d]*([\d\s,.\$]+)/,
          /QPP contributions[^\d]*([\d\s,.\$]+)/,
          /Cotisations RRQ[^\d]*([\d\s,.\$]+)/,
          /RRQ[^\d]*([\d\s,.\$]+)/,
        ]) ?? rl1Rrq
      : undefined,
    rqapContrib: hasQuebecContext
      ? matchSplitCents(normalized, [
          /(?:Releve|RL-1|RL 1)[^\d]*(?:Case|Boite)?\s*10[^\d]*(\d+)\s+(\d{2})/,
          /RQAP[^\d]*(\d+)\s+(\d{2})/,
          /QPIP[^\d]*(\d+)\s+(\d{2})/,
          /Parental insurance[^\d]*(\d+)\s+(\d{2})/,
        ]) ??
        matchFirstNumber(normalized, [
          /(?:Releve|RL-1|RL 1)[^\d]*(?:Case|Boite)?\s*10[^\d]*([\d\s,.\$]+)/,
          /RQAP[^\d]*([\d\s,.\$]+)/,
          /QPIP[^\d]*([\d\s,.\$]+)/,
          /Parental insurance[^\d]*([\d\s,.\$]+)/,
        ]) ?? rl1Rqap
      : undefined,
  };
};

const extractPdfText = async (pdf: any) => {
  let text = "";
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const pageData = await pdf.getPage(page);
    const content = await pageData.getTextContent();
    const pageText = content.items
      .map((item: { str?: string }) => ("str" in item ? item.str : ""))
      .join(" ");
    text += ` ${pageText}`;
  }
  return text;
};

const extractPdfTextWithOcr = async (pdf: any) => {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker();
  const typedWorker = worker as unknown as {
    loadLanguage: (lang: string) => Promise<void>;
    initialize: (lang: string) => Promise<void>;
    recognize: (img: string) => Promise<{ data: { text: string } }>;
    terminate: () => Promise<void>;
  };
  await typedWorker.loadLanguage("eng+fra");
  await typedWorker.initialize("eng+fra");

  let text = "";
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const pageData = await pdf.getPage(page);
    const viewport = pageData.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      continue;
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pageData.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    const result = await typedWorker.recognize(dataUrl);
    text += ` ${result.data.text}`;
  }

  await typedWorker.terminate();
  return text;
};


const calculateProgressiveTax = (
  income: number,
  brackets: { upTo: number; rate: number }[]
) => {
  let remaining = income;
  let lastLimit = 0;
  let tax = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) {
      break;
    }
    const taxableAtRate = Math.min(bracket.upTo - lastLimit, remaining);
    tax += taxableAtRate * bracket.rate;
    remaining -= taxableAtRate;
    lastLimit = bracket.upTo;
  }

  return tax;
};

const calculateTax = (state: FormState) => {
  const taxData = getTaxData(state.taxYear);
  const employmentIncome = toNumber(state.employmentIncome);
  const otherIncome = toNumber(state.otherIncome);
  const rrsp = toNumber(state.rrsp);
  const otherDeductions = toNumber(state.otherDeductions);
  const incomeTaxDeducted = toNumber(state.incomeTaxDeducted);
  const quebecIncomeTaxDeducted = toNumber(state.quebecIncomeTaxDeducted);
  const cppContrib = toNumber(state.cppContrib);
  const eiPremium = toNumber(state.eiPremium);
  const otherCredits = toNumber(state.otherCredits);
  const rrqQpipContrib = toNumber(state.rrqQpipContrib);
  const rqapContrib = toNumber(state.rqapContrib);
  const otherQuebecCredits = toNumber(state.otherQuebecCredits);
  const includeBPA = state.includeBPA;
  const isQuebec = state.province === "qc";

  const grossIncome = employmentIncome + otherIncome;
  const taxableIncome = Math.max(0, grossIncome - rrsp - otherDeductions);
  const grossFederalTax = calculateProgressiveTax(
    taxableIncome,
    taxData.federalBrackets
  );

  const bpaCredit = includeBPA
    ? taxData.federalBpa * taxData.federalCreditRate
    : 0;
  const payrollCredits =
    (cppContrib + eiPremium) * taxData.federalCreditRate;
  const totalCredits = Math.max(0, bpaCredit + payrollCredits + otherCredits);

  const netFederalTax = Math.max(0, grossFederalTax - totalCredits);
  const quebecBpaCredit = includeBPA
    ? taxData.quebecBpa * taxData.quebecCreditRate
    : 0;
  const quebecPayrollCredits =
    (rrqQpipContrib + rqapContrib) * taxData.quebecCreditRate;
  const quebecCredits = Math.max(
    0,
    quebecBpaCredit + quebecPayrollCredits + otherQuebecCredits
  );
  const grossQuebecTax = isQuebec
    ? calculateProgressiveTax(taxableIncome, taxData.quebecBrackets)
    : 0;
  const netQuebecTax = Math.max(0, grossQuebecTax - quebecCredits);

  const totalTax = netFederalTax + netQuebecTax;
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;
  const totalWithheld = incomeTaxDeducted + quebecIncomeTaxDeducted;
  const balance = totalTax - totalWithheld;

  return {
    grossIncome,
    taxableIncome,
    grossFederalTax,
    grossQuebecTax,
    totalCredits,
    quebecCredits,
    netFederalTax,
    netQuebecTax,
    totalTax,
    effectiveRate,
    incomeTaxDeducted,
    quebecIncomeTaxDeducted,
    totalWithheld,
    balance,
    isQuebec,
  };
};

export default function Home() {
  const [form, setForm] = useState<FormState>(defaultState);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importPreviewText, setImportPreviewText] = useState<string | null>(null);
  const [importQuebecTax, setImportQuebecTax] = useState<string | null>(null);
  const [showImportText, setShowImportText] = useState(false);
  const [calculateError, setCalculateError] = useState<string | null>(null);
  const [assistanceProfile, setAssistanceProfile] =
    useState<AssistanceProfile>("salarie");
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(
    {}
  );
  const [calculatedResults, setCalculatedResults] = useState(() =>
    calculateTax(defaultState)
  );
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);

  const balanceLabel =
    calculatedResults.balance > 0 ? "Montant a payer" : "Remboursement";
  const showQuebec = calculatedResults.isQuebec;

  const netfileChecks = useMemo(() => {
    const issues: string[] = [];
    if (!form.employmentIncome || Number(form.employmentIncome) <= 0) {
      issues.push("Revenu d'emploi (T4 case 14) manquant ou nul.");
    }
    if (!form.incomeTaxDeducted) {
      issues.push("Impot federal retenu (T4 case 22) manquant.");
    }
    if (form.province === "qc") {
      if (!form.quebecIncomeTaxDeducted) {
        issues.push("Impot Quebec retenu (RL-1 case E) manquant.");
      }
      if (!form.rrqQpipContrib) {
        issues.push("Cotisations RRQ/QPIP (RL-1 case B) manquantes.");
      }
    }
    return issues;
  }, [form]);

  const handleNetfileExport = () => {
    const payload = {
      metadata: {
        generatedAt: new Date().toISOString(),
        note:
          "Ce fichier est un resume pour NETFILE. Il ne remplace pas un logiciel certifie.",
      },
      input: form,
      results: calculatedResults,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "netfile-resume.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;
    const checked =
      event.target instanceof HTMLInputElement ? event.target.checked : false;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };


  const handlePdfUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;

      const text = await extractPdfText(pdf);
      const parsed = parsePdfText(text);
      setImportPreviewText(text);
      setImportQuebecTax(parsed.quebecIncomeTaxDeducted ?? null);
      setForm((prev) => ({
        ...prev,
        taxYear: parsed.taxYear ?? prev.taxYear,
        employmentIncome: parsed.employmentIncome ?? "0",
        incomeTaxDeducted: parsed.incomeTaxDeducted ?? "0",
        cppContrib: parsed.cppContrib ?? "0",
        eiPremium: parsed.eiPremium ?? "0",
        quebecIncomeTaxDeducted: parsed.quebecIncomeTaxDeducted ?? "",
        rrqQpipContrib: parsed.rrqQpipContrib ?? "0",
        rqapContrib: parsed.rqapContrib ?? "0",
      }));
      setImportStatus("Import PDF termine. Verifiez les champs detectes.");
    } catch (error) {
      setImportStatus(
        error instanceof Error
          ? error.message
          : "Impossible de lire le fichier PDF."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleScannedPdfUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setImportStatus("OCR en cours... cela peut prendre quelques minutes.");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;

      const text = await extractPdfTextWithOcr(pdf);
      const parsed = parsePdfText(text);
      setImportPreviewText(text);
      setImportQuebecTax(parsed.quebecIncomeTaxDeducted ?? null);
      setForm((prev) => ({
        ...prev,
        taxYear: parsed.taxYear ?? prev.taxYear,
        employmentIncome: parsed.employmentIncome ?? "0",
        incomeTaxDeducted: parsed.incomeTaxDeducted ?? "0",
        cppContrib: parsed.cppContrib ?? "0",
        eiPremium: parsed.eiPremium ?? "0",
        quebecIncomeTaxDeducted: parsed.quebecIncomeTaxDeducted ?? "",
        rrqQpipContrib: parsed.rrqQpipContrib ?? "0",
        rqapContrib: parsed.rqapContrib ?? "0",
      }));
      setImportStatus(
        "OCR termine. Verifiez les champs detectes."
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error
          ? error.message
          : "Impossible de traiter le PDF scanne."
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleCalculate = () => {
    if (isCalculating) {
      return;
    }
    if (form.province === "qc" && !form.quebecIncomeTaxDeducted) {
      setCalculateError(
        "Veuillez saisir l'impot du Quebec retenu avant le calcul."
      );
      return;
    }
    setCalculateError(null);
    setIsCalculating(true);
    setTimeout(() => {
      setCalculatedResults(calculateTax(form));
      setIsCalculating(false);
      setShowResultPopup(true);
      const target = document.getElementById("results");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 5000);
  };


  return (
    <>
      <header className="hero">
        <div className="container">
          <span className="pill">Saisie T4 + import CSV</span>
          <h1>Calculateur d&apos;impot au Canada</h1>
          <p className="subtitle">
            Entrez les principaux montants de votre T4 et, si applicable, du
            Releve 1 pour estimer votre impot federal et quebecois. Les credits
            specifiques et prestations ne sont pas inclus.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#calculator">
              Demarrer le calcul
            </a>
            <a className="btn ghost" href="#assumptions">
              Hypotheses
          </a>
        </div>
      </div>
      </header>

      <main>
        <section id="calculator" className="section">
          <div className="container grid">
            <div>
              <h2>Votre T4</h2>
              <p className="muted">
                Reportez les cases suivantes de votre T4. Vous pouvez ajuster
                les deductions et credits supplementaires pour affiner
                l&apos;estimation.
              </p>
              <div className="card note">
                <h3>Importer un fichier PDF</h3>
                <p className="muted">
                  Le PDF texte est plus rapide, mais un PDF scanne peut etre
                  traite via l&apos;OCR.
                </p>
                <div className="hero-actions">
                  <label className="btn primary">
                    Importer un PDF texte
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                  <label className="btn ghost">
                    Importer un PDF scanne (OCR)
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleScannedPdfUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                {importStatus ? (
                  <p className="muted small">{importStatus}</p>
                ) : null}
                {importQuebecTax ? (
                  <p className="muted small">
                    Impot du Quebec retenu detecte: {importQuebecTax}
                  </p>
                ) : null}
                {importPreviewText ? (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setShowImportText((prev) => !prev)}
                  >
                    {showImportText
                      ? "Masquer le texte importe"
                      : "Voir le texte importe"}
                  </button>
                ) : null}
                {showImportText && importPreviewText ? (
                  <textarea
                    className="field"
                    readOnly
                    value={importPreviewText}
                    rows={6}
                  />
                ) : null}
              </div>
              <form className="card">
                <label className="field">
                  <span>Annee fiscale</span>
                  <select
                    name="taxYear"
                    value={form.taxYear}
                    onChange={handleChange}
                  >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                  </select>
                  <span className="muted small">
                    Annee d'imposition correspondant au feuillet.
                  </span>
                </label>
                <label className="field">
                  <span>Province de residence</span>
                  <select
                    name="province"
                    value={form.province}
                    onChange={handleChange}
                  >
                    <option value="qc">Quebec</option>
                    <option value="other">Autre province</option>
                  </select>
                  <span className="muted small">
                    Province au 31 decembre de l'annee fiscale.
                  </span>
                </label>
                <div className="two-col">
                  <label className="field">
                    <span>Boite 14 - Revenu d&apos;emploi</span>
                    <input
                      type="number"
                      name="employmentIncome"
                      min="0"
                      step="100"
                      value={form.employmentIncome}
                      onChange={handleChange}
                    />
                    <span className="muted small">
                      Salaire brut imposable inscrit a la case 14 du T4.
                    </span>
                  </label>
                  <label className="field">
                    <span>Autres revenus imposables</span>
                    <input
                      type="number"
                      name="otherIncome"
                      min="0"
                      step="100"
                      value={form.otherIncome}
                      onChange={handleChange}
                    />
                    <span className="muted small">
                      Revenus additionnels (interets, primes, autres feuillets).
                    </span>
                  </label>
                </div>
                <div className="two-col">
                  <label className="field">
                    <span>Boite 22 - Impot sur le revenu</span>
                    <input
                      type="number"
                      name="incomeTaxDeducted"
                      min="0"
                      step="50"
                      value={form.incomeTaxDeducted}
                      onChange={handleChange}
                    />
                    <span className="muted small">
                      Impot federal retenu a la source (T4 case 22).
                    </span>
                  </label>
                  <label className="field">
                    <span>Releve 1 - Impot provincial retenu</span>
                    <input
                      type="number"
                      name="quebecIncomeTaxDeducted"
                      min="0"
                      step="0.01"
                      value={form.quebecIncomeTaxDeducted}
                      onChange={handleChange}
                      disabled={form.province !== "qc"}
                    />
                    <span className="muted small">
                      Impot du Quebec retenu (RL-1 case E).
                    </span>
                  </label>
                </div>
                <div className="two-col">
                  <label className="field">
                    <span>Boite 16 - Cotisations RPC</span>
                    <input
                      type="number"
                      name="cppContrib"
                      min="0"
                      step="50"
                      value={form.cppContrib}
                      onChange={handleChange}
                    />
                    <span className="muted small">
                      Cotisations au RPC/CPP indiquees a la case 16.
                    </span>
                  </label>
                  <label className="field">
                    <span>Releve 1 - Cotisations RRQ</span>
                    <input
                      type="number"
                      name="rrqQpipContrib"
                      min="0"
                      step="50"
                      value={form.rrqQpipContrib}
                      onChange={handleChange}
                      disabled={form.province !== "qc"}
                    />
                    <span className="muted small">
                      Cotisations RRQ (T4 case 17 ou RL-1 case B).
                    </span>
                  </label>
                </div>
                <label className="field">
                  <span>Cotisation au RQAP (QPIP)</span>
                  <input
                    type="number"
                    name="rqapContrib"
                    min="0"
                    step="0.01"
                    value={form.rqapContrib}
                    onChange={handleChange}
                    disabled={form.province !== "qc"}
                  />
                  <span className="muted small">
                    Cotisation au RQAP/QPIP indiquee sur le Releve 1 (case 10).
                  </span>
                </label>
                <div className="two-col">
                  <label className="field">
                    <span>Boite 18 - Assurance-emploi</span>
                    <input
                      type="number"
                      name="eiPremium"
                      min="0"
                      step="50"
                      value={form.eiPremium}
                      onChange={handleChange}
                    />
                    <span className="muted small">
                      Primes d'assurance-emploi (T4 case 18).
                    </span>
                  </label>
                  <label className="field">
                    <span>Cotisations REER</span>
                    <input
                      type="number"
                      name="rrsp"
                      min="0"
                      step="100"
                      value={form.rrsp}
                      onChange={handleChange}
                    />
                    <span className="muted small">
                      Cotisations admissibles aux REER pour l'annee.
                    </span>
                  </label>
                </div>
                <label className="field">
                  <span>Autres deductions (frais, pensions)</span>
                  <input
                    type="number"
                    name="otherDeductions"
                    min="0"
                    step="100"
                    value={form.otherDeductions}
                    onChange={handleChange}
                  />
                  <span className="muted small">
                    Deductions permises (frais d'emploi, pensions, etc.).
                  </span>
                </label>
                <label className="field">
                  <span>Credits additionnels (federaux)</span>
                  <input
                    type="number"
                    name="otherCredits"
                    min="0"
                    step="50"
                    value={form.otherCredits}
                    onChange={handleChange}
                  />
                  <span className="muted small">
                    Autres credits federaux non remboursables.
                  </span>
                </label>
                <label className="field">
                  <span>Credits additionnels (Quebec)</span>
                  <input
                    type="number"
                    name="otherQuebecCredits"
                    min="0"
                    step="50"
                    value={form.otherQuebecCredits}
                    onChange={handleChange}
                    disabled={form.province !== "qc"}
                  />
                  <span className="muted small">
                    Credits du Quebec (ex: personne seule, etudes, etc.).
                  </span>
                </label>
                <label className="field checkbox">
                  <input
                    type="checkbox"
                    name="includeBPA"
                    checked={form.includeBPA}
                    onChange={handleChange}
                  />
                  <span>Inclure le montant personnel de base federal</span>
                </label>
                <button
                  className="btn primary"
                  type="button"
                  onClick={handleCalculate}
                  disabled={isCalculating}
                >
                  {isCalculating
                    ? "Calcul en cours..."
                    : "Lancer le calcul"}
                </button>
                {calculateError ? (
                  <span className="muted small">{calculateError}</span>
                ) : null}
              </form>
            </div>

            <div id="results">
              <h2>Resultat</h2>
              <div className="card result">
                <div className="result-row">
                  <span>Revenu brut estime</span>
                  <strong>
                    {currency.format(calculatedResults.grossIncome)}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Revenu imposable</span>
                  <strong>
                    {currency.format(calculatedResults.taxableIncome)}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Impot federal brut</span>
                  <strong>
                    {currency.format(calculatedResults.grossFederalTax)}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Credits federaux estimes</span>
                  <strong>
                    {currency.format(calculatedResults.totalCredits)}
                  </strong>
                </div>
                <div className="result-row highlight">
                  <span>Impot federal net</span>
                  <strong>
                    {currency.format(calculatedResults.netFederalTax)}
                  </strong>
                </div>
                {showQuebec ? (
                  <>
                    <div className="result-row">
                      <span>Impot provincial brut (Quebec)</span>
                      <strong>
                        {currency.format(calculatedResults.grossQuebecTax)}
                      </strong>
                    </div>
                    <div className="result-row">
                      <span>Credits provinciaux estimes</span>
                      <strong>
                        {currency.format(calculatedResults.quebecCredits)}
                      </strong>
                    </div>
                    <div className="result-row highlight">
                      <span>Impot provincial net</span>
                      <strong>
                        {currency.format(calculatedResults.netQuebecTax)}
                      </strong>
                    </div>
                  </>
                ) : null}
                <div className="result-row">
                  <span>Impot total estime</span>
                  <strong>
                    {currency.format(calculatedResults.totalTax)}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Impot retenu total</span>
                  <strong>
                    {currency.format(calculatedResults.totalWithheld)}
                  </strong>
                </div>
                <div className="result-row highlight">
                  <span>{balanceLabel}</span>
                  <strong>
                    {currency.format(Math.abs(calculatedResults.balance))}
                  </strong>
                </div>
                <div className="result-row">
                  <span>Taux effectif</span>
                  <strong>
                    {percent.format(calculatedResults.effectiveRate)}
                  </strong>
                </div>
                <div className="divider" />
                <div className="status">
                  <span className="muted">Statut</span>
                  <strong>
                    {calculatedResults.balance > 0
                      ? "Solde a payer"
                      : "Remboursement potentiel"}
                  </strong>
                  <span className="muted small">
                    {calculatedResults.isQuebec
                      ? "Impot federal + Quebec inclus."
                      : "Impot provincial non inclus."}
                  </span>
                </div>
      </div>

              <div className="card note">
                <h3>Conseil rapide</h3>
                <p className="muted">
                  Ajoutez l&apos;impot provincial et les credits personnels
                  propres a votre province pour obtenir un resultat complet.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="assumptions" className="section muted-section">
          <div className="container">
            <h2>Hypotheses et methodologie</h2>
            <div className="card">
              <ul className="list">
                <li>Barremes federaux et Quebec selon l&apos;annee selectionnee.</li>
                <li>Montants personnels de base preconfigures.</li>
                <li>
                  Credits appliques au taux federal de base (15 %) seulement.
                </li>
                <li>
                  Credits Quebec appliques au taux provincial de base (14 %).
                </li>
                <li>Les prestations et surtaxes ne sont pas incluses.</li>
                <li>Outil a titre indicatif, pas un conseil fiscal.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2>Questions frequentes</h2>
            <div className="grid faq">
              <div className="card">
                <h3>Pourquoi la simulation differe-t-elle de mon avis ?</h3>
                <p className="muted">
                  Les credits provinciaux, allocations et exemptions varient. Ce
                  calculateur reste volontairement simplifie.
                </p>
              </div>
              <div className="card">
                <h3>Comment integrer d&apos;autres cases du T4 ?</h3>
                <p className="muted">
                  Ajoutez les champs correspondants et adaptez les credits dans
                  ce module Next.js.
                </p>
              </div>
              <div className="card">
                <h3>Puis-je importer un fichier T4 ?</h3>
                <p className="muted">
                  Oui, utilisez un PDF texte ou un PDF scanne (OCR) pour
                  pre-remplir les champs.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="assistant" className="section">
          <div className="container">
            <h2>Assistant virtuel</h2>
            <p className="muted">
              Suivez ces etapes pour reduire les erreurs et valider votre
              declaration. Cochez les etapes au fur et a mesure.
            </p>
            <div className="grid">
              <div className="card">
                <label className="field">
                  <span>Profil</span>
                  <select
                    value={assistanceProfile}
                    onChange={(event) =>
                      setAssistanceProfile(
                        event.target.value as AssistanceProfile
                      )
                    }
                  >
                    <option value="salarie">Salarie</option>
                    <option value="etudiant">Etudiant</option>
                    <option value="autonome">Travailleur autonome</option>
                    <option value="mixte">Mixte (salarie + autonome)</option>
                  </select>
                </label>
                <p className="muted">{assistanceNotes[assistanceProfile]}</p>
                <div className="status">
                  <span className="muted">Progression</span>
                  <strong>
                    {
                      assistanceSteps.filter(
                        (step) => completedSteps[step.id]
                      ).length
                    }
                    /{assistanceSteps.length} etapes
                  </strong>
                </div>
              </div>
              <div className="card steps">
                {assistanceSteps.map((step) => (
                  <label key={step.id} className="step">
                    <input
                      type="checkbox"
                      checked={Boolean(completedSteps[step.id])}
                      onChange={() => toggleStep(step.id)}
                    />
                    <div>
                      <strong>{step.title}</strong>
                      <p className="muted small">{step.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="netfile" className="section muted-section">
          <div className="container">
            <h2>Preparation NETFILE</h2>
            <div className="grid">
              <div className="card">
                <h3>Etat de preparation</h3>
                <p className="muted">
                  NETFILE exige un logiciel certifie par l&apos;ARC. Cette
                  section verifie les champs essentiels et genere un resume.
                </p>
                {netfileChecks.length === 0 ? (
                  <p className="status">
                    <strong>Pret pour verification</strong>
                    <span className="muted small">
                      Aucun champ critique manquant detecte.
                    </span>
                  </p>
                ) : (
                  <ul className="list">
                    {netfileChecks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card">
                <h3>Export NETFILE</h3>
                <p className="muted">
                  Telechargez un resume JSON a importer dans votre outil de
                  preparation ou pour conserver vos donnees.
                </p>
                <button
                  className="btn primary"
                  type="button"
                  onClick={handleNetfileExport}
                >
                  Telecharger le resume NETFILE
                </button>
                <p className="muted small">
                  Pour soumettre officiellement, utilisez un logiciel
                  NETFILE certifie.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {showResultPopup ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Resultat pret</h3>
            <p className="muted">
              Le calcul est termine. Vous pouvez consulter le resultat.
            </p>
            <div className="hero-actions">
              <button
                className="btn primary"
                type="button"
                onClick={() => setShowResultPopup(false)}
              >
                Voir le resultat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="footer">
        <div className="container">
          <p className="small muted">
            Concu pour demonstration. Aucune garantie de precision.
          </p>
      </div>
      </footer>
    </>
  );
}
