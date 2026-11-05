import { useId } from 'react'

const svgStyle = { display: 'block', width: '100%', height: 'auto' } as const
const ink = '#29312c'
const cream = '#f4f0df'

/** A little impossible studio, drawn entirely from geometric shapes. */
export function HeroArt() {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 960 300" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby={`${id}-title`} style={svgStyle}>
      <title id={`${id}-title`}>An imaginary sunlit studio among sculptural hills and orbiting objects</title>
      <defs>
        <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" stroke="#b9c1a4" strokeWidth=".55" />
        </pattern>
        <clipPath id={`${id}-arch`}><path d="M624 207V123a46 46 0 0 1 92 0v84Z" /></clipPath>
      </defs>
      <path fill="#dfe5d0" d="M0 0h960v300H0z" />
      <path fill={`url(#${id}-grid)`} opacity=".42" d="M0 0h960v300H0z" />
      <circle cx="233" cy="102" r="61" fill="#d57945" />
      <circle cx="233" cy="102" r="73" stroke="#acb49a" strokeWidth=".8" strokeDasharray="2 5" />
      <path d="M0 205C129 104 222 145 371 203s263-54 387-21 139 43 202 7v111H0Z" fill="#a8b890" />
      <path d="M0 257c118-37 223-7 310-18 149-18 166-83 309-52 111 24 205 82 341 42v71H0Z" fill="#bdc9a6" />
      <path d="M0 285c183-40 208 14 357-14s321-27 603 12v17H0Z" fill="#cbd4b8" />
      <path d="m396 237 147 46 240-59-150-47Z" fill="#8e9d7c" opacity=".42" />
      <path d="M412 126 588 80l166 46-176 47Z" fill="#f5efdb" stroke={ink} strokeWidth="1" />
      <path d="M412 126v91l166 52v-96Z" fill="#e8dfc7" stroke={ink} strokeWidth="1" />
      <path d="M578 173v96l176-45v-98Z" fill="#c16e46" stroke={ink} strokeWidth="1" />
      <path d="m588 80 166 46-21 6-164-47Z" fill="#fff8e5" />
      <path d="M604 218V121a66 66 0 0 1 132 0v97l-20 6v-99a46 46 0 0 0-92 0v88Z" fill="#d88759" stroke={ink} strokeWidth="1" />
      <path d="M624 207V123a46 46 0 0 1 92 0v84Z" fill="#394b3b" stroke={ink} strokeWidth="1" />
      <g clipPath={`url(#${id}-arch)`}>
        <path d="M641 78v146m28-150v150m28-146v146M615 118h112m-112 28h112m-112 28h112m-112 28h112" stroke="#77866b" strokeWidth="1" />
        <path d="m615 201 116-82M615 219l116-82" stroke="#c4cba3" strokeWidth="9" opacity=".22" />
      </g>
      <path d="m624 207 14 4 78-20v16l-92 24Z" fill="#d5b183" stroke={ink} strokeWidth="1" />
      <path d="m610 229 106-27 12 4-107 28v8l-11-4Z" fill="#efe4c8" stroke={ink} strokeWidth="1" />
      <path d="m598 238 130-33 12 4-131 34v8l-11-4Z" fill="#efe4c8" stroke={ink} strokeWidth="1" />
      <path d="m586 247 154-39 12 4-155 40v8l-11-4Z" fill="#efe4c8" stroke={ink} strokeWidth="1" />
      <path d="m440 153 105 32v51l-105-32Z" fill="#74846c" stroke={ink} strokeWidth="1" />
      <path d="m447 160 40 12v36l-40-12Zm48 15 42 13v36l-42-13Z" fill="#d1d5b9" stroke={ink} strokeWidth=".7" />
      <path d="m455 168 22 7m-22-2 14 4m34 5 24 8m-24-3 16 5m-59-12v15m-6-10 12 4m44-6v20m-9-13 18 5" stroke="#687a61" strokeWidth="1" />
      <circle cx="488" cy="133" r="9" fill="#db8d54" stroke={ink} strokeWidth=".8" />
      <path d="m477 129 21 7" stroke={ink} strokeWidth=".8" />
      <path d="m527 102 37-10 37 10-37 10Z" fill="#c5d1ac" stroke={ink} strokeWidth="1" />
      <path d="M545 82v22m17-29v25m17-18v22" stroke={ink} strokeWidth="1" />
      <path d="m536 82 26-7 26 7-26 7Z" fill="#de8d59" stroke={ink} strokeWidth="1" />
      <path d="M0 233c51-5 99 5 146 18m-65-33c25-5 50-4 75 2m602 36c55-10 114-10 158-1" stroke="#889b74" strokeWidth=".8" />
      <ellipse cx="302" cy="224" rx="46" ry="11" fill="#7f9470" opacity=".3" />
      <path d="M285 213v-48h32v48c0 9-32 9-32 0Z" fill="#e9e3c9" stroke={ink} strokeWidth="1" />
      <ellipse cx="301" cy="165" rx="16" ry="5" fill="#faf3df" stroke={ink} strokeWidth="1" />
      <path d="M301 165v-25m0 11c-15 0-24-10-22-19 15 0 24 7 22 19Zm1-8c1-19 8-27 18-29 4 15-4 26-18 29Z" fill="#687e5f" stroke={ink} strokeWidth="1" />
      <path d="M112 155c0-31 16-47 37-47s37 16 37 47" stroke="#f3eddb" strokeWidth="19" />
      <path d="M112 155c0-31 16-47 37-47s37 16 37 47" stroke={ink} strokeWidth=".8" />
      <path d="M102 168h20m53 0h21" stroke={ink} strokeWidth="1" />
      <ellipse cx="824" cy="122" rx="54" ry="14" transform="rotate(-26 824 122)" stroke={ink} strokeWidth=".8" />
      <circle cx="825" cy="122" r="21" fill="#f4ecd7" stroke={ink} strokeWidth="1" />
      <path d="M820 102c-10 12-9 29 0 40m9-40c9 12 9 29 0 40m-24-24h39m-39 9h39" stroke="#adb69a" strokeWidth=".7" />
      <path d="m805 78 7-8 8 7-7 8Z" fill="#b56545" stroke={ink} strokeWidth=".8" />
      <circle cx="875" cy="105" r="4" fill="#d38653" stroke={ink} strokeWidth=".8" />
      <path d="M359 61v15m-7-7h14m407-27v12m-6-6h12M91 63v10m-5-5h10" stroke="#5e7058" strokeWidth="1" />
      <circle cx="329" cy="112" r="3" fill="#61775a" /><circle cx="767" cy="83" r="2" fill="#61775a" />
      <path d="m359 183 23-6 12 11-24 6Z" fill="#de9569" stroke={ink} strokeWidth=".9" />
      <path d="m359 183 11 11v20l-11-11Zm11 11 24-6v20l-24 6Z" fill="#c7754f" stroke={ink} strokeWidth=".9" />
      <path d="M55 271h24m-12-12v24m802-6h30m-15-15v30" stroke="#a8b694" strokeWidth=".7" />
      <text x="29" y="31" fontFamily="monospace" fontSize="8" letterSpacing="2" fill="#66785d">STUDIO OF POSSIBILITIES</text>
      <text x="873" y="280" fontFamily="monospace" fontSize="8" letterSpacing="1.3" fill="#66785d">FIG. 001</text>
    </svg>
  )
}

