
import { useEffect, useState } from "react";

const emptyForm = {
  name: "",
  barcode: "",
  price: "",
  stock: "0",
};

function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load products when the page opens
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products/");

        if (!response.ok) {
          throw new Error("Could not load products.");
        }

        const data = await response.json();
        setProducts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  // Update form fields
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Add product through Django API
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/products/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          stock: Number(form.stock),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      setProducts((previous) => [...previous, data]);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-xl font-semibold">
            Mini Retail POS
          </h1>
          <p className="text-sm text-gray-500">
            Product Management
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="mb-6 text-2xl font-semibold">
          Products
        </h2>

        {error && (
          <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-5 text-lg font-semibold">
            Add Product
          </h3>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-2"
          >
            {[
              { name: "name", label: "Product Name", type: "text" },
              { name: "barcode", label: "Barcode", type: "text" },
              { name: "price", label: "Price", type: "number" },
              { name: "stock", label: "Stock Quantity", type: "number" },
            ].map((field) => (
              <label key={field.name} className="block">
                <span className="mb-2 block text-sm font-medium">
                  {field.label}
                </span>

                <input
                  name={field.name}
                  type={field.type}
                  value={form[field.name]}
                  onChange={handleChange}
                  min={field.type === "number" ? 0 : undefined}
                  step={field.name === "price" ? "0.01" : undefined}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-700"
                />
              </label>
            ))}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add Product"}
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-5">
            <h3 className="font-semibold">
              Product List ({products.length})
            </h3>
          </div>

          {loading ? (
            <p className="p-5 text-gray-500">
              Loading products...
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Barcode</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Stock</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-t border-gray-100"
                  >
                    <td className="p-4">{product.name}</td>
                    <td className="p-4">{product.barcode}</td>
                    <td className="p-4">
                      {Number(product.price).toFixed(2)}
                    </td>
                    <td className="p-4">{product.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

export default Products;
