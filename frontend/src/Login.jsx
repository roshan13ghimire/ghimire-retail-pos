
import { useEffect, useState } from "react";
import {
  loginUser,
  loginDemoUser,
  getDemoLoginEnabled,
} from "./api";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoEnabled, setDemoEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    getDemoLoginEnabled()
      .then((enabled) => {
        if (active) setDemoEnabled(enabled);
      })
      .catch(() => {
        if (active) setDemoEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const user = await loginUser(username, password);
      onLogin(user);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(role) {
    if (loading || !demoEnabled) return;

    setLoading(true);
    setError("");

    try {
      const user = await loginDemoUser(role);
      onLogin(user);
    } catch (err) {
      setError(err.message || "Demo login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Ghimire Retail POS
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Sign in to your account
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="login-username"
              className="mb-2 block text-sm font-medium"
            >
              Username
            </label>

            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-gray-800"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium"
            >
              Password
            </label>

            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none focus:border-gray-800"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {demoEnabled && (
          <div className="mt-7 border-t border-gray-200 pt-6">
            <p className="mb-3 text-center text-sm font-medium text-gray-700">
              Explore the Demo
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDemoLogin("owner")}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-3 py-3 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
              >
                Demo Owner
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin("cashier")}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-3 py-3 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-50"
              >
                Demo Cashier
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Public demonstration using fictional store data.
              Changes are shared between visitors.
            </p>
          </div>
        )}

        {!demoEnabled && (
          <p className="mt-6 text-center text-xs text-gray-500">
            Authorized store staff only
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;
