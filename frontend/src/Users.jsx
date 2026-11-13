
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const initialForm = {
  username: "",
  password: "",
  role: "Cashier",
};

function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    const response = await apiFetch("/api/auth/staff/");

    if (!response.ok) {
      throw new Error("Could not load staff accounts.");
    }

    return response.json();
  }

  useEffect(() => {
    let active = true;

    loadUsers()
      .then((data) => {
        if (active) setUsers(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        "/api/auth/staff/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          JSON.stringify(data)
        );
      }

      setUsers((previous) => [...previous, data]);
      setForm(initialForm);
      setMessage("Staff account created successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user) {
    if (updatingId !== null) return;

    const newStatus = !user.is_active;

    const confirmed = window.confirm(
      `${newStatus ? "Activate" : "Deactivate"} ${user.username}?`
    );

    if (!confirmed) return;

    setUpdatingId(user.id);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/auth/staff/${user.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === user.id ? data : item
        )
      );

      setMessage("Staff status updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">
          User Management
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Create and manage store staff accounts.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {message}
        </p>
      )}

      {/* Add Staff */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-5 text-lg font-semibold">
          Create Staff Account
        </h3>

        <form
          onSubmit={handleCreate}
          className="grid gap-4 md:grid-cols-2"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Username
            </label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              autoComplete="off"
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Password
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Role
            </label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="Cashier">Cashier</option>
              <option value="Manager">Manager</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </section>

      {/* Staff List */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <h3 className="border-b p-5 font-semibold">
          Staff Accounts ({users.length})
        </h3>

        {loading ? (
          <p className="p-5 text-sm text-gray-500">
            Loading staff...
          </p>
        ) : users.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">
            No staff accounts created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4">Username</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-gray-100"
                  >
                    <td className="p-4 font-medium">
                      {user.username}
                    </td>

                    <td className="p-4">
                      {user.role}
                    </td>

                    <td className="p-4">
                      <span
                        className={
                          user.is_active
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {user.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        type="button"
                        disabled={updatingId !== null}
                        onClick={() => toggleStatus(user)}
                        className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
                      >
                        {updatingId === user.id
                          ? "Saving..."
                          : user.is_active
                            ? "Deactivate"
                            : "Activate"}
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

export default Users;