export function AvatarArt() {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby={`${id}-title`} style={svgStyle}>
      <title id={`${id}-title`}>An abstract terracotta asterisk on warm ivory</title>
      <path fill="#f2ead7" d="M0 0h120v120H0z" />
      <path d="M24 92V49a25 25 0 0 1 50 0v43H60V50a11 11 0 0 0-22 0v42Z" fill="#c8693f" />
      <path d="M47 92V50a25 25 0 0 1 50 0v42H83V50a11 11 0 0 0-22 0v42Z" fill="#c8693f" />
      <path d="M59 26v66" stroke="#f2ead7" strokeWidth="2" />
      <circle cx="92" cy="24" r="4" fill="#758469" />
      <path d="M15 105h90" stroke="#d0c5ad" strokeWidth=".75" />
    </svg>
  )
}

function OrbitPanel() {
  return (
    <>
      <path fill="#bdc9a7" d="M0 0h800v500H0z" />
      <circle cx="738" cy="56" r="98" stroke="#a3b48b" strokeWidth="1" /><circle cx="738" cy="56" r="117" stroke="#a3b48b" strokeWidth="1" />
      <rect x="49" y="44" width="702" height="425" rx="14" fill="#728268" opacity=".17" />
      <rect x="49" y="31" width="702" height="425" rx="14" fill="#faf9f1" />
      <path d="M49 45a14 14 0 0 1 14-14h122v425H63a14 14 0 0 1-14-14Z" fill="#ecede2" />
      <g fontFamily="Arial, sans-serif">
        <circle cx="77" cy="66" r="9" stroke="#475a43" strokeWidth="2" /><ellipse cx="77" cy="66" rx="13" ry="4" transform="rotate(-35 77 66)" stroke="#475a43" strokeWidth="1.5" />
        <text x="96" y="72" fill="#344b37" fontSize="23" fontWeight="700" letterSpacing="-.9">orbit</text>
        <text x="71" y="117" fill="#8c9481" fontSize="8" fontWeight="700" letterSpacing="1.8">YOUR SPACE</text>
        <rect x="61" y="130" width="112" height="30" rx="6" fill="#d8dfca" />
        <rect x="73" y="141" width="8" height="8" rx="2" fill="#58714e" /><text x="91" y="149" fill="#3f583c" fontSize="10" fontWeight="600">Overview</text>
        <path d="M73 180h8m-8 4h8m-8 4h8" stroke="#929b87" /><text x="91" y="188" fill="#828c7b" fontSize="10">Transactions</text>
        <circle cx="77" cy="219" r="4" stroke="#929b87" /><text x="91" y="223" fill="#828c7b" fontSize="10">Budgets</text>
        <path d="m73 254 4-5 4 5v7h-8Z" stroke="#929b87" /><text x="91" y="258" fill="#828c7b" fontSize="10">Savings goals</text>
        <rect x="65" y="357" width="104" height="73" rx="6" fill="#e1e5d4" />
        <text x="76" y="376" fill="#4b6044" fontSize="10" fontWeight="700">A little, often.</text>
        <text x="76" y="391" fill="#839078" fontSize="8">Your future self says</text><text x="76" y="403" fill="#839078" fontSize="8">thanks for saving.</text>
        <text x="211" y="69" fill="#7c8675" fontSize="9">MONDAY, JUNE 16</text>
        <text x="211" y="99" fill="#303e30" fontSize="24" fontWeight="600" letterSpacing="-.8">Good morning, Alex <tspan fill="#d1a051">✳</tspan></text>
        <rect x="644" y="65" width="78" height="25" rx="12.5" fill="#f1f0e7" stroke="#e3e4d9" /><text x="657" y="81" fill="#74806b" fontSize="9">This month⌄</text>
        <rect x="211" y="122" width="254" height="124" rx="9" fill="#3d523b" />
        <text x="229" y="145" fill="#c7d2b6" fontSize="10">Total balance</text><text x="229" y="180" fill="#f5f4df" fontSize="29" letterSpacing="-1">$24,680<tspan fontSize="17" fill="#c3cfb2">.50</tspan></text>
        <rect x="229" y="202" width="75" height="20" rx="10" fill="#57704d" /><text x="240" y="215" fill="#dce7c7" fontSize="8">↗ 12.4% this month</text>
        <circle cx="428" cy="144" r="4" fill="#b9caa3" /><circle cx="415" cy="144" r="4" fill="#819873" />
        <rect x="478" y="122" width="244" height="124" rx="9" fill="#eeeddf" />
        <text x="495" y="145" fill="#7e8675" fontSize="10">Monthly cash flow</text>
        <text x="495" y="173" fill="#344532" fontSize="22">$6,420<tspan fill="#959b87" fontSize="12"> / $8,000</tspan></text>
        <rect x="496" y="192" width="206" height="7" rx="3.5" fill="#d9ddcb" /><rect x="496" y="192" width="148" height="7" rx="3.5" fill="#99ad7e" />
        <circle cx="499" cy="218" r="3" fill="#99ad7e" /><text x="508" y="221" fill="#88917a" fontSize="8">Income</text><circle cx="575" cy="218" r="3" fill="#d2b88b" /><text x="584" y="221" fill="#88917a" fontSize="8">Spending</text>
        <text x="211" y="280" fill="#344532" fontSize="13" fontWeight="600">Spending overview</text><text x="402" y="279" fill="#8d9580" fontSize="8">View report ↗</text>
        {[311, 339, 367, 395].map(y => <path key={y} d={`M212 ${y}H462`} stroke="#e9ebdf" />)}
        {[35, 59, 48, 86, 62, 108, 77, 95, 68, 117, 100, 130].map((h, i) => <rect key={i} x={218 + i * 20} y={414 - h * .78} width="10" height={h * .78} rx="3" fill={i === 9 ? '#3f5b39' : '#cad3b7'} />)}
        <text x="214" y="432" fill="#929a86" fontSize="7">JAN</text><text x="293" y="432" fill="#929a86" fontSize="7">APR</text><text x="372" y="432" fill="#929a86" fontSize="7">JUL</text><text x="438" y="432" fill="#929a86" fontSize="7">OCT</text>
        <text x="489" y="280" fill="#344532" fontSize="13" fontWeight="600">Recent activity</text>
        {[['↗', 'Figma subscription', 'Today, 9:41 AM', '−$15.00'], ['☕', 'Sunday coffee', 'Yesterday', '−$8.50'], ['↙', 'Payday, the good kind', 'Jun 14, 2025', '+$4,200.00']].map((r, i) => <g key={r[1]}><rect x="489" y={296 + i * 44} width="28" height="28" rx="8" fill={i === 2 ? '#dde7ce' : '#efeee4'} /><text x="498" y={315 + i * 44} fill="#70865e" fontSize="12">{r[0]}</text><text x="528" y={309 + i * 44} fill="#5e6c56" fontSize="9">{r[1]}</text><text x="528" y={322 + i * 44} fill="#9ba38f" fontSize="7">{r[2]}</text><text x="720" y={313 + i * 44} fill={i === 2 ? '#6c8b50' : '#6b7861'} fontSize="9" textAnchor="end">{r[3]}</text></g>)}
      </g>
    </>
  )
}

