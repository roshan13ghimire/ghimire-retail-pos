
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const emptyForm = {
  name: "",
  barcode: "",
  price: "",
  stock: "0",
};

function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load products from Django
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await apiFetch("/api/products/");

        if (!response.ok) {
          throw new Error("Failed to load products.");
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

  // Reset form to Add Product mode
  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  // Open product for editing
  function handleEdit(product) {
    setEditingId(product.id);

    setForm({
      name: product.name,
      barcode: product.barcode,
      price: String(product.price),
      stock: String(product.stock),
    });

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Add or update a product
  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setMessage("");

    const name = form.name.trim();
    const barcode = form.barcode.trim();
    const price = form.price.trim();
    const stock = Number(form.stock);

    if (!name || !barcode) {
      setError("Product name and barcode are required.");
      return;
    }

    // Validate positive price with up to 2 decimals
    if (
      !/^\d+(\.\d{1,2})?$/.test(price) ||
      Number(price) <= 0
    ) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    // Validate initial stock for new products
    if (
      editingId === null &&
      (!Number.isInteger(stock) || stock < 0)
    ) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    // Check for duplicate barcode
    const duplicate = products.some(
      (product) =>
        product.barcode === barcode &&
        product.id !== editingId
    );

    if (duplicate) {
      setError("This barcode is already assigned to another product.");
      return;
    }

    setSaving(true);

    try {
      // Stock is included only when creating products.
      const payload = {
        name,
        barcode,
        price,
        ...(editingId === null ? { stock } : {}),
      };

      const isEditing = editingId !== null;

      const url = isEditing
        ? `/api/products/${editingId}/`
        : "/api/products/";

      const response = await apiFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      if (isEditing) {
        // Replace updated product in the list
        setProducts((previous) =>
          previous.map((product) =>
            product.id === editingId ? data : product
          )
        );

        setMessage("Product updated successfully.");
      } else {
        // Add new product to the list
        setProducts((previous) => [...previous, data]);

        setMessage("Product added successfully.");
      }

      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Search by name or barcode
  const filteredProducts = products.filter(
    (product) =>
      `${product.name} ${product.barcode}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
  );

  // Show stock status
  function getStockStatus(stock) {
    if (stock === 0) {
      return {
        label: "Out of Stock",
        color: "bg-red-50 text-red-700",
      };
    }

    if (stock <= 5) {
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
        <h2 className="text-2xl font-semibold">
          Product Management
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Add, edit, and manage store products.
        </p>
      </div>

      {/* Success Message */}
      {message && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Product Form */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">

        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {editingId !== null
              ? "Edit Product"
              : "Add Product"}
          </h3>

          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="text-sm text-gray-600 hover:underline"
            >
              Cancel Editing
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-2"
        >

          {/* Name */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Product Name
            </label>

            <input
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              maxLength={150}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none"
            />
          </div>

          {/* Barcode */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Barcode
            </label>

            <input
              name="barcode"
              type="text"
              value={form.barcode}
              onChange={handleChange}
              maxLength={50}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none"
            />
          </div>

          {/* Price */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Selling Price
            </label>

            <input
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none"
            />
          </div>

          {/* Initial Stock */}
          {editingId === null && (
            <div>
              <label className="mb-2 block text-sm font-medium">
                Initial Stock
              </label>

              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none"
              />
            </div>
          )}

          {/* Save Button */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Update Product"
                  : "Add Product"}
            </button>
          </div>

        </form>

        {editingId !== null && (
          <p className="mt-4 text-sm text-gray-500">
            To change inventory quantities, use Stock
            Receiving or Stock Adjustment.
          </p>
        )}
      </section>

      {/* Product List */}
      <section className="rounded-xl border border-gray-200 bg-white">

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-5">
          <h3 className="font-semibold">
            Product List ({products.length})
          </h3>

          {/* Search */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or barcode..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-800 sm:w-72"
          />
        </div>

        {loading ? (
          <p className="p-5 text-sm text-gray-500">
            Loading products...
          </p>
        ) : filteredProducts.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">
            No matching products found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">

              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Barcode</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const status = getStockStatus(
                    product.stock
                  );

                  return (
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
                        {Number(product.price).toFixed(2)}
                      </td>

                      <td className="p-4">
                        {product.stock}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleEdit(product)
                          }
                          disabled={saving}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}
      </section>

    </div>
  );
}

export default Products;
