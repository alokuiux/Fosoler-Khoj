// server.jsx — Fosoler Khoj · Module 2: Advisory, Monitoring & AI (single file)
//
// Contains everything Module 2 needs on the server:
//   weather + farm-decision advice, IoT sensor monitoring, water-pump registry (QR codes from the
//   Water_Pump dataset) with automatic irrigation, crop-disease detection, expert advisory and role dashboards.
//
// Two ways to run it (plain CommonJS, so Node runs the .jsx file directly):
//   1) Mounted by backend/server.js (default):  require('./server.jsx')({ app, db, auth, allow, fail })
//   2) Standalone for testing:                   node backend/server.jsx   (port MODULE2_PORT, default 4001)
//
// DATABASE SAFETY: only `CREATE TABLE IF NOT EXISTS` for new tables. The existing `users`,
// `listings` tables and all stored data are never altered. The AI key is read from backend/.env only.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

// ───────────── Water_Pump dataset: 100 pump QR codes (decoded from the images) ─────────────
const PUMP_CODES = [
  'NWAAALRZFYMC3', 'NWAAALRZFYML2', 'NWAAALRZFYMU5', 'NWAAALRZFYM44', 'NWAAALRZFYLC7', 'NWAAALRZFYLL6',
  'NWAAALRZFYLU9', 'NWAAALRZFYL48', 'NWAAALRZFYKCT', 'NWAAALRZFYKLS', 'NWAAALRZFYKUV', 'NWAAALRZFYK4U',
  'NWAAALRZFYJCX', 'NWAAALRZFYJLW', 'NWAAALRZFYJUZ', 'NWAAALRZFYJ4Y', 'NWAAALRZFYRCK', 'NWAAALRZFYRLJ',
  'NWAAALRZFYRUM', 'NWAAALRZFYR4L', 'NWAAALRZFYQCP', 'NWAAALRZFYQLN', 'NWAAALRZFYQUR', 'NWAAALRZFYQ4Q',
  'NWAAALRZFYPCB', 'NWAAALRZFYPLA', 'NWAAALRZFYPUD', 'NWAAALRZFYP4C', 'NWAAALRZFYNCF', 'NWAAALRZFYNLE',
  'NWAAALRZFYNUH', 'NWAAALRZFYN4G', 'NWAAALRZFYDD3', 'NWAAALRZFYDM2', 'NWAAALRZFYDV5', 'NWAAALRZFYD54',
  'NWAAALRZFYCD7', 'NWAAALRZFYCM6', 'NWAAALRZFYCV9', 'NWAAALRZFYC58', 'NWAAALRZFYBDT', 'NWAAALRZFYBMS',
  'NWAAALRZFYBVV', 'NWAAALRZFYB5U', 'NWAAALRZFYADX', 'NWAAALRZFYAMW', 'NWAAALRZFYAVZ', 'NWAAALRZFYA5Y',
  'NWAAALRZFYHDK', 'NWAAALRZFYHMJ', 'NWAAALRX3YHXQ', 'NWAAALRX3YH7R', 'NWAAALRX3YGFJ', 'NWAAALRX3YGPK',
  'NWAAALRX3YGXL', 'NWAAALRX3YG7M', 'NWAAALRX3YFFE', 'NWAAALRX3YFPF', 'NWAAALRX3YFXG', 'NWAAALRX3YF7H',
  'NWAAALRX3YEFA', 'NWAAALRX3YEPB', 'NWAAALRX3YEXC', 'NWAAALRX3YE7D', 'NWAAALRX3Y5G6', 'NWAAALRX3Y5Q7',
  'NWAAALRX3Y5Y8', 'NWAAALRX3Y589', 'NWAAALRX3Y4G2', 'NWAAALRX3Y4Q3', 'NWAAALRX3Y4Y4', 'NWAAALRX3Y485',
  'NWAAALRX3Y3GW', 'NWAAALRX3Y3QX', 'NWAAALRX3Y3YY', 'NWAAALRX3Y38Z', 'NWAAALRX3Y2GS', 'NWAAALRX3Y2QT',
  'NWAAALRX3Y2YU', 'NWAAALRX3Y28V', 'NWAAALRX3Y9GN', 'NWAAALRX3Y9QP', 'NWAAALRX3Y9YQ', 'NWAAALRX3Y98R',
  'NWAAALRX3Y8GJ', 'NWAAALRX3Y8QK', 'NWAAALRX3Y8YL', 'NWAAALRX3Y88M', 'NWAAALRX3Y7GE', 'NWAAALRX3Y7QF',
  'NWAAALRX3Y7YG', 'NWAAALRX3Y78H', 'NWAAALRX3Y6GA', 'NWAAALRX3Y6QB', 'NWAAALRX3Y6YC', 'NWAAALRX3Y68D',
  'NWAAALRX3YVH6', 'NWAAALRX3YVR7', 'NWAAALRX3YVZ8', 'NWAAALRX3YV99',
];

// ───────────── Prompts ─────────────
const PROMPTS = {
  diseaseVision: ({ crop, symptoms, sensor }) => `You are a crop pathologist helping a Bangladeshi farmer. Crop: ${crop || 'unknown'}. Reported symptoms: ${(symptoms || []).join(', ') || 'none'}. Sensor data: ${JSON.stringify(sensor || {})}.
Analyse the photo and reply with ONLY JSON (no markdown) in this shape:
{"healthy":boolean,"diagnoses":[{"id":"snake_case","type":"fungal|bacterial|viral|pest|nutrient|other","severity":"low|medium|high","confidence":0-100,"name":{"en":"","bn":""},"reason":{"en":"","bn":""},"treatment":{"en":"","bn":""},"prevention":{"en":"","bn":""}}],"notes":{"en":"","bn":""}}
Give at most 3 diagnoses, most likely first. Use only chemicals commonly available in Bangladesh and tell the farmer to follow the label. If the image is not a plant, set healthy=null and explain in notes.`,
};

// ───────────── Reference data ─────────────
// Static reference data for Module 2: district coordinates, weather codes,
// seasonal crop tips and the disease knowledge base used by the rule engine.

const DISTRICTS = {
  Dhaka: [23.8103, 90.4125], Gazipur: [23.9999, 90.4203], Narayanganj: [23.6238, 90.5], Tangail: [24.2513, 89.9167],
  Manikganj: [23.8617, 90.0003], Munshiganj: [23.5422, 90.5305], Narsingdi: [23.9322, 90.7151], Faridpur: [23.607, 89.8429],
  Gopalganj: [23.005, 89.8266], Madaripur: [23.1641, 90.1896], Shariatpur: [23.2423, 90.4348], Kishoreganj: [24.4449, 90.7766],
  Chattogram: [22.3569, 91.7832], "Cox's Bazar": [21.4272, 92.0058], Cumilla: [23.4607, 91.1809], Noakhali: [22.8696, 91.0995],
  Feni: [23.0159, 91.3976], Brahmanbaria: [23.9571, 91.1115], Chandpur: [23.2332, 90.6712], Lakshmipur: [22.9425, 90.8412],
  Bandarban: [22.1953, 92.2184], Rangamati: [22.7324, 92.2985], Khagrachhari: [23.1193, 91.9847],
  Rajshahi: [24.3745, 88.6042], Natore: [24.4206, 89.0], Naogaon: [24.7936, 88.9318], Chapainawabganj: [24.5965, 88.2775],
  Pabna: [24.0064, 89.2372], Bogura: [24.8465, 89.3773], Sirajganj: [24.4534, 89.7006], Joypurhat: [25.0968, 89.0227],
  Khulna: [22.8456, 89.5403], Jashore: [23.1664, 89.2081], Satkhira: [22.7185, 89.0705], Bagerhat: [22.6602, 89.7856],
  Kushtia: [23.9013, 89.1205], Jhenaidah: [23.5448, 89.1539], Magura: [23.4873, 89.4199], Narail: [23.1725, 89.5127],
  Chuadanga: [23.6401, 88.8418], Meherpur: [23.7622, 88.6318],
  Barishal: [22.701, 90.3535], Bhola: [22.6859, 90.6482], Patuakhali: [22.3596, 90.3299], Pirojpur: [22.5841, 89.972],
  Jhalokati: [22.6406, 90.1987], Barguna: [22.1591, 90.1126],
  Sylhet: [24.8949, 91.8687], Moulvibazar: [24.4829, 91.7774], Habiganj: [24.3745, 91.4156], Sunamganj: [25.0658, 91.4073],
  Rangpur: [25.7439, 89.2752], Dinajpur: [25.6217, 88.6354], Thakurgaon: [26.0337, 88.4616], Panchagarh: [26.3411, 88.5542],
  Nilphamari: [25.9317, 88.856], Lalmonirhat: [25.9923, 89.2847], Kurigram: [25.8054, 89.6361], Gaibandha: [25.3297, 89.543],
  Mymensingh: [24.7471, 90.4203], Jamalpur: [24.9375, 89.9372], Netrokona: [24.87, 90.7279], Sherpur: [25.0204, 90.0153],
};
const ALIAS = { comilla: 'Cumilla', chittagong: 'Chattogram', bogra: 'Bogura', jessore: 'Jashore', barisal: 'Barishal',
  coxsbazar: "Cox's Bazar", "cox's bazar": "Cox's Bazar", chapainawabganj: 'Chapainawabganj', nawabganj: 'Chapainawabganj',
  chittagongdivision: 'Chattogram', jhenaidah: 'Jhenaidah', jhenidah: 'Jhenaidah', moulvibazar: 'Moulvibazar', maulvibazar: 'Moulvibazar' };
const DIVISION_HQ = { Dhaka: 'Dhaka', Chattogram: 'Chattogram', Rajshahi: 'Rajshahi', Khulna: 'Khulna', Barishal: 'Barishal',
  Sylhet: 'Sylhet', Rangpur: 'Rangpur', Mymensingh: 'Mymensingh' };

