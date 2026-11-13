
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

function Returns() {
  const [sales, setSales] = useState([]);
  const [refunds, setRefunds] = useState([]);

  const [saleId, setSaleId] = useState("");
  const [saleItemId, setSaleItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Keep a request when its result is uncertain
  const [pendingRefund, setPendingRefund] = useState(null);

  function formatMoney(value) {
    return Number(value).toFixed(2);
  }

  function formatDate(value) {
    return new Date(value).toLocaleString();
  }

  // Load sales and previous refunds
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [salesResponse, refundsResponse] =
          await Promise.all([
            apiFetch("/api/sales/"),
            apiFetch("/api/sales/refunds/"),
          ]);

        if (!salesResponse.ok || !refundsResponse.ok) {
          throw new Error("Failed to load returns data.");
        }

        const salesData = await salesResponse.json();
        const refundsData = await refundsResponse.json();

        if (active) {
          setSales(salesData);
          setRefunds(refundsData);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, []);

  // Only recorded cash sales are refundable
  const cashSales = sales.filter(
    (sale) => sale.payment_method === "CASH"
  );

  const selectedSale = cashSales.find(
    (sale) => String(sale.id) === saleId
  );

  const selectedItem = selectedSale?.items.find(
    (item) => String(item.id) === saleItemId
  );

  // Calculate how many units were returned already
  const alreadyReturned = refunds
    .filter(
      (refund) =>
        String(refund.sale_item) === saleItemId
    )
    .reduce(
      (total, refund) => total + refund.quantity,
      0
    );

  const remainingQuantity = selectedItem
    ? Math.max(0, selectedItem.quantity - alreadyReturned)
    : 0;

  const validQuantity =
    /^\d+$/.test(quantity) &&
    Number(quantity) > 0 &&
    Number(quantity) <= remainingQuantity;

  const refundAmount =
    selectedItem && validQuantity
      ? Number(selectedItem.unit_price) * Number(quantity)
      : 0;

  // Save the refund through Django
  async function handleRefund(event) {
    event.preventDefault();

    if (saving) return;

    let payload = pendingRefund;

    // Create a new request only if none is pending
    if (!payload) {
      if (
        !selectedItem ||
        !validQuantity ||
        !reason.trim()
      ) {
        setError("Please complete all return details.");
        return;
      }

      const confirmed = window.confirm(
        `Confirm that ${formatMoney(refundAmount)} ` +
        "has been returned to the customer in cash?"
      );

      if (!confirmed) return;

      payload = {
        refund_request_id: crypto.randomUUID(),
        sale_item_id: selectedItem.id,
        quantity: Number(quantity),
        restock,
        reason: reason.trim(),
      };

      setPendingRefund(payload);
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        "/api/sales/refunds/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Server errors may leave the result uncertain
        if (response.status >= 500) {
          setError(
            "Refund status is uncertain. Retry the same request."
          );
        } else {
          setPendingRefund(null);
          setError(JSON.stringify(data));
        }
        return;
      }

      // Refund successfully recorded
      setPendingRefund(null);

      setMessage(
        `Refund #${data.id} recorded. ` +
        `Amount: ${formatMoney(data.refund_amount)}`
      );

      // Update refund history without another API call
      setRefunds((previous) => [
        data,
        ...previous.filter(
          (refund) => refund.id !== data.id
        ),
      ]);

      setQuantity("1");
      setReason("");
      setRestock(true);

    } catch {
      // Keep the same ID for safe retry
      setError(
        "Could not confirm refund. Retry the same request without changing details."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Heading */}
      <div>
        <h2 className="text-2xl font-semibold">
          Returns & Refunds
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Process customer returns and review refunds.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {message}
        </p>
      )}

      {pendingRefund && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            Refund Confirmation Required
          </p>

          <p className="mt-1 text-sm text-amber-800">
            The previous refund may already be saved.
            Return details are locked until the same
            request is confirmed.
          </p>
        </div>
      )}

      {/* Return Form */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">

        <h3 className="mb-5 text-lg font-semibold">
          Process Return
        </h3>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <form onSubmit={handleRefund} className="space-y-5">

            {/* Select Sale */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Original Sale
              </label>

              <select
                value={saleId}
                onChange={(e) => {
                  setSaleId(e.target.value);
                  setSaleItemId("");
                  setQuantity("1");
                }}
                disabled={saving || !!pendingRefund}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Select a sale</option>

                {cashSales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    Sale #{sale.id} — {formatMoney(sale.total_amount)}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Product */}
            {selectedSale && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Product to Return
                </label>

                <select
                  value={saleItemId}
                  onChange={(e) => {
                    setSaleItemId(e.target.value);
                    setQuantity("1");
                  }}
                  disabled={saving || !!pendingRefund}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Select a product</option>

                  {selectedSale.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.product_name} — {item.quantity} purchased
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Product and Quantity */}
            {selectedItem && (
              <>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="font-medium">
                    {selectedItem.product_name}
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    Original Price: {formatMoney(selectedItem.unit_price)}
                  </p>

                  <p className="text-sm text-gray-600">
                    Purchased: {selectedItem.quantity}
                  </p>

                  <p className="text-sm text-gray-600">
                    Already Returned: {alreadyReturned}
                  </p>

                  <p className="mt-2 font-medium">
                    Available to Return: {remainingQuantity}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Return Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    max={remainingQuantity}
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={saving || !!pendingRefund}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                {/* Restock Option */}
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={restock}
                    onChange={(e) => setRestock(e.target.checked)}
                    disabled={saving || !!pendingRefund}
                    className="h-4 w-4"
                  />

                  <span className="text-sm">
                    Return to sellable inventory
                  </span>
                </label>

                {/* Reason */}
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Return Reason
                  </label>

                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={saving || !!pendingRefund}
                    required
                    maxLength={255}
                    rows={3}
                    placeholder="Why is the customer returning this product?"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                {/* Refund Amount */}
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">
                    Refund Amount
                  </p>

                  <p className="mt-1 text-2xl font-semibold">
                    {formatMoney(refundAmount)}
                  </p>
                </div>

                {/* Submit */}
               {/* Product and Quantity */}
{selectedItem && (
  <>
    {/* Existing product information */}

    {/* Existing quantity input */}

    {/* Existing restock checkbox */}

    {/* Existing reason input */}

    {/* Existing refund amount */}
  </>
)}

{/* Refund Button - Always Visible */}
<button
  type="submit"
  disabled={
    saving ||
    (!pendingRefund &&
      (!selectedItem || !validQuantity || !reason.trim()))
  }
  className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
>
  {saving
    ? "Processing..."
    : pendingRefund
      ? "Retry Same Refund"
      : "Record Refund"}
</button>
              </>
            )}
          </form>
        )}
      </section>

      {/* Refund History */}
      <section className="rounded-xl border border-gray-200 bg-white">

        <div className="border-b border-gray-200 p-5">
          <h3 className="font-semibold">
            Refund History
          </h3>
        </div>

        {refunds.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">
            No refunds recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Sale</th>
                  <th className="p-4">Product</th>
                  <th className="p-4">Qty</th>
                  <th className="p-4">Refund</th>
                  <th className="p-4">Inventory</th>
                </tr>
              </thead>

              <tbody>
                {refunds.map((refund) => (
                  <tr
                    key={refund.id}
                    className="border-t border-gray-100"
                  >
                    <td className="p-4">
                      {formatDate(refund.created_at)}
                    </td>

                    <td className="p-4">
                      #{refund.sale_id}
                    </td>

                    <td className="p-4">
                      <p className="font-medium">
                        {refund.product_name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {refund.reason}
                      </p>
                    </td>

                    <td className="p-4">
                      {refund.quantity}
                    </td>

                    <td className="p-4">
                      {formatMoney(refund.refund_amount)}
                    </td>

                    <td className="p-4">
                      {refund.restock
                        ? "Restocked"
                        : "Not Restocked"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        )}
      </section>

    </div>
  );
}

export default Returns;