function FormaPanel() {
  return (
    <>
      <path fill="#c6bbd4" d="M0 0h800v500H0z" />
      <path d="m0 425 800-90m-800 125 800-90" stroke="#b2a4c3" />
      <rect x="44" y="36" width="712" height="441" rx="12" fill="#71617e" opacity=".15" />
      <rect x="44" y="24" width="712" height="441" rx="12" fill="#f6f3eb" />
      <g fontFamily="Arial, sans-serif">
        <path d="M69 49h9v9h-9zm10 0h9v9h-9zm-10 10h9v9h-9z" fill="#706086" /><text x="99" y="66" fontSize="21" fontWeight="700" letterSpacing="-1.1" fill="#3f3546">forma</text>
        <text x="222" y="60" fill="#a69dac" fontSize="10">Workspace</text><text x="294" y="60" fill="#5a4b67" fontSize="10">/</text><text x="309" y="60" fill="#5a4b67" fontSize="10">Design playground</text>
        <circle cx="664" cy="56" r="12" fill="#e8c5ac" /><text x="659" y="59" fontSize="8" fill="#8b6452">AJ</text><circle cx="684" cy="56" r="12" fill="#b6c5af" stroke="#f6f3eb" strokeWidth="2" /><text x="678" y="59" fontSize="8" fill="#5f7757">RM</text>
        <rect x="706" y="43" width="29" height="25" rx="5" fill="#6f5a84" /><text x="717" y="60" fontSize="15" fill="#f6f3eb">+</text>
        <path d="M44 82h712M194 82v383" stroke="#e5e0e5" />
        <text x="65" y="114" fill="#b1a7b6" fontSize="8" letterSpacing="1.4">YOUR WORKSPACE</text>
        <rect x="57" y="129" width="124" height="30" rx="5" fill="#e9e1ee" /><text x="70" y="148" fill="#766083" fontSize="10">◈  All projects</text>
        <text x="70" y="182" fill="#a196a8" fontSize="10">☆  Favorites</text><text x="70" y="217" fill="#a196a8" fontSize="10">◷  Recent</text><text x="70" y="252" fill="#a196a8" fontSize="10">▱  Archive</text>
        <text x="65" y="307" fill="#b1a7b6" fontSize="8" letterSpacing="1.4">COLLECTIONS</text>
        <circle cx="75" cy="333" r="3" fill="#bba3c7" /><text x="86" y="337" fill="#95869d" fontSize="9">Personal explorations</text><circle cx="75" cy="362" r="3" fill="#b1bda0" /><text x="86" y="366" fill="#95869d" fontSize="9">Client work</text>
        <circle cx="74" cy="433" r="10" fill="#dacde2" /><text x="91" y="431" fill="#7e6c8b" fontSize="9">Alex's workspace</text><text x="91" y="443" fill="#b0a5b5" fontSize="7">A place for good ideas</text>
        <text x="221" y="126" fill="#473a50" fontSize="25" fontWeight="600" letterSpacing="-.9">Room for your next big idea.</text>
        <text x="222" y="147" fill="#a194a6" fontSize="10">A little messy. A little magical. Entirely yours.</text>
        <text x="222" y="187" fill="#786884" fontSize="10" fontWeight="600">All projects <tspan fill="#b6a9bf">  08</tspan></text><text x="325" y="187" fill="#b1a7b6" fontSize="10">Shared with me</text>
        <path d="M222 200h506" stroke="#e9e2ec" /><path d="M222 200h73" stroke="#8d72a0" strokeWidth="2" />
        <rect x="222" y="219" width="241" height="151" rx="7" fill="#dbcea9" />
        <circle cx="334" cy="292" r="49" fill="#d98e68" /><path d="M298 329v-68h33a34 34 0 0 1 0 68Z" fill="#526954" /><path d="m354 259 38 68h-76Z" fill="#f5ebd5" /><path d="M268 344h142" stroke="#8b8c66" strokeWidth=".7" />
        <text x="237" y="241" fill="#847655" fontSize="7" letterSpacing="1.8">AN EXPLORATION IN FORM</text><text x="414" y="354" fill="#847655" fontSize="7">001—025</text>
        <rect x="479" y="219" width="249" height="151" rx="7" fill="#7f688b" />
        <path d="M504 345V243h198v102Z" fill="#eee4ec" /><path d="M517 256h72v76h-72Z" fill="#c0a2c8" /><circle cx="553" cy="286" r="20" fill="#93729e" /><path d="M530 323c0-33 47-33 47 0" fill="#634b72" />
        <text x="600" y="272" fill="#695374" fontSize="14" fontFamily="Georgia, serif">Make space</text><text x="600" y="288" fill="#695374" fontSize="14" fontFamily="Georgia, serif">for wonder.</text><path d="M600 303h80m-80 5h65m-65 5h73" stroke="#b9a9be" strokeWidth="1.5" /><rect x="600" y="324" width="39" height="10" rx="5" fill="#8f719b" />
        <text x="222" y="393" fill="#6b5878" fontSize="12" fontWeight="600">Shapes & other stories</text><text x="222" y="411" fill="#b0a4b7" fontSize="9">Brand exploration · Updated 2h ago</text>
        <text x="479" y="393" fill="#6b5878" fontSize="12" fontWeight="600">The art of slowing down</text><text x="479" y="411" fill="#b0a4b7" fontSize="9">Website concept · Updated yesterday</text>
        <rect x="222" y="435" width="506" height="12" rx="3" fill="#eee8f0" />
      </g>
    </>
  )
}

