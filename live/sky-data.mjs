// Data for the sky chart (Pages "Sky" app, idea #83): bright stars, constellation figures,
// a few deep-sky objects and a city list. Everything is inline; nothing is fetched.
//
// Stars: J2000 positions of the brightest stars (to about V 2.9) plus the fainter stars the
// figures need. Each row is [id, RA "h m s", Dec "±d m s", V magnitude]. ids are Bayer-style
// ("aOri" = α Orionis) so the figures below can name them.

const STAR_ROWS = [
  // the 25 brightest
  ['aCMa', '06 45 09', '-16 42 58', -1.46], ['aCar', '06 23 57', '-52 41 44', -0.74],
  ['aCen', '14 39 36', '-60 50 02', -0.27], ['aBoo', '14 15 40', '+19 10 57', -0.05],
  ['aLyr', '18 36 56', '+38 47 01', 0.03], ['aAur', '05 16 41', '+45 59 53', 0.08],
  ['bOri', '05 14 32', '-08 12 06', 0.13], ['aCMi', '07 39 18', '+05 13 30', 0.34],
  ['aEri', '01 37 43', '-57 14 12', 0.46], ['aOri', '05 55 10', '+07 24 25', 0.50],
  ['bCen', '14 03 49', '-60 22 23', 0.61], ['aAql', '19 50 47', '+08 52 06', 0.76],
  ['aCru', '12 26 36', '-63 05 57', 0.76], ['aTau', '04 35 55', '+16 30 33', 0.86],
  ['aSco', '16 29 24', '-26 25 55', 0.96], ['aVir', '13 25 12', '-11 09 41', 0.97],
  ['bGem', '07 45 19', '+28 01 34', 1.14], ['aPsA', '22 57 39', '-29 37 20', 1.16],
  ['aCyg', '20 41 26', '+45 16 49', 1.25], ['bCru', '12 47 43', '-59 41 19', 1.25],
  ['aLeo', '10 08 22', '+11 58 02', 1.35], ['eCMa', '06 58 38', '-28 58 20', 1.50],
  ['aGem', '07 34 36', '+31 53 18', 1.58], ['gCru', '12 31 10', '-57 06 48', 1.63],
  ['lSco', '17 33 36', '-37 06 14', 1.62],
  // other bright stars
  ['gOri', '05 25 08', '+06 20 59', 1.64], ['bTau', '05 26 18', '+28 36 27', 1.65],
  ['bCar', '09 13 12', '-69 43 02', 1.69], ['eOri', '05 36 13', '-01 12 07', 1.69],
  ['aGru', '22 08 14', '-46 57 40', 1.74], ['zOri', '05 40 46', '-01 56 34', 1.77],
  ['eUMa', '12 54 02', '+55 57 35', 1.77], ['aUMa', '11 03 44', '+61 45 03', 1.79],
  ['aPer', '03 24 19', '+49 51 40', 1.79], ['dCMa', '07 08 23', '-26 23 36', 1.84],
  ['eSgr', '18 24 10', '-34 23 05', 1.85], ['eCar', '08 22 31', '-59 30 34', 1.86],
  ['hUMa', '13 47 32', '+49 18 48', 1.86], ['thSco', '17 37 19', '-42 59 52', 1.87],
  ['bAur', '05 59 32', '+44 56 51', 1.90], ['aTrA', '16 48 40', '-69 01 40', 1.91],
  ['gGem', '06 37 43', '+16 23 57', 1.93], ['aPav', '20 25 39', '-56 44 06', 1.94],
  ['aUMi', '02 31 49', '+89 15 51', 1.98], ['bCMa', '06 22 42', '-17 57 21', 1.98],
  ['aHya', '09 27 35', '-08 39 31', 1.98], ['aAri', '02 07 10', '+23 27 45', 2.00],
  ['gLeo', '10 19 58', '+19 50 29', 2.08], ['bCet', '00 43 35', '-17 59 12', 2.04],
  ['sSgr', '18 55 16', '-26 17 48', 2.05], ['thCen', '14 06 41', '-36 22 12', 2.06],
  ['aAnd', '00 08 23', '+29 05 26', 2.06], ['bAnd', '01 09 44', '+35 37 14', 2.07],
  ['kOri', '05 47 45', '-09 40 11', 2.07], ['bUMi', '14 50 42', '+74 09 20', 2.08],
  ['aOph', '17 34 56', '+12 33 36', 2.08], ['bPer', '03 08 10', '+40 57 20', 2.10],
  ['gAnd', '02 03 54', '+42 19 47', 2.10], ['bLeo', '11 49 04', '+14 34 19', 2.14],
  ['gCas', '00 56 43', '+60 43 00', 2.20], ['gCen', '12 41 31', '-48 57 35', 2.17],
  ['iCar', '09 17 05', '-59 16 31', 2.21], ['aCrB', '15 34 41', '+26 42 53', 2.22],
  ['zUMa', '13 23 56', '+54 55 31', 2.23], ['gCyg', '20 22 14', '+40 15 24', 2.23],
  ['aCas', '00 40 30', '+56 32 14', 2.24], ['gDra', '17 56 36', '+51 29 20', 2.24],
  ['dOri', '05 32 00', '-00 17 57', 2.23], ['bCas', '00 09 11', '+59 08 59', 2.27],
  ['dSco', '16 00 20', '-22 37 18', 2.29], ['eSco', '16 50 10', '-34 17 36', 2.29],
  ['aLup', '14 41 56', '-47 23 17', 2.30], ['eCen', '13 39 53', '-53 27 59', 2.30],
  ['hCen', '14 35 30', '-42 09 28', 2.31], ['bUMa', '11 01 51', '+56 22 57', 2.37],
  ['eBoo', '14 44 59', '+27 04 27', 2.37], ['ePeg', '21 44 11', '+09 52 30', 2.39],
  ['kSco', '17 42 29', '-39 01 48', 2.39], ['aPhe', '00 26 17', '-42 18 22', 2.40],
  ['bPeg', '23 03 46', '+28 04 58', 2.42], ['hOph', '17 10 23', '-15 43 29', 2.43],
  ['gUMa', '11 53 50', '+53 41 41', 2.44], ['aCep', '21 18 35', '+62 35 08', 2.45],
  ['hCMa', '07 24 06', '-29 18 11', 2.45], ['kVel', '09 22 07', '-55 00 38', 2.47],
  ['eCyg', '20 46 13', '+33 58 13', 2.48], ['aPeg', '23 04 46', '+15 12 19', 2.48],
  ['dCen', '12 08 22', '-50 43 21', 2.52], ['aCet', '03 02 17', '+04 05 23', 2.53],
  ['zCen', '13 55 32', '-47 17 18', 2.55], ['zOph', '16 37 10', '-10 34 02', 2.56],
  ['dLeo', '11 14 06', '+20 31 25', 2.56], ['aLep', '05 32 44', '-17 49 20', 2.58],
  ['gCrv', '12 15 48', '-17 32 31', 2.59], ['zSgr', '19 02 37', '-29 52 49', 2.60],
  ['bLib', '15 17 00', '-09 22 59', 2.61], ['bSco', '16 05 26', '-19 48 19', 2.62],
  ['thAur', '05 59 43', '+37 12 45', 2.62], ['aSer', '15 44 16', '+06 25 32', 2.63],
  ['bAri', '01 54 38', '+20 48 29', 2.64], ['bCrv', '12 34 23', '-23 23 48', 2.65],
  ['aCol', '05 39 39', '-34 04 27', 2.65], ['hBoo', '13 54 41', '+18 23 52', 2.68],
  ['dCas', '01 25 49', '+60 14 07', 2.68], ['iAur', '04 56 60', '+33 09 58', 2.69],
  ['aMus', '12 37 11', '-69 08 08', 2.69], ['uSco', '17 30 46', '-37 17 45', 2.70],
  ['dSgr', '18 20 60', '-29 49 41', 2.70], ['gAql', '19 46 15', '+10 36 48', 2.72],
  ['aLib', '14 50 53', '-16 02 30', 2.75], ['thCar', '10 42 57', '-64 23 40', 2.76],
  ['bHer', '16 30 13', '+21 29 22', 2.77], ['bDra', '17 30 26', '+52 18 05', 2.79],
  ['bEri', '05 07 51', '-05 05 11', 2.79], ['dCru', '12 15 09', '-58 44 56', 2.79],
  ['lSgr', '18 27 58', '-25 25 18', 2.81], ['zHer', '16 41 17', '+31 36 10', 2.81],
  ['tSco', '16 35 53', '-28 12 58', 2.82], ['bTrA', '15 55 09', '-63 25 50', 2.83],
  ['eVir', '13 02 11', '+10 57 33', 2.83], ['aAra', '17 31 50', '-49 52 34', 2.84],
  ['bLep', '05 28 15', '-20 45 34', 2.84], ['dCap', '21 47 02', '-16 07 38', 2.85],
  ['zPer', '03 54 08', '+31 53 01', 2.85], ['bAra', '17 25 18', '-55 31 47', 2.85],
  ['aTuc', '22 18 30', '-60 15 35', 2.86], ['gTrA', '15 18 55', '-68 40 46', 2.87],
  ['dCyg', '19 44 58', '+45 07 51', 2.87], ['thEri', '02 58 16', '-40 18 17', 2.88],
  ['pSco', '15 58 51', '-26 06 51', 2.89], ['aCVn', '12 56 02', '+38 19 06', 2.90],
  ['bAqr', '21 31 34', '-05 34 16', 2.90], ['sSco', '16 21 11', '-25 35 34', 2.90],
  ['gVel', '08 09 32', '-47 20 12', 1.83], ['dVel', '08 44 42', '-54 42 30', 1.96],
  ['lVel', '09 07 60', '-43 25 57', 2.21], ['zPup', '08 03 35', '-40 00 12', 2.21],
  ['aAqr', '22 05 47', '-00 19 11', 2.95], ['dCrv', '12 29 52', '-16 30 56', 2.95],
  ['eLeo', '09 45 51', '+23 46 27', 2.98], ['gSgr', '18 05 48', '-30 25 27', 2.99],
  // fainter stars the figures need
  ['m1Sco', '16 51 52', '-38 02 51', 3.04], ['gBoo', '14 32 05', '+38 18 30', 3.03],
  ['mGem', '06 22 58', '+22 30 49', 2.87], ['eGem', '06 43 56', '+25 07 52', 3.06],
  ['dGem', '07 20 07', '+21 58 56', 3.53], ['eCrv', '12 10 07', '-22 37 11', 3.00],
  ['phSgr', '18 45 39', '-26 59 27', 3.17], ['tSgr', '19 06 56', '-27 40 13', 3.32],
  ['iSco', '17 47 35', '-40 07 37', 3.03], ['hSco', '17 12 09', '-43 14 21', 3.33],
  ['z2Sco', '16 54 35', '-42 21 41', 3.62], ['bCyg', '19 30 43', '+27 57 35', 3.08],
  ['pHer', '17 15 03', '+36 48 33', 3.16], ['hHer', '16 42 54', '+38 55 20', 3.53],
  ['eHer', '17 00 17', '+30 55 35', 3.92], ['bBoo', '15 01 57', '+40 23 26', 3.50],
  ['dBoo', '15 15 30', '+33 18 53', 3.47], ['rBoo', '14 31 50', '+30 22 17', 3.58],
  ['gLyr', '18 58 57', '+32 41 22', 3.25], ['bLyr', '18 50 05', '+33 21 46', 3.52],
  ['z1Lyr', '18 44 46', '+37 36 18', 4.36], ['d2Lyr', '18 54 30', '+36 53 55', 4.30],
  ['bAql', '19 55 19', '+06 24 24', 3.71], ['lOri', '05 35 08', '+09 56 03', 3.33],
  ['thLeo', '11 14 14', '+15 25 46', 3.33], ['zLeo', '10 16 41', '+23 25 02', 3.44],
  ['hLeo', '10 07 20', '+16 45 45', 3.48], ['mLeo', '09 52 46', '+26 00 25', 3.88],
  ['eCas', '01 54 24', '+63 40 12', 3.38], ['dUMa', '12 15 26', '+57 01 57', 3.31],
  ['gUMi', '15 20 44', '+71 50 02', 3.00], ['zUMi', '15 44 04', '+77 47 40', 4.32],
  ['eUMi', '16 45 58', '+82 02 14', 4.21], ['dUMi', '17 32 13', '+86 35 11', 4.36],
  ['hUMi', '16 17 30', '+75 45 19', 4.95], ['gPeg', '00 13 14', '+15 11 01', 2.83],
  ['zPeg', '22 41 28', '+10 49 53', 3.40], ['thPeg', '22 10 12', '+06 11 52', 3.53],
  ['dAnd', '00 39 20', '+30 51 40', 3.27], ['gTau', '04 19 48', '+15 37 39', 3.65],
  ['dTau', '04 22 56', '+17 32 33', 3.76], ['eTau', '04 28 37', '+19 10 50', 3.53],
  ['thTau', '04 28 40', '+15 52 15', 3.40], ['zTau', '05 37 39', '+21 08 33', 3.00],
];

