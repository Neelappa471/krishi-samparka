// ---------------------------------------------------------------------------
// Explanation layer for the matching engine.
//
// It turns a calculated match result (from matchEngine.js) into short sentences
// in English or Kannada using translation templates. It reads ONLY the numbers
// and names inside the result: it cannot add farmers, buyers, quantities,
// prices, distances or market facts that are not already there. No AI service
// is called.
// ---------------------------------------------------------------------------
import { translate } from "../i18n/translations.js";

function localeFor(lang) {
  return lang === "kn" ? "kn-IN" : "en-IN";
}

// 34 -> "34", 12.5 -> "12.5", 1420 -> "1,420"
export function formatNumber(value, lang) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "";
  }
  return Number(value).toLocaleString(localeFor(lang), { maximumFractionDigits: 2 });
}

// 1420 -> "₹1,420"
export function formatMoney(value, lang) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "";
  }
  return "₹" + formatNumber(value, lang);
}

// Translate a stored value (crop, unit, location); unknown values stay as they are
export function labelFor(lang, prefix, value) {
  const key = prefix + value;
  const text = translate(lang, key);
  return text === key ? value : text;
}

// The factor in which `best` is clearly ahead of `other` (used to say WHY a
// pricier option ranks higher). Returns a factor name or null.
function leadingFactor(best, other) {
  let winner = null;
  let gap = 0.05;
  ["coverage", "distance", "date", "participants"].forEach((factor) => {
    const a = best.breakdown.find((entry) => entry.factor === factor);
    const b = other.breakdown.find((entry) => entry.factor === factor);
    if (a && b && a.points - b.points > gap) {
      gap = a.points - b.points;
      winner = factor;
    }
  });
  return winner;
}

// Returns { headline, lines } where lines are ready-to-show sentences.
export function explainMatch(result, lang) {
  const t = (key, params) => translate(lang, key, params);
  if (!result) {
    return { headline: "", lines: [] };
  }

  const side = result.side;
  const unit = labelFor(lang, "unit.", result.displayUnit);
  const unitOne = labelFor(lang, "unitOne.", result.displayUnit);
  const product = labelFor(lang, "crop.", result.anchor.productName);
  const required = formatNumber(result.required, lang);

  const best = result.best;
  const lines = [];

  // nothing eligible at all
  if (!best) {
    const line = t("explain." + side + ".empty");
    return { headline: line, lines: [line] };
  }

  // not enough to call it a match: only report what is really available
  if (result.status === "none") {
    const line = t("explain." + side + ".none", {
      available: formatNumber(result.availableQuantity, lang),
      unit: unit,
      product: product,
    });
    return { headline: line, lines: [line] };
  }

  const matched = formatNumber(best.matchedQuantity, lang);
  const count = best.participantCount;

  // headline
  if (result.status === "complete") {
    if (count === 1) {
      lines.push(
        t("explain." + side + ".complete.one", {
          name: best.participants[0].name || t("match.unknownParty." + side),
          qty: matched,
          unit: unit,
          product: product,
        })
      );
    } else {
      lines.push(
        t("explain." + side + ".complete.many", {
          count: count,
          qty: matched,
          unit: unit,
          product: product,
        })
      );
    }
  } else {
    lines.push(
      t("explain." + side + ".partial", {
        matched: matched,
        required: required,
        missing: formatNumber(Math.max(0, result.required - best.matchedQuantity), lang),
        count: count,
        unit: unit,
        product: product,
      })
    );
  }
  const headline = lines[0];

  // distance (only when it is really known)
  if (best.avgDistanceKm !== null) {
    lines.push(
      best.avgDistanceKm < 0.05
        ? t("explain.distance.same")
        : t("explain.distance", { km: formatNumber(best.avgDistanceKm, lang) })
    );
  }

  // price
  if (side === "supply") {
    if (best.totalPrice !== null) {
      lines.push(
        t("explain.price.supply", {
          total: formatMoney(best.totalPrice, lang),
          unitPrice: formatMoney(best.effectivePrice, lang),
          unit: unitOne,
        })
      );
    }
  } else if (best.totalPrice !== null) {
    lines.push(
      best.maxTotal !== null
        ? t("explain.price.demand", {
            total: formatMoney(best.totalPrice, lang),
            maxTotal: formatMoney(best.maxTotal, lang),
          })
        : t("explain.price.demandNoMax", { total: formatMoney(best.totalPrice, lang) })
    );
  }

  // comparison with the next option (same coverage only)
  const next = result.groups[1];
  if (next && next.status === best.status && Math.abs(next.matchedQuantity - best.matchedQuantity) < 1e-6) {
    const reasonFactor = leadingFactor(best, next);
    const reason = reasonFactor ? t("explain.reason." + reasonFactor) : null;

    if (side === "supply" && best.totalPrice !== null && next.totalPrice !== null) {
      const diff = next.totalPrice - best.totalPrice;
      if (diff > 0.005) {
        lines.push(
          t("explain.compare.cheaper", {
            diff: formatMoney(diff, lang),
            altTotal: formatMoney(next.totalPrice, lang),
          })
        );
      } else if (diff < -0.005) {
        lines.push(
          reason
            ? t("explain.compare.pricier", { altTotal: formatMoney(next.totalPrice, lang), reason: reason })
            : t("explain.compare.pricierNoReason", { altTotal: formatMoney(next.totalPrice, lang) })
        );
      }
    } else if (side === "demand" && best.avgOfferPrice !== null && next.avgOfferPrice !== null) {
      if (best.avgOfferPrice - next.avgOfferPrice > 0.005) {
        lines.push(
          t("explain.compare.moreValue", {
            avg: formatMoney(best.avgOfferPrice, lang),
            altAvg: formatMoney(next.avgOfferPrice, lang),
            unit: unitOne,
          })
        );
      } else if (next.avgOfferPrice - best.avgOfferPrice > 0.005 && reason) {
        lines.push(
          t("explain.compare.lessValue", {
            altAvg: formatMoney(next.avgOfferPrice, lang),
            unit: unitOne,
            reason: reason,
          })
        );
      }
    }
  }

  return { headline: headline, lines: lines };
}