function FieldPanel({ clipId }: { clipId: string }) {
  return (
    <>
      <defs><clipPath id={clipId}><rect x="384" y="116" width="347" height="253" rx="2" /></clipPath></defs>
      <path fill="#d2d7c4" d="M0 0h800v500H0z" />
      <rect x="44" y="35" width="712" height="440" rx="9" fill="#8b947b" opacity=".13" />
      <rect x="44" y="24" width="712" height="440" rx="9" fill="#f1edde" />
      <g fontFamily="Arial, sans-serif">
        <text x="69" y="72" fontFamily="Georgia, serif" fontSize="38" fontWeight="700" letterSpacing="-2.4" fill="#334937">field<tspan fill="#be7853">.</tspan></text>
        <text x="317" y="62" fill="#59664e" fontSize="9">Stories</text><text x="383" y="62" fill="#59664e" fontSize="9">Places</text><text x="447" y="62" fill="#59664e" fontSize="9">The journal</text>
        <text x="647" y="62" fill="#59664e" fontSize="9">Find your outside ↗</text><path d="M69 89h662" stroke="#d7d6c4" />
        <text x="69" y="130" fill="#8b9679" fontSize="8" letterSpacing="1.7">A JOURNAL FOR THE WANDERING</text>
        <text x="68" y="184" fontFamily="Georgia, serif" fill="#334937" fontSize="47" letterSpacing="-2">Less scrolling.</text><text x="68" y="231" fontFamily="Georgia, serif" fontStyle="italic" fill="#334937" fontSize="47" letterSpacing="-2">More wandering.</text>
        <text x="71" y="267" fill="#92967d" fontSize="10">Slow stories, winding trails, and a gentle</text><text x="71" y="284" fill="#92967d" fontSize="10">reminder that there's a whole world out there.</text>
        <rect x="70" y="316" width="132" height="32" rx="2" fill="#3f5942" /><text x="85" y="336" fill="#f1edde" fontSize="9">Take the scenic route  ↗</text>
        <g clipPath={`url(#${clipId})`}>
          <path fill="#c1ceba" d="M384 116h347v253H384z" /><circle cx="657" cy="171" r="31" fill="#ecdec0" />
          <path d="m364 290 95-143 93 129 73-110 123 157v66H364Z" fill="#8c9c82" /><path d="m458 147 14 60-14-9-10 18-7-11-30 28Zm167 19 17 63-17-13-12 10-12-8-18 16Z" fill="#d5dbc5" />
          <path d="m353 353 116-91 87 44 75-63 141 97v47H353Z" fill="#71896e" />
          <path d="M495 380c-18-37 44-46 21-75s30-21 49-40c-12 25-49 18-32 39s-28 42-14 76" fill="#c8cdaf" />
          <path d="m383 354 50-70 43 71Z" fill="#536d53" /><path d="m374 331 27-52 30 52m241 46 41-111 40 111" fill="#3e5b44" />
          <path d="m671 288 32-52 30 52m-55 27 27-48 29 48" fill="#3e5b44" />
          <path d="M394 357h324" stroke="#f0ecd6" strokeWidth=".6" opacity=".5" />
          <path d="m565 327 2-10 3 2 2 11m-5-9-6 4m9-4 5 2" stroke="#efe6cf" strokeWidth="1.4" /><circle cx="569" cy="314" r="2.4" fill="#e5c39a" />
        </g>
        <rect x="399" y="131" width="70" height="19" rx="9.5" fill="#f0ecda" /><text x="410" y="144" fill="#6f7e60" fontSize="7" letterSpacing="1">OFF THE GRID</text>
        <text x="400" y="349" fill="#f4efdc" fontSize="9">46°51′ N  ·  9°31′ E</text>
        <path d="M69 389h662" stroke="#d7d6c4" /><text x="69" y="413" fill="#8a9277" fontSize="7" letterSpacing="1.6">FRESH FROM THE FIELD</text>
        <text x="69" y="443" fill="#3e533d" fontFamily="Georgia, serif" fontSize="16">The quiet art of getting lost</text><text x="343" y="443" fill="#3e533d" fontFamily="Georgia, serif" fontSize="16">A cabin, a lake, and absolutely nothing</text><text x="710" y="443" fill="#8d977a" fontSize="17">↗</text>
      </g>
    </>
  )
}

