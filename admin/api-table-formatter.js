(function () {
  function escapePipe(value) {
    return String(value ?? "").replace(/\|/g, "\\|").trim();
  }

  function cleanText(value) {
    return String(value ?? "")
      .replace(/\r\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function unique(arr) {
    return [...new Set((arr || []).filter(Boolean))];
  }

  function formatRate(rate) {
    if (!rate) return "";

    const concentration = cleanText(rate.concentration);
    const amountNote = cleanText(rate.amountNote);
    const unit = cleanText(rate.unit?.name);
    const unitArea = cleanText(rate.unitArea?.name);

    let main = [concentration, unit, unitArea].filter(Boolean).join(" ");
    main = cleanText(main);

    if (amountNote) {
      main = main ? `${main} (${amountNote})` : amountNote;
    }

    return main;
  }

  function formatReiPhi(sitePesticide) {
    if (!sitePesticide || !sitePesticide.length) {
      return { rei: "", phi: "" };
    }

    const first = sitePesticide[0];

    let rei = "";
    if (first.reiUntilDry) {
      rei = "Until dry";
    } else if (first.reiReferToLabel) {
      rei = "See label";
    } else {
      rei = cleanText(first.rei);
    }

    let phi = "";
    if (first.phiUntilDry) {
      phi = "Until dry";
    } else {
      const phiValue = cleanText(first.phi);
      const phiTime = cleanText(first.phiTime);
      phi = [phiValue, phiTime].filter(Boolean).join(" ");
    }

    return { rei, phi };
  }

  function collectActiveIngredientNames(pesticide) {
    const names = (pesticide?.activeIngredients || [])
      .map(ai => cleanText(ai?.name))
      .filter(Boolean);

    return unique(names).join(", ");
  }

  function collectIrac(pesticide) {
    const values = (pesticide?.activeIngredients || [])
      .map(ai => cleanText(ai?.activeIngredientInsecticide?.irac))
      .filter(Boolean);

    return unique(values).join(", ");
  }

  function collectFrac(pesticide) {
    const values = (pesticide?.activeIngredients || [])
      .map(ai => cleanText(ai?.activeIngredientFungicide?.frac))
      .filter(Boolean);

    return unique(values).join(", ");
  }

  function collectGroupNumbers(pesticide) {
    const values = [];

    (pesticide?.activeIngredients || []).forEach(ai => {
      const irac = cleanText(ai?.activeIngredientInsecticide?.irac);
      const frac = cleanText(ai?.activeIngredientFungicide?.frac);

      if (irac) values.push(irac);
      if (frac) values.push(frac);
    });

    return unique(values).join(", ");
  }

  function collectRestrictedUse(pesticide, footnoteMap, footnotes) {
    const symbols = [];

    (pesticide?.restrictedUse || []).forEach(ru => {
      const symbol = cleanText(ru?.symbol);
      const description = cleanText(ru?.description);

      if (symbol) {
        symbols.push(symbol);

        if (description && !footnoteMap.has(symbol)) {
          footnoteMap.set(symbol, description);
          footnotes.push({ symbol, description });
        }
      }
    });

    return unique(symbols).join("");
  }

  function collectComments(treatment) {
    return (treatment?.comments || [])
      .map(c => {
        const index = cleanText(c?.indexNumber);
        const text = cleanText(c?.commentText);
        if (!text) return "";
        return index ? `[${index}] ${text}` : text;
      })
      .filter(Boolean)
      .join(" ; ");
  }

  function pickDisplayAi(pesticide) {
    const commonName = cleanText(pesticide?.commonName);
    if (commonName) return commonName;

    const aiNames = collectActiveIngredientNames(pesticide);
    return aiNames;
  }

  function buildRowsFromTreatment(treatment, footnoteMap, footnotes) {
    const pesticides = treatment?.controlTechnique?.pesticides || [];
    const comments = collectComments(treatment);
    const efficacy = cleanText(treatment?.efficacy?.name);

    return pesticides.map(pesticide => {
      const tradeName = cleanText(pesticide?.tradeName);
      const ai = pickDisplayAi(pesticide);
      const restrictedUse = collectRestrictedUse(pesticide, footnoteMap, footnotes);
      const { rei, phi } = formatReiPhi(pesticide?.sitePesticide || []);
      const irac = collectIrac(pesticide);
      const frac = collectFrac(pesticide);
      const groupNumber = collectGroupNumbers(pesticide);

      const matchingRates = (treatment?.treatmentRates || []).filter(
        r => r?.pesticideId === pesticide?.pesticideId
      );

      const rate = unique(matchingRates.map(formatRate).filter(Boolean)).join(" / ");

      return {
        tradeName,
        ai,
        restrictedUse,
        rate,
        rei,
        phi,
        irac,
        frac,
        groupNumber,
        efficacy,
        comments,
      };
    });
  }

  function buildMarkdownTable(rows) {
    const lines = [
      "| Trade Name | Common Name / AI | Restricted Use | Rate | REI | PHI | IRAC | FRAC | Group No. | Efficacy | Comments |",
      "|---|---|---|---|---|---|---|---|---|---|---|",
    ];

    rows.forEach(row => {
      lines.push(
        [
          escapePipe(row.tradeName),
          escapePipe(row.ai),
          escapePipe(row.restrictedUse),
          escapePipe(row.rate),
          escapePipe(row.rei),
          escapePipe(row.phi),
          escapePipe(row.irac),
          escapePipe(row.frac),
          escapePipe(row.groupNumber),
          escapePipe(row.efficacy),
          escapePipe(row.comments),
        ].join(" | ").replace(/^/, "| ").concat(" |")
      );
    });

    return lines.join("\n");
  }

  function buildFootnotes(footnotes) {
    if (!footnotes.length) return "";

    const lines = [
      "",
      "**Restricted Use Notes**",
      "",
    ];

    footnotes.forEach(f => {
      lines.push(`- **${f.symbol}** ${f.description}`);
    });

    return lines.join("\n");
  }

  function formatApiJsonToMarkdownTable(data) {
    const treatments = Array.isArray(data) ? data : [data];
    const footnoteMap = new Map();
    const footnotes = [];

    const rows = treatments.flatMap(t =>
      buildRowsFromTreatment(t, footnoteMap, footnotes)
    );

    if (!rows.length) {
      return "_No pesticide rows returned by API._";
    }

    return buildMarkdownTable(rows) + "\n" + buildFootnotes(footnotes);
  }

  window.ApiTableFormatter = {
    formatApiJsonToMarkdownTable,
  };
})();