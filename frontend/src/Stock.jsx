import { useEffect, useState } from "react";
import StockHistory from "./StockHistory";
import StockAdjustment from "./StockAdjustment";
import { apiFetch } from "./api";

// A pending receipt is stored BEFORE its HTTP request is sent.
// This lets a retry reuse both the same UUID and the same delivery details,
// even after the page is refreshed in this browser tab.
const PENDING_RECEIPT_KEY = "ghimire_pos_pending_receipt_v1";

function readPendingReceipt() {
  try {
    const saved = window.sessionStorage.getItem(PENDING_RECEIPT_KEY);
    if (!saved) return null;

    const receipt = JSON.parse(saved);
    if (
      !receipt ||
      !receipt.productId ||
      !receipt.payload ||
      !receipt.payload.receipt_request_id
    ) {
      return null;
    }

    return receipt;
  } catch {
    return null;
  }
}

function createReceiptId() {
  if (typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  // getRandomValues also works on many local-network HTTP origins.
  if (typeof window.crypto?.getRandomValues !== "function") {
    throw new Error("Secure random IDs are unavailable in this browser.");
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

async function fetchList(url, errorMessage) {
  const response = await apiFetch(url);
  if (!response.ok) throw new Error(errorMessage);

  const data = await response.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

function fetchProducts() {
  return fetchList("/api/products/", "Failed to load products.");
}

function fetchSuppliers() {
  return fetchList("/api/suppliers/", "Failed to load suppliers.");
}

function getApiError(data) {
  if (typeof data === "string") return data;
  if (data?.detail) return String(data.detail);

  if (data && typeof data === "object") {
    return Object.entries(data)
      .map(([field, value]) => {
        const text = Array.isArray(value) ? value.join(", ") : String(value);
        return `${field}: ${text}`;
      })
      .join(" | ");
  }

  return "Unable to receive stock.";
}

function Stock() {
  const [pendingReceipt, setPendingReceipt] = useState(readPendingReceipt);

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // If a request was interrupted, restore the same frozen details for display.
  const [productId, setProductId] = useState(
    pendingReceipt?.productId ?? ""
  );
  const [supplierId, setSupplierId] = useState(
    pendingReceipt?.payload?.supplier != null
      ? String(pendingReceipt.payload.supplier)
      : ""
  );
  const [quantity, setQuantity] = useState(
    pendingReceipt?.payload?.quantity != null
      ? String(pendingReceipt.payload.quantity)
      : ""
  );
  const [purchaseUnitCost, setPurchaseUnitCost] = useState(
    pendingReceipt?.payload?.purchase_unit_cost ?? ""
  );
  const [reference, setReference] = useState(
    pendingReceipt?.payload?.reference ?? ""
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadData() {
      const [productResult, supplierResult] = await Promise.allSettled([
        fetchProducts(),
        fetchSuppliers(),
      ]);

      if (!active) return;

      const errors = [];

      if (productResult.status === "fulfilled") {
        const loadedProducts = productResult.value;
        setProducts(loadedProducts);
        if (loadedProducts.length > 0) {
          setProductId((previous) => previous || String(loadedProducts[0].id));
        }
      } else {
        errors.push(productResult.reason.message);
      }

      if (supplierResult.status === "fulfilled") {
        setSuppliers(supplierResult.value);
      } else {
        errors.push(supplierResult.reason.message);
      }

      if (errors.length) setError(errors.join(" "));
      setLoading(false);
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  async function handleAdjustmentSaved() {
    setHistoryRefreshKey((previous) => previous + 1);

    try {
      setProducts(await fetchProducts());
    } catch {
      setError(
        "Adjustment saved, but products could not refresh. Reload the page."
      );
    }
  }

  const selectedProduct = products.find(
    (product) => String(product.id) === productId
  );

  const numericQuantity = Number(quantity);
  const validQuantity =
    quantity.trim() !== "" &&
    Number.isSafeInteger(numericQuantity) &&
    numericQuantity > 0;

  const validCost =
    /^\d+(\.\d{1,2})?$/.test(purchaseUnitCost.trim()) &&
    Number.isFinite(Number(purchaseUnitCost)) &&
    Number(purchaseUnitCost) >= 0 &&
    Number(purchaseUnitCost) <= 9999999999.99;

  const numericCost = Number(purchaseUnitCost);
  const totalPurchaseCost =
    validQuantity && validCost ? numericQuantity * numericCost : null;

  const expectedStock =
    selectedProduct && validQuantity
      ? Number(selectedProduct.stock) + numericQuantity
      : null;

  // Clear the in-flight request only when the API confirms it, or when a
  // definite 4xx validation/permission error proves no delivery was saved.
  function clearPendingReceipt() {
    window.sessionStorage.removeItem(PENDING_RECEIPT_KEY);
    setPendingReceipt(null);
  }

  async function receiveStock(event) {
    event.preventDefault();
    if (saving) return;

    setError("");
    setMessage("");

    let receipt = pendingReceipt;

    // For a retry, NEVER generate a new UUID or rebuild the payload from
    // editable inputs. The original delivery must stay exactly the same.
    if (!receipt) {
      if (!productId) {
        setError("Please select a product.");
        return;
      }
      if (!supplierId) {
        setError("Please select a supplier.");
        return;
      }
      if (!validQuantity) {
        setError("Quantity must be a positive whole number.");
        return;
      }
      if (!validCost) {
        setError(
          "Enter a valid purchase cost with up to 2 decimal places."
        );
        return;
      }

      try {
        receipt = {
          productId,
          payload: {
            quantity: numericQuantity,
            supplier: Number(supplierId),
            purchase_unit_cost: purchaseUnitCost.trim(),
            reference: reference.trim(),
            receipt_request_id: createReceiptId(),
          },
        };

        // Persist BEFORE sending the request. If storage fails, do not send
        // a non-recoverable request that might be duplicated after a reload.
        window.sessionStorage.setItem(
          PENDING_RECEIPT_KEY,
          JSON.stringify(receipt)
        );
        setPendingReceipt(receipt);
      } catch (err) {
        setError(`Could not safely prepare the delivery: ${err.message}`);
        return;
      }
    }

    setSaving(true);
    let definitelyRejected = false;

    try {
      const response = await apiFetch(
        `/api/products/${receipt.productId}/receive-stock/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(receipt.payload),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // 409 means an ID conflict and needs investigation. Network and 5xx
        // failures may have committed stock: retain the exact same request.
        if (response.status >= 400 && response.status < 500 && response.status !== 409) {
          definitelyRejected = true;
          clearPendingReceipt();
          throw new Error(
            `${getApiError(data)} The request was rejected; correct the form and submit again.`
          );
        }

        throw new Error(
          `${getApiError(data)} Do not start a new delivery until this request is resolved.`
        );
      }

      // Ensure the server acknowledged the UUID, rather than silently
      // ignoring it (which would mean idempotency is not operational).
      if (
        !data ||
        !data.stock_movement_id ||
        data.receipt_request_id !== receipt.payload.receipt_request_id
      ) {
        throw new Error(
          "The server response did not confirm the receipt ID. Please retry the same delivery."
        );
      }

      clearPendingReceipt();

      setMessage(
        data.already_processed
          ? `This delivery was already recorded. No additional stock was added. Current stock: ${data.current_stock} units.`
          : `Stock received successfully. Current stock: ${data.current_stock} units.`
      );

      setQuantity("");
      setPurchaseUnitCost("");
      setReference("");
      setHistoryRefreshKey((previous) => previous + 1);

      try {
        setProducts(await fetchProducts());
      } catch {
        setError(
          "Delivery confirmed, but products could not refresh. Reload the page without submitting again."
        );
      }
    } catch (err) {
      setError(
        definitelyRejected
          ? err.message
          : `${err.message} If this delivery may have been saved, use “Retry Same Delivery”; do not enter it as a new delivery.`
      );
    } finally {
      setSaving(false);
    }
  }

  // Only for a manager who has independently checked Inventory History
  // and decided NOT to retry this request. This is NOT an automatic retry.
  function discardPendingReceipt() {
    if (saving || !pendingReceipt) return;

    const confirmed = window.confirm(
      "Have you checked Inventory History to determine whether this delivery was already saved? " +
        "Clearing its retry ID and entering the same delivery again can double-count stock. " +
        "Discard this pending request anyway?"
    );
    if (!confirmed) return;

    try {
      clearPendingReceipt();
      setQuantity("");
      setPurchaseUnitCost("");
      setReference("");
      setError("");
      setMessage("Pending retry cleared. Do not re-enter an already recorded delivery.");
    } catch (err) {
      setError(`Could not clear the pending request: ${err.message}`);
    }
  }

  const canReceive =
    !loading &&
    !saving &&
    (pendingReceipt !== null ||
      (Boolean(productId) && Boolean(supplierId) && validQuantity && validCost));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Receive Stock</h2>
        <p className="mt-1 text-sm text-gray-500">
          Record supplier deliveries, purchase costs, and received inventory.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      {pendingReceipt && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            {saving ? "Receiving request in progress" : "Delivery outcome not yet confirmed"}
          </p>
          <p>
            This delivery has a saved request ID. Retry it using the button below;
            the POS will send the exact same details and UUID, even after a page refresh.
          </p>
          <p className="break-all text-xs">
            Receipt ID: {pendingReceipt.payload.receipt_request_id}
          </p>
          {!saving && (
            <button
              type="button"
              onClick={discardPendingReceipt}
              className="text-xs font-medium underline hover:text-amber-700"
            >
              Discard pending retry only after checking Inventory History
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={receiveStock}
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <h3 className="text-lg font-semibold">New Stock Delivery</h3>

        <div>
          <label htmlFor="receive-product" className="mb-2 block text-sm font-medium">
            Select Product *
          </label>
          <select
            id="receive-product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            disabled={loading || saving || Boolean(pendingReceipt)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {products.length === 0 && <option value="">No products available</option>}
            {products.map((product) => (
              <option key={product.id} value={String(product.id)}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Current Stock</p>
            <p className="mt-1 text-2xl font-semibold">
              {selectedProduct.stock} units
            </p>
          </div>
        )}

        <div>
          <label htmlFor="receive-supplier" className="mb-2 block text-sm font-medium">
            Supplier *
          </label>
          <select
            id="receive-supplier"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            disabled={loading || saving || Boolean(pendingReceipt)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={String(supplier.id)}>
                {supplier.name}
              </option>
            ))}
          </select>
          {suppliers.length === 0 && !loading && (
            <p className="mt-2 text-sm text-amber-700">
              No suppliers available. Create a supplier from the Suppliers page first.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="receive-quantity" className="mb-2 block text-sm font-medium">
              Quantity Received *
            </label>
            <input
              id="receive-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={saving || Boolean(pendingReceipt)}
              required
              placeholder="e.g. 20"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="receive-cost" className="mb-2 block text-sm font-medium">
              Purchase Cost per Unit *
            </label>
            <input
              id="receive-cost"
              type="number"
              min="0"
              max="9999999999.99"
              step="0.01"
              value={purchaseUnitCost}
              onChange={(event) => setPurchaseUnitCost(event.target.value)}
              disabled={saving || Boolean(pendingReceipt)}
              required
              placeholder="e.g. 400.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="receive-reference" className="mb-2 block text-sm font-medium">
            Invoice / Delivery Reference
          </label>
          <input
            id="receive-reference"
            type="text"
            maxLength={100}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            disabled={saving || Boolean(pendingReceipt)}
            placeholder="e.g. INV-1001"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="text-sm font-semibold">Delivery Summary</h4>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Quantity</span>
            <span className="font-medium">
              {validQuantity ? `${numericQuantity} units` : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Purchase Cost per Unit</span>
            <span className="font-medium">
              {validCost ? numericCost.toFixed(2) : "—"}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-3">
            <span className="font-semibold">Total Purchase Cost</span>
            <span className="text-lg font-semibold">
              {totalPurchaseCost !== null
                ? totalPurchaseCost.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"}
            </span>
          </div>
          {expectedStock !== null && (
            <p className="border-t border-gray-200 pt-3 text-sm text-gray-600">
              Expected stock after receiving: {" "}
              <strong className="text-gray-900">{expectedStock} units</strong>
            </p>
          )}
        </div>

        <button
          type={pendingReceipt ? "button" : "submit"}
          onClick={pendingReceipt ? receiveStock : undefined}
          disabled={!canReceive}
          className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
        >
          {saving
            ? "Saving..."
            : pendingReceipt
              ? "Retry Same Delivery"
              : "Receive Stock"}
        </button>
      </form>

      <StockAdjustment products={products} onSaved={handleAdjustmentSaved} />
      <StockHistory refreshKey={historyRefreshKey} />
    </div>
  );
}

export default Stock;
