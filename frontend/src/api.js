
export async function apiFetch(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  const requiresCsrf = ![
    "GET",
    "HEAD",
    "OPTIONS",
    "TRACE",
  ].includes(method);

  if (requiresCsrf) {
    const csrfResponse = await fetch("/api/auth/csrf/", {
      credentials: "same-origin",
    });

    if (!csrfResponse.ok) {
      throw new Error("Unable to obtain CSRF token.");
    }

    const csrfData = await csrfResponse.json();

    headers.set("X-CSRFToken", csrfData.csrfToken);
  }

  return fetch(url, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
  });
}

export async function getCurrentUser() {
  const response = await apiFetch("/api/auth/me/");

  if (!response.ok) {
    throw new Error("Unable to check login session.");
  }

  return response.json();
}

export async function loginUser(username, password) {
  const response = await apiFetch("/api/auth/login/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Login failed.");
  }

  return data.user;
}

export async function logoutUser() {
  const response = await apiFetch("/api/auth/logout/", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to log out.");
  }

  return response.json();
}