const clean = (s) => String(s || '').toLowerCase().replace(/district|zila|জেলা/g, '').replace(/[^a-z' ]/g, '').trim();
function resolveLocation(district, division) {
  const lookup = (name) => {
    const c = clean(name);
    if (!c) return null;
    if (ALIAS[c] || ALIAS[c.replace(/[ ']/g, '')]) return ALIAS[c] || ALIAS[c.replace(/[ ']/g, '')];
    return Object.keys(DISTRICTS).find((d) => clean(d) === c) || null;
  };
  const d = lookup(district) || lookup(DIVISION_HQ[division] || division) || 'Dhaka';
  return { name: d, lat: DISTRICTS[d][0], lng: DISTRICTS[d][1] };
}

const WMO = [
  [[0], 'Clear sky', 'পরিষ্কার আকাশ', '☀️'], [[1], 'Mostly clear', 'প্রায় পরিষ্কার', '🌤️'], [[2], 'Partly cloudy', 'আংশিক মেঘলা', '⛅'],
  [[3], 'Overcast', 'মেঘাচ্ছন্ন', '☁️'], [[45, 48], 'Fog', 'কুয়াশা', '🌫️'], [[51, 53, 55, 56, 57], 'Drizzle', 'গুঁড়িগুঁড়ি বৃষ্টি', '🌦️'],
  [[61, 63, 80, 81], 'Rain', 'বৃষ্টি', '🌧️'], [[65, 66, 67, 82], 'Heavy rain', 'ভারী বৃষ্টি', '🌧️'], [[95, 96, 99], 'Thunderstorm', 'বজ্রসহ বৃষ্টি', '⛈️'],
];
const wmo = (c) => { const r = WMO.find(([codes]) => codes.includes(c)) || WMO[3]; return { en: r[1], bn: r[2], icon: r[3] }; };

// Bangladesh crop calendar tip per month (index 0 = January)
const MONTH_TIPS = [
  ['Boro rice seedlings are in the field: keep 2–3 cm water and protect from cold fog.', 'বোরো ধানের চারা মাঠে: ২–৩ সেমি পানি রাখুন এবং শীতের কুয়াশা থেকে রক্ষা করুন।'],
  ['Top-dress boro with urea and watch for blast on foggy mornings. Harvest mustard and potato.', 'বোরোতে ইউরিয়া উপরি প্রয়োগ করুন, কুয়াশায় ব্লাস্ট লক্ষ্য রাখুন। সরিষা ও আলু তুলুন।'],
  ['Prepare Aus land and sow jute. Harvest winter vegetables and store potatoes in cold storage.', 'আউশের জমি প্রস্তুত করুন ও পাট বুনুন। শীতের সবজি তুলুন, আলু হিমাগারে রাখুন।'],
  ['Boro heading stage: keep water, avoid spraying in strong sun. Sow Aus and early vegetables.', 'বোরোর থোড় অবস্থায় পানি রাখুন, কড়া রোদে স্প্রে এড়ান। আউশ ও আগাম সবজি বুনুন।'],
  ['Harvest boro quickly before pre-monsoon storms. Dry grain to 14% moisture before storing.', 'কালবৈশাখীর আগে দ্রুত বোরো কাটুন। সংরক্ষণের আগে ধান ১৪% আর্দ্রতায় শুকান।'],
  ['Monsoon begins: prepare Aman seedbeds and drain waterlogged fields. Sow jute if not done.', 'বর্ষা শুরু: আমনের বীজতলা তৈরি করুন, জলাবদ্ধ জমির পানি নিষ্কাশন করুন।'],
  ['Transplant Aman seedlings. Keep drainage clear and scout for stem borer and BPH.', 'আমন রোপণ করুন। নিষ্কাশন পরিষ্কার রাখুন, মাজরা ও বাদামি গাছফড়িং লক্ষ্য করুন।'],
  ['Aman tillering: apply urea in splits. Harvest jute and ret in clean water.', 'আমনের কুশি পর্যায়ে ভাগে ভাগে ইউরিয়া দিন। পাট কেটে পরিষ্কার পানিতে জাগ দিন।'],
  ['Watch for bacterial leaf blight after heavy rain. Prepare land for winter vegetables.', 'ভারী বৃষ্টির পর ব্যাকটেরিয়াজনিত পাতা পোড়া লক্ষ্য করুন। শীতের সবজির জমি প্রস্তুত করুন।'],
  ['Aman flowering to harvest. Sow early potato, mustard and winter vegetables after harvest.', 'আমন ফুল থেকে কাটার সময়। কাটার পর আগাম আলু, সরিষা ও শীতের সবজি বুনুন।'],
  ['Harvest Aman, dry grain well. Sow potato, wheat, mustard and vegetables. Prepare Boro seedbeds.', 'আমন কেটে ভালো করে শুকান। আলু, গম, সরিষা ও সবজি বুনুন। বোরোর বীজতলা করুন।'],
  ['Transplant Boro in cold-safe seedbeds, protect seedlings with polythene at night.', 'বোরো রোপণ করুন; রাতে চারা পলিথিন দিয়ে ঢেকে ঠান্ডা থেকে বাঁচান।'],
];

// ---- Disease knowledge base ----
// symptoms: codes the farmer can tick; env: favourable conditions (hum %, temp °C, wet = rainy/wet soil)
const SYMPTOMS = ['yellowing', 'brown_spots', 'dark_lesions', 'white_powder', 'wilting', 'curling', 'holes', 'rot', 'stunted', 'edge_drying'];
const DISEASES = [
  { id: 'rice_blast', crops: ['rice', 'paddy', 'ধান'], type: 'fungal', symptoms: ['brown_spots', 'dark_lesions', 'edge_drying'], env: { hum: [80, 100], temp: [20, 30] },
    name: ['Rice blast', 'ধানের ব্লাস্ট'], sev: 'high',
    treat: ['Spray tricyclazole or isoprothiolane as per label at first spots. Avoid excess urea; drain extra water.', 'প্রথম দাগ দেখা দিলে লেবেল অনুযায়ী ট্রাইসাইক্লাজোল বা আইসোপ্রোথায়োলেন স্প্রে করুন। অতিরিক্ত ইউরিয়া এড়ান, বাড়তি পানি বের করুন।'],
    prevent: ['Use resistant varieties, balanced fertiliser, and treat seed before sowing.', 'রোগ প্রতিরোধী জাত, সুষম সার ও বীজ শোধন করুন।'] },
  { id: 'bacterial_blight', crops: ['rice', 'paddy', 'ধান'], type: 'bacterial', symptoms: ['edge_drying', 'yellowing', 'wilting'], env: { wet: true, temp: [25, 34] },
    name: ['Bacterial leaf blight', 'ব্যাকটেরিয়াজনিত পাতা পোড়া'], sev: 'high',
    treat: ['Stop urea top-dressing, drain field, spray copper-based product. Apply potash to harden plants.', 'ইউরিয়া বন্ধ রাখুন, জমির পানি সরান, কপারজাতীয় ছত্রাকনাশক দিন, পটাশ প্রয়োগ করুন।'],
    prevent: ['Clean seed, avoid injuring seedlings, keep fields free of weeds.', 'পরিষ্কার বীজ ব্যবহার করুন, চারা ক্ষত এড়ান, আগাছা পরিষ্কার রাখুন।'] },
  { id: 'brown_spot', crops: ['rice', 'paddy', 'ধান'], type: 'fungal', symptoms: ['brown_spots', 'yellowing', 'stunted'], env: { temp: [25, 30] },
    name: ['Brown spot (rice)', 'ধানের বাদামি দাগ রোগ'], sev: 'medium',
    treat: ['Correct nutrient shortage (potash, zinc), spray mancozeb or propiconazole as per label.', 'পটাশ ও জিংকের ঘাটতি পূরণ করুন, লেবেল অনুযায়ী ম্যানকোজেব বা প্রোপিকোনাজল স্প্রে করুন।'],
    prevent: ['Seed treatment and balanced fertiliser reduce spread.', 'বীজ শোধন ও সুষম সার প্রয়োগে রোগ কমে।'] },
  { id: 'sheath_blight', crops: ['rice', 'paddy', 'ধান'], type: 'fungal', symptoms: ['dark_lesions', 'rot', 'wilting'], env: { hum: [85, 100], temp: [28, 34] },
    name: ['Sheath blight', 'শীথ ব্লাইট'], sev: 'high',
    treat: ['Reduce plant density, drain water, spray hexaconazole or validamycin as per label.', 'চারার ঘনত্ব কমান, পানি সরান, লেবেল অনুযায়ী হেক্সাকোনাজল বা ভ্যালিডামাইসিন দিন।'],
    prevent: ['Wider spacing and avoiding heavy nitrogen keep canopy dry.', 'বেশি ফাঁক রেখে রোপণ ও কম নাইট্রোজেন ব্যবহার করুন।'] },
  { id: 'late_blight', crops: ['potato', 'tomato', 'আলু', 'টমেটো'], type: 'fungal', symptoms: ['dark_lesions', 'rot', 'brown_spots', 'wilting'], env: { hum: [85, 100], temp: [10, 24], wet: true },
    name: ['Late blight', 'নাবিধ্বসা (লেট ব্লাইট)'], sev: 'high',
    treat: ['Spray metalaxyl+mancozeb or cymoxanil as per label every 7 days in humid weather; remove infected plants.', 'আর্দ্র আবহাওয়ায় লেবেল অনুযায়ী মেটালাক্সিল+ম্যানকোজেব বা সাইমোক্সানিল ৭ দিন পরপর স্প্রে করুন; আক্রান্ত গাছ সরান।'],
    prevent: ['Use certified seed, avoid overhead irrigation, earth-up potato mounds.', 'প্রত্যয়িত বীজ ব্যবহার করুন, উপর থেকে সেচ এড়ান, আলুর গোড়ায় মাটি দিন।'] },
  { id: 'early_blight', crops: ['potato', 'tomato', 'আলু', 'টমেটো'], type: 'fungal', symptoms: ['brown_spots', 'yellowing', 'edge_drying'], env: { temp: [24, 29] },
    name: ['Early blight', 'আগাম ধ্বসা (আর্লি ব্লাইট)'], sev: 'medium',
    treat: ['Remove lower infected leaves; spray mancozeb or chlorothalonil as per label.', 'নিচের আক্রান্ত পাতা সরান; লেবেল অনুযায়ী ম্যানকোজেব বা ক্লোরোথ্যালোনিল স্প্রে করুন।'],
    prevent: ['Rotate crops and mulch to stop soil splash.', 'ফসল পর্যায়ক্রম করুন ও মালচিং করুন।'] },
  { id: 'leaf_curl_virus', crops: ['tomato', 'chilli', 'chili', 'টমেটো', 'মরিচ'], type: 'viral', symptoms: ['curling', 'stunted', 'yellowing'], env: { temp: [25, 36] },
    name: ['Leaf curl virus (whitefly-borne)', 'পাতা কোঁকড়ানো ভাইরাস'], sev: 'high',
    treat: ['No cure: uproot badly infected plants, control whitefly with yellow sticky traps and neem or imidacloprid as per label.', 'প্রতিকার নেই: মারাত্মক আক্রান্ত গাছ তুলে ফেলুন, হলুদ আঠালো ফাঁদ, নিম বা লেবেল অনুযায়ী ইমিডাক্লোপ্রিড দিয়ে সাদা মাছি দমন করুন।'],
    prevent: ['Use net-covered seedbeds and resistant varieties.', 'নেট দিয়ে ঢাকা বীজতলা ও প্রতিরোধী জাত ব্যবহার করুন।'] },
  { id: 'powdery_mildew', crops: ['*'], type: 'fungal', symptoms: ['white_powder', 'yellowing'], env: { hum: [50, 80], temp: [20, 30] },
    name: ['Powdery mildew', 'পাউডারি মিলডিউ'], sev: 'medium',
    treat: ['Spray wettable sulphur or hexaconazole as per label; improve air flow.', 'লেবেল অনুযায়ী ভেজা সালফার বা হেক্সাকোনাজল স্প্রে করুন; বাতাস চলাচল বাড়ান।'],
    prevent: ['Avoid crowding and late-evening irrigation.', 'ঘন করে রোপণ ও সন্ধ্যায় সেচ এড়ান।'] },
  { id: 'bacterial_wilt', crops: ['tomato', 'brinjal', 'eggplant', 'potato', 'chilli', 'টমেটো', 'বেগুন', 'আলু', 'মরিচ'], type: 'bacterial', symptoms: ['wilting', 'rot', 'stunted'], env: { temp: [28, 36], wet: true },
    name: ['Bacterial wilt', 'ব্যাকটেরিয়াজনিত ঢলে পড়া'], sev: 'high',
    treat: ['Remove and burn wilted plants, avoid moving water from infected plots, apply lime to soil.', 'ঢলে পড়া গাছ তুলে পুড়িয়ে ফেলুন, আক্রান্ত জমির পানি অন্য জমিতে নেবেন না, মাটিতে চুন দিন।'],
    prevent: ['Rotate with rice or maize for 2–3 seasons; use grafted seedlings.', '২–৩ মৌসুম ধান বা ভুট্টার সাথে ফসল পর্যায়ক্রম করুন।'] },
  { id: 'aphids', crops: ['*'], type: 'pest', symptoms: ['curling', 'yellowing', 'stunted'], env: { hum: [40, 75], temp: [18, 30] },
    name: ['Aphid infestation', 'জাব পোকার আক্রমণ'], sev: 'medium',
    treat: ['Spray soapy water or neem oil; use imidacloprid only if heavy, per label.', 'সাবান পানি বা নিম তেল স্প্রে করুন; বেশি হলে লেবেল অনুযায়ী ইমিডাক্লোপ্রিড।'],
    prevent: ['Encourage ladybirds, use yellow traps, remove weeds.', 'লেডি বার্ড পোকা রক্ষা করুন, হলুদ ফাঁদ ও আগাছা পরিষ্কার করুন।'] },
  { id: 'fruit_borer', crops: ['brinjal', 'eggplant', 'tomato', 'chilli', 'বেগুন', 'টমেটো', 'মরিচ'], type: 'pest', symptoms: ['holes', 'wilting', 'rot'], env: { temp: [25, 35] },
    name: ['Shoot and fruit borer', 'ডগা ও ফল ছিদ্রকারী পোকা'], sev: 'high',
    treat: ['Cut and destroy wilted shoots and bored fruits; use pheromone traps; spray spinosad or emamectin as per label.', 'ঢলে পড়া ডগা ও ছিদ্র ফল কেটে নষ্ট করুন; ফেরোমন ফাঁদ ব্যবহার করুন; লেবেল অনুযায়ী স্পিনোসাড বা ইমামেকটিন দিন।'],
    prevent: ['Collect infested fruit weekly; avoid continuous cropping.', 'প্রতি সপ্তাহে আক্রান্ত ফল সংগ্রহ করুন; একই জমিতে ধারাবাহিক চাষ এড়ান।'] },
  { id: 'nitrogen_deficiency', crops: ['*'], type: 'nutrient', symptoms: ['yellowing', 'stunted'], env: { dry: true },
    name: ['Nitrogen / nutrient deficiency', 'নাইট্রোজেন বা পুষ্টির ঘাটতি'], sev: 'low',
    treat: ['Top-dress urea in small split doses and test soil; also check for zinc or sulphur shortage.', 'অল্প অল্প করে ভাগে ইউরিয়া উপরি দিন ও মাটি পরীক্ষা করুন; জিংক বা সালফারের ঘাটতিও দেখুন।'],
    prevent: ['Add compost and follow a soil-test based fertiliser plan.', 'কম্পোস্ট দিন ও মাটি পরীক্ষা অনুযায়ী সার দিন।'] },
];


// ───────────── Database tables (additive only) ─────────────
const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const statements = [
  `CREATE TABLE IF NOT EXISTS iot_devices (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    farmer_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    field_name VARCHAR(160),
    device_key VARCHAR(64) NOT NULL UNIQUE,
    last_seen TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_iot_devices_farmer (farmer_id),
    CONSTRAINT fk_iot_devices_farmer FOREIGN KEY (farmer_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS sensor_readings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    device_id INT UNSIGNED NOT NULL,
    soil_moisture DECIMAL(5,2) NULL,
    soil_temp DECIMAL(5,2) NULL,
    soil_ph DECIMAL(4,2) NULL,
    air_temp DECIMAL(5,2) NULL,
    humidity DECIMAL(5,2) NULL,
    light_lux INT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_readings_device_time (device_id, recorded_at),
    CONSTRAINT fk_readings_device FOREIGN KEY (device_id) REFERENCES iot_devices(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS disease_reports (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    crop VARCHAR(120) NOT NULL,
    image_path VARCHAR(255) NULL,
    symptoms TEXT NULL,
    sensor_data TEXT NULL,
    engine VARCHAR(30) NOT NULL DEFAULT 'rules',
    top_disease VARCHAR(160) NULL,
    confidence INT NULL,
    result MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_reports_user (user_id),
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS advisory_requests (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    farmer_id INT UNSIGNED NOT NULL,
    crop VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'crop',
    question TEXT NOT NULL,
    status ENUM('open','answered') NOT NULL DEFAULT 'open',
    answer TEXT NULL,
    expert_id INT UNSIGNED NULL,
    answered_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_adv_req_farmer (farmer_id),
    INDEX idx_adv_req_status (status),
    CONSTRAINT fk_adv_req_farmer FOREIGN KEY (farmer_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_adv_req_expert FOREIGN KEY (expert_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE SET NULL
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS advisory_tips (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    expert_id INT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    crop VARCHAR(120) NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'crop',
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_adv_tips_expert (expert_id),
    CONSTRAINT fk_adv_tips_expert FOREIGN KEY (expert_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS water_pumps (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    pump_code VARCHAR(20) NOT NULL UNIQUE,
    farmer_id INT UNSIGNED NULL,
    name VARCHAR(120) NULL,
    field_name VARCHAR(160) NULL,
    device_id INT UNSIGNED NULL,
    pump_key VARCHAR(64) NULL,
    mode ENUM('manual','auto') NOT NULL DEFAULT 'manual',
    desired_state ENUM('on','off') NOT NULL DEFAULT 'off',
    status ENUM('unassigned','idle','running') NOT NULL DEFAULT 'unassigned',
    moisture_low DECIMAL(5,2) NOT NULL DEFAULT 30,
    moisture_high DECIMAL(5,2) NOT NULL DEFAULT 60,
    claimed_at TIMESTAMP NULL DEFAULT NULL,
    last_seen TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_pumps_farmer (farmer_id),
    CONSTRAINT fk_pumps_farmer FOREIGN KEY (farmer_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_pumps_device FOREIGN KEY (device_id) REFERENCES iot_devices(id)
      ON UPDATE CASCADE ON DELETE SET NULL
  ) ${T}`,

  `CREATE TABLE IF NOT EXISTS pump_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pump_id INT UNSIGNED NOT NULL,
    event VARCHAR(40) NOT NULL,
    detail VARCHAR(200) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_pump_events (pump_id, created_at),
    CONSTRAINT fk_pump_events_pump FOREIGN KEY (pump_id) REFERENCES water_pumps(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ${T}`,
];

async function ensureModule2Tables(pool) {
  for (const sql of statements) await pool.query(sql);
  // Seed the factory pump registry (QR codes from the Water_Pump dataset). INSERT IGNORE = safe to re-run.
  await pool.query('INSERT IGNORE INTO water_pumps(pump_code) VALUES ?', [PUMP_CODES.map((c) => [c])]);
}

// ───────────── IoT period analysis (24h / 3d / 7d) ─────────────
// Pure function: turns the aggregates of ONE period into a summary, findings and recommendations.
const PERIODS = { '24h': { hours: 24, bucket: 1800, en: 'the last 24 hours', bn: 'গত ২৪ ঘণ্টায়' }, '3d': { hours: 72, bucket: 7200, en: 'the last 3 days', bn: 'গত ৩ দিনে' }, '7d': { hours: 168, bucket: 21600, en: 'the last 7 days', bn: 'গত ৭ দিনে' } };
const IDEAL = { soil_moisture: [40, 70], soil_temp: [18, 32], soil_ph: [6, 7.5], air_temp: [18, 33], humidity: [50, 80], light_lux: [20000, 70000] };
const SENSOR_LABEL = { soil_moisture: ['Soil moisture', 'মাটির আর্দ্রতা', '%'], soil_temp: ['Soil temperature', 'মাটির তাপমাত্রা', '°C'], soil_ph: ['Soil pH', 'মাটির pH', ''],
  air_temp: ['Air temperature', 'বাতাসের তাপমাত্রা', '°C'], humidity: ['Humidity', 'আর্দ্রতা', '%'], light_lux: ['Sunlight', 'সূর্যালোক', ' lux'] };

function analyzePeriod(period, S) {
  const P = PERIODS[period]; const m = S.m || {}; const sh = S.shares || {};
  const r1 = (x) => Math.round(x * 10) / 10, pct = (x) => Math.round((x || 0) * 100);
  const out = { period, hours: P.hours, n: S.n, metrics: {}, findings: [], recommendations: [], status: 'good', summary: { en: '', bn: '' } };
  for (const k of Object.keys(SENSOR_LABEL)) {
    const x = m[k]; if (!x || x.avg == null) continue;
    out.metrics[k] = { avg: r1(x.avg), min: r1(x.min), max: r1(x.max), n: x.n, delta: x.late != null && x.early != null ? r1(x.late - x.early) : null, inRange: x.inRange == null ? null : pct(x.inRange) };
  }
  if (!S.n || !Object.keys(out.metrics).length) {
    out.status = 'nodata';
    out.summary = { en: `No sensor readings were received in ${P.en}.`, bn: `${P.bn} কোনো সেন্সর রিডিং আসেনি।` };
    out.recommendations.push({ en: 'Check that the device is powered, has network access and uses the correct device key.', bn: 'ডিভাইসে বিদ্যুৎ, নেটওয়ার্ক ও সঠিক ডিভাইস কী আছে কিনা দেখুন।' });
    return out;
  }
  const F = (level, metric, en, bn) => out.findings.push({ level, metric, en, bn });
  const R = (en, bn) => { if (!out.recommendations.some((x) => x.en === en)) out.recommendations.push({ en, bn }); };
  const M = out.metrics;

  if (M.soil_moisture) {
    const a = M.soil_moisture.avg, d = M.soil_moisture.delta;
    if (a < 20 || sh.dry >= 0.8) { F('danger', 'soil_moisture', `Soil is very dry — irrigate now (average ${a}%, below 30% for ${pct(sh.dry)}% of readings)`, `মাটি খুব শুকনো — এখনই সেচ দিন (গড় ${a}%, ${pct(sh.dry)}% রিডিং ৩০%-এর নিচে)`);
      R('Irrigate now, early morning or evening, and check pump and pipes.', 'এখনই ভোরে বা সন্ধ্যায় সেচ দিন এবং পাম্প ও পাইপ পরীক্ষা করুন।'); }
    else if (a < 30 || sh.dry >= 0.4) { F('warn', 'soil_moisture', `Soil is getting dry — plan irrigation (below 30% for ${pct(sh.dry)}% of readings)`, `মাটি শুকিয়ে আসছে — সেচের পরিকল্পনা করুন (${pct(sh.dry)}% রিডিং ৩০%-এর নিচে)`);
      R('Plan irrigation within 1–2 days and mulch the soil to hold water.', '১–২ দিনের মধ্যে সেচের পরিকল্পনা করুন এবং পানি ধরে রাখতে মালচ দিন।'); }
    else if (a > 85 || sh.wet >= 0.4) { F('warn', 'soil_moisture', `Soil is waterlogged — improve drainage (above 85% for ${pct(sh.wet)}% of readings)`, `মাটি জলাবদ্ধ — নিষ্কাশন ঠিক করুন (${pct(sh.wet)}% রিডিং ৮৫%-এর উপরে)`);
      R('Pause irrigation and open drainage channels to protect the roots.', 'সেচ বন্ধ রাখুন এবং শিকড় বাঁচাতে নিষ্কাশন নালা খুলে দিন।'); }
    else F('good', 'soil_moisture', `Soil moisture is healthy (average ${a}%)`, `মাটির আর্দ্রতা ভালো (গড় ${a}%)`);
    if (d != null && d <= -8 && a >= 20) { F('warn', 'soil_moisture', `Soil moisture fell by ${Math.abs(d)} points during ${P.en}`, `${P.bn} মাটির আর্দ্রতা ${Math.abs(d)} পয়েন্ট কমেছে`);
      R('Check the soil by hand tomorrow; irrigation may be needed soon.', 'আগামীকাল হাতে মাটি পরীক্ষা করুন; শিগগির সেচ লাগতে পারে।'); }
    else if (d != null && d >= 8) F('info', 'soil_moisture', `Soil moisture rose by ${d} points — recent rain or irrigation`, `মাটির আর্দ্রতা ${d} পয়েন্ট বেড়েছে — সাম্প্রতিক বৃষ্টি বা সেচ`);
  }
  if (M.humidity) {
    const a = M.humidity.avg;
    if (a > 90 || sh.humid >= 0.3) { F('warn', 'humidity', `Very humid — disease risk is high (above 90% for ${pct(sh.humid)}% of readings)`, `আর্দ্রতা খুব বেশি — রোগের ঝুঁকি বেশি (${pct(sh.humid)}% রিডিং ৯০%-এর উপরে)`);
      R('Scout leaves for spots, run a Disease check, avoid evening irrigation and improve airflow.', 'পাতায় দাগ খুঁজুন, রোগ শনাক্তকরণ চালান, সন্ধ্যায় সেচ এড়ান এবং বাতাস চলাচল বাড়ান।'); }
    else if (a < 30) { F('warn', 'humidity', `Very dry air (average ${a}%)`, `বাতাস খুব শুষ্ক (গড় ${a}%)`); R('Irrigate in cool hours; dry air increases water loss.', 'ঠান্ডা সময়ে সেচ দিন; শুষ্ক বাতাসে পানির ক্ষয় বাড়ে।'); }
    else F('good', 'humidity', `Humidity is comfortable (average ${a}%)`, `আর্দ্রতা স্বাভাবিক (গড় ${a}%)`);
  }
  if (M.air_temp) {
    const x = M.air_temp;
    if (x.max > 38) { F('danger', 'air_temp', `Extreme heat — reached ${x.max}°C`, `তীব্র গরম — সর্বোচ্চ ${x.max}°C`); R('Irrigate in cool hours, mulch and shade seedlings with nets.', 'ঠান্ডা সময়ে সেচ দিন, মালচ দিন এবং চারা নেট দিয়ে ছায়া দিন।'); }
    else if (x.avg > 35 || sh.hot >= 0.3) { F('warn', 'air_temp', `High air temperature (average ${x.avg}°C)`, `বাতাসের তাপমাত্রা বেশি (গড় ${x.avg}°C)`); R('Avoid midday field work and irrigate in the evening.', 'দুপুরে মাঠের কাজ এড়ান এবং সন্ধ্যায় সেচ দিন।'); }
    else if (x.min < 10) { F('warn', 'air_temp', `Cold stress risk — dropped to ${x.min}°C`, `ঠান্ডার ঝুঁকি — সর্বনিম্ন ${x.min}°C`); R('Cover young plants at night.', 'রাতে কচি গাছ ঢেকে দিন।'); }
    else F('good', 'air_temp', `Air temperature is fine (${x.min}–${x.max}°C)`, `বাতাসের তাপমাত্রা ঠিক আছে (${x.min}–${x.max}°C)`);
  }
  if (M.soil_temp) {
    const a = M.soil_temp.avg;
    if (a > 35) { F('warn', 'soil_temp', `Soil is hot (average ${a}°C)`, `মাটি গরম (গড় ${a}°C)`); R('Mulch the root zone to cool the soil.', 'মাটি ঠান্ডা রাখতে গোড়ায় মালচ দিন।'); }
    else if (a < 12) { F('warn', 'soil_temp', `Soil is cold (average ${a}°C) — slow germination`, `মাটি ঠান্ডা (গড় ${a}°C) — অঙ্কুরোদগম ধীর`); R('Delay sowing until the soil warms up.', 'মাটি গরম না হওয়া পর্যন্ত বীজ বপন পিছিয়ে দিন।'); }
  }
  if (M.soil_ph) {
    const a = M.soil_ph.avg;
    if (a < 5.5) { F('warn', 'soil_ph', `Soil is acidic (pH ${a})`, `মাটি অম্লীয় (pH ${a})`); R('Apply lime based on a soil test.', 'মাটি পরীক্ষা করে চুন প্রয়োগ করুন।'); }
    else if (a > 7.8) { F('warn', 'soil_ph', `Soil is alkaline (pH ${a})`, `মাটি ক্ষারীয় (pH ${a})`); R('Add organic matter or gypsum.', 'জৈব সার বা জিপসাম দিন।'); }
    else F('good', 'soil_ph', `Soil pH is in a good range (${a})`, `মাটির pH ভালো (${a})`);
  }
  if (M.light_lux) {
    const x = M.light_lux;
    if (x.max < 15000) { F('warn', 'light_lux', `Low sunlight — peak only ${Math.round(x.max).toLocaleString()} lux`, `সূর্যালোক কম — সর্বোচ্চ মাত্র ${Math.round(x.max).toLocaleString()} লাক্স`); R('Cloudy spell: avoid extra nitrogen and watch for fungal disease.', 'মেঘলা সময়: বাড়তি নাইট্রোজেন এড়ান এবং ছত্রাক রোগের দিকে নজর রাখুন।'); }
    else if (x.max > 90000) { F('warn', 'light_lux', `Very strong sunlight — peak ${Math.round(x.max).toLocaleString()} lux`, `খুব তীব্র রোদ — সর্বোচ্চ ${Math.round(x.max).toLocaleString()} লাক্স`); R('Use shade nets for seedlings during peak sun.', 'তীব্র রোদে চারার জন্য শেড নেট ব্যবহার করুন।'); }
    else F('good', 'light_lux', `Sunlight is adequate (peak ${Math.round(x.max).toLocaleString()} lux)`, `সূর্যালোক পর্যাপ্ত (সর্বোচ্চ ${Math.round(x.max).toLocaleString()} লাক্স)`);
  }
  // multi-day periods: point out the driest day
  const days = (S.daily || []).filter((d) => d.soil_moisture != null);
  if (period !== '24h' && days.length >= 2 && M.soil_moisture) {
    const dry = days.reduce((a, b) => (b.soil_moisture < a.soil_moisture ? b : a));
    F('info', 'soil_moisture', `Driest day: ${dry.date} (soil moisture ${r1(dry.soil_moisture)}%)`, `সবচেয়ে শুকনো দিন: ${dry.date} (মাটির আর্দ্রতা ${r1(dry.soil_moisture)}%)`);
  }
  if (!out.recommendations.length) R('Conditions look stable. Keep your normal routine and check again later.', 'অবস্থা স্থিতিশীল। স্বাভাবিক রুটিন চালিয়ে যান এবং পরে আবার দেখুন।');
  out.status = out.findings.some((f) => f.level === 'danger') ? 'danger' : out.findings.some((f) => f.level === 'warn') ? 'warn' : 'good';
  const bits = (idx) => ['soil_moisture', 'humidity', 'air_temp'].filter((k) => M[k]).map((k) => `${idx === 0 ? SENSOR_LABEL[k][0].toLowerCase() : SENSOR_LABEL[k][1]} ${M[k].avg}${SENSOR_LABEL[k][2]}`).join(', ');
  out.summary = { en: `${P.en[0].toUpperCase() + P.en.slice(1)}: ${S.n} readings. Average ${bits(0)}.`, bn: `${P.bn}: ${S.n}টি রিডিং। গড় ${bits(1)}।` };
  return out;
}

// ───────────── API routes ─────────────

function mountModule2({ app, db, auth, allow, fail }) {
  const num = (v, min, max) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => { console.error(e); fail(res, 500, 'Something went wrong. Please try again.'); });

  /* ───────────────────────── 1. WEATHER ───────────────────────── */
  const wxCache = new Map();

  function buildAdvice(cur, d) {
    const out = [];
    const add = (type, level, tEn, tBn, xEn, xBn) => out.push({ type, level, title: { en: tEn, bn: tBn }, text: { en: xEn, bn: xBn } });
    const rain = (i) => d[i]?.rain || 0;
    const rain48 = rain(0) + rain(1), rain3 = rain(0) + rain(1) + rain(2);
    const prob48 = Math.max(d[0]?.prob || 0, d[1]?.prob || 0);
    const windMax = Math.max(d[0]?.wind || 0, d[1]?.wind || 0);

    // Irrigation
    if (rain48 >= 10 || prob48 >= 70)
      add('irrigation', 'good', 'Hold irrigation', 'সেচ বন্ধ রাখুন', `Rain is likely (about ${rain48.toFixed(0)} mm in 48 hours). Skip irrigation to save water and avoid waterlogging.`, `আগামী ৪৮ ঘণ্টায় প্রায় ${rain48.toFixed(0)} মিমি বৃষ্টির সম্ভাবনা। পানি বাঁচাতে ও জলাবদ্ধতা এড়াতে সেচ দেবেন না।`);
    else if (rain3 < 2 && d[0]?.tmax >= 32)
      add('irrigation', 'warn', 'Irrigate soon', 'শিগগির সেচ দিন', `No rain expected for 3 days and it is hot (up to ${d[0].tmax.toFixed(0)}°C). Irrigate early morning or evening to cut evaporation.`, `৩ দিন বৃষ্টি নেই, তাপমাত্রা ${d[0].tmax.toFixed(0)}°C পর্যন্ত। বাষ্পীভবন কমাতে ভোরে বা সন্ধ্যায় সেচ দিন।`);
    else
      add('irrigation', 'good', 'Normal irrigation', 'স্বাভাবিক সেচ', 'No extreme weather ahead. Check soil moisture by hand and irrigate only if the top 5 cm is dry.', 'আবহাওয়া স্বাভাবিক। মাটির ওপরের ৫ সেমি শুকনো হলেই সেচ দিন।');

    // Harvest
    const dry = d.slice(0, 4).findIndex((x) => x.rain < 1 && x.prob <= 30);
    if (dry === 0) add('harvest', 'good', 'Good harvest day today', 'আজ ফসল কাটার ভালো দিন', 'Dry weather today. Harvest mature crops and dry them in the sun the same day.', 'আজ আবহাওয়া শুকনো। পাকা ফসল কাটুন এবং একই দিনে রোদে শুকান।');
    else if (dry > 0) add('harvest', 'warn', `Best harvest day: ${d[dry].date}`, `ফসল কাটার সেরা দিন: ${d[dry].date}`, 'Rain is possible before then. Harvest only fully mature crops now and keep cut produce covered.', 'এর আগে বৃষ্টির সম্ভাবনা আছে। শুধু পুরো পাকা ফসল কাটুন এবং কাটা ফসল ঢেকে রাখুন।');
    else add('harvest', 'danger', 'No dry window for 4 days', '৪ দিন শুকনো সময় নেই', 'Harvest only what is ready in rain gaps, thresh under cover and dry grain quickly to avoid sprouting and mould.', 'বৃষ্টির ফাঁকে শুধু পাকা ফসল কাটুন, ঢাকা জায়গায় মাড়াই করুন এবং ধান দ্রুত শুকান।');

    // Spraying
    if (windMax >= 25 || prob48 >= 60) add('spray', 'warn', 'Postpone spraying', 'স্প্রে পিছিয়ে দিন', 'Wind or rain would wash away or drift the spray. Wait for a calm, dry spell.', 'বাতাস বা বৃষ্টিতে স্প্রে ভেসে বা ধুয়ে যাবে। শান্ত ও শুকনো সময়ের অপেক্ষা করুন।');
    else add('spray', 'good', 'Good spraying conditions', 'স্প্রে করার ভালো সময়', 'Low wind and little rain. Spray early morning, and follow label doses and waiting periods.', 'বাতাস কম, বৃষ্টি কম। ভোরে স্প্রে করুন এবং লেবেলের মাত্রা ও অপেক্ষার সময় মানুন।');

    // Alerts
    if (d.slice(0, 3).some((x) => x.rain >= 50)) add('alert', 'danger', 'Heavy rain alert', 'ভারী বৃষ্টির সতর্কতা', 'Clear drainage channels, raise seedbeds, and move harvested crops and inputs to high, dry places.', 'নিষ্কাশন নালা পরিষ্কার করুন, বীজতলা উঁচু করুন এবং কাটা ফসল ও উপকরণ উঁচু শুকনো জায়গায় রাখুন।');
    if (d[0]?.tmax >= 36) add('alert', 'danger', 'Extreme heat', 'তীব্র গরম', 'Mulch the soil, irrigate in cool hours, and avoid field work at noon.', 'মালচিং করুন, ঠান্ডা সময়ে সেচ দিন এবং দুপুরে মাঠে কাজ এড়ান।');
    else if (d[0]?.tmax >= 33) add('alert', 'warn', 'Heat stress risk', 'গরমের চাপ', 'Watch for leaf wilting at midday. Light mulch and evening irrigation help.', 'দুপুরে পাতা নেতিয়ে পড়ছে কিনা দেখুন। হালকা মালচ ও সন্ধ্যায় সেচ উপকারী।');
    if (Math.min(...d.slice(0, 3).map((x) => x.tmin)) <= 12) add('alert', 'warn', 'Cold night risk', 'ঠান্ডা রাতের ঝুঁকি', 'Cover seedlings with polythene at night and irrigate lightly in the evening to hold warmth.', 'রাতে চারা পলিথিনে ঢাকুন এবং সন্ধ্যায় হালকা সেচ দিন।');
    if ((cur.humidity >= 85 && cur.temp >= 20 && cur.temp <= 32) || rain3 >= 15)
      add('disease', 'warn', 'Fungal and bacterial disease risk', 'ছত্রাক ও ব্যাকটেরিয়া রোগের ঝুঁকি', 'Warm and humid weather favours blast, blight and mildew. Scout your field and use Disease Check if you see spots.', 'উষ্ণ ও আর্দ্র আবহাওয়ায় ব্লাস্ট, ধ্বসা ও মিলডিউ বাড়ে। মাঠ দেখুন, দাগ দেখলে রোগ শনাক্তকরণ ব্যবহার করুন।');

    // Seasonal crop management
    const m = new Date().getMonth();
    add('crop', 'info', 'Crop management this month', 'এ মাসের ফসল ব্যবস্থাপনা', MONTH_TIPS[m][0], MONTH_TIPS[m][1]);
    return out;
  }

  const sampleWeather = (loc) => {
    const day = (i) => { const dt = new Date(Date.now() + i * 864e5); return dt.toISOString().slice(0, 10); };
    const codes = [2, 1, 61, 3, 0, 2, 1];
    return {
      current: { temp: 29, humidity: 74, wind: 9, precip: 0, ...wmo(2) },
      daily: codes.map((c, i) => ({ date: day(i), code: c, ...wmo(c), tmax: 32 - (i % 3), tmin: 23 + (i % 2), rain: c === 61 ? 8 : 0, prob: c === 61 ? 70 : 10, wind: 12, et0: 4.2 })),
      source: 'sample',
    };
  };

  async function fetchWeather(loc) {
    const key = loc.name; const hit = wxCache.get(key);
    if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.data;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}` +
      '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration' +
      '&timezone=Asia%2FDhaka&forecast_days=7';
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('weather http ' + r.status);
      const j = await r.json();
      const data = {
        current: { temp: j.current.temperature_2m, humidity: j.current.relative_humidity_2m, wind: j.current.wind_speed_10m, precip: j.current.precipitation, ...wmo(j.current.weather_code) },
        daily: j.daily.time.map((t, i) => ({ date: t, code: j.daily.weather_code[i], ...wmo(j.daily.weather_code[i]), tmax: j.daily.temperature_2m_max[i], tmin: j.daily.temperature_2m_min[i],
          rain: j.daily.precipitation_sum[i] || 0, prob: j.daily.precipitation_probability_max[i] || 0, wind: j.daily.wind_speed_10m_max[i] || 0, et0: j.daily.et0_fao_evapotranspiration?.[i] ?? null })),
        source: 'open-meteo',
      };
      wxCache.set(key, { at: Date.now(), data });
      return data;
    } finally { clearTimeout(timer); }
  }

  app.get('/api/weather/districts', auth, (req, res) => res.json(Object.keys(DISTRICTS).sort()));

  app.get('/api/weather', auth, wrap(async (req, res) => {
    const loc = resolveLocation(req.query.district || req.user.district, req.user.division);
    let w;
    try { w = await fetchWeather(loc); } catch (e) { console.warn('Weather fetch failed, using sample:', e.message); w = sampleWeather(loc); }
    res.json({ location: loc.name, ...w, advice: buildAdvice(w.current, w.daily) });
  }));

  /* ───────────────────────── 2. IoT MONITORING ───────────────────────── */
  const METRICS = { soil_moisture: [0, 100], soil_temp: [-10, 70], soil_ph: [0, 14], air_temp: [-20, 60], humidity: [0, 100], light_lux: [0, 200000] };

  function evaluate(r) {
    if (!r) return [];
    const a = []; const add = (metric, level, en, bn) => a.push({ metric, level, en, bn });
    const v = (k) => (r[k] == null ? null : Number(r[k]));
    const sm = v('soil_moisture'), sp = v('soil_ph'), st = v('soil_temp'), at = v('air_temp'), hu = v('humidity');
    if (sm != null) { if (sm < 20) add('soil_moisture', 'danger', 'Soil is very dry — irrigate now', 'মাটি খুব শুকনো — এখনই সেচ দিন'); else if (sm < 30) add('soil_moisture', 'warn', 'Soil is getting dry — plan irrigation', 'মাটি শুকিয়ে আসছে — সেচের পরিকল্পনা করুন'); else if (sm > 85) add('soil_moisture', 'warn', 'Waterlogged — improve drainage', 'জলাবদ্ধ — নিষ্কাশন ঠিক করুন'); }
    if (sp != null) { if (sp < 5.5) add('soil_ph', 'warn', 'Soil is acidic — consider lime', 'মাটি অম্লীয় — চুন প্রয়োগ বিবেচনা করুন'); else if (sp > 7.8) add('soil_ph', 'warn', 'Soil is alkaline — add organic matter or gypsum', 'মাটি ক্ষারীয় — জৈব সার বা জিপসাম দিন'); }
    if (st != null) { if (st > 35) add('soil_temp', 'warn', 'Soil is hot — mulch the root zone', 'মাটি গরম — গোড়ায় মালচ দিন'); else if (st < 12) add('soil_temp', 'warn', 'Soil is cold — slow germination expected', 'মাটি ঠান্ডা — অঙ্কুরোদগম ধীর হবে'); }
    if (at != null) { if (at > 38) add('air_temp', 'danger', 'Extreme heat on the farm', 'খামারে তীব্র গরম'); else if (at > 35) add('air_temp', 'warn', 'High air temperature', 'বাতাসের তাপমাত্রা বেশি'); else if (at < 10) add('air_temp', 'warn', 'Cold stress risk', 'ঠান্ডার চাপের ঝুঁকি'); }
    if (hu != null) { if (hu > 90) add('humidity', 'warn', 'Very humid — disease risk is high', 'আর্দ্রতা খুব বেশি — রোগের ঝুঁকি বেশি'); else if (hu < 30) add('humidity', 'warn', 'Very dry air', 'বাতাস খুব শুষ্ক'); }
    return a;
  }

  const LATEST = `SELECT r.* FROM sensor_readings r WHERE r.device_id=? ORDER BY r.recorded_at DESC, r.id DESC LIMIT 1`;

  async function deviceView(d) {
    const latest = await db.get(LATEST, [d.id]);
    const online = d.last_seen && Date.now() - new Date(d.last_seen).getTime() < 15 * 60 * 1000;
    return { ...d, online: !!online, latest: latest || null, alerts: evaluate(latest) };
  }
  async function ownDevice(req, res, next) {
    const d = await db.get('SELECT * FROM iot_devices WHERE id=?', [req.params.id]);
    if (!d) return fail(res, 404, 'Device not found.');
    if (d.farmer_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'This is not your device.');
    req.device = d; next();
  }
  async function saveReading(deviceId, b) {
    const vals = {}; for (const [k, [mn, mx]] of Object.entries(METRICS)) vals[k] = num(b[k], mn, mx);
    if (Object.values(vals).every((x) => x === null)) return null;
    const r = await db.run('INSERT INTO sensor_readings(device_id,soil_moisture,soil_temp,soil_ph,air_temp,humidity,light_lux) VALUES(?,?,?,?,?,?,?)',
      [deviceId, vals.soil_moisture, vals.soil_temp, vals.soil_ph, vals.air_temp, vals.humidity, vals.light_lux == null ? null : Math.round(vals.light_lux)]);
    await db.run('UPDATE iot_devices SET last_seen=CURRENT_TIMESTAMP WHERE id=?', [deviceId]);
    autoPumps(deviceId).catch((e) => console.warn('auto pump:', e.message)); // fire and forget
    return r.insertId;
  }

  app.get('/api/iot/devices', auth, allow('farmer', 'admin'), wrap(async (req, res) => {
    const rows = req.user.role === 'admin'
      ? await db.all('SELECT d.*, u.name AS farmer_name FROM iot_devices d JOIN users u ON u.id=d.farmer_id ORDER BY d.id DESC')
      : await db.all('SELECT * FROM iot_devices WHERE farmer_id=? ORDER BY id DESC', [req.user.id]);
    res.json(await Promise.all(rows.map(deviceView)));
  }));

  app.post('/api/iot/devices', auth, allow('farmer'), wrap(async (req, res) => {
    const { name, field_name } = req.body || {};
    if (!name?.trim()) return fail(res, 400, 'Please give the device a name.');
    const n = await db.get('SELECT COUNT(*) AS n FROM iot_devices WHERE farmer_id=?', [req.user.id]);
    if (Number(n.n) >= 20) return fail(res, 400, 'You can register up to 20 devices.');
    const key = crypto.randomBytes(16).toString('hex');
    const r = await db.run('INSERT INTO iot_devices(farmer_id,name,field_name,device_key) VALUES(?,?,?,?)', [req.user.id, name.trim().slice(0, 120), (field_name || '').trim().slice(0, 160), key]);
    res.status(201).json(await deviceView(await db.get('SELECT * FROM iot_devices WHERE id=?', [r.insertId])));
  }));

  app.delete('/api/iot/devices/:id', auth, allow('farmer', 'admin'), wrap(ownDevice), wrap(async (req, res) => {
    await db.run('DELETE FROM iot_devices WHERE id=?', [req.device.id]); res.json({ ok: true });
  }));

  app.get('/api/iot/devices/:id/readings', auth, allow('farmer', 'admin'), wrap(ownDevice), wrap(async (req, res) => {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 168);
    const rows = await db.all('SELECT * FROM sensor_readings WHERE device_id=? AND recorded_at >= (NOW() - INTERVAL ? HOUR) ORDER BY recorded_at ASC, id ASC LIMIT 500', [req.device.id, hours]);
    res.json({ device: await deviceView(req.device), readings: rows });
  }));

  // Period report: its own aggregates, chart series, analysis and recommendations for 24h / 3d / 7d.
  app.get('/api/iot/devices/:id/report', auth, allow('farmer', 'admin'), wrap(ownDevice), wrap(async (req, res) => {
    const period = PERIODS[req.query.period] ? req.query.period : '24h', P = PERIODS[period], id = req.device.id;
    const keys = Object.keys(METRICS);
    const agg = keys.map((k) => {
      const [lo, hi] = IDEAL[k] || [0, 0];
      return `AVG(${k}) AS ${k}_avg, MIN(${k}) AS ${k}_min, MAX(${k}) AS ${k}_max, COUNT(${k}) AS ${k}_n,
        AVG(CASE WHEN recorded_at >= NOW() - INTERVAL ? HOUR THEN ${k} END) AS ${k}_late,
        AVG(CASE WHEN recorded_at < NOW() - INTERVAL ? HOUR THEN ${k} END) AS ${k}_early,
        AVG(CASE WHEN ${k} IS NULL THEN NULL WHEN ${k} BETWEEN ${lo} AND ${hi} THEN 1 ELSE 0 END) AS ${k}_in`;
    }).join(',\n');
    const half = P.hours / 2;
    const row = await db.get(`SELECT COUNT(*) AS n,
        AVG(CASE WHEN soil_moisture IS NULL THEN NULL WHEN soil_moisture < 30 THEN 1 ELSE 0 END) AS dry,
        AVG(CASE WHEN soil_moisture IS NULL THEN NULL WHEN soil_moisture > 85 THEN 1 ELSE 0 END) AS wet,
        AVG(CASE WHEN humidity IS NULL THEN NULL WHEN humidity > 90 THEN 1 ELSE 0 END) AS humid,
        AVG(CASE WHEN air_temp IS NULL THEN NULL WHEN air_temp > 35 THEN 1 ELSE 0 END) AS hot,
        ${agg}
      FROM sensor_readings WHERE device_id=? AND recorded_at >= NOW() - INTERVAL ? HOUR`,
      [...keys.flatMap(() => [half, half]), id, P.hours]);
    const num2 = (v) => (v == null ? null : Number(v));
    const m = {};
    for (const k of keys) m[k] = { avg: num2(row[k + '_avg']), min: num2(row[k + '_min']), max: num2(row[k + '_max']), n: Number(row[k + '_n'] || 0), late: num2(row[k + '_late']), early: num2(row[k + '_early']), inRange: num2(row[k + '_in']) };
    const daily = period === '24h' ? [] : (await db.all(`SELECT DATE_FORMAT(recorded_at,'%Y-%m-%d') AS date, AVG(soil_moisture) AS soil_moisture FROM sensor_readings
      WHERE device_id=? AND recorded_at >= NOW() - INTERVAL ? HOUR GROUP BY DATE_FORMAT(recorded_at,'%Y-%m-%d') ORDER BY date`, [id, P.hours])).map((d) => ({ date: d.date, soil_moisture: num2(d.soil_moisture) }));
    const series = (await db.all(`SELECT FLOOR(UNIX_TIMESTAMP(recorded_at)/?) AS b, MAX(recorded_at) AS t, ${keys.map((k) => `AVG(${k}) AS ${k}`).join(', ')}
      FROM sensor_readings WHERE device_id=? AND recorded_at >= NOW() - INTERVAL ? HOUR GROUP BY b ORDER BY b`, [P.bucket, id, P.hours]))
      .map((r) => ({ t: r.t, ...Object.fromEntries(keys.map((k) => [k, num2(r[k])])) }));
    res.json({ ...analyzePeriod(period, { n: Number(row.n || 0), m, shares: { dry: num2(row.dry), wet: num2(row.wet), humid: num2(row.humid), hot: num2(row.hot) }, daily }), series, generated_at: new Date().toISOString() });
  }));

  // Demo helper: creates a realistic reading so the dashboard can be shown without hardware.
  app.post('/api/iot/devices/:id/simulate', auth, allow('farmer'), wrap(ownDevice), wrap(async (req, res) => {
    const prev = await db.get(LATEST, [req.device.id]);
    const drift = (p, base, spread, mn, mx) => Math.min(mx, Math.max(mn, (p != null ? Number(p) : base) + (Math.random() - 0.5) * spread));
    const reading = {
      soil_moisture: drift(prev?.soil_moisture, 48, 14, 8, 95), soil_temp: drift(prev?.soil_temp, 27, 2, 15, 40), soil_ph: drift(prev?.soil_ph, 6.6, 0.3, 4.8, 8.4),
      air_temp: drift(prev?.air_temp, 30, 3, 14, 40), humidity: drift(prev?.humidity, 72, 8, 25, 98), light_lux: Math.round(drift(prev?.light_lux, 45000, 12000, 0, 90000)),
    };
    for (const k of Object.keys(reading)) reading[k] = Math.round(reading[k] * 100) / 100;
    await saveReading(req.device.id, reading);
    res.json(await deviceView(await db.get('SELECT * FROM iot_devices WHERE id=?', [req.device.id])));
  }));

  // Public ingest endpoint for ESP32 / Arduino / Raspberry Pi. Auth = device key.
  app.post('/api/iot/ingest', rateLimit({ windowMs: 60 * 1000, limit: 300, message: { error: 'Too many requests.' } }), wrap(async (req, res) => {
    const key = String(req.headers['x-device-key'] || req.body?.device_key || '');
    if (!/^[a-f0-9]{32}$/.test(key)) return fail(res, 401, 'Missing or invalid device key.');
    const d = await db.get('SELECT * FROM iot_devices WHERE device_key=?', [key]);
    if (!d) return fail(res, 401, 'Unknown device key.');
    const id = await saveReading(d.id, req.body || {});
    if (!id) return fail(res, 400, 'No valid sensor values. Send soil_moisture, soil_temp, soil_ph, air_temp, humidity or light_lux.');
    res.status(201).json({ ok: true, id });
  }));

  /* ───────────────────────── 3. AI DISEASE DETECTION ───────────────────────── */
  const UPLOAD_DIR = path.join(__dirname, 'uploads', 'disease');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'), { index: false, dotfiles: 'deny', maxAge: '7d' }));

  const inRange = (x, r) => x != null && x >= r[0] && x <= r[1];
  function ruleEngine({ crop, symptoms, sensor, colors, hasImage }) {
    const S = {}; (symptoms || []).filter((s) => SYMPTOMS.includes(s)).forEach((s) => (S[s] = 1));
    const explicit = Object.keys(S).length;
    // Weak signals inferred from the photo's colour profile (basic screening only)
    if (colors) {
      if (colors.yellow > 0.12 && !S.yellowing) S.yellowing = 0.6;
      if (colors.brown > 0.08 && !S.brown_spots) S.brown_spots = 0.6;
      if (colors.dark > 0.05 && !S.dark_lesions) S.dark_lesions = 0.6;
      if (colors.white > 0.06 && !S.white_powder) S.white_powder = 0.6;
    }
    const evidence = Object.keys(S).length;
    const c = String(crop || '').toLowerCase();
    const env = sensor || {};
    const scored = DISEASES.map((d) => {
      const matched = d.symptoms.reduce((s, k) => s + (S[k] || 0), 0);
      const extra = Object.keys(S).filter((k) => !d.symptoms.includes(k)).length;
      const symScore = matched / d.symptoms.length;
      const cropMatch = d.crops.includes('*') ? 0.05 : d.crops.some((x) => c.includes(x)) ? 0.15 : -0.2;
      const checks = [];
      if (d.env.hum && env.humidity != null) checks.push(inRange(Number(env.humidity), d.env.hum));
      if (d.env.temp && env.air_temp != null) checks.push(inRange(Number(env.air_temp), d.env.temp));
      if (d.env.wet && env.soil_moisture != null) checks.push(Number(env.soil_moisture) >= 65);
      if (d.env.dry && env.soil_moisture != null) checks.push(Number(env.soil_moisture) < 30);
      const envScore = checks.length ? (checks.filter(Boolean).length / checks.length) * 0.15 : 0;
      const score = (evidence ? symScore * 0.62 : 0) + cropMatch + envScore - extra * 0.04 + (explicit ? 0.05 : 0);
      return { d, score, matched: d.symptoms.filter((k) => S[k]) };
    }).sort((a, b) => b.score - a.score);

    const top = scored.filter((x) => x.score > 0.3 && x.matched.length).slice(0, 3);
    const mk = (x) => ({ id: x.d.id, type: x.d.type, severity: x.d.sev, confidence: Math.max(10, Math.min(85, Math.round(x.score * 100))), name: { en: x.d.name[0], bn: x.d.name[1] },
      matched: x.matched, treatment: { en: x.d.treat[0], bn: x.d.treat[1] }, prevention: { en: x.d.prevent[0], bn: x.d.prevent[1] } });
    if (!top.length) {
      return { healthy: evidence === 0 && !hasImage ? null : true, diagnoses: [], mode: 'rules',
        notes: { en: evidence ? 'No strong match found. Add more symptoms or a clearer photo, or ask an expert.' : 'Not enough information to detect a disease. Tick the symptoms you see or upload a clear leaf photo.',
          bn: evidence ? 'জোরালো কোনো মিল পাওয়া যায়নি। আরও লক্ষণ যোগ করুন, পরিষ্কার ছবি দিন বা বিশেষজ্ঞকে জিজ্ঞাসা করুন।' : 'রোগ শনাক্ত করার মতো তথ্য নেই। যে লক্ষণ দেখছেন তা বেছে নিন বা পাতার পরিষ্কার ছবি দিন।' } };
    }
    return { healthy: false, diagnoses: top.map(mk), mode: 'rules',
      notes: { en: 'This is a screening result from symptoms, sensor and basic photo colour analysis. Confirm with an expert before spraying.', bn: 'এটি লক্ষণ, সেন্সর ও ছবির সাধারণ রঙ বিশ্লেষণভিত্তিক প্রাথমিক ফল। স্প্রে করার আগে বিশেষজ্ঞের সাথে নিশ্চিত হন।' } };
  }

  async function visionEngine({ crop, imageB64, mime, symptoms, sensor }) {
    const key = process.env.ANTHROPIC_API_KEY; if (!key || !imageB64) return null;
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 30000);
    try {
      const prompt = PROMPTS.diseaseVision({ crop, symptoms, sensor });
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-4-6', max_tokens: 1500,
          messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data: imageB64 } }, { type: 'text', text: prompt }] }] }),
      });
      if (!r.ok) throw new Error('vision http ' + r.status);
      const j = await r.json();
      const text = (j.content || []).map((x) => x.text || '').join('');
      const out = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      if (!Array.isArray(out.diagnoses)) throw new Error('bad shape');
      out.diagnoses = out.diagnoses.slice(0, 3).map((x) => ({ ...x, confidence: Math.max(1, Math.min(95, Math.round(Number(x.confidence) || 50))), matched: [] }));
      return { ...out, mode: 'ai-vision' };
    } catch (e) { console.warn('Vision engine unavailable, using rules:', e.message); return null; }
    finally { clearTimeout(timer); }
  }

  const bigJson = express.json({ limit: '8mb' });
  app.post('/api/disease/analyze', auth, allow('farmer', 'expert'), bigJson, wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.crop?.trim()) return fail(res, 400, 'Please enter the crop name.');
    let sensor = b.sensor && typeof b.sensor === 'object' ? b.sensor : null;
    if (b.device_id) {
      const d = await db.get('SELECT * FROM iot_devices WHERE id=?', [b.device_id]);
      if (!d || (d.farmer_id !== req.user.id && req.user.role !== 'admin')) return fail(res, 403, 'This is not your device.');
      sensor = (await db.get(LATEST, [d.id])) || sensor;
    }
    const symptoms = Array.isArray(b.symptoms) ? b.symptoms.filter((s) => SYMPTOMS.includes(s)) : [];

    let imageFile = null, imageB64 = null, mime = null;
    if (b.image) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.image);
      if (!m) return fail(res, 400, 'Please upload a JPG, PNG or WebP photo.');
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 5 * 1024 * 1024) return fail(res, 400, 'Photo is too large (max 5 MB).');
      mime = m[1]; imageB64 = m[2];
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      imageFile = `${req.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, imageFile), buf);
    }
    if (!imageFile && !symptoms.length && !sensor) return fail(res, 400, 'Add a photo, tick symptoms, or choose a sensor device.');

    const colors = b.colors && typeof b.colors === 'object' ? b.colors : null;
    const result = (await visionEngine({ crop: b.crop, imageB64, mime, symptoms, sensor })) || ruleEngine({ crop: b.crop, symptoms, sensor, colors, hasImage: !!imageFile });
    const top = result.diagnoses?.[0];
    const ins = await db.run('INSERT INTO disease_reports(user_id,crop,image_path,symptoms,sensor_data,engine,top_disease,confidence,result) VALUES(?,?,?,?,?,?,?,?,?)',
      [req.user.id, b.crop.trim().slice(0, 120), imageFile, JSON.stringify(symptoms), sensor ? JSON.stringify(sensor) : null, result.mode, top ? (top.name?.en || '').slice(0, 160) : null, top ? top.confidence : null, JSON.stringify(result)]);
    res.status(201).json(await reportView(await db.get('SELECT r.*, u.name AS user_name FROM disease_reports r JOIN users u ON u.id=r.user_id WHERE r.id=?', [ins.insertId])));
  }));

  const safe = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const reportView = (r) => ({ id: r.id, user_id: r.user_id, user_name: r.user_name, crop: r.crop, image: r.image_path ? `/api/uploads/disease/${r.image_path}` : null,
    symptoms: safe(r.symptoms) || [], engine: r.engine, top_disease: r.top_disease, confidence: r.confidence, result: safe(r.result), created_at: r.created_at });

  app.get('/api/disease/reports', auth, allow('farmer', 'expert', 'admin'), wrap(async (req, res) => {
    const own = req.user.role === 'farmer' || req.query.mine === '1';
    const rows = await db.all(`SELECT r.*, u.name AS user_name FROM disease_reports r JOIN users u ON u.id=r.user_id ${own ? 'WHERE r.user_id=?' : ''} ORDER BY r.id DESC LIMIT 50`, own ? [req.user.id] : []);
    res.json(rows.map(reportView));
  }));

  app.delete('/api/disease/reports/:id', auth, allow('farmer', 'expert', 'admin'), wrap(async (req, res) => {
    const r = await db.get('SELECT * FROM disease_reports WHERE id=?', [req.params.id]);
    if (!r) return fail(res, 404, 'Report not found.');
    if (r.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'This is not your report.');
    if (r.image_path) fs.unlink(path.join(UPLOAD_DIR, path.basename(r.image_path)), () => {});
    await db.run('DELETE FROM disease_reports WHERE id=?', [r.id]); res.json({ ok: true });
  }));

  app.get('/api/disease/meta', auth, (req, res) => res.json({ symptoms: SYMPTOMS, aiVision: !!process.env.ANTHROPIC_API_KEY }));

  /* ───────────────────────── 4. EXPERT ADVISORY ───────────────────────── */
  const CATS = ['crop', 'irrigation', 'fertilizer', 'pest', 'disease', 'harvest', 'market', 'farm'];
  const REQ = `SELECT q.*, f.name AS farmer_name, f.district AS farmer_district, e.name AS expert_name
               FROM advisory_requests q JOIN users f ON f.id=q.farmer_id LEFT JOIN users e ON e.id=q.expert_id`;

  app.get('/api/advisory/requests', auth, allow('farmer', 'expert', 'admin'), wrap(async (req, res) => {
    const where = [], args = [];
    if (req.user.role === 'farmer') { where.push('q.farmer_id=?'); args.push(req.user.id); }
    else if (req.user.role === 'expert') {
      if (req.query.scope === 'mine') { where.push('q.expert_id=?'); args.push(req.user.id); } else where.push("q.status='open'");
    }
    res.json(await db.all(`${REQ} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY q.id DESC LIMIT 100`, args));
  }));

  app.post('/api/advisory/requests', auth, allow('farmer'), wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.crop?.trim()) return fail(res, 400, 'Please enter the crop name.');
    if (!b.question?.trim() || b.question.trim().length < 10) return fail(res, 400, 'Please describe your problem in at least 10 characters.');
    const r = await db.run('INSERT INTO advisory_requests(farmer_id,crop,category,question) VALUES(?,?,?,?)',
      [req.user.id, b.crop.trim().slice(0, 120), CATS.includes(b.category) ? b.category : 'crop', b.question.trim().slice(0, 2000)]);
    res.status(201).json(await db.get(`${REQ} WHERE q.id=?`, [r.insertId]));
  }));

  app.put('/api/advisory/requests/:id/answer', auth, allow('expert'), wrap(async (req, res) => {
    const a = (req.body?.answer || '').trim();
    if (a.length < 10) return fail(res, 400, 'Please write a helpful answer (at least 10 characters).');
    const q = await db.get('SELECT * FROM advisory_requests WHERE id=?', [req.params.id]);
    if (!q) return fail(res, 404, 'Question not found.');
    if (q.status === 'answered' && q.expert_id !== req.user.id) return fail(res, 403, 'Another expert has already answered this.');
    await db.run("UPDATE advisory_requests SET answer=?, status='answered', expert_id=?, answered_at=CURRENT_TIMESTAMP WHERE id=?", [a.slice(0, 4000), req.user.id, q.id]);
    res.json(await db.get(`${REQ} WHERE q.id=?`, [q.id]));
  }));

  app.delete('/api/advisory/requests/:id', auth, allow('farmer', 'admin'), wrap(async (req, res) => {
    const q = await db.get('SELECT * FROM advisory_requests WHERE id=?', [req.params.id]);
    if (!q) return fail(res, 404, 'Question not found.');
    if (q.farmer_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'This is not your question.');
    await db.run('DELETE FROM advisory_requests WHERE id=?', [q.id]); res.json({ ok: true });
  }));

  const TIP = `SELECT t.*, u.name AS expert_name FROM advisory_tips t JOIN users u ON u.id=t.expert_id`;
  app.get('/api/advisory/tips', auth, wrap(async (req, res) => {
    const q = `%${req.query.q || ''}%`;
    res.json(await db.all(`${TIP} WHERE (t.title LIKE ? OR t.crop LIKE ? OR t.body LIKE ?) ORDER BY t.id DESC LIMIT 100`, [q, q, q]));
  }));
  app.post('/api/advisory/tips', auth, allow('expert'), wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.title?.trim()) return fail(res, 400, 'Please add a title.');
    if (!b.body?.trim() || b.body.trim().length < 20) return fail(res, 400, 'Please write at least 20 characters of advice.');
    const r = await db.run('INSERT INTO advisory_tips(expert_id,title,crop,category,body) VALUES(?,?,?,?,?)',
      [req.user.id, b.title.trim().slice(0, 200), (b.crop || '').trim().slice(0, 120), CATS.includes(b.category) ? b.category : 'crop', b.body.trim().slice(0, 3000)]);
    res.status(201).json(await db.get(`${TIP} WHERE t.id=?`, [r.insertId]));
  }));
  app.delete('/api/advisory/tips/:id', auth, allow('expert', 'admin'), wrap(async (req, res) => {
    const t = await db.get('SELECT * FROM advisory_tips WHERE id=?', [req.params.id]);
    if (!t) return fail(res, 404, 'Tip not found.');
    if (t.expert_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'This is not your tip.');
    await db.run('DELETE FROM advisory_tips WHERE id=?', [t.id]); res.json({ ok: true });
  }));


  /* ───────────────────────── 5. WATER PUMPS (QR registry from the Water_Pump dataset) ───────────────────────── */
  const normCode = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const logPump = (id, event, detail) => db.run('INSERT INTO pump_events(pump_id,event,detail) VALUES(?,?,?)', [id, event, String(detail || '').slice(0, 200)]);

  async function rainExpected(farmerId) {
    try {
      const u = await db.get('SELECT district, division FROM users WHERE id=?', [farmerId]);
      const w = await fetchWeather(resolveLocation(u?.district, u?.division));
      const d = w.daily; return (d[0].rain || 0) + (d[1]?.rain || 0) >= 8 || Math.max(d[0].prob, d[1]?.prob || 0) >= 80;
    } catch { return false; }
  }
  // Auto mode: dry soil + no rain coming -> ON; wet enough (or rain coming) -> OFF.
  async function evalPump(p) {
    if (p.mode !== 'auto' || !p.device_id) return p;
    const r = await db.get(LATEST, [p.device_id]);
    if (!r || r.soil_moisture == null) return p;
    const m = Number(r.soil_moisture), rain = await rainExpected(p.farmer_id);
    let want = p.desired_state;
    if (m < Number(p.moisture_low) && !rain) want = 'on'; else if (m >= Number(p.moisture_high) || rain) want = 'off';
    if (want !== p.desired_state) {
      await db.run('UPDATE water_pumps SET desired_state=? WHERE id=?', [want, p.id]);
      await logPump(p.id, want === 'on' ? 'auto_on' : 'auto_off', `soil moisture ${m}%` + (rain ? ' (rain expected)' : ''));
      p.desired_state = want;
    }
    return p;
  }
  async function autoPumps(deviceId) {
    const ps = await db.all("SELECT * FROM water_pumps WHERE device_id=? AND mode='auto' AND farmer_id IS NOT NULL", [deviceId]);
    for (const p of ps) await evalPump(p);
  }
  async function ownPump(req, res, next) {
    const p = await db.get('SELECT * FROM water_pumps WHERE id=?', [req.params.id]);
    if (!p) return fail(res, 404, 'Pump not found.');
    if (p.farmer_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'This is not your pump.');
    req.pump = p; next();
  }
  const pumpView = async (p) => {
    const r = p.device_id ? await db.get(LATEST, [p.device_id]) : null;
    return { ...p, online: !!(p.last_seen && Date.now() - new Date(p.last_seen).getTime() < 5 * 60 * 1000), soil_moisture: r?.soil_moisture ?? null };
  };

  app.get('/api/pumps/verify/:code', auth, allow('farmer'), wrap(async (req, res) => {
    const p = await db.get('SELECT farmer_id FROM water_pumps WHERE pump_code=?', [normCode(req.params.code)]);
    res.json(p ? { valid: true, available: p.farmer_id == null, mine: p.farmer_id === req.user.id } : { valid: false });
  }));

  app.post('/api/pumps/claim', auth, allow('farmer'), wrap(async (req, res) => {
    const code = normCode(req.body?.code);
    if (!code) return fail(res, 400, 'Enter or scan the pump QR code.');
    const n = await db.get('SELECT COUNT(*) AS n FROM water_pumps WHERE farmer_id=?', [req.user.id]);
    if (Number(n.n) >= 10) return fail(res, 400, 'You can register up to 10 pumps.');
    const key = crypto.randomBytes(16).toString('hex');
    const r = await db.run("UPDATE water_pumps SET farmer_id=?, name=?, field_name=?, pump_key=?, status='idle', desired_state='off', mode='manual', claimed_at=CURRENT_TIMESTAMP WHERE pump_code=? AND farmer_id IS NULL",
      [req.user.id, (req.body?.name || 'My pump').trim().slice(0, 120), (req.body?.field_name || '').trim().slice(0, 160), key, code]);
    if (!r.affectedRows) return fail(res, 404, 'This QR code is not valid or the pump is already registered.');
    const p = await db.get('SELECT * FROM water_pumps WHERE pump_code=?', [code]);
    await logPump(p.id, 'claimed', 'Registered by farmer');
    res.status(201).json(await pumpView(p));
  }));

  app.get('/api/pumps', auth, allow('farmer', 'admin'), wrap(async (req, res) => {
    const rows = req.user.role === 'admin' ? await db.all('SELECT * FROM water_pumps ORDER BY id') : await db.all('SELECT * FROM water_pumps WHERE farmer_id=? ORDER BY id', [req.user.id]);
    res.json(await Promise.all(rows.map(async (p) => pumpView(await evalPump(p)))));
  }));

  app.put('/api/pumps/:id', auth, allow('farmer'), wrap(ownPump), wrap(async (req, res) => {
    const b = req.body || {}, p = req.pump;
    let device = p.device_id;
    if (b.device_id !== undefined) {
      if (b.device_id === null || b.device_id === '') device = null;
      else { const d = await db.get('SELECT farmer_id FROM iot_devices WHERE id=?', [b.device_id]); if (!d || d.farmer_id !== req.user.id) return fail(res, 403, 'This is not your sensor device.'); device = Number(b.device_id); }
    }
    const lo = num(b.moisture_low ?? p.moisture_low, 0, 100), hi = num(b.moisture_high ?? p.moisture_high, 0, 100);
    if (lo == null || hi == null || lo >= hi) return fail(res, 400, 'Moisture thresholds must be 0–100 and "start" must be lower than "stop".');
    const mode = b.mode === 'auto' ? 'auto' : b.mode === 'manual' ? 'manual' : p.mode;
    if (mode === 'auto' && !device) return fail(res, 400, 'Link a sensor device before using automatic mode.');
    await db.run('UPDATE water_pumps SET name=?, field_name=?, device_id=?, mode=?, moisture_low=?, moisture_high=? WHERE id=?',
      [(b.name ?? p.name ?? '').toString().slice(0, 120), (b.field_name ?? p.field_name ?? '').toString().slice(0, 160), device, mode, lo, hi, p.id]);
    if (mode !== p.mode) await logPump(p.id, 'mode', mode);
    res.json(await pumpView(await evalPump(await db.get('SELECT * FROM water_pumps WHERE id=?', [p.id]))));
  }));

  app.post('/api/pumps/:id/command', auth, allow('farmer'), wrap(ownPump), wrap(async (req, res) => {
    const state = req.body?.state === 'on' ? 'on' : req.body?.state === 'off' ? 'off' : null;
    if (!state) return fail(res, 400, 'state must be "on" or "off".');
    await db.run("UPDATE water_pumps SET desired_state=?, mode='manual' WHERE id=?", [state, req.pump.id]);
    await logPump(req.pump.id, 'manual_' + state, 'Farmer command');
    res.json(await pumpView(await db.get('SELECT * FROM water_pumps WHERE id=?', [req.pump.id])));
  }));

  app.post('/api/pumps/:id/release', auth, allow('farmer'), wrap(ownPump), wrap(async (req, res) => {
    await logPump(req.pump.id, 'released', 'Unregistered by farmer');
    await db.run("UPDATE water_pumps SET farmer_id=NULL, name=NULL, field_name=NULL, device_id=NULL, pump_key=NULL, mode='manual', desired_state='off', status='unassigned' WHERE id=?", [req.pump.id]);
    res.json({ ok: true });
  }));

  app.get('/api/pumps/:id/events', auth, allow('farmer', 'admin'), wrap(ownPump), wrap(async (req, res) =>
    res.json(await db.all('SELECT * FROM pump_events WHERE pump_id=? ORDER BY id DESC LIMIT 50', [req.pump.id]))));

  // Pump controller (ESP32 relay etc.) polls this with its QR code + key; reports whether the motor is running.
  app.get('/api/pumps-poll', rateLimit({ windowMs: 60 * 1000, limit: 120, message: { error: 'Too many requests.' } }), wrap(async (req, res) => {
    const code = normCode(req.headers['x-pump-code']), key = String(req.headers['x-pump-key'] || '');
    const p = await db.get('SELECT * FROM water_pumps WHERE pump_code=? AND pump_key=? AND farmer_id IS NOT NULL', [code, key]);
    if (!p) return fail(res, 401, 'Unknown pump code or key.');
    await evalPump(p);
    const running = req.query.running === '1' ? 'running' : req.query.running === '0' ? 'idle' : p.status;
    await db.run('UPDATE water_pumps SET last_seen=CURRENT_TIMESTAMP, status=? WHERE id=?', [running, p.id]);
    res.json({ state: p.desired_state, mode: p.mode });
  }));

  /* ───────────────────────── 6. ROLE DASHBOARDS ───────────────────────── */
  const count = async (sql, args = []) => Number((await db.get(sql, args))?.n || 0);

  app.get('/api/dashboard', auth, wrap(async (req, res) => {
    const u = req.user, role = u.role;
    if (role === 'farmer') {
      const devs = await db.all('SELECT * FROM iot_devices WHERE farmer_id=?', [u.id]);
      const views = await Promise.all(devs.map(deviceView));
      return res.json({
        role, listings: {
          total: await count('SELECT COUNT(*) AS n FROM listings WHERE farmer_id=?', [u.id]),
          available: await count("SELECT COUNT(*) AS n FROM listings WHERE farmer_id=? AND status='available'", [u.id]),
          sold: await count("SELECT COUNT(*) AS n FROM listings WHERE farmer_id=? AND status='sold'", [u.id]) },
        devices: { total: views.length, online: views.filter((v) => v.online).length, alerts: views.flatMap((v) => v.alerts.map((a) => ({ ...a, device: v.name }))).slice(0, 4) },
        advisory: { open: await count("SELECT COUNT(*) AS n FROM advisory_requests WHERE farmer_id=? AND status='open'", [u.id]), answered: await count("SELECT COUNT(*) AS n FROM advisory_requests WHERE farmer_id=? AND status='answered'", [u.id]) },
        reports: await count('SELECT COUNT(*) AS n FROM disease_reports WHERE user_id=?', [u.id]),
        pumps: { total: await count('SELECT COUNT(*) AS n FROM water_pumps WHERE farmer_id=?', [u.id]), running: await count("SELECT COUNT(*) AS n FROM water_pumps WHERE farmer_id=? AND desired_state='on'", [u.id]) },
        latestAnswer: (await db.get(`${REQ} WHERE q.farmer_id=? AND q.status='answered' ORDER BY q.answered_at DESC LIMIT 1`, [u.id])) || null,
      });
    }
    if (role === 'buyer') {
      return res.json({ role,
        available: await count("SELECT COUNT(*) AS n FROM listings WHERE status='available'"),
        farmers: await count("SELECT COUNT(DISTINCT farmer_id) AS n FROM listings WHERE status='available'"),
        topCrops: await db.all("SELECT crop_name, COUNT(*) AS listings, SUM(quantity) AS qty, MIN(price) AS min_price, MAX(unit) AS unit FROM listings WHERE status='available' GROUP BY crop_name ORDER BY listings DESC, qty DESC LIMIT 5"),
        latest: await db.all("SELECT l.*, u.name AS farmer_name FROM listings l JOIN users u ON u.id=l.farmer_id WHERE l.status='available' ORDER BY l.id DESC LIMIT 4") });
    }
    if (role === 'expert') {
      return res.json({ role,
        open: await count("SELECT COUNT(*) AS n FROM advisory_requests WHERE status='open'"),
        answered: await count('SELECT COUNT(*) AS n FROM advisory_requests WHERE expert_id=?', [u.id]),
        tips: await count('SELECT COUNT(*) AS n FROM advisory_tips WHERE expert_id=?', [u.id]),
        reports: await count('SELECT COUNT(*) AS n FROM disease_reports'),
        recentOpen: await db.all(`${REQ} WHERE q.status='open' ORDER BY q.id DESC LIMIT 4`) });
    }
    if (role === 'supplier') {
      return res.json({ role,
        farmers: await count("SELECT COUNT(*) AS n FROM users WHERE role='farmer' AND status='active'"),
        crops: await count('SELECT COUNT(DISTINCT crop_name) AS n FROM listings'),
        topCrops: await db.all('SELECT crop_name, COUNT(*) AS listings, SUM(quantity) AS qty, MAX(unit) AS unit FROM listings GROUP BY crop_name ORDER BY listings DESC, qty DESC LIMIT 6'),
        regions: await db.all("SELECT COALESCE(NULLIF(district,''),'Unspecified') AS district, COUNT(*) AS farmers FROM users WHERE role='farmer' GROUP BY COALESCE(NULLIF(district,''),'Unspecified') ORDER BY farmers DESC LIMIT 6"),
        problems: await db.all('SELECT category, COUNT(*) AS n FROM advisory_requests GROUP BY category ORDER BY n DESC LIMIT 4') });
    }
    // admin
    return res.json({ role,
      users: await count("SELECT COUNT(*) AS n FROM users WHERE role!='admin'"),
      byRole: await db.all("SELECT role, COUNT(*) AS n FROM users WHERE role!='admin' GROUP BY role"),
      listings: await count('SELECT COUNT(*) AS n FROM listings'), active: await count("SELECT COUNT(*) AS n FROM listings WHERE status='available'"),
      devices: await count('SELECT COUNT(*) AS n FROM iot_devices'), readings: await count('SELECT COUNT(*) AS n FROM sensor_readings'),
      pumps: { registered: await count('SELECT COUNT(*) AS n FROM water_pumps'), claimed: await count('SELECT COUNT(*) AS n FROM water_pumps WHERE farmer_id IS NOT NULL') },
      reports: await count('SELECT COUNT(*) AS n FROM disease_reports'),
      questions: await count('SELECT COUNT(*) AS n FROM advisory_requests'), openQuestions: await count("SELECT COUNT(*) AS n FROM advisory_requests WHERE status='open'"),
      recentUsers: (await db.all('SELECT id,name,email,role,status,created_at FROM users ORDER BY id DESC LIMIT 5')) });
  }));
}

