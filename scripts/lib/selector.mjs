// Runs in the page. Class names and IDs are escaped; every result is unique.
export function selectorFor(el) {
  if (el.id && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1)
    return "#" + CSS.escape(el.id);
  const parts = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    let s =
      n.tagName.toLowerCase() +
      [...n.classList].map((c) => "." + CSS.escape(c)).join("");
    if (
      n.parentElement &&
      n.parentElement.querySelectorAll(":scope > " + s).length !== 1
    )
      s =
        n.tagName.toLowerCase() +
        `:nth-of-type(${[...n.parentElement.children].filter((x) => x.tagName === n.tagName).indexOf(n) + 1})`;
    parts.unshift(s);
    const sel = parts.join(" > ");
    if (document.querySelectorAll(sel).length === 1) return sel;
  }
  return parts.join(" > ");
}
