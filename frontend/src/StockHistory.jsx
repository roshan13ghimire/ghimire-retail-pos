
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const movementTypes = {
  RECEIVED: {
    label: "Received",
    sign: "+",
    color: "text-green-700",
  },
  SOLD: {
    label: "Sold",
    sign: "-",
    color: "text-red-600",
  },
  ADJUST_IN: {
    label: "Adjustment In",
    sign: "+",
    color: "text-green-700",
  },
  ADJUST_OUT: {
    label: "Adjustment Out",
    sign: "-",
    color: "text-red-600",
  },
  RETURNED: {
    label: "Returned",
    sign: "+",
    color: "text-green-700",
  },
};

function StockHistory({ refreshKey }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load stock movement history
  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(
          "/api/stock-movements/"
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load stock history."
          );
        }

        const data = await response.json();

        const history = Array.isArray(data)
          ? data
          : data.results;

        if (!Array.isArray(history)) {
          throw new Error(
            "Unexpected stock history response."
          );
        }

        if (active) {
          setMovements(history);
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

    loadHistory();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Format movement date
  function formatDate(date) {
    if (!date) return "Not recorded";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "Invalid date";
    }

    return parsed.toLocaleString();
  }

  // Format money for display
  function formatMoney(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "Not recorded";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return "Invalid amount";
    }

    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">

      {/* Header */}
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-gray-900">
          Inventory History
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Track stock received, sold, returned, and
          adjusted, including suppliers, purchase costs,
          invoice references, and employees.
        </p>
      </div>

      {/* Loading */}
      {loading ? (
        <p className="text-sm text-gray-500">
          Loading inventory history...
        </p>

      ) : error ? (
        <p
          role="alert"
          className="text-sm text-red-600"
        >
          {error}
        </p>

      ) : movements.length === 0 ? (
        <p className="text-sm text-gray-500">
          No inventory movements recorded yet.
        </p>

      ) : (
        <div className="overflow-x-auto">

          <table className="w-full min-w-275 text-left text-sm">

            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3 font-medium">
                  Date
                </th>

                <th className="p-3 font-medium">
                  Product
                </th>

                <th className="p-3 font-medium">
                  Type
                </th>

                <th className="p-3 font-medium">
                  Supplier
                </th>

                <th className="p-3 text-right font-medium">
                  Unit Cost
                </th>

                <th className="p-3 text-right font-medium">
                  Total Cost
                </th>

                <th className="p-3 font-medium">
                  Reference
                </th>

                <th className="p-3 font-medium">
                  Performed By
                </th>

                <th className="p-3 text-right font-medium">
                  Quantity
                </th>
              </tr>
            </thead>

            <tbody>
              {movements.map((movement) => {
                const type =
                  movementTypes[
                    movement.movement_type
                  ] ?? {
                    label: movement.movement_type,
                    sign: "",
                    color: "text-gray-600",
                  };

                const isReceived =
                  movement.movement_type === "RECEIVED";

                return (
                  <tr
                    key={movement.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >

                    {/* Date */}
                    <td className="whitespace-nowrap p-3 text-gray-600">
                      {formatDate(
                        movement.created_at
                      )}
                    </td>

                    {/* Product and reason */}
                    <td className="p-3">
                      <p className="font-medium text-gray-900">
                        {movement.product_name ||
                          `Product #${movement.product}`}
                      </p>

                      {movement.reason && (
                        <p className="mt-1 text-xs text-gray-500">
                          Reason: {movement.reason}
                        </p>
                      )}
                    </td>

                    {/* Movement type */}
                    <td className="p-3">
                      <span
                        className={`font-medium ${type.color}`}
                      >
                        {type.label}
                      </span>
                    </td>

                    {/* Supplier */}
                    <td className="p-3">
                      {isReceived ? (
                        movement.supplier_name ? (
                          <span className="font-medium text-gray-800">
                            {movement.supplier_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            Not recorded
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* Purchase unit cost */}
                    <td className="p-3 text-right whitespace-nowrap">
                      {isReceived ? (
                        <span className="text-gray-700">
                          {formatMoney(
                            movement.purchase_unit_cost
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* Total purchase cost */}
                    <td className="p-3 text-right whitespace-nowrap">
                      {isReceived ? (
                        <span className="font-medium text-gray-900">
                          {formatMoney(
                            movement.total_purchase_cost
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* Invoice reference */}
                    <td className="p-3">
                      {isReceived ? (
                        movement.reference ? (
                          <span className="text-gray-700">
                            {movement.reference}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            Not recorded
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">
                          —
                        </span>
                      )}
                    </td>

                    {/* Employee */}
                    <td className="p-3">
                      {movement.performed_by_username ? (
                        <span className="font-medium text-gray-700">
                          {movement.performed_by_username}
                        </span>
                      ) : (
                        <span className="text-gray-400">
                          Not recorded
                        </span>
                      )}
                    </td>

                    {/* Signed quantity */}
                    <td
                      className={`p-3 text-right font-semibold ${type.color}`}
                    >
                      {type.sign}
                      {movement.quantity}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      )}
    </section>
  );
}

export default StockHistory;
