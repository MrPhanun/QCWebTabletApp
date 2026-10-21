// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// ---- Language: app text in Khmer or English (switch in the top bar). The OQC record sheet keeps its own bilingual labels.
const LANG_KEY = 'qc-lang';
let LANG = 'km';
try { LANG = localStorage.getItem(LANG_KEY) || 'km'; } catch {}
// key: [English, Khmer]; {name} is filled from vars; {s} is the English plural "s"
const STR = {
  'u.search': ['Search ID, name, role, department…', 'ស្វែងរក ID ឈ្មោះ តួនាទី ផ្នែក…'],
  'u.id': ['ID', 'ID'], 'u.name': ['Username', 'ឈ្មោះអ្នកប្រើ'], 'u.role': ['Role', 'តួនាទី'], 'u.dept': ['Department', 'ផ្នែក'],
  'u.created': ['Created', 'បង្កើត'], 'u.updated': ['Last updated', 'កែប្រែចុងក្រោយ'],
  'u.count': ['{n} user{s}', 'អ្នកប្រើ {n} នាក់'], 'u.countOf': ['{n} of {total} users', '{n} ក្នុងចំណោម {total} នាក់'],
  'u.none': ['No users match', 'រកមិនឃើញអ្នកប្រើដែលត្រូវគ្នាទេ'], 'u.noDept': ['—', '—'],
  'u.password': ['Password', 'ពាក្យសម្ងាត់'], 'u.phId': ['e.g. 2398', 'ឧ. 2398'], 'u.phName': ['Name', 'ឈ្មោះ'], 'u.phDept': ['e.g. QC', 'ឧ. QC'],
  'u.phPass': ['Password', 'ពាក្យសម្ងាត់'], 'u.phPassKeep': ['Leave blank to keep', 'ទុកទទេ ដើម្បីរក្សាដដែល'],
  'u.editing': ['Editing {id} · {name}', 'កំពុងកែប្រែ {id} · {name}'],
  'u.added': ['Added {id} · {name}', 'បានបន្ថែម {id} · {name}'], 'u.saved': ['Saved {id} · {name}', 'បានរក្សាទុក {id} · {name}'],
  'u.deleted': ['Deleted {id} · {name}', 'បានលុប {id} · {name}'],
  'u.delT': ['Delete this user?', 'លុបអ្នកប្រើនេះ?'],
  'u.delM': ['<b>{id} · {name}</b> will no longer be able to log in, and their permissions are removed.', '<b>{id} · {name}</b> នឹងមិនអាចចូលប្រើបានទៀតទេ ហើយសិទ្ធិរបស់ពួកគេនឹងត្រូវលុបចោល។'],
  'u.errId': ['ID must be 1 to 10 letters, digits, dot, dash or underscore', 'ID ត្រូវមាន 1 ដល់ 10 តួអក្សរ (អក្សរ លេខ . - _)'],
  'u.errName': ['Enter a username', 'សូមបញ្ចូលឈ្មោះអ្នកប្រើ'], 'u.errPass': ['Enter a password', 'សូមបញ្ចូលពាក្យសម្ងាត់'],
  'e.noPerm': ['You do not have permission to do this', 'អ្នកមិនមានសិទ្ធិធ្វើការនេះទេ'],
  'p.view': ['View', 'មើល'], 'p.add': ['Add', 'បន្ថែម'], 'p.edit': ['Edit', 'កែប្រែ'], 'p.delete': ['Delete', 'លុប'], 'p.excel': ['Excel', 'Excel'],
  'r.search': ['Search user…', 'ស្វែងរកអ្នកប្រើ…'], 'r.user': ['User', 'អ្នកប្រើ'],
  'r.default': ['Default', 'លំនាំដើម'], 'r.custom': ['Custom', 'កំណត់ផ្ទាល់'], 'r.all': ['Tick / untick for everyone in the list', 'ធីក / ដោះធីក សម្រាប់អ្នកទាំងអស់ក្នុងបញ្ជី'],
  'r.changes': ['{n} unsaved change{s}', 'មានការកែប្រែ {n} មិនទាន់រក្សាទុក'], 'r.saved': ['Permissions saved', 'បានរក្សាទុកសិទ្ធិ'],
  'r.reset': ['Reset', 'កំណត់ឡើងវិញ'], 'r.resetT': ['Reset {name} to default?', 'កំណត់ {name} ទៅលំនាំដើមវិញ?'],
  'r.resetM': ['Their ticks are removed and they follow the standard rules again (everyone views, QC edits, Admin manages users).', 'ការធីកទាំងអស់នឹងត្រូវដកចេញ ហើយពួកគេនឹងប្រើច្បាប់ស្តង់ដារវិញ (អ្នកទាំងអស់មើលបាន QC កែប្រែបាន Admin គ្រប់គ្រងអ្នកប្រើ)។'],
  'r.readonly': ['View only — you cannot change permissions.', 'មើលបានតែប៉ុណ្ណោះ — អ្នកមិនអាចកែប្រែសិទ្ធិបានទេ។'],
  'r.hint': ['Tick what each user can see (View) and which buttons they can use. Click a column title to tick it for everyone. Users marked Default follow the standard rules until you change them.', 'ធីកអ្វីដែលអ្នកប្រើម្នាក់ៗអាចមើល (មើល) និងប៊ូតុងដែលពួកគេអាចប្រើ។ ចុចចំណងជើងជួរឈរ ដើម្បីធីកសម្រាប់អ្នកទាំងអស់។ អ្នកប្រើដែលមានស្លាក លំនាំដើម ប្រើច្បាប់ស្តង់ដារ រហូតដល់អ្នកកែប្រែ។'],
  'b.excel': ['Excel', 'Excel'], 'e.excel': ['Could not create the Excel file', 'មិនអាចបង្កើតឯកសារ Excel បានទេ'],
  'o.excelDone': ['Downloaded {file}', 'បានទាញយក {file}'],
  'vt.btn': ['Video tip', 'វីដេអូណែនាំ'], 'vt.title': ['Video tip — how it works', 'វីដេអូណែនាំ — របៀបប្រើ'], 'b.close': ['Close', 'បិទ'],
  'b.save': ['Save', 'រក្សាទុក'], 'b.search': ['Search', 'ស្វែងរក'], 'b.new': ['New form', 'ទម្រង់ថ្មី'], 'b.print': ['Print', 'បោះពុម្ព'],
  'b.addPage': ['Add page', 'បន្ថែមទំព័រ'], 'b.nextPage': ['Next page', 'ទំព័របន្ទាប់'], 'b.removePage': ['Remove page', 'លុបទំព័រ'],
  'b.close': ['Close', 'បិទ'], 'b.open': ['Open', 'បើក'], 'b.add': ['Add', 'បន្ថែម'], 'b.edit': ['Edit', 'កែប្រែ'], 'b.copy': ['Copy', 'ចម្លង'],
  'b.delete': ['Delete', 'លុប'], 'b.view': ['View', 'មើល'], 'b.cancel': ['Cancel', 'បោះបង់'], 'b.logout': ['Logout', 'ចាកចេញ'],
  'b.expandAll': ['Expand all', 'ពង្រីកទាំងអស់'], 'b.collapseAll': ['Collapse all', 'បង្រួមទាំងអស់'], 'b.ok': ['OK', 'យល់ព្រម'],
  'b.gotIt': ['Got it', 'យល់ហើយ'], 'b.keep': ['Keep it', 'ទុកវាដដែល'], 'b.remove': ['Remove', 'លុប'], 'b.continue': ['Continue', 'បន្ត'],
  'b.stay': ['Stay here', 'នៅទីនេះ'], 'b.replace': ['Replace it', 'ជំនួសវា'], 'b.clearIt': ['Yes, clear it', 'បាទ/ចាស សម្អាតវា'],
  'b.keepEditing': ['Keep editing', 'បន្តកែប្រែ'],
  't.hideMenu': ['Hide menu', 'លាក់ម៉ឺនុយ'], 't.showMenu': ['Show menu', 'បង្ហាញម៉ឺនុយ'], 't.prevPage': ['Previous page', 'ទំព័រមុន'],
  't.removeThisPage': ['Remove this page', 'លុបទំព័រនេះ'], 't.onlyQcSave': ['Only QC department users can save', 'មានតែអ្នកប្រើផ្នែក QC ប៉ុណ្ណោះដែលអាចរក្សាទុកបាន'],
  't.language': ['Language', 'ភាសា'],
  'ph.menu': ['Search menu', 'ស្វែងរកម៉ឺនុយ'], 'menu.empty': ['No menu items match.', 'រកមិនឃើញម៉ឺនុយដែលត្រូវគ្នាទេ។'],
  'loading': ['Loading…', 'កំពុងផ្ទុក…'], 'notBuilt': ['This screen is not built yet.', 'អេក្រង់នេះមិនទាន់បានបង្កើតនៅឡើយទេ។'],
  'm.dashboard': ['Dashboard', 'ផ្ទាំងគ្រប់គ្រង'], 'm.master': ['Master Data', 'ទិន្នន័យមេ'], 'm.sampling': ['OQC Inspection', 'ការត្រួតពិនិត្យ OQC'],
  'm.spec': ['តំលៃប្រវែងកំនត់ / SPEC', 'តំលៃប្រវែងកំនត់ / SPEC'], 'm.reports': ['Reports', 'របាយការណ៍'],
  'm.daily': ['OQC Data Information', 'ព័ត៌មានទិន្នន័យ OQC'], 'm.draft': ['Search Draft / Save', 'ស្វែងរកតារាងព្រៀង និង រក្សាទុក'], 'm.defect': ['Defect Analysis', 'ការវិភាគចំណុចខូច'],
  'm.supplier': ['Supplier Quality', 'គុណភាពអ្នកផ្គត់ផ្គង់'], 'm.admin': ['Administration', 'រដ្ឋបាលប្រព័ន្ធ'],
  'm.users': ['User Management', 'គ្រប់គ្រងអ្នកប្រើប្រាស់'], 'm.roles': ['Roles & Permissions', 'តួនាទី និងសិទ្ធិ'],
  'e.server': ['Cannot reach the server', 'មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ'], 'e.session': ['Session expired', 'វគ្គប្រើប្រាស់បានផុតកំណត់'],
  'e.request': ['Request failed ({status})', 'សំណើបរាជ័យ ({status})'],
  'd.noPrintT': ["Can't print yet", 'មិនទាន់អាចបោះពុម្ពបានទេ'],
  'd.noPrintM': ['The print template did not load. Refresh the page and try again.', 'គំរូបោះពុម្ពមិនបានផ្ទុកទេ។ សូមផ្ទុកទំព័រឡើងវិញ ហើយសាកល្បងម្តងទៀត។'],
  // table headers / fields
  'h.customer': ['Customer', 'អតិថិជន'], 'h.itemCode': ['Item Code', 'លេខកូដទំនិញ'], 'h.partNo': ['Part No', 'Part No'],
  'h.type': ['Type', 'ប្រភេទ'], 'see.more': ['See more ({n})', 'មើលបន្ថែម ({n})'], 'see.less': ['See less', 'បង្រួម'], 'cust.all': ['All Customers', 'គ្រប់អតិថិជន'], 'type.all': ['All Types', 'គ្រប់ប្រភេទ'], 'type.sample': ['Sample', 'Sample'], 'type.normal': ['Normal', 'Normal'], 'type.firstSlot': ['First Lot', 'First Lot'],
  'h.wire': ['Wire', 'ខ្សែ'], 'h.terminal': ['Terminal', 'ធឺរមីណល'], 'h.housing': ['Housing', 'ហៅស៊ីង'], 'h.other': ['Other', 'ផ្សេងៗ'],
  'h.length': ['Length', 'ប្រវែង'], 'h.lastUpdated': ['Last updated', 'កែប្រែចុងក្រោយ'], 'h.lot': ['Lot №', 'Lot №'], 'h.box': ['Box', 'Box'],
  'h.checkDate': ['Check date', 'ថ្ងៃត្រួតពិនិត្យ'], 'h.pages': ['Pages', 'ទំព័រ'], 'h.status': ['Status', 'ស្ថានភាព'], 'h.total': ['Total', 'សរុប'],
  'h.lastSaved': ['Last saved', 'រក្សាទុកចុងក្រោយ'],
  // OQC Inspection ranges
  'sp.readonly': ['View only — only QC department users can add, edit or delete ranges.', 'មើលបានតែប៉ុណ្ណោះ — មានតែអ្នកប្រើផ្នែក QC ទេដែលអាចបន្ថែម កែប្រែ ឬលុបជួរបាន។'],
  'sp.level': ['Level', 'កម្រិត'], 'sp.ship': ['Shipment Qty', 'ចំនួនដឹកជញ្ជូន'], 'sp.inspAll': ['Inspection All Qty', 'ចំនួនត្រួតពិនិត្យសរុប'],
  'ph.range': ['e.g. 101-150', 'ឧ. 101-150'], 'ph.qty': ['e.g. 100', 'ឧ. 100'],
  'sp.gap': ['⚠ Gap: Shipment Qty {from}-{to} has no {level} range', '⚠ ចន្លោះ៖ ចំនួនដឹកជញ្ជូន {from}-{to} មិនមានជួរ {level} ទេ'],
  'sp.count': ['{n} range{s}', '{n} ជួរ'], 'sp.none': ['No {level} ranges yet', 'មិនទាន់មានជួរ {level} នៅឡើយទេ'],
  'sp.editing': ['Editing {level} {range}', 'កំពុងកែប្រែ {level} {range}'],
  'sp.delT': ['Delete this range?', 'លុបជួរនេះ?'],
  'sp.delM': ['<b>{level} {range}</b> → Inspection All Qty <b>{qty}</b> will be gone for good.', '<b>{level} {range}</b> → ចំនួនត្រួតពិនិត្យសរុប <b>{qty}</b> នឹងត្រូវលុបជាអចិន្ត្រៃយ៍។'],
  'sp.deleted': ['Deleted {level} {range}', 'បានលុប {level} {range}'],
  'sp.errRange': ['Shipment Qty must be a range like 101-150', 'ចំនួនដឹកជញ្ជូនត្រូវតែជាជួរ ដូចជា 101-150'],
  'sp.errOrder': ['In Shipment Qty, the second number must be greater than or equal to the first', 'ក្នុងចំនួនដឹកជញ្ជូន លេខទីពីរត្រូវតែធំជាង ឬស្មើលេខទីមួយ'],
  'sp.errQty': ['Inspection All Qty must be a whole number like 100', 'ចំនួនត្រួតពិនិត្យសរុបត្រូវតែជាចំនួនគត់ ដូចជា 100'],
  'sp.saved': ['Saved {level} {range} → Inspection All Qty {qty}', 'បានរក្សាទុក {level} {range} → ចំនួនត្រួតពិនិត្យសរុប {qty}'],
  'sp.added': ['Added {level} {range} → Inspection All Qty {qty}', 'បានបន្ថែម {level} {range} → ចំនួនត្រួតពិនិត្យសរុប {qty}'],
  // SPEC
  'sc.readonly': ['View only — only QC department users can add, edit or delete SPEC.', 'មើលបានតែប៉ុណ្ណោះ — មានតែអ្នកប្រើផ្នែក QC ទេដែលអាចបន្ថែម កែប្រែ ឬលុប SPEC បាន។'],
  'ph.scSearch': ['Search Customer, Part No, material, SPEC…', 'ស្វែងរក អតិថិជន Part No សម្ភារៈ SPEC…'],
  'sc.count': ['{n} item{s}', '{n} មុខ'], 'sc.countOf': ['{n} of {total} items', '{n} ក្នុងចំណោម {total} មុខ'],
  'sc.noMatch': ['No items match the search', 'រកមិនឃើញមុខទំនិញដែលត្រូវគ្នាទេ'], 'sc.none': ['No SPEC yet', 'មិនទាន់មាន SPEC នៅឡើយទេ'],
  'sc.new': ['New SPEC', 'SPEC ថ្មី'], 'sc.edit': ['Edit {code}', 'កែប្រែ {code}'], 'sc.copyT': ['New SPEC (copy)', 'SPEC ថ្មី (ចម្លង)'],
  'sc.copiedFrom': ['copied from {code} — enter the new Part No', 'ចម្លងពី {code} — សូមបញ្ចូល Part No ថ្មី'],
  'sc.delT': ['Delete this SPEC?', 'លុប SPEC នេះ?'],
  'sc.delM': ['Part No <b>{code}</b>{part} and all its length lines will be gone for good.', 'Part No <b>{code}</b>{part} និងបន្ទាត់ប្រវែងទាំងអស់របស់វា នឹងត្រូវលុបជាអចិន្ត្រៃយ៍។'],
  'sc.deleted': ['Deleted {code}', 'បានលុប {code}'], 'sc.needCode': ['Enter the Part No', 'សូមបញ្ចូល Part No'],
  'sc.saved': ['Saved {code}', 'បានរក្សាទុក {code}'], 'sc.added': ['Added {code}', 'បានបន្ថែម {code}'],
  'sc.maxPages': ['A SPEC can have up to {n} pages', 'SPEC មួយអាចមានរហូតដល់ {n} ទំព័រ'],
  'sc.removeM': ['The length lines on this page will be removed and the later pages move up one page.', 'បន្ទាត់ប្រវែងនៅលើទំព័រនេះនឹងត្រូវលុប ហើយទំព័របន្ទាប់នឹងឡើងមកមួយទំព័រ។'],
  // OQC Data Information
  'ph.scan': ['Scan label barcode', 'ស្កេនបាកូដ'], 'ph.badge': ['Scan badge or type', 'ស្កេនកាត ឬវាយបញ្ចូល'],
  'ph.find': ['Search Lot, Box, Item Code, Part No, Customer, Inspector…', 'ស្វែងរក Lot, Box, លេខកូដទំនិញ, Part No, អតិថិជន, អ្នកត្រួតពិនិត្យ…'],
  'pg': ['Page {n} / {total}', 'ទំព័រ {n} / {total}'], 'st.complete': ['Can Print', 'អាចបោះពុម្ពបាន'], 'st.draft': ['Draft', 'ព្រាង'],
  'rec.count': ['{n} record{s}', '{n} កំណត់ត្រា'], 'rec.noMatch': ['No saved records match', 'រកមិនឃើញកំណត់ត្រាដែលត្រូវគ្នាទេ'],
  'rec.none': ['No saved records yet', 'មិនទាន់មានកំណត់ត្រាដែលបានរក្សាទុកទេ'],
  'st.new': ['New', 'ថ្មី'], 'st.newUnsaved': ['New · not saved', 'ថ្មី · មិនទាន់រក្សាទុក'], 'st.saved': ['Saved #{id}', 'បានរក្សាទុក #{id}'],
  'st.changed': ['Saved #{id} · unsaved changes', 'បានរក្សាទុក #{id} · មានការកែប្រែមិនទាន់រក្សាទុក'],
  'o.chooseProb': ['Choose Probability (Normal or Strict) to fill Spot Check', 'សូមជ្រើសរើស Probability (Normal ឬ Strict) ដើម្បីបំពេញ Spot Check'],
  'o.enterQty': ['Enter Quantity to fill Spot Check', 'សូមបញ្ចូលចំនួនផលិត ដើម្បីបំពេញ Spot Check'],
  'o.spot': ['Spot Check {n} — {prob}, Shipment Qty {range}', 'Spot Check {n} — {prob}, ចំនួនដឹកជញ្ជូន {range}'],
  'o.noRange': ['No {prob} range covers Quantity {qty} — add one in Master Data › OQC Inspection', 'គ្មានជួរ {prob} ដែលគ្របដណ្តប់ចំនួន {qty} ទេ — សូមបន្ថែមនៅ ទិន្នន័យមេ › ការត្រួតពិនិត្យ OQC'],
  'o.badCode': ['Hmm, "{code}" isn\'t a label code. Scan the Barcode on the label — it looks like 26-0700394/8802/4500/002', 'អូ "{code}" មិនមែនជាបាកូដទេ។ សូមស្កេន Barcode នៅលើស្លាក — វាមានទម្រង់ដូចជា 26-0700394/8802/4500/002'],
  'o.openedSaved': ['Opened saved record — Lot {lot}, Box {box} ({state}, saved by {by} {date}). Change what you need and Save to update.', 'បានបើកកំណត់ត្រាដែលបានរក្សាទុក — Lot {lot}, Box {box} ({state}, រក្សាទុកដោយ {by} {date})។ កែប្រែតាមត្រូវការ ហើយចុច រក្សាទុក ដើម្បីធ្វើបច្ចុប្បន្នភាព។'],
  'o.scanned': ['Scanned Lot {lot}, Box {box}, Item Code {item}', 'បានស្កេន Lot {lot}, Box {box}, លេខកូដទំនិញ {item}'],
  'o.delT': ['Delete this record?', 'លុបកំណត់ត្រានេះ?'],
  'o.delM': ['<b>{label}</b> and all its pages will be deleted. This cannot be undone.', '<b>{label}</b> និងទំព័រទាំងអស់របស់វានឹងត្រូវលុប។ មិនអាចយកមកវិញបានទេ។'],
  'o.deleted': ['Deleted {label}', 'បានលុប {label}'],
  'o.labelFound':['Part No {part}, Qty {qty} from Marunix', 'Part No {part} ចំនួន {qty} ពី Marunix'],
  'o.labelMissing': ['Label {lot} / {item} / Box {box} is not in Marunix — Lot and Qty are taken from the barcode', 'រកមិនឃើញស្លាក {lot} / {item} / Box {box} ក្នុង Marunix ទេ — Lot និងចំនួន យកពីបាកូដ'],
  'o.enterPart':['Enter the Part No to fill Customer and SPEC', 'សូមបញ្ចូល Part No ដើម្បីបំពេញ អតិថិជន និង SPEC'],
  'o.specFound': ['SPEC of Part No {part} filled', 'បានបំពេញ SPEC របស់ Part No {part}'], 'o.lines': ['{n} length lines', '{n} បន្ទាត់ប្រវែង'],
  'o.specPages': ['{n} pages (22 lines each)', '{n} ទំព័រ (22 បន្ទាត់ក្នុងមួយទំព័រ)'],
  'o.noSpec': ['No SPEC for Part No {part} — add it in Master Data › SPEC', 'គ្មាន SPEC សម្រាប់ Part No {part} — សូមបន្ថែមនៅ ទិន្នន័យមេ › SPEC'],
  'o.badge': ['{field}: {name} (ID {id})', '{field}៖ {name} (ID {id})'],
  'o.pageAdded': ['Page {n} added — copied from page {from} without the Length Check', 'បានបន្ថែមទំព័រ {n} — ចម្លងពីទំព័រ {from} ដោយគ្មានការត្រួតពិនិត្យប្រវែង'],
  'o.removeT': ['Remove page {n}?', 'លុបទំព័រ {n}?'],
  'o.removeM': ['Everything on this page will be removed. The other pages stay.', 'អ្វីៗទាំងអស់នៅលើទំព័រនេះនឹងត្រូវលុប។ ទំព័រផ្សេងទៀតនៅដដែល។'],
  'o.pageRemoved': ['Page removed — {n} page{s} left', 'បានលុបទំព័រ — នៅសល់ {n} ទំព័រ'],
  'o.lenPos': ['Length № {no}: Length Position', 'ប្រវែង № {no}៖ ទីតាំងប្រវែង'], 'o.lenSample': ['Length № {no}: sample {list}', 'ប្រវែង № {no}៖ គំរូ {list}'],
  'o.badLot': ['Lot № must be a date: DD-MM-YYYY.', 'Lot № ត្រូវតែជាកាលបរិច្ឆេទ៖ ថ្ងៃ-ខែ-ឆ្នាំ។'], 'ph.lotDate': ['DD-MM-YYYY', 'ថ្ងៃ-ខែ-ឆ្នាំ'], 'ph.dateFmt': ['DD-MM-YYYY', 'ថ្ងៃ-ខែ-ឆ្នាំ'], 't.pickDate': ['Pick a date', 'ជ្រើសរើសកាលបរិច្ឆេទ'],
  'o.shipDate': ['Shipment Date', 'ថ្ងៃដឹកជញ្ជូន'], 'o.needShip': ['Pick the Shipment Date to save.', 'សូមជ្រើសរើសថ្ងៃដឹកជញ្ជូន ដើម្បីរក្សាទុក។'],
  'h.shipQty': ['Shipment Qty', 'ចំនួនដឹកជញ្ជូន'], 'h.excelStatus': ['Excel Status', 'ស្ថានភាព Excel'], 'h.pdfStatus': ['PDF Status', 'ស្ថានភាព PDF'], 'st.all': ['All', 'ទាំងអស់'], 'st.printed': ['Printed', 'បានព្រីន'],
  'o.chooseSpecT': ['Choose the SPEC', 'ជ្រើសរើស SPEC'], 'o.chooseSpecM': ['Part No {part} has {n} SPECs. Which one does this item need?', 'Part No {part} មាន SPEC {n}។ តើទំនិញនេះត្រូវប្រើមួយណា?'],
  'o.specNotChosen': ['No SPEC chosen for {part}. Scan again or press Enter in Part No to choose.', 'មិនបានជ្រើស SPEC សម្រាប់ {part}។ ស្កេនម្តងទៀត ឬចុច Enter ក្នុង Part No ដើម្បីជ្រើស។'],
  'o.shipFrom': ['Shipment from', 'ថ្ងៃដឹកជញ្ជូនពី'], 'o.shipTo': ['to', 'ដល់'], 'h.shipDate': ['Shipment Date', 'ថ្ងៃដឹកជញ្ជូន'], 'b.pdf': ['PDF', 'PDF'],
  'dr.pick': ['Click a row first, then press Excel or PDF.', 'សូមចុចជួរមួយជាមុនសិន រួចចុច Excel ឬ PDF។'],
  'dr.notReadyM': ['This record is a draft, so some points are still empty. Excel and PDF need every point filled in. Open it to complete?', 'កំណត់ត្រានេះជាសេចក្តីព្រាង នៅមានចំណុចទទេ។ Excel និង PDF ត្រូវការបំពេញគ្រប់ចំណុច។ បើកដើម្បីបំពេញឬទេ?'],
  'dr.cantPrintT': ["Can't print yet", 'មិនទាន់អាចបោះពុម្ពបានទេ'],
  'dr.cantPrint': ['{label} is still a draft. Excel and PDF need every point filled in: open it, complete the empty fields and Save.', '{label} នៅជាសេចក្តីព្រាង។ Excel និង PDF ត្រូវការបំពេញគ្រប់ចំណុច៖ សូមបើក បំពេញចំណុចទទេ រួចចុច រក្សាទុក។'],
  'o.fileOpened': ['Saved {file} in {folder} and opened it.', 'បានរក្សាទុក {file} ក្នុង {folder} ហើយបើកវា។'],
  'o.pdfSent': ['Saved the PDF {file} in {folder}', 'បានរក្សាទុក PDF {file} ក្នុង {folder}'],
  'dr.openFix': ['Open to complete', 'បើកដើម្បីបំពេញ'],
  'dr.draftT': ['This record is a draft', 'កំណត់ត្រានេះជាសេចក្តីព្រាង'],
  'dr.draftM': ['Some fields are not complete yet. Continue anyway?', 'ព័ត៌មានខ្លះមិនទាន់គ្រប់គ្រាន់ទេ។ បន្តដែរឬទេ?'],
  'o.notReadyT': ['Not ready to print yet', 'មិនទាន់រួចរាល់សម្រាប់បោះពុម្ពទេ'],
  'o.notReadyM': ['Fill in every point first — the empty fields are outlined in red.', 'សូមបំពេញគ្រប់ចំណុចជាមុនសិន — ចំណុចដែលនៅទទេត្រូវបានគូសពណ៌ក្រហម។'],
  'o.pageN': ['Page {n}', 'ទំព័រ {n}'], 'o.more': ['and {n} more', 'និង {n} ទៀត'],
  'o.discardT': ['Unsaved changes', 'ការកែប្រែមិនទាន់រក្សាទុក'],
  'o.discardM': ['This form has changes that are not saved. Leave them and continue?', 'ទម្រង់នេះមានការកែប្រែដែលមិនទាន់បានរក្សាទុក។ ទុកវាចោល ហើយបន្តឬ?'],
  'o.onlyQc': ['Only QC department users can save OQC records', 'មានតែអ្នកប្រើផ្នែក QC ប៉ុណ្ណោះដែលអាចរក្សាទុកកំណត់ត្រា OQC បាន'],
  'o.needLot': ['Lot № is needed to save — scan the label or type the Lot №', 'ត្រូវការ Lot № ដើម្បីរក្សាទុក — សូមស្កេនស្លាក ឬវាយ Lot №'],
  'o.saved': ['Saved #{id} — Lot {lot}{box} · {n} page{s} · {state}', 'បានរក្សាទុក #{id} — Lot {lot}{box} · {n} ទំព័រ · {state}'],
  'o.draftLong': ['Draft (not every point filled yet)', 'ព្រាង (មិនទាន់បំពេញគ្រប់ចំណុច)'],
  'o.dupT': ['Already saved', 'បានរក្សាទុករួចហើយ'],
  'o.dupM': ['{err} (record #{id}). Replace that saved record with this form?', '{err} (កំណត់ត្រា #{id})។ ជំនួសកំណត់ត្រានោះដោយទម្រង់នេះឬ?'],
  'o.notSaved': ['Not saved — open the saved record with Search or by scanning its label to update it', 'មិនបានរក្សាទុកទេ — សូមបើកកំណត់ត្រាដែលបានរក្សាទុក តាមរយៈ ស្វែងរក ឬស្កេនស្លាករបស់វា ដើម្បីធ្វើបច្ចុប្បន្នភាព'],
  'o.openedRec': ['Opened saved record #{id} — Lot {lot}{box} ({state}). Change what you need and Save to update.', 'បានបើកកំណត់ត្រា #{id} — Lot {lot}{box} ({state})។ កែប្រែតាមត្រូវការ ហើយចុច រក្សាទុក ដើម្បីធ្វើបច្ចុប្បន្នភាព។'],
  'o.freshT': ['Start fresh?', 'ចាប់ផ្តើមថ្មី?'],
  'o.freshM': ['Every page of this form will be cleared so you can start a new one.', 'គ្រប់ទំព័រនៃទម្រង់នេះនឹងត្រូវសម្អាត ដើម្បីអោយអ្នកចាប់ផ្តើមទម្រង់ថ្មី។']
};
function t(key, vars) {
  const e = STR[key];
  let out = e ? e[LANG === 'km' ? 1 : 0] : key;
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => k === 's' && !('s' in vars) ? (Number(vars.n) === 1 ? '' : 's') : (vars[k] ?? ''));
  return out;
}
// Static text that follows the language switch in place: T() for text, P() placeholder, TT() tooltip/label
const T = (key, vars) => `<span data-t="${key}"${vars ? ` data-tv="${esc(JSON.stringify(vars))}"` : ''}>${esc(t(key, vars))}</span>`;
const P = key => `placeholder="${esc(t(key))}" data-tp="${key}"`;
const TT = key => `title="${esc(t(key))}" aria-label="${esc(t(key))}" data-tt="${key}"`;
function applyLang(root = document) {
  root.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t, el.dataset.tv ? JSON.parse(el.dataset.tv) : null); });
  root.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = t(el.dataset.tp); });
  root.querySelectorAll('.date-wrap').forEach(w => w._sync && w._sync());
  root.querySelectorAll('[data-tt]').forEach(el => { el.title = t(el.dataset.tt); el.setAttribute('aria-label', t(el.dataset.tt)); });
  document.documentElement.lang = LANG;
  document.querySelectorAll('.lang-switch button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === LANG));
}
// Field names used in messages (the sheet labels themselves stay as on the template)
const FIELD_KM = {
  'Check date': 'ថ្ងៃត្រួតពិនិត្យ', CUSTOMER: 'អតិថិជន', 'PART №': 'ឈ្មោះផលិតផល', 'LOT №': 'លេខឡត', QUANTITY: 'ចំនួនផលិត',
  'SPOT CHECK': 'ចំនួនចាប់ត្រួតពិនិត្យ', Probability: 'ប្រូបាបចាប់ពិនិត្យ', 'Material check': 'ត្រួតពិនិត្យវត្ថុធាតុដើម',
  'Material Wire': 'វត្ថុធាតុដើម ខ្សែ', 'Material Terminal': 'វត្ថុធាតុដើម ធឺរមីណល', 'Material Housing': 'វត្ថុធាតុដើម ហៅស៊ីង', 'Material Other': 'វត្ថុធាតុដើម ផ្សេងៗ',
  'Length Check result': 'លទ្ធផលត្រួតពិនិត្យប្រវែង', 'Total Determination': 'សរុបលទ្ធផល', 'Checked by': 'ត្រួតពិនិត្យដោយ', Inspector: 'អ្នកត្រួតពិនិត្យ'
};
const fieldName = en => LANG === 'km' ? (FIELD_KM[en] || (OQC_ITEMS.find(i => i[1] === en) || [])[0]?.replace(/^(?:\d+\)|[①-⑨])\s*/, '') || en) : en;
// Field names inside server messages ("Lot № must be 50 characters or less")
const SERVER_FIELD_KM = {
  'Lot №': 'លេខឡត', Box: 'ប្រអប់', 'Item Code': 'Item Code', 'Part №': 'ឈ្មោះផលិតផល', 'Part No': 'Part No', Customer: 'អតិថិជន',
  customer: 'អតិថិជន', wire: 'ខ្សែ', terminal: 'ធឺរមីណល', housing: 'ហៅស៊ីង', other: 'ផ្សេងៗ',
  Probability: 'ប្រូបាបចាប់ពិនិត្យ', Total: 'សរុបលទ្ធផល', Inspector: 'អ្នកត្រួតពិនិត្យ', 'Checked by': 'ត្រួតពិនិត្យដោយ',
  Username: 'ឈ្មោះអ្នកប្រើ', Department: 'ផ្នែក', Password: 'ពាក្យសម្ងាត់'
};
// Server messages are English; show them in Khmer when Khmer is chosen
const SERVER_KM = [
  [/^Not logged in$/, 'មិនទាន់បានចូលប្រើ'], [/^Session expired$/, 'វគ្គប្រើប្រាស់បានផុតកំណត់'], [/^Database error$/, 'បញ្ហាមូលដ្ឋានទិន្នន័យ'],
  [/^Cannot connect to the database$/, 'មិនអាចភ្ជាប់ទៅមូលដ្ឋានទិន្នន័យបានទេ'], [/^Invalid request$/, 'សំណើមិនត្រឹមត្រូវ'],
  [/^Only QC department users can .*$/, 'មានតែអ្នកប្រើផ្នែក QC ប៉ុណ្ណោះដែលអាចធ្វើការនេះបាន'],
  [/^No SPEC for Part No (.+?) — .*$/, 'គ្មាន SPEC សម្រាប់ Part No $1 — សូមបន្ថែមនៅ ទិន្នន័យមេ › SPEC'],
  [/^Not a valid label barcode$/, 'មិនមែនជាបាកូដស្លាកត្រឹមត្រូវទេ'], [/^Not a valid staff ID$/, 'ID បុគ្គលិកមិនត្រឹមត្រូវ'],
  [/^No user with ID (.+)$/, 'រកមិនឃើញអ្នកប្រើដែលមាន ID $1'],
  [/^Part No (.+) already has a SPEC with the same Wire, Terminal, Housing and Other$/, 'Part No $1 មាន SPEC ដែលមាន Wire, Terminal, Housing និង Other ដូចគ្នារួចហើយ'],
  [/^Part No is required$/, 'ត្រូវការ Part No'], [/^Give a Part No$/, 'សូមបញ្ចូល Part No'],
  [/^No (Normal|Strict) range covers (\d+)$/, 'គ្មានជួរ $1 ដែលគ្របដណ្តប់ $2 ទេ'],
  [/^Overlaps the existing (\w+) range (.+)$/, 'ជាន់គ្នាជាមួយជួរ $1 ដែលមានស្រាប់ $2'],
  [/^This (range|item|record) no longer exists$/, 'ទិន្នន័យនេះលែងមានទៀតហើយ'],
  [/^Lot № is required to save.*$/, 'ត្រូវការ Lot № ដើម្បីរក្សាទុក — សូមស្កេនស្លាក ឬវាយ Lot №'],
  [/^Lot (.+?)(, Box .+)? is already saved$/, 'Lot $1$2 បានរក្សាទុករួចហើយ'],
  [/^You do not have permission to do this$/, 'អ្នកមិនមានសិទ្ធិធ្វើការនេះទេ'],
  [/^You cannot remove your own Roles & Permissions access$/, 'អ្នកមិនអាចដកសិទ្ធិ តួនាទី និងសិទ្ធិ ពីខ្លួនឯងបានទេ'],
  [/^At least one user must keep Roles & Permissions access$/, 'ត្រូវមានអ្នកប្រើយ៉ាងហោចណាស់ម្នាក់ ដែលនៅមានសិទ្ធិ តួនាទី និងសិទ្ធិ'],
  [/^Only Admin users can view users$/, 'មានតែអ្នកប្រើ Admin ប៉ុណ្ណោះដែលអាចមើលអ្នកប្រើបាន'],
  [/^ID (.+) already exists$/, 'ID $1 មានរួចហើយ'], [/^ID is required$/, 'ត្រូវការ ID'],
  [/^ID must be 1 to 10 .*$/, 'ID ត្រូវមាន 1 ដល់ 10 តួអក្សរ (អក្សរ លេខ . - _)'],
  [/^Username is required$/, 'ត្រូវការឈ្មោះអ្នកប្រើ'], [/^Password is required$/, 'ត្រូវការពាក្យសម្ងាត់'],
  [/^Role must be Admin or User$/, 'តួនាទីត្រូវតែជា Admin ឬ User'],
  [/^([^:]+) must be (\d+) characters or less$/, (m, f, n) => `${SERVER_FIELD_KM[f] || f} ត្រូវមិនលើសពី ${n} តួអក្សរ`],
  [/^Total must be OK or NG$/, 'សរុបលទ្ធផលត្រូវតែជា OK ឬ NG'],
  [/^Length № must be 1-(\d+)$/, 'លេខប្រវែង № ត្រូវនៅចន្លោះ 1-$1'],
  [/^Length № (\d+): Position and SPEC must be (\d+) characters or less$/, 'ប្រវែង № $1: ទីតាំង និង SPEC ត្រូវមិនលើសពី $2 តួអក្សរ'],
  [/^Length № (\d+): SPEC - and \+ must be (\d+) characters or less$/, 'ប្រវែង № $1: SPEC - និង + ត្រូវមិនលើសពី $2 តួអក្សរ'],
  [/^Length № (\d+) is given twice$/, 'ប្រវែង № $1 ត្រូវបានបញ្ចូលពីរដង'],
  [/^Level must be Normal or Strict$/, 'កម្រិតត្រូវតែជា Normal ឬ Strict'],
  [/^Shipment Qty From and To must be whole numbers of 1 or more$/, 'Shipment Qty ពី និង ដល់ ត្រូវតែជាចំនួនគត់ចាប់ពី 1 ឡើងទៅ'],
  [/^Shipment Qty "To" must be greater than or equal to "From"$/, 'Shipment Qty "ដល់" ត្រូវធំជាង ឬស្មើ "ពី"'],
  [/^Inspection All Qty must be a whole number of 1 or more$/, 'Inspection All Qty ត្រូវតែជាចំនួនគត់ចាប់ពី 1 ឡើងទៅ'],
  [/^Give level \(Normal or Strict\) and qty \(whole number\)$/, 'សូមផ្តល់កម្រិត (Normal ឬ Strict) និងចំនួន (ចំនួនគត់)'],
  [/^Method not allowed$/, 'មិនអនុញ្ញាតសកម្មភាពនេះទេ'], [/^Not found$/, 'រកមិនឃើញ'],
  [/^Please enter ID and password$/, 'សូមបញ្ចូលអាយឌី និងពាក្យសម្ងាត់'], [/^Incorrect ID or password$/, 'អាយឌី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ'],
  [/^You cannot delete your own user$/, 'អ្នកមិនអាចលុបអ្នកប្រើរបស់ខ្លួនឯងបានទេ'],
  [/^This user no longer exists$/, 'អ្នកប្រើនេះលែងមានទៀតហើយ'],
  [/^Could not create the Excel file$/, 'មិនអាចបង្កើតឯកសារ Excel បានទេ'],
  [/^A record needs 1 to 50 pages$/, 'កំណត់ត្រាមួយត្រូវមានពី 1 ដល់ 50 ទំព័រ'], [/^This record is too large to save$/, 'កំណត់ត្រានេះធំពេកមិនអាចរក្សាទុកបាន']
];
// Level "Hard" in the database is shown as "Strict" everywhere (same word as on the OQC record)
const LVL = l => l === 'Hard' ? 'Strict' : l;
const trServer = m => { m = m.replace(/\bHard\b/g, 'Strict'); if (LANG !== 'km') return m; for (const [re, km] of SERVER_KM) if (re.test(m)) return m.replace(re, km); return m; };
// The current screen re-draws its lists / counters when the language changes
let langHook = null;
