
import { useEffect, useState } from "react";

function Reports() {
  const [selectedDate, setSelectedDate] = useState("");
  const [requestedDate, setRequestedDate] = useState(null);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch report on first load and when date changes
  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setError("");

      try {
        const query = requestedDate
          ? `?date=${requestedDate}`
          : "";

        const response = await fetch(
          `/api/sales/report/${query}`
        );

        if (!response.ok) {
          throw new Error("Failed to load sales report.");
        }

        const data = await response.json();

        if (active) {
          setReport(data);
          setSelectedDate(data.date);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [requestedDate]);

  function handleSubmit(event) {
    event.preventDefault();

    if (selectedDate) {
      setRequestedDate(selectedDate);
    }
  }

  function formatMoney(value) {
    return Number(value).toFixed(2);
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold">
          Daily Sales Report
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Review sales for a selected date.
        </p>
      </div>

      {/* Date Selection */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-5"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">
            Select Date
          </label>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) =>
              setSelectedDate(e.target.value)
            }
            required
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          View Report
        </button>
      </form>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-gray-500">
          Loading report...
        </p>
      ) : report && (
        <>
          {/* Report Date */}
          <h3 className="font-semibold">
            Sales Summary — {report.date}
          </h3>

          {/* Statistics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {
[
  {
    title: "Gross Sales",
    value: formatMoney(report.total_sales),
  },
  {
    title: "Refunds Issued",
    value: formatMoney(report.total_refunds),
  },
  {
    title: "Net Sales",
    value: formatMoney(report.net_sales),
  },
  {
    title: "Sales Transactions",
    value: report.transaction_count,
  },
  {
    title: "Refund Transactions",
    value: report.refund_count,
  },
  {
    title: "Items Sold",
    value: report.total_items_sold,
  },
  {
    title: "Products Sold",
    value: report.products_sold_count,
  },
]
.map((stat) => (
              <div
                key={stat.title}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <p className="text-sm text-gray-500">
                  {stat.title}
                </p>

                <h3 className="mt-3 text-2xl font-semibold">
                  {stat.value}
                </h3>
              </div>
            ))}
          </div>

          {/* Product Sales Breakdown */}
          <section className="rounded-xl border border-gray-200 bg-white">

            <div className="border-b border-gray-200 p-5">
              <h3 className="font-semibold">
                Products Sold (Before Refunds)
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Product-wise sales breakdown.
              </p>
            </div>

            {report.products.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">
                No sales found for this date.
              </p>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full text-left text-sm">

                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="p-4">Product</th>
                      <th className="p-4 text-right">
                        Quantity Sold
                      </th>
                      <th className="p-4 text-right">
                        Total Sales
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.products.map((product) => (
                      <tr
                        key={product.product_id}
                        className="border-t border-gray-100"
                      >
                        <td className="p-4 font-medium">
                          {product.product_name}
                        </td>

                        <td className="p-4 text-right">
                          {product.quantity_sold}
                        </td>

                        <td className="p-4 text-right">
                          {formatMoney(product.sales_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default Reports;
