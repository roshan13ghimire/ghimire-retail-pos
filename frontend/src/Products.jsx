import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const emptyForm = {
  name: "",
  barcode: "",
  price: "",
  stock: "0",
  category: "",
  reorder_level: "5",
};

function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load products and their categories from Django.
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [productResponse, categoryResponse] = await Promise.all([
          apiFetch("/api/products/"),
          apiFetch("/api/categories/"),
        ]);

        if (!productResponse.ok || !categoryResponse.ok) {
          throw new Error("Could not load products or categories.");
        }

        const productData = await productResponse.json();
        const categoryData = await categoryResponse.json();
        const productList = Array.isArray(productData)
          ? productData
          : productData.results;
        const categoryList = Array.isArray(categoryData)
          ? categoryData
          : categoryData.results;

        if (!Array.isArray(productList) || !Array.isArray(categoryList)) {
          throw new Error("Unexpected products or categories response.");
        }

        if (active) {
          setProducts(productList);
          setCategories(categoryList);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Managers can create categories without leaving Product Management.
  async function handleCreateCategory(event) {
    event.preventDefault();
    if (creatingCategory || saving) return;

    const name = newCategoryName.trim();
    setError("");
    setMessage("");

    if (!name || name.length > 100) {
      setError("Category name must contain 1 to 100 characters.");
      return;
    }

    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      setError("A category with this name already exists.");
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await apiFetch("/api/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      setCategories((previous) =>
        [...previous, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm((previous) => ({ ...previous, category: String(data.id) }));
      setNewCategoryName("");
      setMessage(`Category "${data.name}" created. It is selected in the product form.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingCategory(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      barcode: product.barcode,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category == null ? "" : String(product.category),
      reorder_level: String(product.reorder_level ?? 5),
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setError("");
    setMessage("");

    const name = form.name.trim();
    const barcode = form.barcode.trim();
    const price = form.price.trim();
    const stock = Number(form.stock);
    const reorderLevelText = form.reorder_level.trim();
    const categoryIdText = form.category;
    const reorderLevel = Number(reorderLevelText);

    if (!name || !barcode) {
      setError("Product name and barcode are required.");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
      setError("Enter a valid price greater than zero (maximum 2 decimals).");
      return;
    }

    if (
      editingId === null &&
      (form.stock.trim() === "" || !Number.isInteger(stock) || stock < 0)
    ) {
      setError("Initial stock must be a non-negative whole number.");
      return;
    }

    if (
      !/^\d+$/.test(reorderLevelText) ||
      !Number.isSafeInteger(reorderLevel) ||
      reorderLevel > 2147483647
    ) {
      setError("Low-stock alert level must be a non-negative whole number.");
      return;
    }

    if (
      categoryIdText !== "" &&
      !categories.some((category) => String(category.id) === categoryIdText)
    ) {
      setError("Select an existing category or leave it uncategorized.");
      return;
    }

    const duplicate = products.some(
      (product) => product.barcode === barcode && product.id !== editingId
    );

    if (duplicate) {
      setError("This barcode is already assigned to another product.");
      return;
    }

    setSaving(true);

    try {
      const isEditing = editingId !== null;
      const payload = {
        name,
        barcode,
        price,
        reorder_level: reorderLevel,
        category: categoryIdText === "" ? null : Number(categoryIdText),
        ...(isEditing ? {} : { stock }),
      };

      const url = isEditing
        ? `/api/products/${editingId}/`
        : "/api/products/";

      const response = await apiFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      if (isEditing) {
        setProducts((previous) =>
          previous.map((product) => (product.id === editingId ? data : product))
        );
        setMessage("Product updated successfully.");
      } else {
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

  // Search and category filtering work together.
  const filteredProducts = products.filter((product) => {
    const matchesSearch = `${product.name} ${product.barcode}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "uncategorized"
        ? product.category == null
        : String(product.category) === categoryFilter);

    return matchesSearch && matchesCategory;
  });

  function getStockStatus(product) {
    const stock = Number(product.stock);
    const reorderLevel = Number(product.reorder_level ?? 5);

    if (stock === 0) {
      return { label: "Out of Stock", color: "bg-red-50 text-red-700" };
    }
    if (stock <= reorderLevel) {
      return { label: "Low Stock", color: "bg-amber-50 text-amber-700" };
    }
    return { label: "In Stock", color: "bg-green-50 text-green-700" };
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Product Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Add, edit, and manage store products.
        </p>
      </div>

      {message && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Category creation */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold">Product Categories</h3>
        <p className="mt-1 text-sm text-gray-500">
          Create a category such as Rice & Grains, Snacks, or Household.
        </p>
        <form onSubmit={handleCreateCategory} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="new-category-name" className="sr-only">
            New Category Name
          </label>
          <input
            id="new-category-name"
            type="text"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="New category name"
            maxLength={100}
            disabled={creatingCategory || saving || loading}
            className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={creatingCategory || saving || loading || !newCategoryName.trim()}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {creatingCategory ? "Creating..." : "Create Category"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {editingId !== null ? "Edit Product" : "Add Product"}
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

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="product-name" className="mb-2 block text-sm font-medium">
              Product Name
            </label>
            <input
              id="product-name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              maxLength={150}
              required
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none disabled:bg-gray-100"
            />
          </div>

          <div>
            <label htmlFor="product-barcode" className="mb-2 block text-sm font-medium">
              Barcode
            </label>
            <input
              id="product-barcode"
              name="barcode"
              type="text"
              value={form.barcode}
              onChange={handleChange}
              maxLength={50}
              required
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none disabled:bg-gray-100"
            />
          </div>

          <div>
            <label htmlFor="product-price" className="mb-2 block text-sm font-medium">
              Selling Price
            </label>
            <input
              id="product-price"
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={handleChange}
              required
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none disabled:bg-gray-100"
            />
          </div>

          {editingId === null && (
            <div>
              <label htmlFor="product-stock" className="mb-2 block text-sm font-medium">
                Initial Stock
              </label>
              <input
                id="product-stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
                required
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none disabled:bg-gray-100"
              />
            </div>
          )}

          <div>
            <label htmlFor="product-category" className="mb-2 block text-sm font-medium">
              Category
            </label>
            <select
              id="product-category"
              name="category"
              value={form.category}
              onChange={handleChange}
              disabled={saving || loading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none disabled:bg-gray-100"
            >
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="product-reorder" className="mb-2 block text-sm font-medium">
              Low-Stock Alert Level
            </label>
            <input
              id="product-reorder"
              name="reorder_level"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              value={form.reorder_level}
              onChange={handleChange}
              required
              disabled={saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-gray-800 focus:outline-none disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Alert when stock is at or below this number. Set 0 for out-of-stock alerts only.
            </p>
          </div>

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
            To change inventory quantities, use Stock Receiving or Stock Adjustment.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-5">
          <h3 className="font-semibold">Product List ({products.length})</h3>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <label htmlFor="category-filter" className="sr-only">Filter by category</label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-800"
            >
              <option value="all">All Categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <label htmlFor="product-search" className="sr-only">Search products</label>
            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or barcode..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-800 sm:w-72"
            />
          </div>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-gray-500">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No matching products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Barcode</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Alert At</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product);

                  return (
                    <tr key={product.id} className="border-t border-gray-100">
                      <td className="p-4 font-medium">{product.name}</td>
                      <td className="p-4">{product.barcode}</td>
                      <td className="p-4 text-gray-600">
                        {product.category_name ||
                          categories.find((category) =>
                            String(category.id) === String(product.category)
                          )?.name ||
                          "Uncategorized"}
                      </td>
                      <td className="p-4">{Number(product.price).toFixed(2)}</td>
                      <td className="p-4">{product.stock}</td>
                      <td className="p-4">{product.reorder_level ?? 5}</td>
                      <td className="p-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleEdit(product)}
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
