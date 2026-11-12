
import { useEffect, useState } from "react";
import Receipt from "./Receipt";

function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);

  // Load completed sales
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

  function formatDate(date) {
    return new Date(date).toLocaleString();
  }

  function formatMoney(value) {
    return Number(value).toFixed(2);
  }

  // Expand or collapse sale details
  function toggleSale(id) {
    setSelectedSale((previous) =>
      previous === id ? null : id
    );
  }

  // Print the currently selected receipt
  function printReceipt() {
    window.print();
  }

  // Get the sale that is currently expanded
  const activeSale = sales.find(
    (sale) => sale.id === selectedSale
  );

  return (
    <div>

      {/* Normal Sales History Page */}
      <div className="sales-history-screen space-y-6">

        {/* Page Heading */}
        <div>
          <h2 className="text-2xl font-semibold">
            Sales History
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            View transactions, payment details,
            and print receipts.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">
            Loading sales...
          </p>
        ) : sales.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
            No sales recorded yet.
          </div>
        ) : (

          <div className="space-y-3">

            {sales.map((sale) => {
              const isExpanded =
                selectedSale === sale.id;

              const hasCashPayment =
                sale.payment_method === "CASH" &&
                sale.cash_received != null &&
                sale.change_amount != null;

              return (
                <div
                  key={sale.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                >

                  {/* Sale Summary */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5">

                    <div>
                      <h3 className="font-semibold">
                        Sale #{sale.id}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {formatDate(sale.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">

                      <p className="font-semibold">
                        {formatMoney(sale.total_amount)}
                      </p>

                      <button
                        onClick={() =>
                          toggleSale(sale.id)
                        }
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        {isExpanded
                          ? "Hide Details"
                          : "View Details"}
                      </button>

                    </div>
                  </div>

                  {/* Expanded Sale Details */}
                  {isExpanded && (

                    <div className="border-t border-gray-200 bg-gray-50 p-5">

                      <h4 className="mb-4 text-sm font-semibold">
                        Purchased Products
                      </h4>

                      {/* Product Table */}
                      <div className="overflow-x-auto">

                        <table className="w-full text-left text-sm">

                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="pb-3">
                                Product
                              </th>

                              <th className="pb-3">
                                Qty
                              </th>

                              <th className="pb-3">
                                Price
                              </th>

                              <th className="pb-3 text-right">
                                Total
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {sale.items.map(
                              (item, index) => (

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
                                    {formatMoney(
                                      item.unit_price
                                    )}
                                  </td>

                                  <td className="py-3 text-right">
                                    {formatMoney(
                                      Number(item.unit_price) *
                                      item.quantity
                                    )}
                                  </td>

                                </tr>
                              )
                            )}
                          </tbody>

                        </table>
                      </div>

                      {/* Sale Total */}
                      <div className="mt-4 flex justify-end gap-8 font-semibold">
                        <span>Total</span>

                        <span>
                          {formatMoney(
                            sale.total_amount
                          )}
                        </span>
                      </div>

                      {/* Payment Information */}
                      <div className="mt-5 space-y-3 border-t border-gray-200 pt-4">

                        <h4 className="text-sm font-semibold">
                          Payment Details
                        </h4>

                        {hasCashPayment ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                Payment Method
                              </span>
                              <span>Cash</span>
                            </div>

                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                Cash Received
                              </span>

                              <span>
                                {formatMoney(
                                  sale.cash_received
                                )}
                              </span>
                            </div>

                            <div className="flex justify-between text-sm font-semibold">
                              <span className="text-gray-600">
                                Change Returned
                              </span>

                              <span className="text-green-700">
                                {formatMoney(
                                  sale.change_amount
                                )}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">
                            Payment details were not recorded
                            for this sale.
                          </p>
                        )}

                      </div>

                      {/* Print Receipt Button */}
                      <div className="mt-6 border-t border-gray-200 pt-5">

                        <button
                          type="button"
                          onClick={printReceipt}
                          className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-700"
                        >
                          Print Receipt
                        </button>

                      </div>

                    </div>
                  )}

                </div>
              );
            })}

          </div>
        )}

      </div>

      {/* Print-only Receipt */}
      {activeSale && (
        <Receipt sale={activeSale} />
      )}

    </div>
  );
}

export default SalesHistory;
