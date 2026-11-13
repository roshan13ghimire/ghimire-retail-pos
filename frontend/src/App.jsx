
import { useEffect, useState } from "react";

// Authentication
import Login from "./Login";
import { getCurrentUser, logoutUser } from "./api";

// Application Pages
import Dashboard from "./Dashboard";
import POS from "./POS";
import Products from "./Products";
import Stock from "./Stock";
import SalesHistory from "./SalesHistory";
import Returns from "./Returns";
import Reports from "./Reports";
import Users from "./Users";

// Navigation
const navigation = [
  {
    id: "dashboard",
    label: "Dashboard",
    roles: ["Admin", "Manager"],
  },
  {
    id: "pos",
    label: "POS",
    roles: ["Admin", "Manager", "Cashier"],
  },
  {
    id: "products",
    label: "Products",
    roles: ["Admin", "Manager"],
  },
  {
    id: "stock",
    label: "Stock",
    roles: ["Admin", "Manager"],
  },
  {
    id: "sales",
    label: "Sales History",
    roles: ["Admin", "Manager"],
  },
  {
    id: "returns",
    label: "Returns",
    roles: ["Admin", "Manager"],
  },
  {
    id: "reports",
    label: "Reports",
    roles: ["Admin", "Manager"],
  },
  {
    id: "users",
    label: "Users",
    roles: ["Admin"],
  },
];

function App() {
  const [page, setPage] = useState("dashboard");

  // Authentication state
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authError, setAuthError] = useState("");

  // -------------------------------------
  // 1. Check existing login session
  // -------------------------------------
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const data = await getCurrentUser();

if (data.authenticated) {
  setUser(data.user);

  setPage(
    data.user.role === "Cashier" ? "pos" : "dashboard"
  );
} else {
  setUser(null);
}
      } catch {
        if (active) {
          setAuthError(
            "Could not verify your login session."
          );
        }
      } finally {
        if (active) {
          setCheckingAuth(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  // -------------------------------------
  // 2. Login successful
  // -------------------------------------
function handleLogin(loggedInUser) {
  setUser(loggedInUser);

  setPage(
    loggedInUser.role === "Cashier" ? "pos" : "dashboard"
  );

  setAuthError("");
}

  // -------------------------------------
  // 3. Logout
  // -------------------------------------
  
async function handleLogout() {
  if (loggingOut) return;

  setLoggingOut(true);
  setAuthError("");

  try {
    await logoutUser();

    // Clear logged-in user
    setUser(null);

    // Reset page without accessing loggedInUser
    setPage("dashboard");

  } catch (err) {
    setAuthError(err.message);
  } finally {
    setLoggingOut(false);
  }
}

  // -------------------------------------
  // 4. Check admin role
  // -------------------------------------
  const isAdmin = user?.role === "Admin";

  // Hide Users tab from non-admin users
const visibleNavigation = navigation.filter(
  (item) => item.roles.includes(user?.role)
);
  // -------------------------------------
  // 5. Render selected page
  // -------------------------------------
  function renderPage() {
    if (
  !visibleNavigation.some((item) => item.id === page)
) {
  return (
    <p className="text-red-600">
      You do not have permission to access this page.
    </p>
  );
}
    switch (page) {
      case "dashboard":
        return <Dashboard />;

      case "pos":
        return <POS />;

      case "products":
        return <Products />;

      case "stock":
        return <Stock />;

      case "sales":
        return <SalesHistory />;

      case "returns":
        return <Returns />;

      case "reports":
        return <Reports />;

      case "users":
        return isAdmin ? (
          <Users />
        ) : (
          <p className="text-red-600">
            Access denied.
          </p>
        );

      default:
        return <Dashboard />;
    }
  }

  // -------------------------------------
  // 6. Loading authentication
  // -------------------------------------
  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">
          Checking login session...
        </p>
      </div>
    );
  }

  // -------------------------------------
  // 7. Session verification error
  // -------------------------------------
  if (authError && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <p className="text-sm text-red-600">
          {authError}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  // -------------------------------------
  // 8. Show login page
  // -------------------------------------
  if (!user) {
    return (
      <Login onLogin={handleLogin} />
    );
  }

  // -------------------------------------
  // 9. Main POS application
  // -------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* HEADER */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">

          {/* Application name */}
          <div>
            <h1 className="text-xl font-semibold">
              Ghimire Retail POS
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Store Management System
            </p>
          </div>

          {/* Logged-in user */}
          <div className="flex items-center gap-4">

            <div className="text-right">
              <p className="text-sm font-medium">
                {user.username}
              </p>

              <p className="text-xs text-gray-500">
                {user.role}
              </p>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-40"
            >
              {loggingOut
                ? "Logging out..."
                : "Logout"}
            </button>

          </div>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-5 py-3">

          {visibleNavigation.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPage(item.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                page === item.id
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </button>
          ))}

        </div>
      </nav>

      {/* AUTHENTICATION ERROR */}
      {authError && (
        <div className="mx-auto max-w-7xl px-5 pt-4">
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {authError}
          </p>
        </div>
      )}

      {/* CURRENT PAGE */}
      <main className="mx-auto max-w-7xl p-5">
        {renderPage()}
      </main>

      {/* FOOTER */}
      <footer className="mt-10 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-4 text-center text-xs text-gray-500">
          Ghimire Retail POS — Store Management System
        </div>
      </footer>

    </div>
  );
}

export default App;
