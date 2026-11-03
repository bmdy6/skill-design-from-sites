(() => {
  const bar = document.createElement("aside");
  bar.id = "dfs-overlay";
  bar.innerHTML =
    '<strong>Design feedback</strong><span id="dfs-target">Click a block or drag a rectangle</span><input id="dfs-comment" aria-label="Comment" placeholder="What should change?"><button id="dfs-save">Save note</button><span id="dfs-status"></span>';
  const css = document.createElement("style");
  css.textContent =
    "#dfs-overlay{position:fixed;bottom:16px;left:16px;right:16px;z-index:2147483647;background:#172033;color:white;padding:16px;display:flex;gap:16px;align-items:center;font:14px system-ui;border-radius:12px;box-shadow:0 8px 32px #0005}#dfs-overlay input{flex:1;padding:10px;border:0;border-radius:4px}#dfs-overlay button{padding:10px 16px;background:white;border:0;border-radius:4px} [data-dfs-selected]{outline:3px solid #2563eb!important}";
  document.head.append(css);
  document.body.append(bar);
  let ids = [],
    rect = null,
    start;
  const targets = (x, y) =>
    document
      .elementsFromPoint(x, y)
      .filter((e) => !bar.contains(e) && e !== bar)
      .map((e) => e.closest("[data-ds-id]"))
      .find(Boolean);
  const select = (els) => {
    document
      .querySelectorAll("[data-dfs-selected]")
      .forEach((e) => e.removeAttribute("data-dfs-selected"));
    ids = els.filter(Boolean).map((e) => {
      e.setAttribute("data-dfs-selected", "");
      return e.dataset.dsId;
    });
    document.querySelector("#dfs-target").textContent = ids.join(", ");
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!bar.contains(e.target)) start = [e.clientX, e.clientY];
    },
    true,
  );
  document.addEventListener(
    "pointerup",
    (e) => {
      if (!start || bar.contains(e.target)) return;
      const [x, y] = start;
      start = null;
      if (Math.hypot(e.clientX - x, e.clientY - y) < 5) {
        rect = null;
        select([targets(e.clientX, e.clientY)]);
        return;
      }
      const left = Math.min(x, e.clientX),
        top = Math.min(y, e.clientY),
        w = Math.abs(x - e.clientX),
        h = Math.abs(y - e.clientY),
        els = [];
      for (let a = 0; a <= 4; a++)
        for (let b = 0; b <= 4; b++) {
          const t = targets(left + (w * a) / 4, top + (h * b) / 4);
          if (t) els.push(t);
        }
      let common = els[0];
      while (common && !els.every((n) => common.contains(n)))
        common = common.parentElement?.closest("[data-ds-id]");
      rect = [left, top, w, h];
      select([common]);
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      if (!bar.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
  document.querySelector("#dfs-save").onclick = async () => {
    if (!ids.length) return;
    const response = await fetch("/__dfs/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: location.pathname.slice(1),
        viewport: innerWidth < 600 ? "mobile" : "desktop",
        targetIds: ids,
        rect,
        comment: document.querySelector("#dfs-comment").value,
      }),
    });
    document.querySelector("#dfs-status").textContent = response.ok
      ? "Saved"
      : "Could not save";
  };
})();
