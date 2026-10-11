import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// NOTE: if your config/supabase.js uses a default export, change this to:
//   import supabase from "../../config/supabase";
import { supabase } from "../../config/supabase";
import { GoogleMarketMap } from "../Map/GoogleMarketMap";
import { translate } from "../../i18n/translations";
import { startConversation, isMessagingNotSetUp } from "../Messaging/messagingApi";
import {
  LISTING_COLUMNS,
  REQ_COLUMNS,
  LOCATION_VALUES,
  hasValue,
  resolveCoords,
  errorText,
  formatDate,
} from "../../utils/marketplaceData";

const noop = () => {};

const CSS = `
.ks-fm { color: #1f2937; text-align: left;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Kannada", sans-serif; }
.ks-fm *, .ks-fm *::before, .ks-fm *::after { box-sizing: border-box; }
.ks-fm button, .ks-fm input, .ks-fm select { font-family: inherit; }
.ks-fm-panel { background: #fff; border: 1px solid #e3ece3; border-radius: 16px; padding: 16px; margin-bottom: 14px; }
.ks-fm-field { margin-bottom: 12px; }
.ks-fm-label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #374151; }
.ks-fm-input { width: 100%; min-height: 46px; padding: 8px 12px; border: 1.5px solid #c9d6c9; border-radius: 12px;
  background: #fff; color: #111827; font-size: 16px; }
.ks-fm-input:focus { border-color: #16a34a; }
.ks-fm-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.ks-fm-btn { min-height: 46px; padding: 0 20px; border: none; border-radius: 12px; background: #14532d; color: #fff;
  font-size: 15px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; gap: 8px; }
.ks-fm-btn:hover { background: #166534; }
.ks-fm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ks-fm-btn-ghost { background: #fff; color: #374151; border: 1px solid #cfdccf; }
.ks-fm-btn-ghost:hover { background: #f0f7f0; }
.ks-fm-btn-small { min-height: 38px; padding: 0 14px; font-size: 14px; }
.ks-fm-btn-blue { background: #1f6feb; }
.ks-fm-btn-blue:hover { background: #1a5fcb; }
.ks-fm-msg { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; font-size: 14px; line-height: 1.4; }
.ks-fm-msg-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
.ks-fm-msg-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
.ks-fm-split { display: grid; grid-template-columns: 420px 1fr; gap: 16px; align-items: start; }
.ks-fm-results-title { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #111827; }
.ks-fm-list { display: grid; gap: 10px; }
.ks-fm-item { background: #fff; border: 1px solid #e3ece3; border-left: 5px solid #1f6feb; border-radius: 14px;
  padding: 12px 14px; text-align: left; color: inherit; width: 100%; cursor: pointer; }
.ks-fm-item:hover { background: #f8fbff; }
.ks-fm-item[aria-pressed="true"] { border-color: #1f6feb; background: #eff6ff; }
.ks-fm-item-title { display: block; margin-bottom: 6px; font-size: 16px; font-weight: 700; color: #111827; }
.ks-fm-rows { display: grid; gap: 3px; }
.ks-fm-r { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.ks-fm-r-label { color: #6b7280; }
.ks-fm-r-value { font-weight: 600; text-align: right; }
.ks-fm-detail { border-left: 5px solid #1f6feb; }
.ks-fm-detail-green { border-left-color: #2e9e4f; }
.ks-fm-detail h2 { margin: 0 0 10px; font-size: 18px; color: #111827; }
.ks-fm-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.ks-fm-detail-head h2 { margin: 0; }
.ks-fm-badge { padding: 2px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 600; }
.ks-fm-badge-green { background: #dcfce7; color: #166534; }
.ks-fm-photo { width: 100%; max-height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 10px; background: #eef2ee; }
.ks-fm-map-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 4px 0 10px; }
.ks-fm-legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; color: #374151; }
.ks-fm-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.25); margin-right: 6px; vertical-align: -1px; }
.ks-fm-map { width: 100%; height: 560px; border: 1px solid #e3ece3; border-radius: 16px; overflow: hidden; background: #fff; }
.ks-fm-note { margin: 10px 0 0; font-size: 12px; color: #6b7280; line-height: 1.4; }
.ks-fm button:focus-visible, .ks-fm input:focus-visible, .ks-fm select:focus-visible {
  outline: 3px solid #86efac; outline-offset: 2px; }
@media (max-width: 1100px) { .ks-fm-split { grid-template-columns: 1fr; } .ks-fm-map { height: 480px; } }
`;

