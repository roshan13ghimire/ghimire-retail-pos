
import { apiFetch } from "./api";
import { useState } from "react";

function StockAdjustment({ products, onSaved }) {
  const [productId, setProductId] = useState("");
  const [countedStock, setCountedStock] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  

  const product = products.find(
    (p) => String(p.id) === productId
  );

  const count = Number(countedStock);

  const validCount =
    countedStock !== "" &&
    Number.isInteger(count) &&
    count >= 0;

  const difference =
    product && validCount
      ? count - product.stock
      : null;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!product || !validCount || difference === 0) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/products/${productId}/adjust-stock/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            counted_stock: count,
            reason: reason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      setMessage(
        `Stock adjusted from ${data.previous_stock} to ${data.current_stock}.`
      );

      setCountedStock("");
      setReason("");

      // Update products and history in parent
      try {
        await onSaved();
      } catch {
        setError(
          "Adjustment saved, but refresh failed. Reload the page."
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold">
        Stock Adjustment
      </h3>

      <p className="mt-1 mb-6 text-sm text-gray-500">
        Correct inventory after physically counting stock.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium">
            Select Product
          </label>

          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setCountedStock("");
            }}
            disabled={saving}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Choose a product</option>

            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {product && (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              Current System Stock
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {product.stock} units
            </p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">
            Actual Stock Count
          </label>

          <input
            type="number"
            min="0"
            step="1"
            value={countedStock}
            onChange={(e) => setCountedStock(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        {difference !== null && (
          <p className="text-sm text-gray-600">
            Adjustment:{" "}
            <strong>
              {difference > 0 ? "+" : ""}
              {difference} units
            </strong>
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">
            Reason
          </label>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Example: 2 damaged items"
            required
            maxLength={255}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={
            saving ||
            !product ||
            !validCount ||
            difference === 0 ||
            !reason.trim()
          }
          className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Adjust Stock"}
        </button>
      </form>
    </section>
  );
}

export default StockAdjustment;
