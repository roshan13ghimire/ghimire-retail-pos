
import { useEffect, useState } from "react";

function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);

  // Fetch sales from Django
  useEffect(() => {
    async function fetchSales() {
      try {
        const response = await fetch("/api/sales/");

        if (!response.ok) {
          throw new Error("Failed to load sales.");
        }

        const data = await response.json();
        setSales(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSales();
  }, []);

  // Format date for display
  function formatDate(date) {
    return new Date(date).toLocaleString();
  }

  // Expand or collapse sale details
  function toggleSale(id) {
    setSelectedSale(selectedSale === id ? null : id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Sales History
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          View completed transactions.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading sales...</p>
      ) : sales.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
          No sales recorded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              {/* Sale summary */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">
                    Sale #{sale.id}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {formatDate(sale.created_at)}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <p className="font-semibold">
                    {Number(sale.total_amount).toFixed(2)}
                  </p>

                  <button
                    onClick={() => toggleSale(sale.id)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    {selectedSale === sale.id
                      ? "Hide Details"
                      : "View Details"}
                  </button>
                </div>
              </div>

              {/* Expanded sale items */}
              {selectedSale === sale.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-5">
                  <h4 className="mb-4 text-sm font-semibold">
                    Purchased Products
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="pb-3">Product</th>
                          <th className="pb-3">Qty</th>
                          <th className="pb-3">Price</th>
                          <th className="pb-3 text-right">
                            Total
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {sale.items.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b border-gray-200"
                          >
                            <td className="py-3">
                              {item.product_name}
                            </td>

                            <td className="py-3">
                              {item.quantity}
                            </td>

                            <td className="py-3">
                              {Number(item.unit_price).toFixed(2)}
                            </td>

                            <td className="py-3 text-right">
                              {(
                                Number(item.unit_price) *
                                item.quantity
                              ).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end gap-8 font-semibold">
                    <span>Total</span>
                    <span>
                      {Number(sale.total_amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SalesHistory;