// ───────────── Standalone mode (node server.jsx) ─────────────
async function standalone() {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  const mysql = require('mysql2/promise'); const cors = require('cors'); const jwt = require('jsonwebtoken');
  const pool = mysql.createPool({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'fosoler_khoj', connectionLimit: 10 });
  const db = {
    all: async (s, a = []) => (await pool.execute(s, a))[0],
    get: async (s, a = []) => (await pool.execute(s, a))[0][0],
    run: async (s, a = []) => (await pool.execute(s, a))[0],
  };
  await ensureModule2Tables(pool);
  const fail = (res, code, error) => res.status(code).json({ error });
  const auth = async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const id = jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret').id; // same secret/payload as server.js
      const u = await db.get('SELECT * FROM users WHERE id=?', [id]);
      if (!u) return fail(res, 401, 'Account not found. Please log in again.');
      if (u.status !== 'active') return fail(res, 403, 'Your account is suspended. Please contact admin.');
      req.user = u; next();
    } catch { fail(res, 401, 'Please log in again.'); }
  };
  const allow = (...roles) => (req, res, next) => (roles.includes(req.user.role) ? next() : fail(res, 403, 'Not allowed for your role.'));
  const app = express();
  app.use(cors());
  app.use((req, res, next) => (req.path === '/api/disease/analyze' ? next() : express.json({ limit: '100kb' })(req, res, next)));
  mountModule2({ app, db, auth, allow, fail });
  const port = Number(process.env.MODULE2_PORT || 4001);
  app.listen(port, () => console.log(`Module 2 server on http://localhost:${port}`));
}

module.exports = mountModule2;
module.exports.ensureTables = ensureModule2Tables;
module.exports.PUMP_CODES = PUMP_CODES;
module.exports.analyzePeriod = analyzePeriod;
if (require.main === module) standalone().catch((e) => { console.error(e); process.exit(1); });