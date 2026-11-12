
import { useState } from "react";

import Products from "./Products";
import POS from "./POS";
import SalesHistory from "./SalesHistory";

function App() {
  const [page, setPage] = useState("pos");

  const navigation = [
    { id: "pos", label: "POS" },
    { id: "products", label: "Products" },
    { id: "sales", label: "Sales History" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <h1 className="text-xl font-semibold">
            Mini Retail POS
          </h1>

          <nav className="flex flex-wrap gap-2">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`rounded-lg px-4 py-2 text-sm ${
                  page === item.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {page === "pos" && <POS />}
        {page === "products" && <Products />}
        {page === "sales" && <SalesHistory />}
      </main>
    </div>
  );
}

export default App;
