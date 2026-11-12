
import { useEffect, useRef, useState } from "react";
import Receipt from "./Receipt";

// Fetch products from Django
async function getProducts() {
  const response = await fetch("/api/products/");

  if (!response.ok) {
    throw new Error("Failed to load products.");
  }

  return response.json();
}

function POS() {
  // Products
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Barcode scanning
  const [barcode, setBarcode] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const barcodeRef = useRef(null);

  // Shopping cart
  const [cart, setCart] = useState([]);

  // Payment
  const [cashReceived, setCashReceived] = useState("");

  // Checkout
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Receipt
  const [completedSale, setCompletedSale] = useState(null);

  // Duplicate checkout protection
  const [checkoutId, setCheckoutId] = useState(
    () => crypto.randomUUID()
  );
  const [retryRequired, setRetryRequired] = useState(false);

  // Load products
  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    barcodeRef.current?.focus();
  }, []);

  // Add product to cart
  function addToCart(product) {
    if (processing || retryRequired) return false;

    if (product.stock <= 0) {
      setError(`${product.name} is out of stock.`);
      return false;
    }

    const existing = cart.find(
      (item) => item.id === product.id
    );

    if (existing && existing.quantity >= product.stock) {
      setError(`No more stock available for ${product.name}.`);
      return false;
    }

    setCart((previous) => {
      const current = previous.find(
        (item) => item.id === product.id
      );

      if (current) {
        // Also enforce stock limits during rapid scans
        if (current.quantity >= product.stock) {
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

    setCompletedSale(null);
    setMessage("");
    setError("");

    return true;
  }

  // Scan or manually enter barcode
  function handleBarcodeSubmit(event) {
    event.preventDefault();

    if (processing || retryRequired) return;

    const scannedCode = barcode.trim();

    if (!scannedCode) return;

    // Match the full barcode, not a partial search
    const product = products.find(
      (p) => String(p.barcode).trim() === scannedCode
    );

    if (!product) {
      setError(`Product with barcode ${scannedCode} not found.`);
      setScanMessage("");
    } else {
      const added = addToCart(product);

      if (added) {
        setScanMessage(`${product.name} added to cart.`);
      } else {
        setScanMessage("");
      }
    }

    // Clear input and prepare for another scan
    setBarcode("");
    barcodeRef.current?.focus();
  }

  // Change cart quantity
  function changeQuantity(id, change) {
    if (processing || retryRequired) return;

    setCart((previous) =>
      previous.map((item) => {
        if (item.id !== id) return item;

        const product = products.find(
          (p) => p.id === id
        );

        const maxStock = product?.stock ?? item.quantity;

        const quantity = Math.max(
          1,
          Math.min(maxStock, item.quantity + change)
        );

        return { ...item, quantity };
      })
    );
  }

  // Remove item
  function removeItem(id) {
    if (processing || retryRequired) return;

    setCart((previous) =>
      previous.filter((item) => item.id !== id)
    );
  }

  // Calculate total in cents
  const totalCents = cart.reduce((sum, item) => {
    const priceCents = Math.round(
      Number(item.price) * 100
    );

    return sum + priceCents * item.quantity;
  }, 0);

  const total = totalCents / 100;

  // Cash and change
  const validCash = /^\d+(\.\d{1,2})?$/.test(
    cashReceived
  );

  const cashCents = validCash
    ? Math.round(Number(cashReceived) * 100)
    : 0;

  const sufficientCash =
    validCash && cashCents >= totalCents;

  const change = sufficientCash
    ? (cashCents - totalCents) / 100
    : 0;

  // Product search
  const filteredProducts = products.filter(
    (product) =>
      `${product.name} ${product.barcode}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  // Complete checkout
  async function handleCheckout() {
    if (
      cart.length === 0 ||
      processing ||
      !sufficientCash
    ) {
      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");
    setScanMessage("");

    try {
      const response = await fetch(
        "/api/sales/checkout/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checkout_id: checkoutId,
            items: cart.map((item) => ({
              product_id: item.id,
              quantity: item.quantity,
            })),
            cash_received: cashReceived,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status >= 500) {
          setRetryRequired(true);
          setError(
            "Checkout status is uncertain. Retry the same sale."
          );
        } else {
          setRetryRequired(false);
          setError(JSON.stringify(data));
        }
        return;
      }

      // Checkout confirmed
      setCompletedSale(data);
      setMessage(
        `Sale #${data.id} completed. Change: ${data.change_amount}`
      );

      setCart([]);
      setCashReceived("");
      setRetryRequired(false);

      // Generate ID for next sale
      setCheckoutId(crypto.randomUUID());

      // Refresh stock
      try {
        const updatedProducts = await getProducts();
        setProducts(updatedProducts);
      } catch {
        setError(
          "Sale saved, but stock refresh failed. Reload the page."
        );
      }

      barcodeRef.current?.focus();

    } catch {
      setRetryRequired(true);
      setError(
        "Could not confirm checkout. Retry the same sale without changing the cart."
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <div className="pos-screen space-y-6">

        {/* Heading */}
        <div>
          <h2 className="text-2xl font-semibold">
            New Sale
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Scan products, manage the cart, and complete checkout.
          </p>
        </div>

        {/* Errors */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Retry warning */}
        {retryRequired && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">
              Checkout Confirmation Required
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Your cart and payment are locked.
              Retry the same checkout.
            </p>
          </div>
        )}

        {/* Successful checkout */}
        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="font-medium text-green-800">
              {message}
            </p>

            {completedSale && (
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-3 rounded-lg bg-gray-900 px-5 py-2.5 text-sm text-white"
              >
                Print Receipt #{completedSale.id}
              </button>
            )}
          </div>
        )}

        {/* BARCODE SCANNER */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-2 font-semibold">
            Barcode Scanner
          </h3>

          <p className="mb-4 text-sm text-gray-500">
            Scan a barcode or enter it manually and press Enter.
          </p>

          <form
            onSubmit={handleBarcodeSubmit}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              ref={barcodeRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan barcode here..."
              disabled={processing || retryRequired}
              autoComplete="off"
              className="w-full flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-gray-800 disabled:bg-gray-100"
            />

            <button
              type="submit"
              disabled={
                processing ||
                retryRequired ||
                !barcode.trim()
              }
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Add Barcode
            </button>
          </form>

          {scanMessage && (
            <p className="mt-3 text-sm text-green-700">
              {scanMessage}
            </p>
          )}
        </section>

        {/* Products and Cart */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* PRODUCTS */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
            <h3 className="mb-4 font-semibold">
              Products
            </h3>

            <input
              type="text"
              placeholder="Search by name or barcode..."
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

                        <p className="mt-1 text-sm text-gray-500">
                          Price: {Number(product.price).toFixed(2)}
                          {" | "}
                          Stock: {product.stock}
                        </p>

                        <p className="text-xs text-gray-400">
                          Barcode: {product.barcode}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={
                          processing ||
                          retryRequired ||
                          product.stock <= inCart
                        }
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  );
                })}

                {!loading && filteredProducts.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No products found.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* CART */}
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
                  const product = products.find(
                    (p) => p.id === item.id
                  );

                  const stock = product?.stock ?? item.quantity;

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
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={processing || retryRequired}
                          className="text-xs text-red-600 disabled:opacity-40"
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
                            type="button"
                            onClick={() =>
                              changeQuantity(item.id, -1)
                            }
                            disabled={
                              processing ||
                              retryRequired ||
                              item.quantity <= 1
                            }
                            className="rounded border px-2 py-1 disabled:opacity-40"
                          >
                            -
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(item.id, 1)
                            }
                            disabled={
                              processing ||
                              retryRequired ||
                              item.quantity >= stock
                            }
                            className="rounded border px-2 py-1 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-sm font-medium">
                          {(
                            Number(item.price) *
                            item.quantity
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PAYMENT */}
            <div className="mt-6 border-t border-gray-200 pt-4">
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{total.toFixed(2)}</span>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium">
                  Payment Method
                </label>

                <input
                  type="text"
                  value="Cash"
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium">
                  Cash Received
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  disabled={processing || retryRequired}
                  placeholder="Enter cash amount"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                />
              </div>

              <div className="mt-5 rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Change to Return
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {change.toFixed(2)}
                </p>
              </div>

              {validCash && cashCents < totalCents && (
                <p className="mt-3 text-sm text-red-600">
                  Insufficient cash.
                </p>
              )}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={
                  cart.length === 0 ||
                  processing ||
                  !sufficientCash
                }
                className="mt-5 w-full rounded-lg bg-gray-900 py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                {processing
                  ? "Processing..."
                  : retryRequired
                    ? "Retry Same Sale"
                    : "Complete Cash Sale"}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Receipt printing */}
      {completedSale && (
        <Receipt sale={completedSale} />
      )}
    </>
  );
}

export default POS;
