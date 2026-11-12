
import { useEffect, useState } from "react";

// Get products from Django
async function getProducts() {
  const response = await fetch("/api/products/");

  if (!response.ok) {
    throw new Error("Failed to load products.");
  }

  return response.json();
}

function POS() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load products when POS opens
  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Add a product to the cart
  function addToCart(product) {
    if (product.stock <= 0) return;

    setCart((previous) => {
      const existing = previous.find(
        (item) => item.id === product.id
      );

      if (existing) {
        if (existing.quantity >= product.stock) {
          return previous;
        }

        return previous.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...previous,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });

    setMessage("");
  }

  // Increase or decrease quantity
  function changeQuantity(id, change) {
    setCart((previous) =>
      previous.map((item) => {
        if (item.id !== id) return item;

        const product = products.find((p) => p.id === id);
        const maxStock = product?.stock ?? item.quantity;

        const quantity = Math.max(
          1,
          Math.min(maxStock, item.quantity + change)
        );

        return { ...item, quantity };
      })
    );
  }

  // Remove a product from the cart
  function removeItem(id) {
    setCart((previous) =>
      previous.filter((item) => item.id !== id)
    );
  }

  // Calculate displayed subtotal
  const total = cart.reduce(
    (sum, item) =>
      sum + Number(item.price) * item.quantity,
    0
  );

  // Filter products by name or barcode
  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.barcode}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Send checkout request to Django
  async function handleCheckout() {
    if (cart.length === 0 || processing) return;

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/sales/checkout/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      // Sale successfully saved
      setCart([]);
      setMessage(
        `Sale #${data.id} recorded. Total: ${data.total_amount}`
      );

      // Refresh stock from PostgreSQL
      try {
        const updatedProducts = await getProducts();
        setProducts(updatedProducts);
      } catch {
        setError(
          "Sale saved, but stock could not refresh. Reload the page."
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">New Sale</h2>
        <p className="text-sm text-gray-500">
          Search products and add them to the cart.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* PRODUCT SECTION */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold">Products</h3>

          <input
            type="text"
            placeholder="Search name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-5 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-700"
          />

          {loading ? (
            <p className="text-sm text-gray-500">
              Loading products...
            </p>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product) => {
                const cartItem = cart.find(
                  (item) => item.id === product.id
                );

                const inCart = cartItem?.quantity ?? 0;

                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
                  >
                    <div>
                      <p className="font-medium">
                        {product.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Price: {product.price} | Stock: {product.stock}
                      </p>
                      <p className="text-xs text-gray-400">
                        {product.barcode}
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      disabled={
                        processing ||
                        product.stock <= inCart
                      }
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <p className="py-4 text-sm text-gray-500">
                  No products found.
                </p>
              )}
            </div>
          )}
        </section>

        {/* CART SECTION */}
        <section className="h-fit rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-5 font-semibold">
            Cart ({cart.length})
          </h3>

          {cart.length === 0 ? (
            <p className="text-sm text-gray-500">
              Your cart is empty.
            </p>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => {
                const stock =
                  products.find((p) => p.id === item.id)
                    ?.stock ?? 0;

                return (
                  <div
                    key={item.id}
                    className="border-b border-gray-100 pb-4"
                  >
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-medium">
                        {item.name}
                      </p>

                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={processing}
                        className="text-xs text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <p className="mt-1 text-sm text-gray-500">
                      {Number(item.price).toFixed(2)} each
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            changeQuantity(item.id, -1)
                          }
                          disabled={
                            processing || item.quantity <= 1
                          }
                          className="rounded border px-2 py-1 disabled:opacity-40"
                        >
                          -
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          onClick={() =>
                            changeQuantity(item.id, 1)
                          }
                          disabled={
                            processing || item.quantity >= stock
                          }
                          className="rounded border px-2 py-1 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-sm font-medium">
                        {(
                          Number(item.price) * item.quantity
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 pt-4">
            <div className="flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>{total.toFixed(2)}</span>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Taxes and payment collection are not included yet.
            </p>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || processing}
              className="mt-5 w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {processing ? "Processing..." : "Record Sale"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default POS;
