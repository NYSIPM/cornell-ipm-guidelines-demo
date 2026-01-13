// gate.js
// Reusable content-gating logic using existing auth.js functions

document.addEventListener("DOMContentLoaded", async () => {
  const gateDiv = document.getElementById("auth-gate");
  const contentDiv = document.getElementById("content");

  // If the page doesn't have gate elements, do nothing
  if (!gateDiv || !contentDiv) return;

  // Show temporary status
  gateDiv.innerHTML = `
    <div style="background:#e2e3e5;border:1px solid #d3d6d8;border-radius:8px;
                padding:16px;margin:1rem 0;">
      Checking sign-in status...
    </div>
  `;

  try {
    // checkAuth() comes from your existing auth.js
    const authStatus = await checkAuth();

    if (authStatus && authStatus.authenticated) {
      // User signed in → show content
      gateDiv.style.display = "none";
      contentDiv.style.display = "block";
      return;
    }

    // User not signed in → show sign-in prompt
    gateDiv.innerHTML = `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;
                  padding:20px 30px;margin:2rem 0;display:flex;align-items:center;
                  justify-content:space-between;gap:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:24px;">🔒</span>
          <span style="color:#856404;font-size:16px;">
            Sign in to access full content
          </span>
        </div>
        <button onclick="login()"
                style="background:#B31B1B;color:white;border:none;
                       padding:10px 24px;font-size:16px;border-radius:6px;
                       cursor:pointer;font-weight:500;">
          Sign In
        </button>
      </div>
    `;
  } catch (err) {
    console.error("Auth gate error:", err);
    gateDiv.innerHTML = `
      <div style="background:#f8d7da;border:1px solid #f5c2c7;border-radius:8px;
                  padding:16px;margin:1rem 0;">
        <strong>Auth error:</strong> ${String(err?.message || err)}
      </div>
    `;

    // Optional debug fallback:
    // contentDiv.style.display = "block";
  }
});
