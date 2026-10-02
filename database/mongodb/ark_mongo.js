// =====================================================================
// Project Ark : MongoDB setup (run with:  mongosh ark_mongo.js)
// Semi-structured / unstructured field data. Links to MySQL by IDs.
// =====================================================================
db = db.getSiblingDB("project_ark");
["field_reports","camera_traps","research_notes","rescue_docs"].forEach(c => db.getCollection(c).drop());

// ---------- 1. field_reports : sighting / incident / behaviour notes ----------
db.createCollection("field_reports", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["type","species_id","area_id","reported_by","location","observed_at","notes"],
  properties: {
    type:        { enum: ["SIGHTING","INCIDENT","BEHAVIOUR"] },
    sighting_id: { bsonType: ["number","null"], description: "MySQL sightings.sighting_id" },
    species_id:  { bsonType: "number" },
    area_id:     { bsonType: "number" },
    reported_by: { bsonType: "number" },
    location:    { bsonType: "object", required: ["type","coordinates"],
                   properties: { type: { enum: ["Point"] }, coordinates: { bsonType: "array", minItems: 2, maxItems: 2 } } },
    observed_at: { bsonType: "date" },
    notes:       { bsonType: "string", minLength: 5 },
    weather:     { bsonType: "string" },
    tags:        { bsonType: "array", items: { bsonType: "string" } },
    photos:      { bsonType: "array", items: { bsonType: "object", required: ["file_name"],
                   properties: { file_name: {bsonType:"string"}, camera: {bsonType:"string"}, size_kb: {bsonType:"number"} } } }
  }}}, validationAction: "error" });

// ---------- 2. camera_traps ----------
db.createCollection("camera_traps", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["trap_code","area_id","location","captured_at","detections"],
  properties: {
    trap_code:   { bsonType: "string" },
    area_id:     { bsonType: "number" },
    location:    { bsonType: "object" },
    captured_at: { bsonType: "date" },
    detections:  { bsonType: "array", items: { bsonType: "object", required: ["species_id","count"],
                   properties: { species_id: {bsonType:"number"}, count: {bsonType:"number", minimum: 1}, confidence: {bsonType:"number", minimum:0, maximum:1} } } },
    image_meta:  { bsonType: "object" }
  }}}});

// ---------- 3. research_notes : journals, habitat surveys, behaviour logs ----------
db.createCollection("research_notes", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["kind","title","body","author_id","created_at"],
  properties: {
    kind:       { enum: ["JOURNAL","HABITAT_SURVEY","BEHAVIOUR_LOG"] },
    title:      { bsonType: "string", minLength: 3 },
    body:       { bsonType: "string", minLength: 10 },
    author_id:  { bsonType: "number" },
    species_ids:{ bsonType: "array", items: { bsonType: "number" } },
    area_id:    { bsonType: ["number","null"] },
    survey:     { bsonType: "object", description: "flexible habitat metrics, differs per survey" },
    tags:       { bsonType: "array" },
    created_at: { bsonType: "date" }
  }}}});

// ---------- 4. rescue_docs : narrative + timeline for a MySQL rescue ----------
db.createCollection("rescue_docs", { validator: { $jsonSchema: {
  bsonType: "object",
  required: ["rescue_id","entries"],
  properties: {
    rescue_id: { bsonType: "number", description: "MySQL rescue_operations.rescue_id" },
    entries:   { bsonType: "array", items: { bsonType: "object", required: ["at","by","text"] } }
  }}}});

// ---------- Indexes ----------
db.field_reports.createIndex({ location: "2dsphere" });
db.field_reports.createIndex({ species_id: 1, observed_at: -1 });
db.field_reports.createIndex({ notes: "text", tags: "text" });
db.camera_traps.createIndex({ area_id: 1, captured_at: -1 });
db.camera_traps.createIndex({ "detections.species_id": 1 });
db.research_notes.createIndex({ title: "text", body: "text", tags: "text" }, { weights: { title: 5, tags: 3, body: 1 } });
db.research_notes.createIndex({ kind: 1, created_at: -1 });
db.rescue_docs.createIndex({ rescue_id: 1 }, { unique: true });

