
import { useEffect, useState } from "react";

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load dashboard information
  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/sales/dashboard/",
          {
            credentials: "same-origin",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load dashboard.");
        }

        const result = await response.json();

        if (active) {
          setData(result);
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

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-gray-500">
        Loading dashboard...
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (!data) return null;

  // Dashboard summary statistics
  const stats = [
    {
      title: "Gross Sales Today",
      value: Number(data.today_sales).toFixed(2),
    },
    {
      title: "Refunds Today",
      value: Number(data.today_refunds).toFixed(2),
    },
    {
      title: "Net Sales Today",
      value: Number(data.today_net_sales).toFixed(2),
    },
    {
      title: "Transactions Today",
      value: data.transaction_count,
    },
    {
      title: "Total Products",
      value: data.total_products,
    },
    {
      title: "Low Stock Products",
      value: data.low_stock_count,
    },
  ];

  const lowStockProducts = data.low_stock_products ?? [];

  // Determine the product's stock status
  function getStockStatus(product) {
    const stock = Number(product.stock);
    const reorderLevel = Number(product.reorder_level);

    if (stock === 0) {
      return {
        label: "Out of Stock",
        color: "bg-red-50 text-red-700",
      };
    }

    if (stock <= reorderLevel) {
      return {
        label: "Low Stock",
        color: "bg-amber-50 text-amber-700",
      };
    }

    return {
      label: "In Stock",
      color: "bg-green-50 text-green-700",
    };
  }

  return (
    <div className="space-y-6">

      {/* Heading */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          Dashboard
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Store overview for {data.date}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <p className="text-sm text-gray-500">
              {stat.title}
            </p>

            <h3 className="mt-3 text-2xl font-semibold text-gray-900">
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      {/* Low Stock Section */}
      <section className="rounded-xl border border-gray-200 bg-white">

        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5">
          <div>
            <h3 className="font-semibold text-gray-900">
              Low Stock Alerts
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Products at or below their individual
              reorder levels. Showing up to 10 products.
            </p>
          </div>

          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            {data.low_stock_count} products
          </span>
        </div>

        {/* Empty State */}
        {lowStockProducts.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-gray-500">
              No low-stock products found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-162.5 text-left text-sm">

              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">
                    Product
                  </th>

                  <th className="p-4 font-medium">
                    Barcode
                  </th>

                  <th className="p-4 font-medium">
                    Available Stock
                  </th>

                  <th className="p-4 font-medium">
                    Alert Level
                  </th>

                  <th className="p-4 font-medium">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {lowStockProducts.map((product) => {
                  const stockStatus = getStockStatus(product);

                  return (
                    <tr
                      key={product.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      {/* Product Name */}
                      <td className="p-4 font-medium text-gray-900">
                        {product.name}
                      </td>

                      {/* Barcode */}
                      <td className="p-4 text-gray-600">
                        {product.barcode}
                      </td>

                      {/* Current Stock */}
                      <td className="p-4">
                        <span
                          className={
                            Number(product.stock) === 0
                              ? "font-semibold text-red-700"
                              : "font-medium text-gray-900"
                          }
                        >
                          {product.stock}
                        </span>
                      </td>

                      {/* Reorder Level */}
                      <td className="p-4 text-gray-600">
                        {product.reorder_level ?? "Not set"}
                      </td>

                      {/* Stock Status */}
                      <td className="p-4">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${stockStatus.color}`}
                        >
                          {stockStatus.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

        {/* Additional Information */}
        {data.low_stock_count > lowStockProducts.length && (
          <div className="border-t border-gray-200 p-4">
            <p className="text-sm text-gray-500">
              Showing {lowStockProducts.length} of{" "}
              {data.low_stock_count} products requiring attention.
              View Product Management for the complete inventory.
            </p>
          </div>
        )}

      </section>
    </div>
  );
}

export default Dashboard;