const hms = (s) => { const [h, m, x] = s.split(' ').map(Number); return h + m / 60 + x / 3600; };
const dms = (s) => {
  const sign = s.trim()[0] === '-' ? -1 : 1;
  const [d, m, x] = s.replace(/^[+-]/, '').split(' ').map(Number);
  return sign * (d + m / 60 + x / 3600);
};

/** [raHours, decDeg, mag, id]: the shape live/astro.mjs skyScene() reads. */
export const STARS = STAR_ROWS.map(([id, ra, dec, mag]) => [hms(ra), dms(dec), mag, id]);
const INDEX = new Map(STARS.map((s, i) => [s[3], i]));

/** Names shown next to the brightest stars. */
export const STAR_NAMES = {
  aCMa: { en: 'Sirius', zh: '天狼星' }, aCar: { en: 'Canopus', zh: '老人星' },
  aCen: { en: 'Alpha Centauri', zh: '南门二' }, aBoo: { en: 'Arcturus', zh: '大角星' },
  aLyr: { en: 'Vega', zh: '织女星' }, aAur: { en: 'Capella', zh: '五车二' },
  bOri: { en: 'Rigel', zh: '参宿七' }, aCMi: { en: 'Procyon', zh: '南河三' },
  aEri: { en: 'Achernar', zh: '水委一' }, aOri: { en: 'Betelgeuse', zh: '参宿四' },
  bCen: { en: 'Hadar', zh: '马腹一' }, aAql: { en: 'Altair', zh: '牛郎星' },
  aCru: { en: 'Acrux', zh: '十字架二' }, aTau: { en: 'Aldebaran', zh: '毕宿五' },
  aSco: { en: 'Antares', zh: '心宿二' }, aVir: { en: 'Spica', zh: '角宿一' },
  bGem: { en: 'Pollux', zh: '北河三' }, aPsA: { en: 'Fomalhaut', zh: '北落师门' },
  aCyg: { en: 'Deneb', zh: '天津四' }, bCru: { en: 'Mimosa', zh: '十字架三' },
  aLeo: { en: 'Regulus', zh: '轩辕十四' }, aGem: { en: 'Castor', zh: '北河二' },
  aUMi: { en: 'Polaris', zh: '北极星' },
};

// Constellation figures as polylines of star ids. `dashed` marks an asterism made of
// stars from several constellations.
const FIGURE_ROWS = {
  orion: [['lOri', 'aOri', 'zOri', 'kOri'], ['lOri', 'gOri', 'dOri', 'bOri'], ['dOri', 'eOri', 'zOri'], ['aOri', 'gOri']],
  bigDipper: [['aUMa', 'bUMa', 'gUMa', 'dUMa', 'aUMa'], ['dUMa', 'eUMa', 'zUMa', 'hUMa']],
  littleDipper: [['aUMi', 'dUMi', 'eUMi', 'zUMi', 'bUMi', 'gUMi', 'hUMi', 'zUMi']],
  cassiopeia: [['bCas', 'aCas', 'gCas', 'dCas', 'eCas']],
  cygnus: [['aCyg', 'gCyg', 'bCyg'], ['eCyg', 'gCyg', 'dCyg']],
  lyra: [['aLyr', 'z1Lyr', 'd2Lyr', 'gLyr', 'bLyr', 'z1Lyr']],
  aquila: [['gAql', 'aAql', 'bAql']],
  summerTriangle: [['aLyr', 'aCyg', 'aAql', 'aLyr']],
  scorpius: [['bSco', 'dSco', 'pSco'], ['dSco', 'sSco', 'aSco', 'tSco', 'eSco', 'm1Sco', 'z2Sco', 'hSco', 'thSco', 'iSco', 'kSco', 'lSco', 'uSco']],
  sagittarius: [['gSgr', 'dSgr', 'eSgr', 'gSgr'], ['dSgr', 'lSgr', 'phSgr', 'dSgr'], ['eSgr', 'zSgr', 'phSgr'], ['phSgr', 'sSgr', 'tSgr', 'zSgr']],
  leo: [['eLeo', 'mLeo', 'zLeo', 'gLeo', 'hLeo', 'aLeo'], ['gLeo', 'dLeo', 'bLeo', 'thLeo', 'aLeo'], ['dLeo', 'thLeo']],
  taurus: [['bTau', 'eTau', 'dTau', 'gTau', 'thTau', 'aTau', 'zTau']],
  auriga: [['aAur', 'bAur', 'thAur', 'bTau', 'iAur', 'aAur']],
  gemini: [['aGem', 'eGem', 'mGem'], ['bGem', 'dGem', 'gGem'], ['aGem', 'bGem']],
  canisMajor: [['bCMa', 'aCMa', 'dCMa', 'eCMa'], ['dCMa', 'hCMa']],
  crux: [['aCru', 'gCru'], ['bCru', 'dCru']],
  centaurus: [['aCen', 'bCen']],
  pegasus: [['aPeg', 'bPeg', 'aAnd', 'gPeg', 'aPeg'], ['aPeg', 'zPeg', 'thPeg', 'ePeg']],
  andromeda: [['aAnd', 'dAnd', 'bAnd', 'gAnd']],
  bootes: [['aBoo', 'eBoo', 'dBoo', 'bBoo', 'gBoo', 'rBoo', 'aBoo'], ['aBoo', 'hBoo']],
  hercules: [['zHer', 'eHer', 'pHer', 'hHer', 'zHer'], ['zHer', 'bHer']],
  corvus: [['gCrv', 'dCrv', 'bCrv', 'eCrv', 'gCrv']],
  triangulumAustrale: [['aTrA', 'bTrA', 'gTrA', 'aTrA']],
};
export const DASHED = new Set(['summerTriangle']);

