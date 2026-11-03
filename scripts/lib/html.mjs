import { parse, parseFragment, serialize } from "parse5";
export function htmlTree(text, fragment = false) {
  return (fragment ? parseFragment : parse)(text, {
    sourceCodeLocationInfo: true,
  });
}
export function walk(node, fn) {
  fn(node);
  for (const c of node.childNodes || []) walk(c, fn);
  if (node.content) walk(node.content, fn);
}
export const attr = (n, name) => n.attrs?.find((a) => a.name === name)?.value;
export function findId(tree, id) {
  let found;
  walk(tree, (n) => {
    if (attr(n, "data-ds-id") === id) {
      if (found) throw Error("Duplicate data-ds-id");
      found = n;
    }
  });
  return found;
}
export const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export { serialize };
