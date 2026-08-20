const config = require("../../config");
const CONVERSIONS = {
  km_mi: 0.621371, mi_km: 1.60934, m_ft: 3.28084, ft_m: 0.3048,
  cm_in: 0.393701, in_cm: 2.54, m_yd: 1.09361, yd_m: 0.9144,
  kg_lb: 2.20462, lb_kg: 0.453592, g_oz: 0.035274, oz_g: 28.3495,
  kg_oz: 35.274, t_kg: 1000, kg_t: 0.001,
  l_gal: 0.264172, gal_l: 3.78541, ml_floz: 0.033814, floz_ml: 29.5735,
  kmh_mph: 0.621371, mph_kmh: 1.60934, ms_mph: 2.23694, mph_ms: 0.44704,
  sqm_sqft: 10.7639, sqft_sqm: 0.092903, ha_acre: 2.47105, acre_ha: 0.404686,
  mb_gb: 0.001, gb_mb: 1000, gb_tb: 0.001, tb_gb: 1000, kb_mb: 0.001, mb_kb: 1000,
  min_h: 1/60, h_min: 60, h_d: 1/24, d_h: 24, d_wk: 1/7, wk_d: 7,
};
function convertTemp(val, from, to) {
  if(from==="c"&&to==="f") return val*9/5+32;
  if(from==="f"&&to==="c") return (val-32)*5/9;
  if(from==="c"&&to==="k") return val+273.15;
  if(from==="k"&&to==="c") return val-273.15;
  if(from==="f"&&to==="k") return (val-32)*5/9+273.15;
  if(from==="k"&&to==="f") return (val-273.15)*9/5+32;
  return null;
}
module.exports = {
  name: "convert", alias: ["converter","units","uc"],
  description: "Universal unit converter — length, weight, temp, volume, speed, data",
  category: "productivity",
  async execute(sock, m, args, reply) {
    if (!args[2]) return reply("Usage: .convert <amount> <from> <to>\n\nExamples:\n.convert 100 km mi\n.convert 37 c f\n.convert 5 kg lb\n.convert 1 gb mb\n.convert 60 mph kmh\n\nUnits: km,mi,m,ft,cm,in | kg,lb,g,oz | c,f,k | l,gal,ml | kmh,mph | mb,gb,tb | min,h,d,wk");
    const val = parseFloat(args[0]); const from = args[1].toLowerCase(); const to = args[2].toLowerCase();
    if (isNaN(val)) return reply("❌ Invalid number.");
    const temps = ["c","f","k"];
    if (temps.includes(from) && temps.includes(to)) {
      const result = convertTemp(val, from, to);
      if (result === null) return reply("❌ Invalid temperature conversion.");
      return reply("🌡️ *" + val + "°" + from.toUpperCase() + " = *" + result.toFixed(2) + "°" + to.toUpperCase() + "*" + config.footer);
    }
    const key = from + "_" + to;
    const factor = CONVERSIONS[key];
    if (!factor) return reply("❌ Conversion not supported: " + from + " → " + to + "\nCheck .convert for supported units.");
    const result = val * factor;
    reply("┌ ❏ ◆ ⌜📐 𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗥⌟ ◆\n│\n├◆ " + val + " " + from.toUpperCase() + " = *" + result.toFixed(4).replace(/\.?0+$/,"") + " " + to.toUpperCase() + "*\n└ ❏" + config.footer);
  }
};
