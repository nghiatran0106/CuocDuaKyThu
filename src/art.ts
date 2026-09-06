/** Original, resolution-independent artwork for Turbo Buddies. */
let serial = 0;
const uid = (name: string) => `tb-${name}-${++serial}`;
const svg = (viewBox: string, content: string, className = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" class="${className.replace(/[^a-zA-Z0-9 _-]/g, "")}" aria-hidden="true">${content}</svg>`;

function star(x: number, y: number, size: number, color = "#fff5a4") {
  return `<path d="M${x} ${y - size} Q${x + size * 0.24} ${y - size * 0.24} ${x + size} ${y} Q${x + size * 0.24} ${y + size * 0.24} ${x} ${y + size} Q${x - size * 0.24} ${y + size * 0.24} ${x - size} ${y} Q${x - size * 0.24} ${y - size * 0.24} ${x} ${y - size}" fill="${color}"/>`;
}

function palm(x: number, y: number, scale = 1, lean = 0) {
  return `<g transform="translate(${x} ${y}) scale(${scale}) rotate(${lean})">
    <path d="M-11 149 Q8 80 0 0 L13 0 Q32 71 7 154Z" fill="#9d693d"/>
    <path d="M3 141 Q22 67 9 5" stroke="#d29d57" stroke-width="7"/>
    <path d="M-3 118 L16 123M0 95L20 101M4 72L22 78M4 47L19 53" stroke="#784f38" stroke-width="5" opacity=".6"/>
    <path d="M6 7 Q-45-53-93-9 Q-41-23 4 17 Q-75-15-99 43 Q-45 8 6 23 Q-26 30-23 75 Q-4 44 17 20 Q49 30 66 74 Q68 26 20 9 Q81 8 101 43 Q89-11 22 0 Q49-37 88-21 Q54-59 8 0Z" fill="#147848"/>
    <path d="M6 7 Q-34-45-80-13 Q-36-19 8 15 Q-61-10-90 35 Q-37 6 10 22 Q-15 31-20 59 Q0 28 17 18 Q48 21 61 55 Q56 19 20 9 Q75 4 91 30 Q74-5 19 3 Q51-34 76-23 Q50-47 8 5Z" fill="#39c566"/>
    <path d="M8 10 Q-27-16-65-15M10 13Q-33 9-64 22M16 10Q47-6 73 7" stroke="#b1ee65" stroke-width="3" stroke-linecap="round"/>
    <circle cx="5" cy="18" r="10" fill="#986a32"/><circle cx="19" cy="20" r="9" fill="#bf8b40"/>
  </g>`;
}

function racer(kind: string, prefix: string) {
  const style = {
    fox: {
      body: "#ff9839",
      shade: "#db582a",
      light: "#ffcd79",
      kart: "#00d6c5",
      kartDark: "#008e9a",
      detail: "#ddff69",
      suit: "#19b7a7",
    },
    bunny: {
      body: "#fff3e5",
      shade: "#dbc7d5",
      light: "#fffdf8",
      kart: "#ed78be",
      kartDark: "#b7409b",
      detail: "#ffc9e0",
      suit: "#f272b5",
    },
    panda: {
      body: "#fff5dd",
      shade: "#c9bc9d",
      light: "#fffef1",
      kart: "#a48af8",
      kartDark: "#6755c5",
      detail: "#e9dcff",
      suit: "#9981e6",
    },
    cat: {
      body: "#ffce53",
      shade: "#e98d28",
      light: "#ffe794",
      kart: "#ffd246",
      kartDark: "#ed9128",
      detail: "#fff4b8",
      suit: "#efa33c",
    },
  }[kind] || {
    body: "#ff9839",
    shade: "#db582a",
    light: "#ffcd79",
    kart: "#00d6c5",
    kartDark: "#008e9a",
    detail: "#ddff69",
    suit: "#19b7a7",
  };
  const ears =
    kind === "bunny"
      ? `<path d="M120 123 Q84 14 119 8 Q151 3 151 106Z" fill="url(#${prefix}-fur)"/><path d="M167 101 Q170-10 205 2 Q229 16 195 119Z" fill="url(#${prefix}-fur)"/><path d="M124 94 Q105 32 122 25 Q137 21 138 99Z" fill="#f5aab7"/><path d="M180 94 Q187 21 200 23 Q211 25 191 102Z" fill="#f5aab7"/>`
      : kind === "panda"
        ? `<circle cx="116" cy="104" r="30" fill="#343945"/><circle cx="226" cy="99" r="29" fill="#343945"/><circle cx="116" cy="104" r="18" fill="#565264"/><circle cx="226" cy="99" r="18" fill="#565264"/>`
        : `<path d="M105 135 Q88 103 98 49 Q132 55 149 99Z" fill="url(#${prefix}-fur)"/><path d="M185 96 Q210 44 239 48 Q249 93 232 127Z" fill="url(#${prefix}-fur)"/><path d="M109 111 L108 67 Q131 79 137 109Z" fill="${kind === "cat" ? "#ec9a7b" : "#6a343a"}"/><path d="M201 106 Q214 72 231 63 L227 113Z" fill="${kind === "cat" ? "#ec9a7b" : "#6a343a"}"/>`;
  const patches =
    kind === "panda"
      ? `<ellipse cx="137" cy="156" rx="23" ry="28" transform="rotate(18 137 156)" fill="#353b46"/><ellipse cx="207" cy="150" rx="22" ry="28" transform="rotate(-17 207 150)" fill="#353b46"/>`
      : kind === "fox"
        ? `<path d="M100 151 Q129 151 156 178 Q172 167 181 170 Q199 146 237 139 Q244 178 219 195 Q175 225 132 199 Q110 187 100 151Z" fill="#fff4d8"/>`
        : kind === "cat"
          ? `<path d="M148 108 L158 130L165 106M174 105L177 126L187 106M119 145L101 139M120 155L99 155M223 138L241 128M225 150L246 145" stroke="#de8a31" stroke-width="7" stroke-linecap="round"/>`
          : `<ellipse cx="173" cy="184" rx="35" ry="23" fill="#fffdf7"/>`;
  const goggles =
    kind === "bunny"
      ? `<path d="M110 126 Q166 95 229 112" stroke="#c5569e" stroke-width="14"/><rect x="124" y="103" width="37" height="25" rx="10" fill="#df70b6" transform="rotate(-8 124 103)"/><rect x="167" y="98" width="39" height="25" rx="10" fill="#df70b6" transform="rotate(-8 167 98)"/><path d="M132 108 L152 105M176 103L197 100" stroke="#fff0fb" stroke-width="6" stroke-linecap="round"/>`
      : `<path d="M107 129 Q165 107 233 114" stroke="${kind === "panda" ? "#7663ba" : "#186b78"}" stroke-width="14"/><rect x="119" y="99" width="44" height="29" rx="12" fill="${style.kartDark}" transform="rotate(-8 119 99)"/><rect x="170" y="93" width="44" height="29" rx="12" fill="${style.kartDark}" transform="rotate(-8 170 93)"/><rect x="125" y="103" width="32" height="18" rx="7" fill="#7ae7f1" transform="rotate(-8 125 103)"/><rect x="176" y="97" width="32" height="18" rx="7" fill="#7ae7f1" transform="rotate(-8 176 97)"/><path d="M133 108 L146 105M184 102L197 99" stroke="#e8ffff" stroke-width="4" stroke-linecap="round"/><path d="M162 108L171 107" stroke="#f4eacb" stroke-width="6"/>`;
  return `<defs>
    <linearGradient id="${prefix}-fur" x1="115" y1="95" x2="219" y2="223" gradientUnits="userSpaceOnUse"><stop stop-color="${style.light}"/><stop offset=".46" stop-color="${style.body}"/><stop offset="1" stop-color="${style.shade}"/></linearGradient>
    <linearGradient id="${prefix}-kart" x1="161" y1="225" x2="190" y2="310" gradientUnits="userSpaceOnUse"><stop stop-color="${style.kart}"/><stop offset="1" stop-color="${style.kartDark}"/></linearGradient>
    <linearGradient id="${prefix}-tire" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#374653"/><stop offset="1" stop-color="#151e31"/></linearGradient>
    <linearGradient id="${prefix}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0ffff" stop-opacity=".9"/><stop offset="1" stop-color="#96ffff" stop-opacity=".2"/></linearGradient>
  </defs>
  <ellipse cx="183" cy="320" rx="147" ry="20" fill="#163b4a" opacity=".18"/>
  <path d="M62 237L36 211L36 199L111 195L138 221Z" fill="${style.kartDark}"/>
  <path d="M26 198 Q24 190 34 188L112 184Q120 184 122 192L120 201L34 207Z" fill="${style.kart}"/>
  <path d="M37 191L111 189" stroke="#fff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>
  <path d="M263 235 L288 231Q310 233 312 255L304 277L277 277Z" fill="#192c39"/>
  <ellipse cx="294" cy="255" rx="20" ry="30" transform="rotate(-13 294 255)" fill="url(#${prefix}-tire)"/>
  <path d="M102 223Q91 194 118 182L213 177Q242 184 238 222L223 255L130 259Z" fill="#263a47"/>
  <path d="M125 223Q120 190 140 184L193 181Q217 184 214 216L205 246L142 249Z" fill="${style.suit}"/>
  ${ears}
  <path d="M97 152 Q91 118 119 100 Q148 82 190 89 Q233 87 247 122 Q260 166 231 196 Q203 219 166 213 Q110 212 97 176 L83 165Z" fill="url(#${prefix}-fur)"/>
  <path d="M101 151L85 143L95 174L85 175L109 190" fill="${style.body}"/>
  ${patches}
  ${goggles}
  <ellipse cx="139" cy="153" rx="10" ry="15" fill="#272f3c" transform="rotate(-6 139 153)"/>
  <ellipse cx="207" cy="147" rx="10" ry="15" fill="#272f3c" transform="rotate(-6 207 147)"/>
  <ellipse cx="136" cy="148" rx="3.4" ry="4.6" fill="white"/><ellipse cx="204" cy="142" rx="3.4" ry="4.6" fill="white"/>
  <ellipse cx="119" cy="174" rx="13" ry="7" fill="#f18478" opacity=".65"/><ellipse cx="223" cy="168" rx="12" ry="7" fill="#f18478" opacity=".65"/>
  <path d="M163 169Q174 162 185 168Q187 176 175 180Q164 178 163 169Z" fill="${kind === "bunny" || kind === "cat" ? "#cc6a79" : "#43333a"}"/>
  <path d="M175 180L175 185M175 185Q184 194 194 183M175 185Q165 195 157 187" stroke="#82463d" stroke-width="3" stroke-linecap="round"/>
  ${kind === "bunny" ? '<path d="M170 191L180 190L179 199L172 200Z" fill="white"/>' : ""}
  <path d="M137 211Q174 226 208 204L214 215Q183 240 145 224Z" fill="${style.detail}"/>
  <path d="M140 214Q114 222 103 209L81 224L101 233Q123 235 153 221Z" fill="${style.detail}"/>
  <path d="M122 222Q99 222 100 243L134 253L151 236Z" fill="${style.suit}"/>
  <path d="M203 218Q229 215 231 238L208 250L187 234Z" fill="${style.suit}"/>
  <ellipse cx="194" cy="238" rx="30" ry="12" transform="rotate(-9 194 238)" fill="#213847"/>
  <ellipse cx="194" cy="235" rx="24" ry="8" transform="rotate(-9 194 235)" stroke="#4b6570" stroke-width="4"/>
  <ellipse cx="143" cy="241" rx="15" ry="11" fill="${style.light}" transform="rotate(17 143 241)"/><ellipse cx="217" cy="232" rx="13" ry="11" fill="${style.light}" transform="rotate(-14 217 232)"/>
  <path d="M69 236 Q83 222 114 229L170 247L213 235Q262 232 285 254L313 281Q319 297 299 306L140 317Q102 314 81 290L58 261Z" fill="url(#${prefix}-kart)"/>
  <path d="M77 239Q93 232 112 236L172 255L217 242Q257 239 279 257L286 266L200 277L139 263Z" fill="${style.kart}"/>
  <path d="M169 251L179 272L206 273L212 245Z" fill="${style.detail}"/>
  <path d="M157 300L160 311L205 310L209 296Z" fill="${style.detail}"/>
  <path d="M229 260 Q272 250 288 269L299 284L227 292Q216 279 229 260Z" fill="url(#${prefix}-glass)"/>
  <path d="M235 264L274 263" stroke="#efffff" stroke-width="5" stroke-linecap="round"/>
  <path d="M295 284L303 289L301 297L228 307L222 299Z" fill="#074953" opacity=".6"/>
  <rect x="238" y="290" width="17" height="7" rx="3" fill="#fff9c9" transform="rotate(-8 238 290)"/>
  <rect x="280" y="284" width="17" height="7" rx="3" fill="#fff9c9" transform="rotate(-8 280 284)"/>
  <path d="M91 268Q115 257 131 277L139 294L132 311L103 312L86 291Z" fill="#123341"/>
  <ellipse cx="111" cy="291" rx="24" ry="31" transform="rotate(-15 111 291)" fill="url(#${prefix}-tire)"/>
  <ellipse cx="116" cy="291" rx="14" ry="22" transform="rotate(-15 116 291)" fill="#536373"/>
  <ellipse cx="117" cy="291" rx="8" ry="15" transform="rotate(-15 117 291)" fill="#b7d9dd"/>
  <path d="M115 278L120 303M107 286L127 296M107 295L125 285" stroke="#eefcff" stroke-width="3"/>
  <path d="M274 287Q297 274 312 293L319 307L310 326L284 328L270 309Z" fill="#163241"/>
  <ellipse cx="295" cy="308" rx="23" ry="29" transform="rotate(-14 295 308)" fill="url(#${prefix}-tire)"/>
  <ellipse cx="301" cy="308" rx="14" ry="21" transform="rotate(-14 301 308)" fill="#536373"/>
  <ellipse cx="302" cy="307" rx="8" ry="14" transform="rotate(-14 302 307)" fill="#b7d9dd"/>
  <path d="M300 295L305 319M292 304L310 311M294 313L310 302" stroke="#eefcff" stroke-width="3"/>
  <path d="M61 258L80 267L83 275L58 270Z" fill="#fff1ba"/>
  <path d="M144 281L165 279L166 294L145 296Z" fill="#fff" opacity=".92"/>
  <path d="M151 284L159 283L154 293" stroke="${style.kartDark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M172 314L217 309" stroke="#103e49" stroke-width="7" stroke-linecap="round" opacity=".35"/>
  <path d="M59 243L46 248M61 253L36 260" stroke="#e4fefe" stroke-width="5" stroke-linecap="round" opacity=".65"/>`;
}

export function characterArt(id: string, className = ""): string {
  return svg("0 0 360 350", racer(id, uid(id)), className);
}

export function heroArt(): string {
  const p = uid("hero");
  return svg(
    "0 0 1100 560",
    `<defs>
    <linearGradient id="${p}-sky" x1="520" y1="0" x2="740" y2="470" gradientUnits="userSpaceOnUse"><stop stop-color="#0f8490"/><stop offset=".45" stop-color="#48dace"/><stop offset="1" stop-color="#b0f1b8"/></linearGradient>
    <linearGradient id="${p}-sea" x1="680" y1="228" x2="780" y2="560" gradientUnits="userSpaceOnUse"><stop stop-color="#3cddd6"/><stop offset="1" stop-color="#059f9d"/></linearGradient>
    <linearGradient id="${p}-shade" x1="0" y1="240" x2="795" y2="300" gradientUnits="userSpaceOnUse"><stop stop-color="#063f49"/><stop offset=".48" stop-color="#074c52" stop-opacity=".95"/><stop offset="1" stop-color="#075b59" stop-opacity="0"/></linearGradient>
    <linearGradient id="${p}-road" x1="652" y1="287" x2="805" y2="551" gradientUnits="userSpaceOnUse"><stop stop-color="#789f9f"/><stop offset="1" stop-color="#305965"/></linearGradient>
    <radialGradient id="${p}-sun"><stop stop-color="#fff5b3"/><stop offset="1" stop-color="#fff5b3" stop-opacity="0"/></radialGradient>
    <filter id="${p}-soft"><feGaussianBlur stdDeviation="6"/></filter>
    <pattern id="${p}-checker" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#ffffe9"/><path d="M0 0H12V12H0ZM12 12H24V24H12Z" fill="#254e51"/></pattern>
  </defs>
  <rect width="1100" height="560" fill="url(#${p}-sky)"/>
  <circle cx="921" cy="95" r="146" fill="url(#${p}-sun)"/><circle cx="921" cy="95" r="41" fill="#fff5b3"/>
  <g fill="#e1fff1" opacity=".72"><path d="M733 79Q716 58 699 78Q679 62 668 84Q650 82 647 97H757Q751 79 733 79Z"/><path d="M1039 57Q1023 39 1009 55Q991 44 982 62Q964 58 958 76H1077Q1068 57 1039 57Z"/><path d="M885 174Q869 156 853 170Q836 158 825 177Q808 175 805 189H909Q904 175 885 174Z"/></g>
  <path d="M439 278L544 181Q563 163 579 186L622 232L673 149Q690 122 709 146L801 276Z" fill="#31a69b"/><path d="M625 267L710 161L744 208L775 189L856 278Z" fill="#52b8a0"/><path d="M922 260L987 187Q1003 170 1018 195L1075 259Z" fill="#38afa0"/>
  <path d="M0 275Q284 244 448 260Q590 254 738 260Q906 231 1100 255V560H0Z" fill="url(#${p}-sea)"/>
  <g stroke="#b7f9dc" stroke-width="3" stroke-linecap="round" opacity=".6"><path d="M706 273H758M826 281H886M978 273H1036M412 291H457M958 307H1014M984 321H1092M517 410H549M468 469H502M1049 357H1102"/></g>
  <path d="M576 300Q636 248 722 250Q809 250 834 283Q848 305 909 328Q959 348 1025 337L1128 558L496 575Q483 454 573 403Q624 373 576 300Z" fill="#e5dc9b"/>
  <path d="M591 300Q658 251 718 267Q782 267 802 290Q799 316 867 339L834 355Q742 336 735 316Q705 290 670 312L645 335Z" fill="#8dce6d"/>
  <path d="M694 280C511 330 923 328 814 420S730 543 1056 607" stroke="#f8edb7" stroke-width="156"/>
  <path d="M694 280C511 330 923 328 814 420S730 543 1056 607" stroke="#ed816e" stroke-width="143" stroke-dasharray="21 20"/>
  <path d="M694 280C511 330 923 328 814 420S730 543 1056 607" stroke="url(#${p}-road)" stroke-width="128"/>
  <path d="M694 280C511 330 923 328 814 420S730 543 1056 607" stroke="#eaf4d8" stroke-opacity=".72" stroke-width="5" stroke-dasharray="22 24"/>
  <path d="M750 260L750 180Q750 168 761 166L839 161Q851 161 851 174V287" stroke="#ffe090" stroke-width="11"/>
  <path d="M757 176L844 170L844 195L757 201Z" fill="url(#${p}-checker)"/>
  <path d="M742 257L758 261M842 286L858 290" stroke="#44634e" stroke-width="7" stroke-linecap="round"/>
  ${palm(1015, 209, 1.14, 9)}${palm(564, 248, 0.74, -13)}${palm(1090, 386, 1.55, 16)}
  <path d="M497 520Q541 484 572 508Q561 459 593 446Q607 480 605 507Q633 470 659 488L632 539Z" fill="#2b9d63"/>
  <path d="M954 560Q920 504 949 475Q976 497 979 531Q981 473 1011 478Q1023 507 1000 553Q1040 520 1060 536L1060 560Z" fill="#298d61"/>
  <g transform="translate(590 123) rotate(-10)"><path d="M0 53Q9 81 1 103" stroke="#fff9ce" stroke-width="1.5"/><ellipse cx="0" cy="23" rx="22" ry="28" fill="#ffbd51"/><path d="M-7 10Q-14 18-11 29" stroke="#ffeda2" stroke-width="5" stroke-linecap="round"/><path d="M-4 52L4 52L0 47Z" fill="#ef973a"/></g>
  <g transform="translate(966 152) rotate(12)"><path d="M0 39Q-13 67-5 88" stroke="#e7ffee" stroke-width="1.5"/><ellipse cx="0" cy="15" rx="17" ry="24" fill="#f992b8"/><path d="M-5 2Q-11 8-9 16" stroke="#ffdbdf" stroke-width="4" stroke-linecap="round"/><path d="M-3 39L4 39L0 34Z" fill="#e968a0"/></g>
  <g transform="translate(468 253) scale(.66) rotate(-9 180 260)">${racer("bunny", `${p}-bunny`)}</g>
  <g opacity=".7" stroke="#dafff3" stroke-linecap="round"><path d="M649 469L549 494" stroke-width="6"/><path d="M643 485L593 499" stroke-width="4"/><path d="M911 494L862 513" stroke-width="5"/></g>
  <ellipse cx="889" cy="509" rx="169" ry="22" fill="#183d49" opacity=".16" filter="url(#${p}-soft)"/>
  <g transform="translate(686 104) scale(1.25) rotate(7 180 260)">${racer("fox", `${p}-fox`)}</g>
  <g transform="translate(1035 346) rotate(16)"><rect x="-24" y="-24" width="48" height="48" rx="12" fill="#a8f3df" stroke="#e7fff1" stroke-width="3"/><path d="M2-17L-13 3H-2L-7 19L15-5H3L8-17Z" fill="#fffdb4"/><path d="M-17-17L-9-17" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
  ${star(678, 159, 13)}${star(1051, 142, 11)}${star(965, 388, 7)}${star(579, 448, 9)}${star(1076, 286, 7)}
  <g transform="translate(620 207) rotate(-16)"><ellipse rx="16" ry="22" fill="#d98c2f"/><ellipse cx="-3" cy="-2" rx="14" ry="20" fill="#ffe37a"/><ellipse cx="-3" cy="-2" rx="9" ry="14" stroke="#f6b44a" stroke-width="2"/><path d="M0-12L-7-1H0L-5 9" stroke="#dc9b33" stroke-width="3" stroke-linecap="round"/></g>
  <rect width="1100" height="560" fill="url(#${p}-shade)"/>
  <g opacity=".12" fill="#cffadf"><circle cx="64" cy="80" r="2"/><circle cx="367" cy="84" r="3"/><circle cx="403" cy="464" r="3"/><circle cx="211" cy="500" r="2"/>${star(436, 157, 7)}</g>`,
  );
}

export function trackArt(id: string): string {
  const p = uid(`track-${id}`);
  const candy = id === "candy";
  const sunset = id === "sunset";
  const sky = candy
    ? ["#ecc2f5", "#fff0d4"]
    : sunset
      ? ["#e386b4", "#ffc889"]
      : ["#82e6e3", "#d3f5bf"];
  const road = candy ? "#987abb" : sunset ? "#756790" : "#668d92";
  const edge = candy ? "#f18fad" : sunset ? "#d7ab91" : "#efe0a2";
  let scenery = "";
  if (candy) {
    scenery = `<path d="M0 180Q28 86 73 139Q121 44 176 153Q227 93 271 163Q334 76 376 140Q442 75 500 164V270H0Z" fill="#d4abe9"/><path d="M0 191Q84 137 148 183Q250 136 329 185Q418 138 500 182V270H0Z" fill="#f6bad9"/>
      <g transform="translate(74 119)"><path d="M0 0V96" stroke="#fff8e6" stroke-width="10"/><circle r="34" fill="#fa86ae" stroke="#fff5df" stroke-width="5"/><path d="M0-24C30-24 30 23 1 24C-26 25-26-17-3-14C15-12 12 14-1 11C-10 10-9-4 0-2" stroke="#fff2da" stroke-width="7" stroke-linecap="round"/></g>
      <g transform="translate(426 137)"><path d="M0 0V71" stroke="#fff8e6" stroke-width="8"/><circle r="28" fill="#a58bd7" stroke="#fff5df" stroke-width="5"/><path d="M0-18C23-18 23 17 1 19C-20 20-21-13-3-11C10-8 12 9-1 9" stroke="#f4e7ff" stroke-width="6" stroke-linecap="round"/></g>
      <path d="M337 148L345 96L365 77L386 96L395 151Z" fill="#ffe0a1"/><path d="M340 101L365 67L390 101Z" fill="#ef8daa"/><path d="M347 106H386M347 119H389M345 133H392" stroke="#ffedc4" stroke-width="5"/>
      <g fill="#fff5df"><circle cx="25" cy="221" r="8"/><circle cx="449" cy="242" r="10"/><circle cx="332" cy="206" r="7"/></g>`;
  } else if (sunset) {
    scenery = `<circle cx="349" cy="102" r="47" fill="#ffe8a5"/><path d="M0 149L58 92L109 138L160 72L222 150L281 110L320 153L398 96L500 155V270H0Z" fill="#ad82ab"/><path d="M0 187L88 134L157 171L208 133L300 193L411 145L500 196V270H0Z" fill="#bb89a1"/><path d="M0 212Q106 171 226 210Q341 180 500 218V270H0Z" fill="#dbb4a0"/>
      ${palm(70, 142, 0.53, -13)}${palm(435, 147, 0.49, 9)}
      <path d="M363 172L373 157L395 157L405 174V203H365Z" fill="#f4cfb2"/><path d="M358 174L376 151L399 152L411 174Z" fill="#926a83"/><rect x="379" y="176" width="11" height="20" fill="#7b6f90"/>`;
  } else {
    scenery = `<path d="M0 154L61 91L109 124L156 70L215 153L283 97L346 164L421 102L500 159V270H0Z" fill="#61bd9c"/><path d="M103 143L156 70L180 107L165 99L149 113L137 108Z" fill="#a1ddb0"/><path d="M0 174Q157 143 262 175Q370 143 500 169V270H0Z" fill="#46d0bd"/><g stroke="#d3ffe4" stroke-width="3" opacity=".7"><path d="M4 193H53M95 182H139M375 194H427M446 179H490M405 227H476"/></g>
      <path d="M129 163Q227 127 285 159L390 270H67Z" fill="#a4d67b"/>
      ${palm(58, 137, 0.57, -12)}${palm(405, 140, 0.64, 12)}
      <path d="M285 159L285 116Q285 111 291 111H331Q337 111 337 117V180" stroke="#ffe09a" stroke-width="7"/><path d="M289 116H333V132H289Z" fill="#fff9d6"/><path d="M289 116H298V124H289ZM307 116H316V124H307ZM325 116H333V124H325ZM298 124H307V132H298ZM316 124H325V132H316Z" fill="#46746c"/>`;
  }
  return svg(
    "0 0 500 270",
    `<defs><linearGradient id="${p}-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
    <rect width="500" height="270" fill="url(#${p}-sky)"/>
    <g fill="#fffdf2" opacity=".74"><path d="M100 45Q89 29 75 44Q61 36 53 50Q37 49 35 61H132Q126 45 100 45Z"/><path d="M401 53Q391 41 380 51Q365 43 358 57Q346 53 341 68H424Q419 54 401 53Z"/></g>
    ${scenery}
    <path d="M268 158C162 173 319 188 271 211S168 243 244 291" stroke="${edge}" stroke-width="65"/>
    <path d="M268 158C162 173 319 188 271 211S168 243 244 291" stroke="${candy ? "#fff3e4" : "#fff2c6"}" stroke-width="58" stroke-dasharray="11 11"/>
    <path d="M268 158C162 173 319 188 271 211S168 243 244 291" stroke="${road}" stroke-width="49"/>
    <path d="M268 158C162 173 319 188 271 211S168 243 244 291" stroke="#fff5d3" stroke-width="2.5" stroke-dasharray="10 11"/>
    <g transform="translate(189 139) scale(.25)">${racer(candy ? "bunny" : sunset ? "cat" : "fox", `${p}-racer`)}</g>
    ${star(173, 103, 7, "#fffce3")}${star(324, 57, 5, "#fffce3")}
    <g transform="translate(143 202) rotate(-15)"><ellipse rx="8" ry="11" fill="#e4a43c"/><ellipse cx="-1" cy="-1" rx="6" ry="9" fill="#ffe78c"/><path d="M0-5L-3 0H1L-2 5" stroke="#e5ae46" stroke-width="2"/></g>
    <g transform="translate(356 231) rotate(13)"><rect x="-12" y="-12" width="24" height="24" rx="5" fill="${candy ? "#ffe3a9" : "#b2f3e0"}" stroke="#fff9df" stroke-width="2"/><path d="M2-8L-6 2H0L-2 9L7-2H2L4-8Z" fill="#fffdf4"/></g>`,
  );
}

export function powerupArt(id: string): string {
  const p = uid(`power-${id}`);
  const icons: Record<string, string> = {
    nitro: `<path d="M25 13L38 9L45 22L30 28Z" fill="#6b5fc9"/><path d="M18 26Q17 21 22 19L41 13Q46 12 48 17L54 43Q55 48 51 51L32 57Q26 59 24 53Z" fill="url(#${p}-purple)"/><path d="M22 25L42 19" stroke="#e6daff" stroke-width="4" stroke-linecap="round"/><path d="M38 24L28 41L37 38L34 51L48 31L39 34L43 23Z" fill="#fff6a6"/><path d="M19 38L11 47L20 45L15 58L28 45Z" fill="#ffd66b"/><path d="M28 11L38 8" stroke="#e5d8ff" stroke-width="5" stroke-linecap="round"/>`,
    shield: `<path d="M32 7Q42 15 55 15L52 36Q48 50 32 59Q15 50 11 36L8 15Q21 15 32 7Z" fill="#467cd1"/><path d="M32 7Q42 15 55 15L52 32Q48 46 32 55Q15 46 11 32L8 15Q21 15 32 7Z" fill="url(#${p}-blue)" stroke="#b9f8ff" stroke-width="2"/><path d="M32 15V46Q44 39 46 28L47 22Q39 21 32 15Z" fill="#4eabe7"/><path d="M22 30L29 37L42 23" stroke="#efffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    rocket: `<path d="M24 39Q7 39 9 54L22 51L28 42Z" fill="#ff9c45"/><path d="M24 43Q13 48 11 60Q27 57 32 46Z" fill="#ffc957"/><path d="M22 29L11 32L6 45L26 39ZM37 42L34 55L48 51L49 34Z" fill="#e06162"/><path d="M20 34Q34 9 56 7Q59 28 35 44Z" fill="#fff0d5"/><path d="M42 11Q49 7 56 7Q57 15 54 22Z" fill="#fa7e7d"/><circle cx="39" cy="26" r="8" fill="#df786a"/><circle cx="39" cy="26" r="5" fill="#77dce1"/><path d="M36 24L39 22" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M20 34L35 44L31 48L17 38Z" fill="#e16f67"/>`,
    magnet: `<g transform="rotate(24 32 32)"><path d="M14 11V36Q14 55 32 55Q50 55 50 36V11H39V36Q39 43 32 43Q25 43 25 36V11Z" fill="#cf506f"/><path d="M14 9V32Q14 51 32 51Q50 51 50 32V9H39V32Q39 39 32 39Q25 39 25 32V9Z" fill="#fa8297"/><path d="M14 9H25V22H14ZM39 9H50V22H39Z" fill="#e2f5ff"/><path d="M17 25V33Q17 44 26 46" stroke="#ffbfce" stroke-width="3" stroke-linecap="round"/></g><path d="M7 18L3 15M47 5L49 1M57 19L62 16" stroke="#ffd985" stroke-width="3" stroke-linecap="round"/>`,
    banana: `<path d="M35 9L42 11L40 21Q47 39 57 47Q44 55 31 36Q27 53 11 57Q8 44 24 28Q16 39 4 37Q13 22 32 21Z" fill="#e1aa31"/><path d="M33 7L40 9L38 19Q44 35 56 43Q42 49 30 30Q26 47 10 52Q9 40 26 25Q14 34 4 33Q15 19 31 19Z" fill="#ffe469"/><path d="M30 28Q21 44 13 47M37 22Q43 35 51 40" stroke="#fff5ad" stroke-width="3" stroke-linecap="round"/><path d="M33 7L40 9L38 15L31 13Z" fill="#85ad53"/><path d="M31 24L33 31" stroke="#c49330" stroke-width="2" stroke-linecap="round"/>`,
    lightning: `<path d="M33 5L10 34Q8 37 13 37H27L21 58L56 24H38L46 5Z" fill="#e6a436"/><path d="M32 3L9 31Q7 34 12 34H29L21 55L55 21H36L45 3Z" fill="#ffe578"/><path d="M33 9L19 27H28" stroke="#fff6c4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12L5 8M52 45L57 48M50 8L55 5" stroke="#ffd776" stroke-width="3" stroke-linecap="round"/>`,
  };
  return svg(
    "0 0 64 64",
    `<defs><linearGradient id="${p}-purple" x1="18" y1="16" x2="53" y2="55" gradientUnits="userSpaceOnUse"><stop stop-color="#cdb8ff"/><stop offset="1" stop-color="#8973df"/></linearGradient><linearGradient id="${p}-blue" x1="10" y1="12" x2="51" y2="52" gradientUnits="userSpaceOnUse"><stop stop-color="#91e7ff"/><stop offset="1" stop-color="#539ee5"/></linearGradient></defs>${icons[id] || icons.nitro}`,
  );
}