// The farmer's marketplace view.
//   mode "search": search form + results list + map + details panel
//   mode "map":    map + details panel
// The map ALWAYS shows every active farmer listing (green) and every active
// buyer requirement (blue). Search only filters the results list.
//
// Props:
//   user            signed-in Supabase user
//   lang            "en" | "kn"
//   mode            "search" | "map"
//   initialFilters  { product, location, nonce } from the Home search bar
//   onOpenChat(id)  called with the conversation id after "Contact Buyer"
function FarmerMarketplace({ user, lang, mode = "search", initialFilters = null, onOpenChat }) {
  const showSearch = mode === "search";
  const userId = user ? user.id : null;
  const dateLocale = lang === "kn" ? "kn-IN" : "en-GB";

  const T = useCallback((key, params) => translate(lang, key, params), [lang]);

  // Translate a stored value (crop, unit, location); unknown values stay as is
  const labelFor = useCallback(
    (prefix, value) => {
      const key = prefix + value;
      const text = T(key);
      return text === key ? value : text;
    },
    [T]
  );

  const [listings, setListings] = useState([]);
  const [farmerNames, setFarmerNames] = useState({});
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");
  const [requirementsError, setRequirementsError] = useState("");

  const startProduct = initialFilters ? initialFilters.product || "" : "";
  const startLocation = initialFilters ? initialFilters.location || "" : "";
  const [qProduct, setQProduct] = useState(startProduct);
  const [qLocation, setQLocation] = useState(startLocation);
  const [filters, setFilters] = useState({ product: startProduct, location: startLocation });

  // The ONE selected item: { type: "listing" | "requirement", id } or null
  const [selected, setSelected] = useState(null);
  const [contactBusy, setContactBusy] = useState(null);
  const [contactError, setContactError] = useState("");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // --- Load everything on page load (no search involved) --------------------
  const loadAll = useCallback(async () => {
    setLoading(true);
    setListingsError("");
    setRequirementsError("");
    try {
      const [listingResult, requirementResult] = await Promise.all([
        supabase
          .from("listings")
          .select(LISTING_COLUMNS)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("buyer_requirements")
          .select(REQ_COLUMNS)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);
      if (!mountedRef.current) {
        return;
      }

      if (listingResult.error) {
        console.error("Could not load listings:", listingResult.error);
        setListingsError(errorText(listingResult.error));
      } else {
        const rows = listingResult.data || [];
        setListings(rows);

        const farmerIds = Array.from(
          new Set(rows.map((row) => row.farmer_id).filter(Boolean))
        );
        if (farmerIds.length > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", farmerIds);
          if (profileError) {
            // Names are optional: listings still work without them
            console.error("Could not load farmer names:", profileError);
          } else if (mountedRef.current) {
            const names = {};
            (profiles || []).forEach((profile) => {
              if (profile.full_name) {
                names[profile.id] = profile.full_name;
              }
            });
            setFarmerNames(names);
          }
        }
      }

      if (requirementResult.error) {
        console.error("Could not load requirements:", requirementResult.error);
        setRequirementsError(errorText(requirementResult.error));
      } else {
        setRequirements(requirementResult.data || []);
      }
    } catch (error) {
      console.error("Could not load the marketplace:", error);
      if (mountedRef.current) {
        setRequirementsError(errorText(error));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Pick up new listings / requirements when the farmer returns to this tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadAll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadAll]);

  // Apply a search typed on the Home page (only when a NEW search arrives)
  const lastNonceRef = useRef(initialFilters ? initialFilters.nonce : null);
  useEffect(() => {
    if (!initialFilters || initialFilters.nonce === lastNonceRef.current) {
      return;
    }
    lastNonceRef.current = initialFilters.nonce;
    setQProduct(initialFilters.product || "");
    setQLocation(initialFilters.location || "");
    setFilters({
      product: initialFilters.product || "",
      location: initialFilters.location || "",
    });
  }, [initialFilters]);

  // --- Map items (translated, with real coordinates) -------------------------
  const priceText = useCallback(
    (price, unit) =>
      T("price.perUnit", { price: price, unit: labelFor("unitOne.", unit) }),
    [T, labelFor]
  );

  // GREEN: every active farmer listing
  const listingItems = useMemo(
    () =>
      listings.map((listing) => {
        const coords = resolveCoords(listing);
        return {
          ...listing,
          latitude: coords ? coords.latitude : null,
          longitude: coords ? coords.longitude : null,
          has_coords: Boolean(coords),
          is_mine: Boolean(userId) && listing.farmer_id === userId,
          farmer_name: farmerNames[listing.farmer_id] || "",
          product_label: labelFor("crop.", listing.product_name),
          unit_label: labelFor("unit.", listing.unit),
          location_label: labelFor("loc.", listing.location),
          price_text: hasValue(listing.expected_price)
            ? priceText(listing.expected_price, listing.unit)
            : "",
        };
      }),
    [listings, farmerNames, userId, labelFor, priceText]
  );

  // BLUE: every active buyer requirement
  const requirementItems = useMemo(
    () =>
      requirements.map((row) => {
        const coords = resolveCoords(row);
        return {
          ...row,
          latitude: coords ? coords.latitude : null,
          longitude: coords ? coords.longitude : null,
          has_coords: Boolean(coords),
          is_mine: Boolean(userId) && row.buyer_id === userId,
          product_label: labelFor("crop.", row.product_name),
          unit_label: labelFor("unit.", row.unit),
          location_label: labelFor("loc.", row.location),
          price_text: hasValue(row.max_price) ? priceText(row.max_price, row.unit) : "",
        };
      }),
    [requirements, userId, labelFor, priceText]
  );

  const mapListings = useMemo(
    () => listingItems.filter((item) => item.has_coords),
    [listingItems]
  );
  const mapRequirements = useMemo(
    () => requirementItems.filter((item) => item.has_coords),
    [requirementItems]
  );
  const unmappedCount =
    listingItems.length - mapListings.length + (requirementItems.length - mapRequirements.length);

  // SEARCH ONLY FILTERS THIS LIST. It is NOT used for the map.
  const filteredRequirements = useMemo(() => {
    const product = filters.product.trim().toLowerCase();
    return requirementItems.filter((item) => {
      if (filters.location && item.location !== filters.location) {
        return false;
      }
      if (product) {
        const raw = String(item.product_name || "").toLowerCase();
        const translated = String(item.product_label || "").toLowerCase();
        if (!raw.includes(product) && !translated.includes(product)) {
          return false;
        }
      }
      return true;
    });
  }, [requirementItems, filters]);

  const selectedRequirement = useMemo(
    () =>
      selected && selected.type === "requirement"
        ? requirementItems.find((item) => item.id === selected.id) || null
        : null,
    [requirementItems, selected]
  );
  const selectedListing = useMemo(
    () =>
      selected && selected.type === "listing"
        ? listingItems.find((item) => item.id === selected.id) || null
        : null,
    [listingItems, selected]
  );

  const focusedListingId = selected && selected.type === "listing" ? selected.id : null;
  const focusedRequirementId = selected && selected.type === "requirement" ? selected.id : null;

  const farmerLabels = useMemo(
    () => ({
      title: T("fm.supply"),
      farmer: T("fm.listing.farmer"),
      farmerUnknown: T("fm.listing.unknownFarmer"),
      product: T("fm.product"),
      quantity: T("form.quantity"),
      unit: T("form.unit"),
      price: T("list.price"),
      available: T("list.available"),
      location: T("list.location"),
      yours: T("fm.listing.yours"),
    }),
    [T]
  );

  const requirementLabels = useMemo(
    () => ({
      title: T("fm.demand"),
      product: T("fm.req.product"),
      quantity: T("form.quantity"),
      unit: T("form.unit"),
      maxPrice: T("fm.req.maxPrice"),
      requiredDate: T("fm.req.requiredDate"),
      location: T("list.location"),
      yours: T("fm.req.yours"),
    }),
    [T]
  );

  // --- Selection -----------------------------------------------------------------
  // Used by search results AND by map marker clicks
  const selectListingById = useCallback((id) => {
    setSelected({ type: "listing", id: id });
    setContactError("");
  }, []);

  const selectRequirementById = useCallback((id) => {
    setSelected({ type: "requirement", id: id });
    setContactError("");
  }, []);

  // --- Search -------------------------------------------------------------------
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setFilters({ product: qProduct, location: qLocation });
  };

  const handleClearSearch = () => {
    setQProduct("");
    setQLocation("");
    setFilters({ product: "", location: "" });
  };

  // --- Contact Buyer ---------------------------------------------------------------
  const handleContactBuyer = async (requirement) => {
    if (contactBusy) {
      return;
    }
    setContactBusy(requirement.id);
    setContactError("");
    try {
      const conversationId = await startConversation({ requirementId: requirement.id });
      if (typeof onOpenChat === "function") {
        onOpenChat(conversationId);
      }
    } catch (error) {
      console.error("Could not start the conversation:", error);
      if (mountedRef.current) {
        setContactError(
          isMessagingNotSetUp(error)
            ? T("chat.notSetUp")
            : T("chat.contactFailed", { detail: errorText(error) })
        );
      }
    } finally {
      if (mountedRef.current) {
        setContactBusy(null);
      }
    }
  };

  // --- Render helpers ---------------------------------------------------------------
  const renderRow = (label, value) => (
    <div className="ks-fm-r" key={label}>
      <span className="ks-fm-r-label">{label}</span>
      <span className="ks-fm-r-value">{hasValue(value) ? value : T("common.notSet")}</span>
    </div>
  );

  const quantityText = (item) =>
    hasValue(item.quantity) ? item.quantity + " " + item.unit_label : null;

  const renderMapPanel = () => (
    <>
      <div className="ks-fm-map-head">
        <div className="ks-fm-legend">
          <span>
            <span className="ks-fm-dot" style={{ background: "#2e9e4f" }} />
            {T("fm.supply")} ({mapListings.length})
          </span>
          <span>
            <span className="ks-fm-dot" style={{ background: "#1f6feb" }} />
            {T("fm.demand")} ({mapRequirements.length})
          </span>
        </div>
        <button
          type="button"
          className="ks-fm-btn ks-fm-btn-ghost ks-fm-btn-small"
          onClick={loadAll}
          disabled={loading}
        >
          {loading ? T("fm.loading") : T("fm.refresh")}
        </button>
      </div>

      {listingsError && (
        <p className="ks-fm-msg ks-fm-msg-error" role="alert">
          {T("fm.listingsFailed", { detail: listingsError })}
        </p>
      )}
      {requirementsError && (
        <p className="ks-fm-msg ks-fm-msg-error" role="alert">
          {T("fm.loadFailed", { detail: requirementsError })}
        </p>
      )}

      <div className="ks-fm-map">
        <GoogleMarketMap
          lang={lang}
          onRegionSelect={noop}
          selectedRegionId={null}
          farmerListings={mapListings}
          farmerLabels={farmerLabels}
          buyerRequirements={mapRequirements}
          requirementLabels={requirementLabels}
          noVerifiedOpportunitiesText={T("map.noVerifiedOpportunities")}
          focusedListingId={focusedListingId}
          focusedRequirementId={focusedRequirementId}
          onListingSelect={selectListingById}
          onRequirementSelect={selectRequirementById}
        />
      </div>

      {unmappedCount > 0 && (
        <p className="ks-fm-note">{T("fm.unmapped", { count: unmappedCount })}</p>
      )}
      <p className="ks-fm-note">{T("fm.hint")}</p>
    </>
  );

  // BLUE: selected buyer requirement (with Contact Buyer)
  const renderRequirementDetails = (requirement) => (
    <div className="ks-fm-panel ks-fm-detail" aria-live="polite">
      <div className="ks-fm-detail-head">
        <h2>{T("fm.req.details")}</h2>
        {requirement.is_mine && <span className="ks-fm-badge">{T("fm.req.yours")}</span>}
      </div>
      <div className="ks-fm-rows">
        {renderRow(T("fm.req.product"), requirement.product_label)}
        {renderRow(T("form.quantity"), requirement.quantity)}
        {renderRow(T("form.unit"), requirement.unit_label)}
        {renderRow(T("fm.req.maxPrice"), requirement.price_text)}
        {renderRow(
          T("fm.req.requiredDate"),
          formatDate(requirement.required_date, dateLocale, "")
        )}
        {renderRow(T("list.location"), requirement.location_label)}
      </div>

      {/* Never offer "Contact Buyer" on your own requirement */}
      {!requirement.is_mine && (
        <div className="ks-fm-actions">
          <button
            type="button"
            className="ks-fm-btn ks-fm-btn-blue"
            onClick={() => handleContactBuyer(requirement)}
            disabled={contactBusy !== null}
          >
            {contactBusy === requirement.id ? T("chat.opening") : T("fm.req.contact")}
          </button>
        </div>
      )}
      {contactError && (
        <p className="ks-fm-msg ks-fm-msg-error" role="alert" style={{ marginTop: 10 }}>
          {contactError}
        </p>
      )}
    </div>
  );

  // GREEN: selected farmer listing (details only; farmers do not contact farmers)
  const renderListingDetails = (listing) => (
    <div className="ks-fm-panel ks-fm-detail ks-fm-detail-green" aria-live="polite">
      <div className="ks-fm-detail-head">
        <h2>{T("fm.listing.details")}</h2>
        {listing.is_mine && (
          <span className="ks-fm-badge ks-fm-badge-green">{T("fm.listing.yours")}</span>
        )}
      </div>
      {listing.photo_url && (
        <img className="ks-fm-photo" src={listing.photo_url} alt={listing.product_label} />
      )}
      <div className="ks-fm-rows">
        {renderRow(
          T("fm.listing.farmer"),
          listing.farmer_name || T("fm.listing.unknownFarmer")
        )}
        {renderRow(T("fm.product"), listing.product_label)}
        {renderRow(T("form.quantity"), listing.quantity)}
        {renderRow(T("form.unit"), listing.unit_label)}
        {renderRow(T("list.price"), listing.price_text)}
        {renderRow(T("list.available"), formatDate(listing.available_date, dateLocale, ""))}
        {renderRow(T("list.location"), listing.location_label)}
      </div>
    </div>
  );

  // The details panel always represents the marker / result currently selected
  const renderSelectedDetails = () => {
    if (selectedRequirement) {
      return renderRequirementDetails(selectedRequirement);
    }
    if (selectedListing) {
      return renderListingDetails(selectedListing);
    }
    return null;
  };

  const locationOptions = LOCATION_VALUES.map((value) => (
    <option key={value} value={value}>
      {labelFor("loc.", value)}
    </option>
  ));

  // --- Map-only mode (Market Opportunities page) ----------------------------------
  if (!showSearch) {
    return (
      <div className="ks-fm">
        <style>{CSS}</style>
        {renderMapPanel()}
        {renderSelectedDetails()}
      </div>
    );
  }

  // --- Search mode (Buyer Requests page) -------------------------------------------
  return (
    <div className="ks-fm">
      <style>{CSS}</style>

      <div className="ks-fm-split">
        <div>
          <form className="ks-fm-panel" onSubmit={handleSearchSubmit}>
            <div className="ks-fm-field">
              <label className="ks-fm-label" htmlFor="ks-fm-product">
                {T("fm.search.product")}
              </label>
              <input
                id="ks-fm-product"
                className="ks-fm-input"
                type="text"
                value={qProduct}
                placeholder={T("fm.search.productPlaceholder")}
                onChange={(event) => setQProduct(event.target.value)}
              />
            </div>
            <div className="ks-fm-field">
              <label className="ks-fm-label" htmlFor="ks-fm-location">
                {T("list.location")}
              </label>
              <select
                id="ks-fm-location"
                className="ks-fm-input"
                value={qLocation}
                onChange={(event) => setQLocation(event.target.value)}
              >
                <option value="">{T("fm.search.allLocations")}</option>
                {locationOptions}
              </select>
            </div>
            <div className="ks-fm-actions" style={{ marginTop: 0 }}>
              <button type="submit" className="ks-fm-btn">
                {T("fm.search.button")}
              </button>
              <button type="button" className="ks-fm-btn ks-fm-btn-ghost" onClick={handleClearSearch}>
                {T("fm.search.clear")}
              </button>
            </div>
          </form>

          {renderSelectedDetails()}

          <h2 className="ks-fm-results-title">
            {T("fm.results", { count: filteredRequirements.length })}
          </h2>

          {loading && <p className="ks-fm-msg ks-fm-msg-info">{T("fm.loading")}</p>}
          {!loading && !requirementsError && filteredRequirements.length === 0 && (
            <p className="ks-fm-msg ks-fm-msg-info">
              {requirementItems.length === 0 ? T("fm.noRequirements") : T("fm.noMatch")}
            </p>
          )}

          <div className="ks-fm-list">
            {filteredRequirements.map((item) => (
              <button
                type="button"
                key={item.id}
                className="ks-fm-item"
                aria-pressed={focusedRequirementId === item.id}
                onClick={() => selectRequirementById(item.id)}
              >
                <span className="ks-fm-item-title">{item.product_label}</span>
                <span className="ks-fm-rows">
                  {renderRow(T("form.quantity"), quantityText(item))}
                  {renderRow(T("fm.req.maxPrice"), item.price_text)}
                  {renderRow(
                    T("fm.req.requiredDate"),
                    formatDate(item.required_date, dateLocale, "")
                  )}
                  {renderRow(T("list.location"), item.location_label)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>{renderMapPanel()}</div>
      </div>
    </div>
  );
}

export default FarmerMarketplace;