function MonoPanel() {
  const bars = [14, 20, 11, 28, 39, 25, 50, 35, 22, 43, 60, 39, 72, 47, 30, 62, 42, 78, 51, 35, 69, 44, 28, 58, 35, 20, 45, 32, 17, 25, 12, 19]
  return (
    <>
      <path fill="#c27d60" d="M0 0h800v500H0z" />
      <path d="M0 40h800M0 460h800" stroke="#b16e53" /><circle cx="50" cy="455" r="115" stroke="#b16e53" /><circle cx="50" cy="455" r="145" stroke="#b16e53" />
      <rect x="57" y="49" width="686" height="414" rx="13" fill="#814d3d" opacity=".22" />
      <rect x="57" y="36" width="686" height="414" rx="13" fill="#292d2a" />
      <g fontFamily="Arial, sans-serif">
        <path d="M82 63v13m5-17v21m5-17v13m5-17v21" stroke="#d89471" strokeWidth="2.5" strokeLinecap="round" /><text x="108" y="78" fill="#f1e9d9" fontSize="23" fontWeight="700" letterSpacing="-.7">mono</text><text x="657" y="73" fill="#7f857a" fontSize="9">Your listening room</text>
        <path d="M80 97h640" stroke="#3b403a" />
        <text x="83" y="126" fill="#7d8778" fontSize="8" letterSpacing="1.8">ON ROTATION</text>
        <rect x="83" y="144" width="207" height="207" rx="3" fill="#dfcba6" />
        <circle cx="187" cy="247" r="79" fill="#a55d45" /><path d="M109 247h156" stroke="#dfcba6" strokeWidth="1" /><path d="M187 169v156" stroke="#dfcba6" strokeWidth="1" />
        <circle cx="187" cy="247" r="63" stroke="#d3a882" strokeWidth="1" /><circle cx="187" cy="247" r="47" stroke="#d3a882" strokeWidth="1" /><circle cx="187" cy="247" r="31" stroke="#d3a882" strokeWidth="1" /><circle cx="187" cy="247" r="15" fill="#dfcba6" />
        <path d="m139 157 109 181" stroke="#475d4a" strokeWidth="19" /><path d="m148 154 109 181" stroke="#eeead9" strokeWidth="3" />
        <text x="95" y="164" fontSize="7" fill="#6d6956" letterSpacing="1.5">SLOW SUNDAY</text><text x="247" y="337" fontSize="6" fill="#6d6956" letterSpacing="1" textAnchor="end">VOL. 03</text>
        <text x="83" y="377" fill="#eee7d8" fontSize="17" fontWeight="600" letterSpacing="-.3">Somewhere, slowly.</text><text x="83" y="395" fill="#8a9183" fontSize="10">A soundtrack for doing a little less.</text>
        <rect x="83" y="410" width="53" height="16" rx="8" fill="#3a4037" /><text x="95" y="421" fontSize="7" fill="#a4b096">AMBIENT</text><text x="146" y="421" fontSize="8" fill="#687361">12 tracks · 48 min</text>
        <text x="324" y="141" fill="#828b7d" fontSize="8" letterSpacing="1.7">NOW PLAYING</text><text x="324" y="177" fill="#ede6d8" fontSize="29" letterSpacing="-1">A place between.</text><text x="325" y="200" fill="#8c9585" fontSize="11">Nori & the quiet hours</text>
        <path d="M682 160c-8-8-18 3 0 15 18-12 8-23 0-15Z" stroke="#b3bdab" strokeWidth="1.2" />
        {bars.map((h, i) => <rect key={i} x={327 + i * 11} y={257 - h / 2} width="4" height={h} rx="2" fill={i < 18 ? '#cf9275' : '#4d5847'} />)}
        <path d="M326 313h369" stroke="#4a5343" strokeWidth="2" strokeLinecap="round" /><path d="M326 313h207" stroke="#d19577" strokeWidth="2" strokeLinecap="round" /><circle cx="533" cy="313" r="4" fill="#e5b298" />
        <text x="326" y="334" fill="#909b86" fontSize="8">02:34</text><text x="695" y="334" fill="#65725d" fontSize="8" textAnchor="end">04:58</text>
        <circle cx="511" cy="378" r="25" fill="#d49a7b" /><path d="M505 370v16m11-16v16" stroke="#2d352c" strokeWidth="3" />
        <path d="m451 372-10 6 10 6Zm-13 0v12m135-12 10 6-10 6Zm13 0v12" fill="#a9b39e" stroke="#a9b39e" strokeWidth="1.5" />
        <path d="m375 374 15 9m-15 0 15-9m-3-2 4 1-1 4m-3 3 4 2-1 4m242-13h15m-2-3 3 3-3 3m3 8h-15m2-3-3 3 3 3" stroke="#6d7a63" strokeWidth="1.3" />
        <text x="436" y="430" fill="#61705b" fontSize="7" letterSpacing="1.3">GOOD SOUND. LESS NOISE.</text>
      </g>
    </>
  )
}

