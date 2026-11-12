
import { useEffect, useState } from "react";

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load dashboard information
  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch(
          "/api/sales/dashboard/"
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
    return <p>Loading dashboard...</p>;
  }

  if (error) {
    return (
      <p className="text-red-600">{error}</p>
    );
  }

  if (!data) return null;

  
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


  return (
    <div className="space-y-6">

      {/* Heading */}
      <div>
        <h2 className="text-2xl font-semibold">
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

            <h3 className="mt-3 text-2xl font-semibold">
              {stat.value}
            </h3>
          </div>
        ))}

      </div>

      {/* Low Stock Products */}
      <section className="rounded-xl border border-gray-200 bg-white">

        <div className="border-b border-gray-200 p-5">
          <h3 className="font-semibold">
            Low Stock Products
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Products with 5 or fewer units remaining.
            Showing up to 10 products.
          </p>
        </div>

        {data.low_stock_products.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">
            No low-stock products found.
          </p>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">

              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Barcode</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>

              <tbody>
                {data.low_stock_products.map(
                  (product) => (
                    <tr
                      key={product.id}
                      className="border-t border-gray-100"
                    >
                      <td className="p-4 font-medium">
                        {product.name}
                      </td>

                      <td className="p-4">
                        {product.barcode}
                      </td>

                      <td className="p-4">
                        {product.stock}
                      </td>

                      <td className="p-4">
                        <span
                          className={
                            product.stock === 0
                              ? "text-red-600"
                              : "text-amber-600"
                          }
                        >
                          {product.stock === 0
                            ? "Out of Stock"
                            : "Low Stock"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>

            </table>

          </div>
        )}

      </section>

    </div>
  );
}

export default Dashboard;
