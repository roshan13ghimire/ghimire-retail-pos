
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load suppliers
  useEffect(() => {
    let active = true;

    async function loadSuppliers() {
      try {
        const response = await apiFetch("/api/suppliers/");

        if (!response.ok) {
          throw new Error("Failed to load suppliers.");
        }

        const data = await response.json();

        if (active) {
          setSuppliers(
            Array.isArray(data) ? data : data.results ?? []
          );
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

    loadSuppliers();

    return () => {
      active = false;
    };
  }, []);

  // Handle form inputs
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Reset form
  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  // Edit supplier
  function handleEdit(supplier) {
    setEditingId(supplier.id);

    setForm({
      name: supplier.name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    });

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Format API validation errors
  function getApiError(data) {
    if (typeof data === "string") {
      return data;
    }

    if (data?.detail) {
      return String(data.detail);
    }

    if (data && typeof data === "object") {
      return Object.entries(data)
        .map(([field, value]) => {
          const text = Array.isArray(value)
            ? value.join(", ")
            : String(value);

          return `${field}: ${text}`;
        })
        .join(" | ");
    }

    return "Unable to save supplier.";
  }

  // Create or update supplier
  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setMessage("");

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    };

    if (!payload.name) {
      setError("Supplier name is required.");
      return;
    }

    const duplicate = suppliers.some(
      (supplier) =>
        supplier.name.toLowerCase() ===
          payload.name.toLowerCase() &&
        supplier.id !== editingId
    );

    if (duplicate) {
      setError("A supplier with this name already exists.");
      return;
    }

    const isEditing = editingId !== null;

    const url = isEditing
      ? `/api/suppliers/${editingId}/`
      : "/api/suppliers/";

    setSaving(true);

    try {
      const response = await apiFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(getApiError(data));
      }

      if (isEditing) {
        setSuppliers((previous) =>
          previous.map((supplier) =>
            supplier.id === editingId ? data : supplier
          )
        );

        setMessage("Supplier updated successfully.");
      } else {
        setSuppliers((previous) => [...previous, data]);

        setMessage("Supplier added successfully.");
      }

      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filter and sort suppliers
  const filteredSuppliers = suppliers
    .filter((supplier) => {
      const text = [
        supplier.name,
        supplier.phone,
        supplier.email,
        supplier.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(search.trim().toLowerCase());
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          Supplier Management
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Manage supplier contact details and store
          purchasing contacts.
        </p>
      </div>

      {/* Messages */}
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

      {/* Supplier Form */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {editingId !== null
              ? "Edit Supplier"
              : "Add Supplier"}
          </h3>

          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="text-sm text-gray-600 hover:underline disabled:opacity-40"
            >
              Cancel Editing
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-2"
        >
          {/* Supplier Name */}
          <div>
            <label
              htmlFor="supplier-name"
              className="mb-2 block text-sm font-medium"
            >
              Supplier Name *
            </label>

            <input
              id="supplier-name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              maxLength={150}
              required
              disabled={saving}
              placeholder="Enter supplier name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-800"
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="supplier-phone"
              className="mb-2 block text-sm font-medium"
            >
              Phone Number
            </label>

            <input
              id="supplier-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              maxLength={30}
              disabled={saving}
              placeholder="Enter phone number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-800"
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="supplier-email"
              className="mb-2 block text-sm font-medium"
            >
              Email
            </label>

            <input
              id="supplier-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              disabled={saving}
              placeholder="supplier@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-800"
            />
          </div>

          {/* Address */}
          <div>
            <label
              htmlFor="supplier-address"
              className="mb-2 block text-sm font-medium"
            >
              Address
            </label>

            <input
              id="supplier-address"
              name="address"
              type="text"
              value={form.address}
              onChange={handleChange}
              disabled={saving}
              placeholder="City or full address"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-800"
            />
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label
              htmlFor="supplier-notes"
              className="mb-2 block text-sm font-medium"
            >
              Notes
            </label>

            <textarea
              id="supplier-notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              disabled={saving}
              placeholder="Products supplied, delivery details, etc."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-800"
            />
          </div>

          {/* Save */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Update Supplier"
                  : "Add Supplier"}
            </button>
          </div>
        </form>
      </section>

      {/* Supplier List */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-5">
          <h3 className="font-semibold">
            Supplier List ({suppliers.length})
          </h3>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search suppliers..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-800 sm:w-72"
          />
        </div>

        {loading ? (
          <p className="p-5 text-sm text-gray-500">
            Loading suppliers...
          </p>
        ) : filteredSuppliers.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">
            No suppliers found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-187.5 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4">Supplier</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Address</th>
                  <th className="p-4">Notes</th>
                  <th className="p-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="p-4 font-medium text-gray-900">
                      {supplier.name}
                    </td>

                    <td className="p-4">
                      {supplier.phone || "—"}
                    </td>

                    <td className="p-4">
                      {supplier.email || "—"}
                    </td>

                    <td className="p-4">
                      {supplier.address || "—"}
                    </td>

                    <td className="p-4">
                      {supplier.notes || "—"}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleEdit(supplier)
                        }
                        disabled={saving}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Suppliers;