export function ProjectArt({ kind }: { kind: 'orbit' | 'forma' | 'field' | 'mono' }) {
  const id = useId().replace(/:/g, '')
  const titles = { orbit: 'Orbit, a thoughtful personal finance dashboard', forma: 'Forma, a playful creative workspace', field: 'Field, an editorial journal for the outdoors', mono: 'Mono, a quiet audio listening room' }
  return (
    <svg viewBox="0 0 800 500" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby={`${id}-title`} style={svgStyle}>
      <title id={`${id}-title`}>{titles[kind]}</title>
      {kind === 'orbit' && <OrbitPanel />}
      {kind === 'forma' && <FormaPanel />}
      {kind === 'field' && <FieldPanel clipId={`${id}-landscape`} />}
      {kind === 'mono' && <MonoPanel />}
    </svg>
  )
}

export function StickerArt({ kind }: { kind: 'flower' | 'cube' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby={`${id}-title`} style={svgStyle}>
      <title id={`${id}-title`}>{kind === 'flower' ? 'An orange geometric flower' : 'A small mint impossible cube'}</title>
      {kind === 'flower' ? <g transform="rotate(-12 60 60)">
        <path d="M60 21C71 4 91 11 85 31c20-4 31 17 12 28 20 12 11 35-10 29 4 22-19 30-28 10-12 19-34 10-28-11C9 93 0 70 21 59 2 47 11 25 32 31 27 10 49 2 60 21Z" fill="#df9869" stroke="#a86543" strokeWidth="1" />
        <circle cx="58" cy="59" r="20" fill="#573e2e" /><circle cx="58" cy="59" r="12" fill="#e6bc87" />
        <path d="M53 55v3m10-3v3m-11 7c4 4 8 4 12 0" stroke="#765032" strokeWidth="1.3" strokeLinecap="round" />
      </g> : <g transform="rotate(8 60 60)">
        <path d="m59 13 40 23v47L59 107 19 84V36Z" fill="#b8cda8" stroke="#506c51" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m19 36 40 24 40-24M59 60v47" stroke="#506c51" strokeWidth="1.5" />
        <path d="m59 13 40 23-40 24-40-24Z" fill="#d7e3c4" stroke="#506c51" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m59 38 19 11v23L59 84 39 72V49Z" fill={cream} stroke="#506c51" strokeWidth="1.2" /><path d="m39 49 20 12 19-12M59 61v23" stroke="#506c51" strokeWidth="1.2" />
        <path d="m59 38 19 11-19 12-20-12Z" fill="#da936c" stroke="#506c51" strokeWidth="1.2" />
      </g>}
    </svg>
  )
}
