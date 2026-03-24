// Check deployment status
chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
  const statusEl = document.getElementById("status");
  const infoEl = document.getElementById("campaign-info");
  const nameEl = document.getElementById("campaign-name");

  if (response?.hasPending) {
    statusEl.textContent = "Deployment pending";
    statusEl.className = "status-value pending";
    infoEl.style.display = "block";
    nameEl.textContent =
      response.deployment.campaign?.name || "Campaign";
  } else {
    statusEl.textContent = "Idle — no pending deployments";
    statusEl.className = "status-value idle";
  }
});