export const FIGURE_NAMES = {
  orion: { en: 'Orion', zh: '猎户座' }, bigDipper: { en: 'Big Dipper', zh: '北斗七星' },
  littleDipper: { en: 'Little Dipper', zh: '小北斗' }, cassiopeia: { en: 'Cassiopeia', zh: '仙后座' },
  cygnus: { en: 'Cygnus', zh: '天鹅座' }, lyra: { en: 'Lyra', zh: '天琴座' },
  aquila: { en: 'Aquila', zh: '天鹰座' }, summerTriangle: { en: 'Summer Triangle', zh: '夏季大三角' },
  scorpius: { en: 'Scorpius', zh: '天蝎座' }, sagittarius: { en: 'Sagittarius', zh: '人马座' },
  leo: { en: 'Leo', zh: '狮子座' }, taurus: { en: 'Taurus', zh: '金牛座' },
  auriga: { en: 'Auriga', zh: '御夫座' }, gemini: { en: 'Gemini', zh: '双子座' },
  canisMajor: { en: 'Canis Major', zh: '大犬座' }, crux: { en: 'Southern Cross', zh: '南十字' },
  centaurus: { en: 'Pointers', zh: '指极星' }, pegasus: { en: 'Pegasus', zh: '飞马座' },
  andromeda: { en: 'Andromeda', zh: '仙女座' }, bootes: { en: 'Boötes', zh: '牧夫座' },
  hercules: { en: 'Hercules', zh: '武仙座' }, corvus: { en: 'Corvus', zh: '乌鸦座' },
  triangulumAustrale: { en: 'Southern Triangle', zh: '南三角座' },
};

/** {figure: [[starIndex, …], …]}: polylines into STARS. */
export const FIGURES = Object.fromEntries(Object.entries(FIGURE_ROWS).map(([k, lines]) => [k, lines.map((line) => line.map((id) => {
  const i = INDEX.get(id);
  if (i == null) throw new Error(`sky-data: figure ${k} names unknown star ${id}`);
  return i;
}))]));

/** Deep-sky objects: [id, raHours, decDeg, mag, {en, zh}]. */
export const DEEP_SKY = [
  ['m31', hms('00 42 44'), dms('+41 16 09'), 3.4, { en: 'Andromeda Galaxy', zh: '仙女座星系' }],
  ['m42', hms('05 35 17'), dms('-05 23 28'), 4.0, { en: 'Orion Nebula', zh: '猎户座大星云' }],
  ['m45', hms('03 47 24'), dms('+24 07 00'), 1.6, { en: 'Pleiades', zh: '昴星团' }],
  ['lmc', hms('05 23 35'), dms('-69 45 22'), 0.9, { en: 'Large Magellanic Cloud', zh: '大麦哲伦云' }],
  ['smc', hms('00 52 45'), dms('-72 49 43'), 2.7, { en: 'Small Magellanic Cloud', zh: '小麦哲伦云' }],
];

