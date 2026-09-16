import fs from "fs";
import path from "path";

const SRC = "c:/Users/Wilso/Downloads/slow-roll/slow-roll";
const outCss = path.join("src/app/slow-roll-dice.css");
const outCatalog = path.join("src/lib/slow-roll/catalog.json");

const html = fs.readFileSync(path.join(SRC, "images/1.html"), "utf8");
let css = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));

css = css
  .replace(/@keyframes roll/g, "@keyframes slowRoll")
  .replace(/@keyframes shadow/g, "@keyframes slowShadow")
  .replace(/animation:roll/g, "animation:slowRoll")
  .replace(/animation:shadow/g, "animation:slowShadow");

function prefixSelector(sel) {
  const s = sel.trim();
  if (!s || s.startsWith("@")) return s;
  if (/^(from|to|\d+%|[\d.]+%)/.test(s)) return s;
  if (s.startsWith("html")) return "";
  if (s === "label" || s.startsWith("label ")) return "";
  if (s.startsWith("body")) {
    const rest = s.replace(/^body/, "").trim();
    return rest ? `.slow-die${rest.startsWith(".") || rest.startsWith("[") ? rest : ` ${rest}`}` : "";
  }
  return `.slow-die ${s}`;
}

function prefixRuleSelectors(chunk) {
  return chunk.replace(/(^|})\s*([^{}]+)\{/g, (full, brace, selector) => {
    const sel = selector.trim();
    if (sel.startsWith("@")) return full;
    const parts = sel
      .split(",")
      .map(prefixSelector)
      .filter(Boolean);
    if (!parts.length) return `${brace} .slow-die-skip{`;
    return `${brace}${parts.join(",")}{`;
  });
}

const parts = [];
const kf = /@keyframes\s+[\w-]+\s*\{/g;
let last = 0;
let m;
while ((m = kf.exec(css))) {
  parts.push(prefixRuleSelectors(css.slice(last, m.index)));
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < css.length && depth) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
    i += 1;
  }
  parts.push(css.slice(m.index, i));
  last = i;
}
parts.push(prefixRuleSelectors(css.slice(last)));
const out = parts.join("");

fs.mkdirSync("src/lib/slow-roll", { recursive: true });
fs.writeFileSync(outCss, `/* Slow Roll NFT dice — namespaced */\n${out}\n`);

const gallery = JSON.parse(fs.readFileSync(path.join(SRC, "gallery-data.json"), "utf8"));
const catalog = gallery.map((row) => ({
  i: row.i,
  n: row.n,
  r: row.r,
  bg: row.s.bgFam,
  tex: row.s.texFam,
  fin: row.s.finFam,
  pip: row.s.pipFam,
  s: {
    face: row.s.face,
    shade: row.s.shade,
    light: row.s.light,
    shift: row.s.shift,
    sheen: row.s.sheen,
    pip: row.s.pip,
    rim: row.s.rim,
    felt: row.s.felt,
    bg2: row.s.bg2,
    bg3: row.s.bg3,
    pipScale: row.s.pipScale,
    texA: row.s.texA,
    texO: row.s.texO,
    texZ: row.s.texZ,
    bga: row.s.bga,
    bpx: row.s.bpx,
    bpy: row.s.bpy,
    grad: row.s.grad,
    dur: row.s.dur,
    delay: row.s.delay,
    x: row.s.x,
    y: row.s.y,
    z: row.s.z,
    sx: row.s.sx,
    sy: row.s.sy,
    sz: row.s.sz,
  },
}));
fs.writeFileSync(outCatalog, JSON.stringify(catalog));
console.log("css", fs.statSync(outCss).size, "catalog", fs.statSync(outCatalog).size);
const sample = fs.readFileSync(outCss, "utf8");
const ki = sample.indexOf("@keyframes slowRoll");
console.log(sample.slice(ki, ki + 280));