// ---------- Sample data ----------
db.field_reports.insertMany([
 { type:"SIGHTING", sighting_id:1, species_id:1, area_id:1, reported_by:2,
   location:{type:"Point",coordinates:[76.632,11.667]}, observed_at:new Date("2026-08-12T06:40:00Z"),
   notes:"Adult male tiger crossing the Moolehole road, calm, moved into bamboo thicket.",
   weather:"Clear", tags:["tiger","road-crossing"], photos:[{file_name:"T017_001.jpg",camera:"Nikon D500",size_kb:4210}] },
 { type:"SIGHTING", sighting_id:2, species_id:2, area_id:1, reported_by:2,
   location:{type:"Point",coordinates:[76.6105,11.6801]}, observed_at:new Date("2026-08-14T17:10:00Z"),
   notes:"Herd of seven elephants including two calves at waterhole.", tags:["elephant","herd","calves"] },
 { type:"INCIDENT", species_id:1, area_id:1, reported_by:2,
   location:{type:"Point",coordinates:[76.64,11.66]}, observed_at:new Date("2026-09-28T05:00:00Z"),
   notes:"Wire snare found near boundary; tiger pugmarks with drag marks. Possible poaching.",
   tags:["snare","poaching"] },
 { type:"BEHAVIOUR", species_id:5, area_id:2, reported_by:3,
   location:{type:"Point",coordinates:[76.1203,12.0021]}, observed_at:new Date("2026-09-02T08:05:00Z"),
   notes:"Troop of macaques foraging on jackfruit, alpha male vocalising frequently.", tags:["foraging","macaque"] }
]);

db.camera_traps.insertMany([
 { trap_code:"BNP-CT-07", area_id:1, location:{type:"Point",coordinates:[76.63,11.67]},
   captured_at:new Date("2026-09-20T02:14:00Z"),
   detections:[{species_id:1,count:1,confidence:0.97}], image_meta:{resolution:"1920x1080",infrared:true,battery:62} },
 { trap_code:"BNP-CT-07", area_id:1, location:{type:"Point",coordinates:[76.63,11.67]},
   captured_at:new Date("2026-09-22T19:40:00Z"),
   detections:[{species_id:2,count:3,confidence:0.91}], image_meta:{resolution:"1920x1080",infrared:false} },
 { trap_code:"NNP-CT-02", area_id:2, location:{type:"Point",coordinates:[76.15,12.01]},
   captured_at:new Date("2026-09-23T04:02:00Z"),
   detections:[{species_id:1,count:1,confidence:0.88},{species_id:5,count:4,confidence:0.79}], image_meta:{infrared:true} }
]);

db.research_notes.insertMany([
 { kind:"HABITAT_SURVEY", title:"Bandipur waterhole survey – post monsoon", author_id:3, area_id:1, species_ids:[1,2],
   body:"Surveyed 14 waterholes. 11 hold water. Invasive Lantana camara spreading along the eastern range, reducing grazing for prey species.",
   survey:{ waterholes_checked:14, waterholes_dry:3, invasive_species:["Lantana camara"], canopy_cover_pct:48 },
   tags:["waterhole","lantana","invasive"], created_at:new Date("2026-09-05") },
 { kind:"JOURNAL", title:"Great Indian Bustard breeding observations", author_id:3, area_id:3, species_ids:[3],
   body:"Two females observed displaying nesting behaviour. Power lines near the grassland remain the biggest collision threat.",
   tags:["breeding","power lines","bustard"], created_at:new Date("2026-09-12") },
 { kind:"BEHAVIOUR_LOG", title:"Lion-tailed macaque troop dynamics", author_id:3, area_id:2, species_ids:[5],
   body:"Troop size 18. Juveniles spend more time on the ground near the road, increasing roadkill risk.",
   survey:{ troop_size:18, juveniles:6 }, tags:["macaque","roadkill"], created_at:new Date("2026-09-18") }
]);

db.rescue_docs.insertOne({ rescue_id:1, entries:[
  { at:new Date("2026-09-28T05:30:00Z"), by:2, text:"Rescue reported: tiger with snare injury on right foreleg." },
  { at:new Date("2026-09-28T07:10:00Z"), by:2, text:"Team Bandipur Alpha dispatched with tranquiliser kit." }
]});

// ---------- Aggregation pipelines (NoSQL aggregation demo) ----------
print("\n-- A1: detections per species from camera traps");
printjson(db.camera_traps.aggregate([
  { $unwind: "$detections" },
  { $group: { _id: "$detections.species_id", captures: { $sum: 1 }, individuals: { $sum: "$detections.count" },
              avg_conf: { $avg: "$detections.confidence" } } },
  { $sort: { individuals: -1 } }
]).toArray());

print("\n-- A2: field reports by type per area");
printjson(db.field_reports.aggregate([
  { $group: { _id: { area: "$area_id", type: "$type" }, n: { $sum: 1 } } },
  { $sort: { "_id.area": 1 } }
]).toArray());

print("\n-- A3: full-text search in research notes for 'invasive'");
printjson(db.research_notes.find({ $text: { $search: "invasive lantana" } },
  { title: 1, score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } }).toArray());

print("\n-- A4: geo query: field reports within 5 km of Bandipur HQ");
printjson(db.field_reports.find({ location: { $near: { $geometry: { type: "Point", coordinates: [76.63, 11.665] }, $maxDistance: 5000 } } },
  { type: 1, notes: 1 }).toArray());

print("\n-- A5: validation test (should FAIL)");
try { db.field_reports.insertOne({ type: "RUMOUR", notes: "x" }); } catch (e) { print("Rejected: " + e.message); }
