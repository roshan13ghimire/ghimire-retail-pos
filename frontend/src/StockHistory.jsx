
import { useEffect, useState } from "react";

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
};

function StockHistory({ refreshKey }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/stock-movements/");

        if (!response.ok) {
          throw new Error("Failed to load stock history.");
        }

        const data = await response.json();

        if (active) {
          setMovements(data);
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

  function formatDate(date) {
    return new Date(date).toLocaleString();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-5">
        <h3 className="text-lg font-semibold">
          Inventory History
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          View stock received, sold, and adjusted.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">
          Loading inventory history...
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">
          {error}
        </p>
      ) : movements.length === 0 ? (
        <p className="text-sm text-gray-500">
          No inventory movements recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr className="text-gray-600">
                <th className="p-3">Date</th>
                <th className="p-3">Product</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">
                  Quantity
                </th>
              </tr>
            </thead>

            <tbody>
              {movements.map((movement) => {
                const type = movementTypes[
                  movement.movement_type
                ] ?? {
                  label: movement.movement_type,
                  sign: "",
                  color: "text-gray-600",
                };

                return (
                  <tr
                    key={movement.id}
                    className="border-t border-gray-100"
                  >
                    {/* Date */}
                    <td className="p-3 text-gray-600">
                      {formatDate(movement.created_at)}
                    </td>

                    {/* Product and reason */}
                    <td className="p-3">
                      <p className="font-medium">
                        {movement.product_name}
                      </p>

                      {movement.reason && (
                        <p className="mt-1 text-xs text-gray-500">
                          Reason: {movement.reason}
                        </p>
                      )}
                    </td>

                    {/* Movement type */}
                    <td className="p-3">
                      <span className={type.color}>
                        {type.label}
                      </span>
                    </td>

                    {/* Signed quantity */}
                    <td
                      className={`p-3 text-right font-medium ${type.color}`}
                    >
                      {type.sign}{movement.quantity}
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
