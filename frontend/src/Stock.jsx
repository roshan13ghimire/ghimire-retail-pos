
import { useEffect, useState } from "react";
import StockHistory from "./StockHistory";
import StockAdjustment from "./StockAdjustment";
import { apiFetch } from "./api";

async function fetchProducts() {
  const response = await apiFetch("/api/products/");

  if (!response.ok) {
    throw new Error("Failed to load products.");
  }

  return response.json();
}

function Stock() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setProducts(data);
        if (data.length > 0) {
          setProductId(String(data[0].id));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

async function handleAdjustmentSaved() {
  // Reload inventory history
  setHistoryRefreshKey((previous) => previous + 1);

  // Reload current stock values
  try {
    const updatedProducts = await fetchProducts();
    setProducts(updatedProducts);
  } catch {
    setError(
      "Adjustment saved, but products could not refresh. Reload the page."
    );
  }
}


  const selectedProduct = products.find(
    (product) => String(product.id) === productId
  );
  

  async function receiveStock(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await apiFetch(
        `/api/products/${productId}/receive-stock/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: Number(quantity),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      setMessage(
        `Stock received. New quantity: ${data.current_stock}`
      );
      setQuantity("");
      setHistoryRefreshKey((previous) => previous + 1);

      // Refresh stock from PostgreSQL
      try {
        const updated = await fetchProducts();
        setProducts(updated);
      } catch {
        setError(
          "Stock was saved, but refresh failed. Reload the page."
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          Receive Stock
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Add newly received inventory to a product.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}

      <form
        onSubmit={receiveStock}
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div>
          <label className="mb-2 block text-sm font-medium">
            Select Product
          </label>

          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={loading || saving}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {products.length === 0 && (
              <option value="">No products available</option>
            )}

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              Current Stock
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {selectedProduct.stock} units
            </p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium">
            Quantity Received
          </label>

          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            placeholder="Enter quantity"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        {selectedProduct && Number(quantity) > 0 &&
          Number.isInteger(Number(quantity)) && (
          <p className="text-sm text-gray-600">
            New stock:{" "}
            <strong>
              {selectedProduct.stock + Number(quantity)}
              {" "}units
            </strong>
          </p>
        )}

        <button
          type="submit"
          disabled={
            saving ||
            !productId ||
            !Number.isInteger(Number(quantity)) ||
            Number(quantity) <= 0
          }
          className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Receive Stock"}
        </button>
      </form>
      <StockAdjustment
  products={products}
  onSaved={handleAdjustmentSaved}
/>

<StockHistory refreshKey={historyRefreshKey} />
     
    </div>
  );
}

export default Stock;