// Cities: [id, English, 中文, lat, lon, IANA time zone, ISO country]. Coordinates are city
// centres to about 0.01°. Albany is first because it is the default.
export const CITIES = [
  ['albany', 'Albany, NY', '奥尔巴尼（纽约州）', 42.6526, -73.7562, 'America/New_York', 'US'],
  ['new-york', 'New York', '纽约', 40.7128, -74.0060, 'America/New_York', 'US'],
  ['boston', 'Boston', '波士顿', 42.3601, -71.0589, 'America/New_York', 'US'],
  ['philadelphia', 'Philadelphia', '费城', 39.9526, -75.1652, 'America/New_York', 'US'],
  ['washington', 'Washington, D.C.', '华盛顿', 38.9072, -77.0369, 'America/New_York', 'US'],
  ['pittsburgh', 'Pittsburgh', '匹兹堡', 40.4406, -79.9959, 'America/New_York', 'US'],
  ['buffalo', 'Buffalo', '布法罗', 42.8864, -78.8784, 'America/New_York', 'US'],
  ['rochester', 'Rochester, NY', '罗切斯特', 43.1566, -77.6088, 'America/New_York', 'US'],
  ['syracuse', 'Syracuse', '雪城', 43.0481, -76.1474, 'America/New_York', 'US'],
  ['ithaca', 'Ithaca', '伊萨卡', 42.4440, -76.5019, 'America/New_York', 'US'],
  ['atlanta', 'Atlanta', '亚特兰大', 33.7490, -84.3880, 'America/New_York', 'US'],
  ['miami', 'Miami', '迈阿密', 25.7617, -80.1918, 'America/New_York', 'US'],
  ['orlando', 'Orlando', '奥兰多', 28.5383, -81.3792, 'America/New_York', 'US'],
  ['charlotte', 'Charlotte', '夏洛特', 35.2271, -80.8431, 'America/New_York', 'US'],
  ['raleigh', 'Raleigh', '罗利', 35.7796, -78.6382, 'America/New_York', 'US'],
  ['detroit', 'Detroit', '底特律', 42.3314, -83.0458, 'America/Detroit', 'US'],
  ['chicago', 'Chicago', '芝加哥', 41.8781, -87.6298, 'America/Chicago', 'US'],
  ['minneapolis', 'Minneapolis', '明尼阿波利斯', 44.9778, -93.2650, 'America/Chicago', 'US'],
  ['st-louis', 'St. Louis', '圣路易斯', 38.6270, -90.1994, 'America/Chicago', 'US'],
  ['nashville', 'Nashville', '纳什维尔', 36.1627, -86.7816, 'America/Chicago', 'US'],
  ['new-orleans', 'New Orleans', '新奥尔良', 29.9511, -90.0715, 'America/Chicago', 'US'],
  ['dallas', 'Dallas', '达拉斯', 32.7767, -96.7970, 'America/Chicago', 'US'],
  ['houston', 'Houston', '休斯敦', 29.7604, -95.3698, 'America/Chicago', 'US'],
  ['austin', 'Austin', '奥斯汀', 30.2672, -97.7431, 'America/Chicago', 'US'],
  ['denver', 'Denver', '丹佛', 39.7392, -104.9903, 'America/Denver', 'US'],
  ['salt-lake-city', 'Salt Lake City', '盐湖城', 40.7608, -111.8910, 'America/Denver', 'US'],
  ['phoenix', 'Phoenix', '凤凰城', 33.4484, -112.0740, 'America/Phoenix', 'US'],
  ['las-vegas', 'Las Vegas', '拉斯维加斯', 36.1699, -115.1398, 'America/Los_Angeles', 'US'],
  ['los-angeles', 'Los Angeles', '洛杉矶', 34.0522, -118.2437, 'America/Los_Angeles', 'US'],
  ['san-diego', 'San Diego', '圣迭戈', 32.7157, -117.1611, 'America/Los_Angeles', 'US'],
  ['san-francisco', 'San Francisco', '旧金山', 37.7749, -122.4194, 'America/Los_Angeles', 'US'],
  ['san-jose', 'San Jose', '圣何塞', 37.3382, -121.8863, 'America/Los_Angeles', 'US'],
  ['seattle', 'Seattle', '西雅图', 47.6062, -122.3321, 'America/Los_Angeles', 'US'],
  ['portland', 'Portland, OR', '波特兰（俄勒冈州）', 45.5152, -122.6784, 'America/Los_Angeles', 'US'],
  ['anchorage', 'Anchorage', '安克雷奇', 61.2181, -149.9003, 'America/Anchorage', 'US'],
  ['honolulu', 'Honolulu', '檀香山', 21.3069, -157.8583, 'Pacific/Honolulu', 'US'],
  ['mauna-kea', 'Mauna Kea', '冒纳凯阿火山', 19.8207, -155.4681, 'Pacific/Honolulu', 'US'],
  ['toronto', 'Toronto', '多伦多', 43.6532, -79.3832, 'America/Toronto', 'CA'],
  ['montreal', 'Montreal', '蒙特利尔', 45.5017, -73.5673, 'America/Toronto', 'CA'],
  ['ottawa', 'Ottawa', '渥太华', 45.4215, -75.6972, 'America/Toronto', 'CA'],
  ['vancouver', 'Vancouver', '温哥华', 49.2827, -123.1207, 'America/Vancouver', 'CA'],
  ['calgary', 'Calgary', '卡尔加里', 51.0447, -114.0719, 'America/Edmonton', 'CA'],
  ['mexico-city', 'Mexico City', '墨西哥城', 19.4326, -99.1332, 'America/Mexico_City', 'MX'],
  ['havana', 'Havana', '哈瓦那', 23.1136, -82.3666, 'America/Havana', 'CU'],
  ['bogota', 'Bogotá', '波哥大', 4.7110, -74.0721, 'America/Bogota', 'CO'],
  ['lima', 'Lima', '利马', -12.0464, -77.0428, 'America/Lima', 'PE'],
  ['santiago', 'Santiago, Chile', '圣地亚哥（智利）', -33.4489, -70.6693, 'America/Santiago', 'CL'],
  ['atacama', 'San Pedro de Atacama', '阿塔卡马', -22.9087, -68.1997, 'America/Santiago', 'CL'],
  ['buenos-aires', 'Buenos Aires', '布宜诺斯艾利斯', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires', 'AR'],
  ['sao-paulo', 'São Paulo', '圣保罗', -23.5505, -46.6333, 'America/Sao_Paulo', 'BR'],
  ['rio', 'Rio de Janeiro', '里约热内卢', -22.9068, -43.1729, 'America/Sao_Paulo', 'BR'],
  ['london', 'London', '伦敦', 51.5074, -0.1278, 'Europe/London', 'GB'],
  ['edinburgh', 'Edinburgh', '爱丁堡', 55.9533, -3.1883, 'Europe/London', 'GB'],
  ['dublin', 'Dublin', '都柏林', 53.3498, -6.2603, 'Europe/Dublin', 'IE'],
  ['paris', 'Paris', '巴黎', 48.8566, 2.3522, 'Europe/Paris', 'FR'],
  ['berlin', 'Berlin', '柏林', 52.5200, 13.4050, 'Europe/Berlin', 'DE'],
  ['munich', 'Munich', '慕尼黑', 48.1351, 11.5820, 'Europe/Berlin', 'DE'],
  ['amsterdam', 'Amsterdam', '阿姆斯特丹', 52.3676, 4.9041, 'Europe/Amsterdam', 'NL'],
  ['brussels', 'Brussels', '布鲁塞尔', 50.8503, 4.3517, 'Europe/Brussels', 'BE'],
  ['zurich', 'Zurich', '苏黎世', 47.3769, 8.5417, 'Europe/Zurich', 'CH'],
  ['geneva', 'Geneva', '日内瓦', 46.2044, 6.1432, 'Europe/Zurich', 'CH'],
  ['vienna', 'Vienna', '维也纳', 48.2082, 16.3738, 'Europe/Vienna', 'AT'],
  ['prague', 'Prague', '布拉格', 50.0755, 14.4378, 'Europe/Prague', 'CZ'],
  ['warsaw', 'Warsaw', '华沙', 52.2297, 21.0122, 'Europe/Warsaw', 'PL'],
  ['budapest', 'Budapest', '布达佩斯', 47.4979, 19.0402, 'Europe/Budapest', 'HU'],
  ['rome', 'Rome', '罗马', 41.9028, 12.4964, 'Europe/Rome', 'IT'],
  ['milan', 'Milan', '米兰', 45.4642, 9.1900, 'Europe/Rome', 'IT'],
  ['madrid', 'Madrid', '马德里', 40.4168, -3.7038, 'Europe/Madrid', 'ES'],
  ['barcelona', 'Barcelona', '巴塞罗那', 41.3851, 2.1734, 'Europe/Madrid', 'ES'],
  ['lisbon', 'Lisbon', '里斯本', 38.7223, -9.1393, 'Europe/Lisbon', 'PT'],
  ['athens', 'Athens', '雅典', 37.9838, 23.7275, 'Europe/Athens', 'GR'],
  ['istanbul', 'Istanbul', '伊斯坦布尔', 41.0082, 28.9784, 'Europe/Istanbul', 'TR'],
  ['stockholm', 'Stockholm', '斯德哥尔摩', 59.3293, 18.0686, 'Europe/Stockholm', 'SE'],
  ['oslo', 'Oslo', '奥斯陆', 59.9139, 10.7522, 'Europe/Oslo', 'NO'],
  ['tromso', 'Tromsø', '特罗姆瑟', 69.6492, 18.9553, 'Europe/Oslo', 'NO'],
  ['copenhagen', 'Copenhagen', '哥本哈根', 55.6761, 12.5683, 'Europe/Copenhagen', 'DK'],
  ['helsinki', 'Helsinki', '赫尔辛基', 60.1699, 24.9384, 'Europe/Helsinki', 'FI'],
  ['reykjavik', 'Reykjavík', '雷克雅未克', 64.1466, -21.9426, 'Atlantic/Reykjavik', 'IS'],
  ['moscow', 'Moscow', '莫斯科', 55.7558, 37.6173, 'Europe/Moscow', 'RU'],
  ['kyiv', 'Kyiv', '基辅', 50.4501, 30.5234, 'Europe/Kiev', 'UA'],
  ['dubai', 'Dubai', '迪拜', 25.2048, 55.2708, 'Asia/Dubai', 'AE'],
  ['tel-aviv', 'Tel Aviv', '特拉维夫', 32.0853, 34.7818, 'Asia/Jerusalem', 'IL'],
  ['riyadh', 'Riyadh', '利雅得', 24.7136, 46.6753, 'Asia/Riyadh', 'SA'],
  ['tehran', 'Tehran', '德黑兰', 35.6892, 51.3890, 'Asia/Tehran', 'IR'],
  ['cairo', 'Cairo', '开罗', 30.0444, 31.2357, 'Africa/Cairo', 'EG'],
  ['casablanca', 'Casablanca', '卡萨布兰卡', 33.5731, -7.5898, 'Africa/Casablanca', 'MA'],
  ['lagos', 'Lagos', '拉各斯', 6.5244, 3.3792, 'Africa/Lagos', 'NG'],
  ['nairobi', 'Nairobi', '内罗毕', -1.2921, 36.8219, 'Africa/Nairobi', 'KE'],
  ['johannesburg', 'Johannesburg', '约翰内斯堡', -26.2041, 28.0473, 'Africa/Johannesburg', 'ZA'],
  ['cape-town', 'Cape Town', '开普敦', -33.9249, 18.4241, 'Africa/Johannesburg', 'ZA'],
  ['mumbai', 'Mumbai', '孟买', 19.0760, 72.8777, 'Asia/Kolkata', 'IN'],
  ['delhi', 'New Delhi', '新德里', 28.6139, 77.2090, 'Asia/Kolkata', 'IN'],
  ['bengaluru', 'Bengaluru', '班加罗尔', 12.9716, 77.5946, 'Asia/Kolkata', 'IN'],
  ['karachi', 'Karachi', '卡拉奇', 24.8607, 67.0011, 'Asia/Karachi', 'PK'],
  ['dhaka', 'Dhaka', '达卡', 23.8103, 90.4125, 'Asia/Dhaka', 'BD'],
  ['kathmandu', 'Kathmandu', '加德满都', 27.7172, 85.3240, 'Asia/Kathmandu', 'NP'],
  ['colombo', 'Colombo', '科伦坡', 6.9271, 79.8612, 'Asia/Colombo', 'LK'],
  ['beijing', 'Beijing', '北京', 39.9042, 116.4074, 'Asia/Shanghai', 'CN'],
  ['shanghai', 'Shanghai', '上海', 31.2304, 121.4737, 'Asia/Shanghai', 'CN'],
  ['tianjin', 'Tianjin', '天津', 39.3434, 117.3616, 'Asia/Shanghai', 'CN'],
  ['chongqing', 'Chongqing', '重庆', 29.5630, 106.5516, 'Asia/Shanghai', 'CN'],
  ['guangzhou', 'Guangzhou', '广州', 23.1291, 113.2644, 'Asia/Shanghai', 'CN'],
  ['shenzhen', 'Shenzhen', '深圳', 22.5431, 114.0579, 'Asia/Shanghai', 'CN'],
  ['hangzhou', 'Hangzhou', '杭州', 30.2741, 120.1551, 'Asia/Shanghai', 'CN'],
  ['nanjing', 'Nanjing', '南京', 32.0603, 118.7969, 'Asia/Shanghai', 'CN'],
  ['suzhou', 'Suzhou', '苏州', 31.2989, 120.5853, 'Asia/Shanghai', 'CN'],
  ['wuxi', 'Wuxi', '无锡', 31.4912, 120.3119, 'Asia/Shanghai', 'CN'],
  ['ningbo', 'Ningbo', '宁波', 29.8683, 121.5440, 'Asia/Shanghai', 'CN'],
  ['wuhan', 'Wuhan', '武汉', 30.5928, 114.3055, 'Asia/Shanghai', 'CN'],
  ['chengdu', 'Chengdu', '成都', 30.5728, 104.0668, 'Asia/Shanghai', 'CN'],
  ['xian', "Xi'an", '西安', 34.3416, 108.9398, 'Asia/Shanghai', 'CN'],
  ['changsha', 'Changsha', '长沙', 28.2282, 112.9388, 'Asia/Shanghai', 'CN'],
  ['zhengzhou', 'Zhengzhou', '郑州', 34.7466, 113.6253, 'Asia/Shanghai', 'CN'],
  ['jinan', 'Jinan', '济南', 36.6512, 117.1201, 'Asia/Shanghai', 'CN'],
  ['qingdao', 'Qingdao', '青岛', 36.0671, 120.3826, 'Asia/Shanghai', 'CN'],
  ['shenyang', 'Shenyang', '沈阳', 41.8057, 123.4315, 'Asia/Shanghai', 'CN'],
  ['dalian', 'Dalian', '大连', 38.9140, 121.6147, 'Asia/Shanghai', 'CN'],
  ['harbin', 'Harbin', '哈尔滨', 45.8038, 126.5350, 'Asia/Shanghai', 'CN'],
  ['changchun', 'Changchun', '长春', 43.8171, 125.3235, 'Asia/Shanghai', 'CN'],
  ['hefei', 'Hefei', '合肥', 31.8206, 117.2272, 'Asia/Shanghai', 'CN'],
  ['fuzhou', 'Fuzhou', '福州', 26.0745, 119.2965, 'Asia/Shanghai', 'CN'],
  ['xiamen', 'Xiamen', '厦门', 24.4798, 118.0894, 'Asia/Shanghai', 'CN'],
  ['nanchang', 'Nanchang', '南昌', 28.6820, 115.8579, 'Asia/Shanghai', 'CN'],
  ['kunming', 'Kunming', '昆明', 25.0389, 102.7183, 'Asia/Shanghai', 'CN'],
  ['guiyang', 'Guiyang', '贵阳', 26.6470, 106.6302, 'Asia/Shanghai', 'CN'],
  ['nanning', 'Nanning', '南宁', 22.8170, 108.3665, 'Asia/Shanghai', 'CN'],
  ['haikou', 'Haikou', '海口', 20.0440, 110.1999, 'Asia/Shanghai', 'CN'],
  ['sanya', 'Sanya', '三亚', 18.2528, 109.5119, 'Asia/Shanghai', 'CN'],
  ['taiyuan', 'Taiyuan', '太原', 37.8706, 112.5489, 'Asia/Shanghai', 'CN'],
  ['shijiazhuang', 'Shijiazhuang', '石家庄', 38.0428, 114.5149, 'Asia/Shanghai', 'CN'],
  ['hohhot', 'Hohhot', '呼和浩特', 40.8424, 111.7490, 'Asia/Shanghai', 'CN'],
  ['lanzhou', 'Lanzhou', '兰州', 36.0611, 103.8343, 'Asia/Shanghai', 'CN'],
  ['xining', 'Xining', '西宁', 36.6171, 101.7782, 'Asia/Shanghai', 'CN'],
  ['yinchuan', 'Yinchuan', '银川', 38.4872, 106.2309, 'Asia/Shanghai', 'CN'],
  ['urumqi', 'Ürümqi', '乌鲁木齐', 43.8256, 87.6168, 'Asia/Shanghai', 'CN'],
  ['lhasa', 'Lhasa', '拉萨', 29.6520, 91.1721, 'Asia/Shanghai', 'CN'],
  ['ngari', 'Ngari (Shiquanhe)', '阿里（狮泉河）', 32.5000, 80.1000, 'Asia/Shanghai', 'CN'],
  ['foshan', 'Foshan', '佛山', 23.0215, 113.1214, 'Asia/Shanghai', 'CN'],
  ['dongguan', 'Dongguan', '东莞', 23.0207, 113.7518, 'Asia/Shanghai', 'CN'],
  ['zhuhai', 'Zhuhai', '珠海', 22.2710, 113.5767, 'Asia/Shanghai', 'CN'],
  ['hong-kong', 'Hong Kong', '香港', 22.3193, 114.1694, 'Asia/Hong_Kong', 'HK'],
  ['macau', 'Macau', '澳门', 22.1987, 113.5439, 'Asia/Macau', 'MO'],
  ['taipei', 'Taipei', '台北', 25.0330, 121.5654, 'Asia/Taipei', 'TW'],
  ['taichung', 'Taichung', '台中', 24.1477, 120.6736, 'Asia/Taipei', 'TW'],
  ['kaohsiung', 'Kaohsiung', '高雄', 22.6273, 120.3014, 'Asia/Taipei', 'TW'],
  ['ulaanbaatar', 'Ulaanbaatar', '乌兰巴托', 47.8864, 106.9057, 'Asia/Ulaanbaatar', 'MN'],
  ['tokyo', 'Tokyo', '东京', 35.6762, 139.6503, 'Asia/Tokyo', 'JP'],
  ['osaka', 'Osaka', '大阪', 34.6937, 135.5023, 'Asia/Tokyo', 'JP'],
  ['kyoto', 'Kyoto', '京都', 35.0116, 135.7681, 'Asia/Tokyo', 'JP'],
  ['sapporo', 'Sapporo', '札幌', 43.0618, 141.3545, 'Asia/Tokyo', 'JP'],
  ['fukuoka', 'Fukuoka', '福冈', 33.5904, 130.4017, 'Asia/Tokyo', 'JP'],
  ['naha', 'Naha (Okinawa)', '那霸（冲绳）', 26.2124, 127.6809, 'Asia/Tokyo', 'JP'],
  ['seoul', 'Seoul', '首尔', 37.5665, 126.9780, 'Asia/Seoul', 'KR'],
  ['busan', 'Busan', '釜山', 35.1796, 129.0756, 'Asia/Seoul', 'KR'],
  ['singapore', 'Singapore', '新加坡', 1.3521, 103.8198, 'Asia/Singapore', 'SG'],
  ['kuala-lumpur', 'Kuala Lumpur', '吉隆坡', 3.1390, 101.6869, 'Asia/Kuala_Lumpur', 'MY'],
  ['bangkok', 'Bangkok', '曼谷', 13.7563, 100.5018, 'Asia/Bangkok', 'TH'],
  ['hanoi', 'Hanoi', '河内', 21.0278, 105.8342, 'Asia/Ho_Chi_Minh', 'VN'],
  ['ho-chi-minh', 'Ho Chi Minh City', '胡志明市', 10.8231, 106.6297, 'Asia/Ho_Chi_Minh', 'VN'],
  ['phnom-penh', 'Phnom Penh', '金边', 11.5564, 104.9282, 'Asia/Phnom_Penh', 'KH'],
  ['yangon', 'Yangon', '仰光', 16.8409, 96.1735, 'Asia/Yangon', 'MM'],
  ['manila', 'Manila', '马尼拉', 14.5995, 120.9842, 'Asia/Manila', 'PH'],
  ['jakarta', 'Jakarta', '雅加达', -6.2088, 106.8456, 'Asia/Jakarta', 'ID'],
  ['bali', 'Bali (Denpasar)', '巴厘岛（登巴萨）', -8.6705, 115.2126, 'Asia/Makassar', 'ID'],
  ['sydney', 'Sydney', '悉尼', -33.8688, 151.2093, 'Australia/Sydney', 'AU'],
  ['melbourne', 'Melbourne', '墨尔本', -37.8136, 144.9631, 'Australia/Melbourne', 'AU'],
  ['brisbane', 'Brisbane', '布里斯班', -27.4698, 153.0251, 'Australia/Brisbane', 'AU'],
  ['perth', 'Perth', '珀斯', -31.9505, 115.8605, 'Australia/Perth', 'AU'],
  ['adelaide', 'Adelaide', '阿德莱德', -34.9285, 138.6007, 'Australia/Adelaide', 'AU'],
  ['auckland', 'Auckland', '奥克兰', -36.8485, 174.7633, 'Pacific/Auckland', 'NZ'],
  ['wellington', 'Wellington', '惠灵顿', -41.2865, 174.7762, 'Pacific/Auckland', 'NZ'],
  ['longyearbyen', 'Longyearbyen (Svalbard)', '朗伊尔城（斯瓦尔巴）', 78.2232, 15.6267, 'Arctic/Longyearbyen', 'NO'],
];

/** The data skyScene() wants: stars, deep-sky objects and every figure's segments as
 *  [starIndex, starIndex, figure] triples. */
export const SKY_DATA = {
  stars: STARS,
  deepSky: DEEP_SKY,
  lines: Object.entries(FIGURES).flatMap(([k, polylines]) => polylines.flatMap((pl) =>
    pl.slice(1).map((j, n) => [pl[n], j, k]))),
};

// ---------------------------------------------------------------- R3.3 (additive)
// New in R3.3; nothing above changes (scripts/sky_day.mjs reads STAR_NAMES and SKY_DATA).

/** The seven stars of the Big Dipper, named so the chart can select them (ideas #132, #133):
 *  the IAU names in English, the traditional Chinese names in Chinese. */
export const DIPPER_NAMES = {
  aUMa: { en: 'Dubhe', zh: '天枢' }, bUMa: { en: 'Merak', zh: '天璇' }, gUMa: { en: 'Phecda', zh: '天玑' },
  dUMa: { en: 'Megrez', zh: '天权' }, eUMa: { en: 'Alioth', zh: '玉衡' }, zUMa: { en: 'Mizar', zh: '开阳' },
  hUMa: { en: 'Alkaid', zh: '摇光' },
};

// How far the 23 named stars are (idea #132), as [low, high] in light years: the range the
// published measurements span (1 pc = 3.26156 ly; a parallax of p mas is 3261.56 / p ly).
// Unless noted, the range is the 1-sigma interval of the Hipparcos parallax in F. van Leeuwen,
// "Validation of the new Hipparcos reduction", A&A 474, 653 (2007), as quoted on each star's
// Wikipedia page (checked 2026-11-14). Where newer work disagrees, the range covers both:
//   aCMa  also W. Bond et al. 2017, ApJ 840, 70: 378.9 ± 1.4 mas
//   aCen  R. Akeson et al. 2021, AJ 162, 14: 750.81 ± 0.38 mas (instead of Hipparcos)
//   aAur  also Gaia DR3 for its companion Capella H: 74.95 mas (43.5 ly)
//   bOri  also Gaia DR3 for its companion Rigel BC: 3.235 ± 0.055 mas (991 to 1026 ly)
//   aOri  hard to measure: 408 ly (Neuhäuser et al. 2022), 498 (Hipparcos), 548 (Joyce et al.
//         2020) and 724 (Harper et al. 2017, radio and Hipparcos); shown as 400 to 700
//   bCen  also A. Pigulski et al. 2016, A&A 588, A55: 9.04 ± 0.04 mas (dynamical parallax)
//   aCru  also Gaia DR3 for its companion α Cru C: 9.396 ± 0.129 mas (342 to 352 ly)
//   aCyg  hard to measure: 1,412 ly (Hipparcos) to 2,616 ly (Schiller & Przybilla 2008, A&A
//         479, 849; 802 pc); a 2026 estimate is 622 ± 20 pc (2,029 ly); shown as 1,400 to 2,600
//   aGem  G. Torres et al. 2022, ApJ 941, 8: 66.356 ± 0.041 mas (instead of Hipparcos)
//   aUMi  also Gaia DR3 for its companion Polaris B: 136.9 ± 0.3 pc (446.5 ly)
// The page says "about" and gives the range when it is wide.
export const STAR_DIST = {
  aCMa: [8.57, 8.64], aCar: [294, 326], aCen: [4.342, 4.346], aBoo: [36.5, 36.94], aLyr: [24.98, 25.11],
  aAur: [42.55, 43.52], bOri: [792, 1026], aCMi: [11.41, 11.51], aEri: [136.1, 142.9], aOri: [400, 700],
  bCen: [359, 417], aAql: [16.68, 16.78], aCru: [307, 353], aTau: [65.6, 67.7], aSco: [473, 667],
  aVir: [237, 264], bGem: [33.69, 33.88], aPsA: [25.04, 25.22], aCyg: [1400, 2600], bCru: [257, 304],
  aLeo: [78.6, 80.0], aGem: [49.12, 49.18], aUMi: [426, 448],
};

// Traditional Chinese star names and one line each (idea #133, shown in Chinese only): `name`
// is the traditional name (星官 and its number) where it differs from the label the chart uses,
// `story` a source or a well-known fact. The names follow the standard Chinese star names; the
// 水委, 马腹 and 十字架 asterisms are among the 23 near the south pole that Xu Guangqi's
// 崇祯历书 added in the late Ming (zh.wikipedia.org, 近南极星区). Quotations: 屈原《九歌·东君》; 《史记·天官书》 ("狼比地有大星，
// 曰南极老人。老人见，治安；不见，兵起", "大角者，天王帝廷", "参为白虎", "轩辕，黄龙体",
// "斗为帝车，运于中央，临制四乡"); 《诗经·小雅·渐渐之石》; 《诗经·豳风·七月》; 杜甫《赠卫八处士》;
// 《鹖冠子·环流》.
export const CN_STARS = {
  aCMa: { story: '属井宿。屈原《九歌·东君》：“举长矢兮射天狼。”' },
  aCar: { story: '又称南极老人星、寿星。《史记·天官书》：“老人见，治安；不见，兵起。”' },
  aCen: { story: '南门星官的第二颗，属角宿。它是离太阳最近的恒星系统。' },
  aBoo: { story: '属亢宿。《史记·天官书》：“大角者，天王帝廷。”' },
  aLyr: { name: '织女一', story: '七夕故事里，她和银河对岸的牛郎星（河鼓二）隔河相望。' },
  aAur: { story: '五车星官的第二颗，属毕宿；五车就是五辆车。' },
  bOri: { story: '参宿的第七颗。《史记·天官书》说“参为白虎”，参宿是西方白虎七宿的最后一宿。' },
  aCMi: { story: '南河星官的第三颗，和北河二、北河三分列井宿的南北两边。' },
  aEri: { story: '水委星官的第一颗，是明末新增的近南极星官，在中原看不到。' },
  aOri: { story: '参宿的第四颗。杜甫诗“人生不相见，动如参与商”：参宿和商星（心宿二）一升一落，难得相见。' },
  bCen: { story: '马腹星官的第一颗，是明末新增的近南极星官。' },
  aAql: { name: '河鼓二', story: '俗称牛郎星，和银河对岸的织女星隔河相望。' },
  aCru: { story: '十字架星官的第二颗。十字架是明末新增的近南极星官，就是南十字座。' },
  aTau: { story: '毕宿的第五颗。《诗经》“月离于毕，俾滂沱矣”：古人认为月亮走到毕宿就要下大雨。' },
  aSco: { story: '又名大火。《诗经》“七月流火”说的就是它：农历七月黄昏它偏西下沉，天气开始转凉。' },
  aVir: { story: '角宿的第一颗。角宿是东方苍龙七宿的第一宿，象征龙角。' },
  bGem: { story: '北河星官的第三颗，比旁边的北河二还亮。' },
  aPsA: { story: '属室宿，名字的意思是“军营的北门”。《史记·天官书》说羽林天军旁“有一大星为北落”。' },
  aCyg: { story: '天津星官的第四颗。天津的意思是银河上的渡口。' },
  bCru: { story: '十字架星官的第三颗，南十字座第二亮的星。' },
  aLeo: { story: '轩辕星官的第十四颗。《史记·天官书》：“轩辕，黄龙体。”' },
  aGem: { story: '北河星官的第二颗。它其实是由六颗星组成的聚星系统。' },
  aUMi: { name: '勾陈一', story: '因为岁差，北天极在星空里慢慢移动，古代的北极星并不是它。' },
  aUMa: { story: '北斗第一星。把天璇到天枢的连线延长约五倍，就能找到北极星。' },
  bUMa: { story: '北斗第二星，和天枢合称指极星。' },
  gUMa: { story: '北斗第三星。《史记·天官书》：“斗为帝车，运于中央，临制四乡。”' },
  dUMa: { story: '北斗第四星，北斗七星里最暗的一颗。' },
  eUMa: { story: '北斗第五星，北斗七星里最亮的一颗。' },
  zUMa: { story: '北斗第六星。身旁有一颗暗星叫“辅”，眼力好的人能分辨出来。' },
  hUMa: { story: '北斗第七星，在斗柄的末端。《鹖冠子》：“斗柄东指，天下皆春。”' },
};

/** The city the Sky app opens on for a visitor in a time zone (idea #102), where it is not
 *  simply the first city in CITIES with that zone, and the older zone names some browsers
 *  still report. Nothing is looked up online: the browser already knows its time zone. */
export const TZ_CITY = {
  'America/Los_Angeles': 'los-angeles', 'Asia/Kolkata': 'delhi', 'Asia/Calcutta': 'delhi',
  'Asia/Saigon': 'hanoi', 'Asia/Katmandu': 'kathmandu', 'Asia/Rangoon': 'yangon', 'Europe/Kyiv': 'kyiv',
  'America/Buenos_Aires': 'buenos-aires', 'Asia/Ulan_Bator': 'ulaanbaatar', 'Asia/Dacca': 'dhaka',
  'Asia/Macao': 'macau', 'Asia/Chongqing': 'chongqing', 'Asia/Chungking': 'chongqing', 'Asia/Harbin': 'harbin',
  'Asia/Tel_Aviv': 'tel-aviv', 'Asia/Istanbul': 'istanbul', 'Europe/Belfast': 'london', 'America/Montreal': 'montreal',
  'US/Eastern': 'albany', 'US/Central': 'chicago', 'US/Mountain': 'denver', 'US/Pacific': 'los-angeles',
  'US/Arizona': 'phoenix', 'US/Alaska': 'anchorage', 'US/Hawaii': 'honolulu', 'PRC': 'beijing', 'ROC': 'taipei',
  'ROK': 'seoul', 'Japan': 'tokyo', 'Hongkong': 'hong-kong', 'Singapore': 'singapore', 'GB': 'london',
  'Australia/ACT': 'sydney', 'Australia/NSW': 'sydney', 'Australia/Canberra': 'sydney', 'NZ': 'auckland',
};

// ---------------------------------------------------------------- R3.3 batch 1b (additive)
// The eight major meteor showers (idea #93), from the International Meteor Organization's
// Meteor Shower Calendar 2026 (ed. J. Rendtel, IMO INFO(3-25)): Table 5 (the working list:
// activity period, the solar longitude λ☉ (J2000) of the maximum, the radiant at the maximum and
// the ZHR) and Table 6 (the radiant's drift, every five days). The 2027 calendar (IMO INFO(3-26))
// lists the same λ☉; showerPeak() in live/astro.mjs turns λ☉ into a date for any year, which
// matches both calendars' maximum dates. `peak` is the 2026 date, `where` the radiant's
// constellation. A ZHR is the rate under ideal skies with the radiant overhead; these are the
// 2026 list's (the 2027 list gives the Perseids 110 and marks three showers "+" for that year).
export const METEOR_SHOWERS = [
  { id: 'QUA', name: { en: 'Quadrantids', zh: '象限仪座流星雨' }, where: { en: 'northern Boötes', zh: '牧夫座北部' }, lam: 283.15,
    peak: [1, 3], from: [12, 28], to: [1, 12], zhr: 80, radiant: [[12, 30, 226, 50], [12, 31, 228, 50], [1, 3, 230, 49], [1, 5, 231, 49], [1, 10, 234, 48]] },
  { id: 'LYR', name: { en: 'Lyrids', zh: '天琴座流星雨' }, where: { en: 'Lyra', zh: '天琴座' }, lam: 32.32,
    peak: [4, 22], from: [4, 14], to: [4, 30], zhr: 18, radiant: [[4, 15, 263, 34], [4, 20, 269, 34], [4, 22, 271, 34], [4, 25, 274, 34], [4, 30, 279, 34]] },
  { id: 'ETA', name: { en: 'Eta Aquariids', zh: '宝瓶座η流星雨' }, where: { en: 'Aquarius', zh: '宝瓶座' }, lam: 45.5,
    peak: [5, 6], from: [4, 19], to: [5, 28], zhr: 50,
    radiant: [[4, 20, 323, -7], [4, 25, 328, -5], [4, 30, 332, -3], [5, 5, 337, -1], [5, 6, 338, -1], [5, 10, 341, 1], [5, 15, 345, 3], [5, 20, 349, 5], [5, 25, 353, 7]] },
  { id: 'PER', name: { en: 'Perseids', zh: '英仙座流星雨' }, where: { en: 'Perseus', zh: '英仙座' }, lam: 140.0,
    peak: [8, 13], from: [7, 17], to: [8, 24], zhr: 100,
    radiant: [[7, 15, 6, 50], [7, 20, 11, 52], [7, 25, 22, 53], [7, 30, 29, 54], [8, 5, 37, 56], [8, 10, 45, 57], [8, 13, 48, 58], [8, 15, 51, 58], [8, 20, 57, 58], [8, 25, 63, 58]] },
  { id: 'ORI', name: { en: 'Orionids', zh: '猎户座流星雨' }, where: { en: 'Orion', zh: '猎户座' }, lam: 208,
    peak: [10, 21], from: [10, 2], to: [11, 7], zhr: 20,
    radiant: [[10, 5, 85, 14], [10, 10, 88, 15], [10, 15, 91, 15], [10, 20, 94, 16], [10, 21, 95, 16], [10, 25, 98, 16], [10, 30, 101, 16], [11, 5, 105, 17]] },
  { id: 'LEO', name: { en: 'Leonids', zh: '狮子座流星雨' }, where: { en: 'Leo', zh: '狮子座' }, lam: 235.27,
    peak: [11, 17], from: [11, 6], to: [11, 30], zhr: 15,
    radiant: [[11, 10, 147, 24], [11, 15, 150, 23], [11, 17, 152, 22], [11, 20, 153, 21], [11, 25, 156, 20], [11, 30, 159, 19]] },
  { id: 'GEM', name: { en: 'Geminids', zh: '双子座流星雨' }, where: { en: 'Gemini', zh: '双子座' }, lam: 262.2,
    peak: [12, 14], from: [12, 4], to: [12, 20], zhr: 150, radiant: [[12, 5, 103, 33], [12, 10, 108, 33], [12, 14, 112, 33], [12, 15, 113, 33], [12, 20, 118, 32]] },
  { id: 'URS', name: { en: 'Ursids', zh: '小熊座流星雨' }, where: { en: 'Ursa Minor', zh: '小熊座' }, lam: 270.7,
    peak: [12, 22], from: [12, 17], to: [12, 26], zhr: 10, radiant: [[12, 20, 217, 76], [12, 22, 217, 76], [12, 25, 217, 74]] },
];

// Eclipses from 2026 to 2035 (idea #94), from NASA's eclipse pages by Fred Espenak
// (eclipse.gsfc.nasa.gov, read 2026-11-14): "Solar Eclipses: 2021 to 2030" and "2031 to 2040",
// and the "Five Millennium Catalog of Lunar Eclipses" (2001 to 2100).
// Solar: [date, TD of greatest eclipse, type, magnitude, where the partial eclipse is seen, the
// central path (total, annular or hybrid)], the regions shortened from NASA's. Whether a city sees
// a solar eclipse is not worked out here: its shape on the ground is too intricate to sum up.
export const SOLAR_ECLIPSES = [
  ['2026-02-17', '12:13:05', 'annular', 0.963, { en: 'southern South America, southern Africa and Antarctica', zh: '南美洲南部、非洲南部和南极洲' }, { en: 'Antarctica', zh: '南极洲' }],
  ['2026-08-12', '17:47:05', 'total', 1.039, { en: 'northern North America, western Africa and Europe', zh: '北美洲北部、非洲西部和欧洲' }, { en: 'the Arctic, Greenland, Iceland and Spain', zh: '北极地区、格陵兰、冰岛和西班牙' }],
  ['2027-02-06', '16:00:47', 'annular', 0.928, { en: 'South America, Antarctica, western Africa and southern Africa', zh: '南美洲、南极洲以及非洲西部和南部' }, { en: 'Chile, Argentina and the Atlantic', zh: '智利、阿根廷和大西洋' }],
  ['2027-08-02', '10:07:49', 'total', 1.079, { en: 'Africa, Europe, the Middle East, western Asia and southern Asia', zh: '非洲、欧洲、中东以及亚洲西部和南部' }, { en: 'Spain, northern Africa, the Arabian Peninsula and the Horn of Africa', zh: '西班牙、北非、阿拉伯半岛和非洲之角' }],
  ['2028-01-26', '15:08:58', 'annular', 0.921, { en: 'eastern North America, Central and South America, western Europe and northwestern Africa', zh: '北美洲东部、中美洲、南美洲、欧洲西部和非洲西北部' }, { en: 'Ecuador, Peru, Brazil, Suriname, Spain and Portugal', zh: '厄瓜多尔、秘鲁、巴西、苏里南、西班牙和葡萄牙' }],
  ['2028-07-22', '02:56:39', 'total', 1.056, { en: 'Southeast Asia, the East Indies, Australia and New Zealand', zh: '东南亚、东印度群岛、澳大利亚和新西兰' }, { en: 'Australia and New Zealand', zh: '澳大利亚和新西兰' }],
  ['2029-01-14', '17:13:47', 'partial', 0.871, { en: 'North and Central America', zh: '北美洲和中美洲' }, null],
  ['2029-06-12', '04:06:13', 'partial', 0.458, { en: 'the Arctic, Scandinavia, Alaska, northern Asia and northern Canada', zh: '北极地区、斯堪的纳维亚、阿拉斯加、亚洲北部和加拿大北部' }, null],
  ['2029-07-11', '15:37:18', 'partial', 0.230, { en: 'southern Chile and Argentina', zh: '智利和阿根廷南部' }, null],
  ['2029-12-05', '15:03:57', 'partial', 0.891, { en: 'southern Argentina, southern Chile and Antarctica', zh: '阿根廷和智利南部以及南极洲' }, null],
  ['2030-06-01', '06:29:13', 'annular', 0.944, { en: 'Europe, northern Africa, the Middle East, Asia, the Arctic and Alaska', zh: '欧洲、非洲北部、中东、亚洲、北极地区和阿拉斯加' }, { en: 'Algeria, Tunisia, Greece, Turkey, Russia, northern China and Japan', zh: '阿尔及利亚、突尼斯、希腊、土耳其、俄罗斯、中国北部和日本' }],
  ['2030-11-25', '06:51:37', 'total', 1.047, { en: 'southern Africa, the southern Indian Ocean, the East Indies, Australia and Antarctica', zh: '非洲南部、南印度洋、东印度群岛、澳大利亚和南极洲' }, { en: 'Botswana, South Africa and Australia', zh: '博茨瓦纳、南非和澳大利亚' }],
  ['2031-05-21', '07:16:04', 'annular', 0.959, { en: 'Africa, southern Asia, the East Indies and Australia', zh: '非洲、亚洲南部、东印度群岛和澳大利亚' }, { en: 'Angola, Congo, Zambia, Tanzania, southern India, Malaysia and Indonesia', zh: '安哥拉、刚果、赞比亚、坦桑尼亚、印度南部、马来西亚和印度尼西亚' }],
  ['2031-11-14', '21:07:30', 'hybrid', 1.011, { en: 'the Pacific, the southern United States, Central America and northwestern South America', zh: '太平洋、美国南部、中美洲和南美洲西北部' }, { en: 'the Pacific and Panama', zh: '太平洋和巴拿马' }],
  ['2032-05-09', '13:26:42', 'annular', 0.996, { en: 'southern South America and southern Africa', zh: '南美洲南部和非洲南部' }, { en: 'the southern Atlantic', zh: '南大西洋' }],
  ['2032-11-03', '05:34:12', 'partial', 0.855, { en: 'Asia', zh: '亚洲' }, null],
  ['2033-03-30', '18:02:35', 'total', 1.046, { en: 'North America', zh: '北美洲' }, { en: 'eastern Russia and Alaska', zh: '俄罗斯东部和阿拉斯加' }],
  ['2033-09-23', '13:54:31', 'partial', 0.689, { en: 'southern South America and Antarctica', zh: '南美洲南部和南极洲' }, null],
  ['2034-03-20', '10:18:45', 'total', 1.046, { en: 'Africa, Europe and western Asia', zh: '非洲、欧洲和亚洲西部' }, { en: 'Nigeria, Cameroon, Chad, Sudan, Egypt, Saudi Arabia, Iran, Afghanistan, Pakistan, India and China', zh: '尼日利亚、喀麦隆、乍得、苏丹、埃及、沙特阿拉伯、伊朗、阿富汗、巴基斯坦、印度和中国' }],
  ['2034-09-12', '16:19:27', 'annular', 0.974, { en: 'Central and South America', zh: '中美洲和南美洲' }, { en: 'Chile, Bolivia, Argentina, Paraguay and Brazil', zh: '智利、玻利维亚、阿根廷、巴拉圭和巴西' }],
  ['2035-03-09', '23:05:53', 'annular', 0.992, { en: 'Australia, New Zealand, the southern Pacific, Mexico and Antarctica', zh: '澳大利亚、新西兰、南太平洋、墨西哥和南极洲' }, { en: 'New Zealand and the Pacific', zh: '新西兰和太平洋' }],
  ['2035-09-02', '01:56:46', 'total', 1.032, { en: 'eastern Asia and the Pacific', zh: '亚洲东部和太平洋' }, { en: 'China, the Korean Peninsula, Japan and the Pacific', zh: '中国、朝鲜半岛、日本和太平洋' }],
];
// Lunar: [date, TD of greatest eclipse, ΔT (s), type, umbral magnitude, penumbral, partial and
// total durations (minutes, 0 when there is none), penumbral magnitude], as in NASA's catalogue.
// lunarEclipseTimes() in live/astro.mjs gives the phases in UT; the Sky app works out whether the
// Moon is up for them at the chosen place. 2027-07-18 only grazes the penumbra.
export const LUNAR_ECLIPSES = [
  ['2026-03-03', '11:34:52', 75, 'total', 1.1507, 338.6, 207.2, 58.3, 2.1838],
  ['2026-08-28', '04:14:04', 75, 'partial', 0.9299, 337.8, 198.1, 0, 1.9645],
  ['2027-02-20', '23:14:06', 76, 'penumbral', -0.0569, 241.0, 0, 0, 0.9266],
  ['2027-07-18', '16:04:09', 76, 'penumbral', -1.0680, 11.8, 0, 0, 0.0014],
  ['2027-08-17', '07:14:59', 76, 'penumbral', -0.5254, 218.6, 0, 0, 0.5456],
  ['2028-01-12', '04:14:13', 76, 'partial', 0.0662, 250.7, 56.0, 0, 1.0468],
  ['2028-07-06', '18:20:57', 77, 'partial', 0.3892, 310.6, 141.5, 0, 1.4266],
  ['2028-12-31', '16:53:15', 77, 'total', 1.2463, 336.2, 208.8, 71.3, 2.2742],
  ['2029-06-26', '03:23:22', 77, 'total', 1.8436, 335.1, 219.5, 101.9, 2.8266],
  ['2029-12-20', '22:43:12', 78, 'total', 1.1174, 358.0, 213.3, 53.7, 2.2008],
  ['2030-06-15', '18:34:34', 78, 'partial', 0.5025, 278.2, 144.4, 0, 1.4480],
  ['2030-12-09', '22:28:51', 78, 'penumbral', -0.1628, 279.2, 0, 0, 0.9416],
  ['2031-05-07', '03:52:02', 78, 'penumbral', -0.0904, 237.3, 0, 0, 0.8814],
  ['2031-06-05', '11:45:17', 78, 'penumbral', -0.8199, 95.6, 0, 0, 0.1292],
  ['2031-10-30', '07:46:45', 79, 'penumbral', -0.3204, 231.8, 0, 0, 0.7161],
  ['2032-04-25', '15:14:51', 79, 'total', 1.1913, 342.4, 211.2, 65.5, 2.2192],
  ['2032-10-18', '19:03:40', 79, 'total', 1.1028, 315.4, 195.9, 47.1, 2.0830],
  ['2033-04-14', '19:13:51', 80, 'total', 1.0944, 361.2, 215.0, 49.2, 2.1711],
  ['2033-10-08', '10:56:23', 80, 'total', 1.3497, 312.6, 202.4, 78.8, 2.3057],
  ['2034-04-03', '19:06:59', 80, 'penumbral', -0.2274, 265.4, 0, 0, 0.8545],
  ['2034-09-28', '02:47:37', 81, 'partial', 0.0144, 248.7, 26.7, 0, 0.9911],
  ['2035-02-22', '09:06:12', 81, 'penumbral', -0.0535, 255.7, 0, 0, 0.9652],
  ['2035-08-19', '01:12:15', 81, 'partial', 0.1037, 289.8, 76.5, 0, 1.1507],
];

// The star game (idea #103): the figures it uses (those with four or more lines that most
// people could learn) and one line about each, from the Greek myths behind the names and the
// standard star lore (the brightest stars, the asterisms inside them). In Chinese the Lyra line
// adds the Qixi story, whose weaver girl and cowherd are Vega and Altair.
export const GAME_FIGURES = ['orion', 'bigDipper', 'cassiopeia', 'cygnus', 'lyra', 'scorpius', 'sagittarius', 'leo', 'taurus',
  'auriga', 'gemini', 'canisMajor', 'pegasus', 'bootes', 'hercules', 'corvus', 'littleDipper'];
export const FIGURE_STORIES = {
  orion: { en: 'A hunter in Greek myth. The three stars in a row are his belt; red Betelgeuse is his shoulder and blue-white Rigel his foot.',
    zh: '希腊神话里的猎人。中间排成一行的三颗星是他的腰带；红色的参宿四在肩上，蓝白色的参宿七在脚边。' },
  bigDipper: { en: 'Seven bright stars of Ursa Major, the Great Bear. The two stars at the end of the bowl point to Polaris.',
    zh: '大熊座里最亮的七颗星。斗口外侧的两颗星（天璇、天枢）连起来延长，就指向北极星。' },
  littleDipper: { en: 'Ursa Minor, the Little Bear. Polaris, the North Star, is the end of its handle.',
    zh: '小熊座。北极星就在小北斗斗柄的末端。' },
  cassiopeia: { en: 'A vain queen of Greek myth, seated on her throne. Her five bright stars make a W, across Polaris from the Big Dipper.',
    zh: '希腊神话中自负的王后，坐在宝座上。五颗亮星组成 W 形，和北斗七星隔着北极星相对。' },
  cygnus: { en: 'The Swan, flying down the Milky Way. Deneb marks its tail; the same stars are called the Northern Cross.',
    zh: '天鹅座，沿着银河飞翔。天津四在天鹅尾部；这几颗星也叫北十字。' },
  lyra: { en: 'The lyre of Orpheus in Greek myth. Vega, one of the brightest stars in the sky, sits at its top.',
    zh: '希腊神话中俄耳甫斯的竖琴。织女星就在这里；它和银河对岸的牛郎星，就是七夕故事里的织女和牛郎。' },
  scorpius: { en: 'The scorpion that killed Orion in Greek myth. The two were set on opposite sides of the sky, so one rises as the other sets. Red Antares is its heart.',
    zh: '希腊神话中蜇死猎户的蝎子。两者被放在天空的两端，一个升起时另一个落下。红色的心宿二是它的心脏。' },
  sagittarius: { en: 'The Archer. Its brightest stars form the Teapot, and the center of our galaxy lies just beyond the spout.',
    zh: '人马座。几颗亮星组成一只“茶壶”，银河系的中心就在壶嘴外不远处。' },
  leo: { en: 'The lion that Heracles defeated in Greek myth. A backward question mark, the Sickle, makes its head and mane; Regulus is its heart.',
    zh: '希腊神话中被赫拉克勒斯打败的狮子。反写问号形的“镰刀”是狮头和鬃毛，轩辕十四是它的心脏。' },
  taurus: { en: 'The Bull. Orange Aldebaran is its eye, beside the V of the Hyades; the Pleiades ride on its shoulder.',
    zh: '金牛座。橙红色的毕宿五是牛眼，旁边是毕星团的 V 字，牛肩上是昴星团。' },
  auriga: { en: 'The Charioteer, often shown holding a goat: Capella, his brightest star, means little she-goat.',
    zh: '御夫座，常画成抱着一只山羊的驾车人：最亮的五车二，拉丁名的意思就是“小母山羊”。' },
  gemini: { en: 'The twins Castor and Pollux of Greek myth, a bright star at each head.',
    zh: '希腊神话中的双生子卡斯托耳和波吕丢刻斯，两颗亮星北河二和北河三是他们的头。' },
  canisMajor: { en: "Orion's larger hunting dog. Sirius, the brightest star of the night sky, is part of it.",
    zh: '大犬座，猎户的猎犬。夜空中最亮的恒星天狼星就在这里。' },
  pegasus: { en: 'The winged horse of Greek myth. Its body is the Great Square, one corner of which belongs to Andromeda.',
    zh: '希腊神话中的飞马。马身是“秋季四边形”，其中一角的星属于仙女座。' },
  bootes: { en: 'The Herdsman, who drives the Great Bear around the pole. Arcturus, at the foot of the kite, is the brightest star north of the celestial equator.',
    zh: '牧夫座，赶着大熊绕北极转的牧人。风筝形底部的大角星，是天赤道以北最亮的恒星。' },
  hercules: { en: 'The hero Heracles of Greek myth, kneeling. Four stars make the Keystone; the great star cluster M13 lies on one side of it.',
    zh: '希腊神话中单膝跪着的英雄赫拉克勒斯。四颗星组成“拱顶石”，著名的球状星团 M13 就在它的一边。' },
  corvus: { en: "Apollo's crow in Greek myth. Sent for water, it dawdled and lied, and was set in the sky beside the Cup and the Water Snake.",
    zh: '希腊神话中阿波罗的乌鸦。它去取水时贪玩迟归还说了谎，被放到天上，旁边是巨爵座（杯子）和长蛇座。' },
};
