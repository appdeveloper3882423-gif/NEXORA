
import { auth, db, googleProvider } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const VERSION = "2.3.0";
const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  profile: {},
  category: "general",
  page: "dashboard",
  records: [],
  editingId: null,
  activeModule: null,
  search: "",
  filter: "all",
  busy: false
};

const CATEGORIES = {
  general: {
    name: "General Business", icon: "◈",
    description: "Keep your business operations, customers, projects and finances organized.",
    nav: [
      ["dashboard","Overview","▦"],["customers","Customers","♙"],["projects","Projects","◫"],
      ["tasks","Tasks","✓"],["invoices","Invoices","▤"],["expenses","Expenses","↘"],
      ["employees","Team","♧"],["reports","Reports","▥"]
    ],
    modules: {
      customers:{title:"Customers",singular:"Customer",icon:"♙",desc:"Manage customer details and follow-ups.",fields:[
        ["name","Customer name","text","required"],["email","Email","email"],["phone","Phone","tel"],["company","Company","text"],["status","Status","select","Active|Lead|Inactive"],["notes","Notes","textarea"]]},
      projects:{title:"Projects",singular:"Project",icon:"◫",desc:"Track projects, budgets, deadlines and progress.",fields:[
        ["name","Project name","text","required"],["client","Client","text"],["status","Status","select","Planning|In progress|On hold|Completed"],["startDate","Start date","date"],["dueDate","Due date","date"],["budget","Budget (PKR)","number"],["progress","Progress (%)","number"],["notes","Notes","textarea"]]},
      tasks:{title:"Tasks",singular:"Task",icon:"✓",desc:"Organize daily work and deadlines.",fields:[
        ["name","Task title","text","required"],["assignedTo","Assigned to","text"],["priority","Priority","select","Low|Normal|High|Urgent"],["status","Status","select","Pending|In progress|Completed"],["dueDate","Due date","date"],["notes","Details","textarea"]]},
      invoices:{title:"Invoices",singular:"Invoice",icon:"▤",desc:"Record invoices and payment status.",fields:[
        ["name","Invoice title / number","text","required"],["customer","Customer","text"],["amount","Amount (PKR)","number","required"],["issueDate","Issue date","date"],["dueDate","Due date","date"],["status","Status","select","Draft|Sent|Paid|Overdue"],["notes","Notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Expense",icon:"↘",desc:"Track business spending.",fields:[
        ["name","Expense title","text","required"],["category","Category","select","Supplies|Rent|Salary|Travel|Utilities|Other"],["amount","Amount (PKR)","number","required"],["date","Expense date","date","required"],["paymentMethod","Payment method","select","Cash|Bank transfer|Card|Other"],["notes","Notes","textarea"]]},
      employees:{title:"Team",singular:"Team member",icon:"♧",desc:"Keep a simple team directory.",fields:[
        ["name","Full name","text","required"],["email","Email","email"],["phone","Phone","tel"],["role","Job title","text"],["department","Department","text"],["status","Status","select","Active|On leave|Inactive"]]}
    }
  },
  retail: {
    name:"Retail & Inventory",icon:"▣",description:"Monitor stock, sales, suppliers and customer orders.",
    nav:[["dashboard","Overview","▦"],["products","Products & Stock","▣"],["sales","Sales","↗"],["customers","Customers","♙"],["suppliers","Suppliers","♧"],["expenses","Expenses","↘"],["reports","Reports","▥"]],
    modules:{
      products:{title:"Products & Stock",singular:"Product",icon:"▣",desc:"Track products, stock quantity and selling price.",fields:[["name","Product name","text","required"],["sku","SKU / Barcode","text"],["category","Product category","text"],["quantity","Stock quantity","number","required"],["minStock","Minimum stock alert","number"],["costPrice","Cost price (PKR)","number"],["price","Selling price (PKR)","number","required"],["supplier","Supplier","text"],["expiryDate","Expiry date","date"],["notes","Notes","textarea"]]},
      sales:{title:"Sales",singular:"Sale",icon:"↗",desc:"Record sales and payment status.",fields:[["name","Sale / product description","text","required"],["customer","Customer","text"],["quantity","Quantity sold","number","required"],["amount","Total sale (PKR)","number","required"],["cost","Total cost (PKR)","number"],["date","Sale date","date","required"],["paymentStatus","Payment status","select","Paid|Pending|Partial"],["notes","Notes","textarea"]]},
      customers:{title:"Customers",singular:"Customer",icon:"♙",desc:"Manage retail customers.",fields:[["name","Customer name","text","required"],["phone","Phone","tel"],["email","Email","email"],["address","Address","textarea"],["notes","Notes","textarea"]]},
      suppliers:{title:"Suppliers",singular:"Supplier",icon:"♧",desc:"Maintain supplier contacts.",fields:[["name","Supplier name","text","required"],["contact","Contact person","text"],["phone","Phone","tel"],["email","Email","email"],["address","Address","textarea"],["notes","Notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Expense",icon:"↘",desc:"Track store operating costs.",fields:[["name","Expense","text","required"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","select","Rent|Utilities|Transport|Supplies|Salary|Other"],["notes","Notes","textarea"]]}
    }
  },
  restaurant:{
    name:"Restaurant & Cafe",icon:"♨",description:"Organize your menu, orders, tables and purchasing.",
    nav:[["dashboard","Overview","▦"],["menu","Menu Items","☷"],["orders","Orders","▤"],["tables","Tables & Bookings","▦"],["inventory","Ingredients & Stock","▣"],["suppliers","Suppliers","♧"],["expenses","Expenses","↘"],["reports","Reports","▥"]],
    modules:{
      menu:{title:"Menu Items",singular:"Menu item",icon:"☷",desc:"Manage menu prices and availability.",fields:[["name","Item name","text","required"],["category","Menu category","select","Starter|Main course|Dessert|Beverage|Other"],["price","Price (PKR)","number","required"],["cost","Estimated cost (PKR)","number"],["availability","Availability","select","Available|Unavailable"],["notes","Description / notes","textarea"]]},
      orders:{title:"Orders",singular:"Order",icon:"▤",desc:"Record orders and their progress.",fields:[["name","Order / items","text","required"],["table","Table / pickup","text"],["customer","Customer","text"],["quantity","Items quantity","number"],["amount","Order total (PKR)","number","required"],["status","Order status","select","New|Preparing|Ready|Served|Cancelled"],["date","Order date","date","required"],["notes","Notes","textarea"]]},
      tables:{title:"Tables & Bookings",singular:"Booking",icon:"▦",desc:"Track reservations and table bookings.",fields:[["name","Guest / booking name","text","required"],["table","Table number","text"],["guests","Number of guests","number"],["date","Booking date","date","required"],["time","Booking time","time"],["status","Status","select","Booked|Seated|Completed|Cancelled"],["phone","Phone","tel"],["notes","Notes","textarea"]]},
      inventory:{title:"Ingredients & Stock",singular:"Ingredient",icon:"▣",desc:"Track ingredients and stock levels.",fields:[["name","Ingredient","text","required"],["quantity","Quantity in stock","number","required"],["unit","Unit","select","Kg|Gram|Liter|Bottle|Pack|Piece"],["minStock","Minimum stock","number"],["cost","Unit cost (PKR)","number"],["expiryDate","Expiry date","date"],["notes","Notes","textarea"]]},
      suppliers:{title:"Suppliers",singular:"Supplier",icon:"♧",desc:"Keep supplier contacts and notes.",fields:[["name","Supplier name","text","required"],["phone","Phone","tel"],["email","Email","email"],["products","Supplied items","text"],["notes","Notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Expense",icon:"↘",desc:"Record restaurant costs.",fields:[["name","Expense","text","required"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","select","Ingredients|Staff|Rent|Utilities|Repairs|Other"],["notes","Notes","textarea"]]}
    }
  },
  services:{
    name:"Services & Agency",icon:"✳",description:"Manage clients, service projects, tasks and billing.",
    nav:[["dashboard","Overview","▦"],["clients","Clients","♙"],["projects","Projects","◫"],["tasks","Tasks","✓"],["appointments","Appointments","◷"],["invoices","Invoices","▤"],["expenses","Expenses","↘"],["reports","Reports","▥"]],
    modules:{
      clients:{title:"Clients",singular:"Client",icon:"♙",desc:"Manage clients and contact details.",fields:[["name","Client name","text","required"],["company","Company","text"],["email","Email","email"],["phone","Phone","tel"],["status","Status","select","Lead|Active|Inactive"],["notes","Notes","textarea"]]},
      projects:{title:"Projects",singular:"Project",icon:"◫",desc:"Track service delivery and project progress.",fields:[["name","Project name","text","required"],["client","Client","text"],["service","Service type","text"],["status","Status","select","New|In progress|On hold|Completed"],["startDate","Start date","date"],["dueDate","Due date","date"],["amount","Project fee (PKR)","number"],["progress","Progress (%)","number"],["notes","Notes","textarea"]]},
      tasks:{title:"Tasks",singular:"Task",icon:"✓",desc:"Track team tasks and due dates.",fields:[["name","Task","text","required"],["assignedTo","Assigned to","text"],["priority","Priority","select","Low|Normal|High|Urgent"],["status","Status","select","Pending|In progress|Completed"],["dueDate","Due date","date"],["notes","Notes","textarea"]]},
      appointments:{title:"Appointments",singular:"Appointment",icon:"◷",desc:"Schedule customer meetings and sessions.",fields:[["name","Appointment title","text","required"],["client","Client","text"],["date","Date","date","required"],["time","Time","time"],["location","Location / meeting link","text"],["status","Status","select","Scheduled|Completed|Cancelled"],["notes","Notes","textarea"]]},
      invoices:{title:"Invoices",singular:"Invoice",icon:"▤",desc:"Track client billing.",fields:[["name","Invoice number / title","text","required"],["client","Client","text"],["amount","Amount (PKR)","number","required"],["dueDate","Due date","date"],["status","Status","select","Draft|Sent|Paid|Overdue"],["notes","Notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Expense",icon:"↘",desc:"Record agency expenses.",fields:[["name","Expense","text","required"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","text"],["notes","Notes","textarea"]]}
    }
  },
  healthcare:{
    name:"Healthcare",icon:"✚",description:"Organize appointments, patients, services and payments.",
    nav:[["dashboard","Overview","▦"],["patients","Patients","♙"],["appointments","Appointments","◷"],["services","Services","✚"],["billing","Billing","▤"],["supplies","Medical Supplies","▣"],["staff","Staff","♧"],["reports","Reports","▥"]],
    modules:{
      patients:{title:"Patients",singular:"Patient",icon:"♙",desc:"Store basic patient administration details. Avoid unnecessary sensitive clinical information.",fields:[["name","Patient name / reference","text","required"],["phone","Phone","tel"],["email","Email","email"],["date","Registration date","date"],["status","Status","select","Active|Follow-up|Inactive"],["notes","Administrative notes","textarea"]]},
      appointments:{title:"Appointments",singular:"Appointment",icon:"◷",desc:"Manage appointment schedule and status.",fields:[["name","Patient / booking reference","text","required"],["date","Appointment date","date","required"],["time","Time","time"],["provider","Provider / staff","text"],["type","Appointment type","text"],["status","Status","select","Scheduled|Completed|Cancelled|No show"],["notes","Administrative notes","textarea"]]},
      services:{title:"Services",singular:"Service",icon:"✚",desc:"Manage services and fees.",fields:[["name","Service name","text","required"],["category","Service category","text"],["price","Fee (PKR)","number","required"],["duration","Duration","text"],["status","Status","select","Available|Unavailable"],["notes","Notes","textarea"]]},
      billing:{title:"Billing",singular:"Bill",icon:"▤",desc:"Record bills and payment status.",fields:[["name","Bill / reference number","text","required"],["patient","Patient reference","text"],["amount","Amount (PKR)","number","required"],["date","Bill date","date","required"],["status","Payment status","select","Pending|Paid|Partial|Waived"],["notes","Notes","textarea"]]},
      supplies:{title:"Medical Supplies",singular:"Supply item",icon:"▣",desc:"Track supply inventory. Not a clinical or prescribing system.",fields:[["name","Item name","text","required"],["quantity","Quantity","number","required"],["unit","Unit","select","Box|Pack|Bottle|Piece|Vial|Other"],["minStock","Minimum stock alert","number"],["expiryDate","Expiry date","date"],["cost","Unit cost (PKR)","number"],["notes","Notes","textarea"]]},
      staff:{title:"Staff",singular:"Staff member",icon:"♧",desc:"Maintain staff directory.",fields:[["name","Staff name","text","required"],["role","Role / designation","text"],["phone","Phone","tel"],["email","Email","email"],["status","Status","select","Active|On leave|Inactive"],["notes","Notes","textarea"]]}
    }
  },
  education:{
    name:"Education",icon:"▤",description:"Manage students, courses, attendance and fee records.",
    nav:[["dashboard","Overview","▦"],["students","Students","♙"],["courses","Courses","▤"],["attendance","Attendance","✓"],["fees","Fee Records","▤"],["staff","Staff","♧"],["announcements","Announcements","◉"],["reports","Reports","▥"]],
    modules:{
      students:{title:"Students",singular:"Student",icon:"♙",desc:"Maintain student records.",fields:[["name","Student name","text","required"],["studentId","Student ID","text"],["className","Class / grade","text"],["guardian","Parent / guardian","text"],["phone","Contact number","tel"],["email","Email","email"],["enrollmentDate","Enrollment date","date"],["status","Status","select","Active|Graduated|Inactive"],["notes","Notes","textarea"]]},
      courses:{title:"Courses",singular:"Course",icon:"▤",desc:"Manage courses and enrollment information.",fields:[["name","Course name","text","required"],["code","Course code","text"],["teacher","Teacher","text"],["duration","Duration","text"],["fee","Course fee (PKR)","number"],["status","Status","select","Active|Completed|Planned"],["notes","Notes","textarea"]]},
      attendance:{title:"Attendance",singular:"Attendance entry",icon:"✓",desc:"Record attendance entries.",fields:[["name","Student name / ID","text","required"],["className","Class / course","text"],["date","Date","date","required"],["status","Attendance","select","Present|Absent|Late|Excused"],["notes","Notes","textarea"]]},
      fees:{title:"Fee Records",singular:"Fee record",icon:"▤",desc:"Track fee payments and balances.",fields:[["name","Student name / ID","text","required"],["amount","Amount (PKR)","number","required"],["date","Payment date","date","required"],["period","Fee period","text"],["status","Status","select","Paid|Pending|Partial|Waived"],["method","Payment method","select","Cash|Bank transfer|Other"],["notes","Notes","textarea"]]},
      staff:{title:"Staff",singular:"Staff member",icon:"♧",desc:"Maintain school staff details.",fields:[["name","Full name","text","required"],["role","Designation","text"],["department","Department","text"],["phone","Phone","tel"],["email","Email","email"],["status","Status","select","Active|On leave|Inactive"]]},
      announcements:{title:"Announcements",singular:"Announcement",icon:"◉",desc:"Record school announcements.",fields:[["name","Announcement title","text","required"],["audience","Audience","select","All|Students|Parents|Staff"],["date","Publish date","date"],["status","Status","select","Draft|Published|Archived"],["notes","Announcement details","textarea"]]}
    }
  },
  construction:{
    name:"Construction",icon:"⌂",description:"Track sites, projects, materials, contractors and costs.",
    nav:[["dashboard","Overview","▦"],["projects","Projects & Sites","◫"],["materials","Materials","▣"],["contractors","Contractors","♧"],["tasks","Tasks","✓"],["expenses","Project Expenses","↘"],["equipment","Equipment","⚙"],["reports","Reports","▥"]],
    modules:{
      projects:{title:"Projects & Sites",singular:"Project",icon:"◫",desc:"Monitor construction sites and project progress.",fields:[["name","Project / site name","text","required"],["client","Client","text"],["location","Location","text"],["manager","Site manager","text"],["startDate","Start date","date"],["dueDate","Target completion","date"],["budget","Budget (PKR)","number"],["progress","Progress (%)","number"],["status","Status","select","Planning|In progress|On hold|Completed"],["notes","Notes","textarea"]]},
      materials:{title:"Materials",singular:"Material",icon:"▣",desc:"Track material stock and cost.",fields:[["name","Material name","text","required"],["quantity","Quantity","number","required"],["unit","Unit","select","Bag|Kg|Ton|Meter|Piece|Liter|Other"],["site","Project / site","text"],["cost","Unit cost (PKR)","number"],["supplier","Supplier","text"],["notes","Notes","textarea"]]},
      contractors:{title:"Contractors",singular:"Contractor",icon:"♧",desc:"Manage contractor contacts.",fields:[["name","Contractor / company","text","required"],["contact","Contact person","text"],["phone","Phone","tel"],["specialty","Specialty","text"],["project","Project","text"],["status","Status","select","Active|Pending|Inactive"],["notes","Notes","textarea"]]},
      tasks:{title:"Tasks",singular:"Task",icon:"✓",desc:"Track site activities and deadlines.",fields:[["name","Task / activity","text","required"],["project","Project / site","text"],["assignedTo","Assigned to","text"],["dueDate","Due date","date"],["priority","Priority","select","Low|Normal|High|Urgent"],["status","Status","select","Pending|In progress|Completed"],["notes","Notes","textarea"]]},
      expenses:{title:"Project Expenses",singular:"Expense",icon:"↘",desc:"Record project costs.",fields:[["name","Expense","text","required"],["project","Project / site","text"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","select","Materials|Labor|Transport|Equipment|Other"],["notes","Notes","textarea"]]},
      equipment:{title:"Equipment",singular:"Equipment item",icon:"⚙",desc:"Track equipment and maintenance.",fields:[["name","Equipment name","text","required"],["assetId","Asset ID","text"],["site","Assigned site","text"],["condition","Condition","select","Good|Needs maintenance|Under repair"],["lastService","Last service date","date"],["nextService","Next service date","date"],["notes","Notes","textarea"]]}
    }
  },
  manufacturing:{
    name:"Manufacturing",icon:"⚙",description:"Manage production, raw materials, stock and quality checks.",
    nav:[["dashboard","Overview","▦"],["products","Finished Products","▣"],["production","Production Runs","⚙"],["materials","Raw Materials","◫"],["suppliers","Suppliers","♧"],["quality","Quality Checks","✓"],["expenses","Expenses","↘"],["reports","Reports","▥"]],
    modules:{
      products:{title:"Finished Products",singular:"Product",icon:"▣",desc:"Track finished goods and stock.",fields:[["name","Product name","text","required"],["sku","SKU / code","text"],["quantity","Quantity in stock","number","required"],["unit","Unit","select","Piece|Pack|Box|Kg|Liter|Other"],["cost","Unit cost (PKR)","number"],["price","Unit price (PKR)","number"],["status","Status","select","Available|Low stock|Discontinued"],["notes","Notes","textarea"]]},
      production:{title:"Production Runs",singular:"Production run",icon:"⚙",desc:"Record production batches and outcomes.",fields:[["name","Batch / product","text","required"],["batchId","Batch ID","text"],["quantity","Planned quantity","number","required"],["produced","Actual produced","number"],["startDate","Start date","date"],["endDate","End date","date"],["status","Status","select","Planned|Running|Completed|On hold"],["notes","Notes","textarea"]]},
      materials:{title:"Raw Materials",singular:"Raw material",icon:"◫",desc:"Track raw material inventory.",fields:[["name","Material name","text","required"],["quantity","Quantity","number","required"],["unit","Unit","select","Kg|Ton|Liter|Meter|Piece|Other"],["minStock","Minimum stock","number"],["cost","Unit cost (PKR)","number"],["supplier","Supplier","text"],["notes","Notes","textarea"]]},
      suppliers:{title:"Suppliers",singular:"Supplier",icon:"♧",desc:"Manage vendor information.",fields:[["name","Supplier name","text","required"],["contact","Contact person","text"],["phone","Phone","tel"],["email","Email","email"],["materials","Materials supplied","text"],["notes","Notes","textarea"]]},
      quality:{title:"Quality Checks",singular:"Quality check",icon:"✓",desc:"Log quality inspections and results.",fields:[["name","Product / batch","text","required"],["inspector","Inspector","text"],["date","Inspection date","date","required"],["result","Result","select","Pass|Fail|Needs review"],["defects","Defect count","number"],["notes","Findings / notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Expense",icon:"↘",desc:"Record factory operating costs.",fields:[["name","Expense","text","required"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","select","Materials|Labor|Utilities|Maintenance|Other"],["notes","Notes","textarea"]]}
    }
  },
  realestate:{
    name:"Real Estate",icon:"⌂",description:"Manage property listings, clients, viewings and transactions.",
    nav:[["dashboard","Overview","▦"],["properties","Properties","⌂"],["clients","Clients & Leads","♙"],["viewings","Viewings","◷"],["deals","Deals","▤"],["expenses","Expenses","↘"],["agents","Agents","♧"],["reports","Reports","▥"]],
    modules:{
      properties:{title:"Properties",singular:"Property",icon:"⌂",desc:"Manage listings and property status.",fields:[["name","Property title / address","text","required"],["propertyType","Property type","select","House|Apartment|Commercial|Plot|Land|Other"],["purpose","Purpose","select","Sale|Rent"],["price","Asking price (PKR)","number"],["location","Location","text"],["bedrooms","Bedrooms","number"],["area","Area / size","text"],["status","Listing status","select","Available|Reserved|Sold|Rented"],["notes","Description / notes","textarea"]]},
      clients:{title:"Clients & Leads",singular:"Client",icon:"♙",desc:"Track property buyers, sellers and tenants.",fields:[["name","Client name","text","required"],["phone","Phone","tel"],["email","Email","email"],["interest","Property interest","text"],["budget","Budget (PKR)","number"],["status","Lead status","select","New|Contacted|Qualified|Converted|Inactive"],["notes","Notes","textarea"]]},
      viewings:{title:"Viewings",singular:"Viewing",icon:"◷",desc:"Schedule property visits.",fields:[["name","Client / property","text","required"],["date","Viewing date","date","required"],["time","Time","time"],["agent","Agent","text"],["status","Status","select","Scheduled|Completed|Rescheduled|Cancelled"],["notes","Notes","textarea"]]},
      deals:{title:"Deals",singular:"Deal",icon:"▤",desc:"Track property transactions and commissions.",fields:[["name","Deal / property","text","required"],["client","Client","text"],["agent","Agent","text"],["amount","Deal value (PKR)","number","required"],["commission","Commission (PKR)","number"],["date","Deal date","date"],["status","Status","select","Negotiation|Pending|Closed|Cancelled"],["notes","Notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Expense",icon:"↘",desc:"Track agency expenses.",fields:[["name","Expense","text","required"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","text"],["notes","Notes","textarea"]]},
      agents:{title:"Agents",singular:"Agent",icon:"♧",desc:"Maintain agent contacts.",fields:[["name","Agent name","text","required"],["phone","Phone","tel"],["email","Email","email"],["specialty","Specialty","text"],["status","Status","select","Active|Inactive"],["notes","Notes","textarea"]]}
    }
  },
  transport:{
    name:"Transport & Logistics",icon:"➜",description:"Track vehicles, deliveries, drivers, routes and costs.",
    nav:[["dashboard","Overview","▦"],["shipments","Shipments","➜"],["vehicles","Vehicles","▣"],["drivers","Drivers","♙"],["routes","Routes","↗"],["maintenance","Maintenance","⚙"],["expenses","Expenses","↘"],["reports","Reports","▥"]],
    modules:{
      shipments:{title:"Shipments",singular:"Shipment",icon:"➜",desc:"Manage delivery records and tracking status.",fields:[["name","Shipment / tracking ID","text","required"],["customer","Customer","text"],["origin","Pickup location","text"],["destination","Delivery destination","text"],["dispatchDate","Dispatch date","date"],["deliveryDate","Expected delivery","date"],["amount","Delivery charge (PKR)","number"],["status","Status","select","Pending|In transit|Delivered|Delayed|Cancelled"],["notes","Notes","textarea"]]},
      vehicles:{title:"Vehicles",singular:"Vehicle",icon:"▣",desc:"Track fleet and vehicle details.",fields:[["name","Vehicle name / registration","text","required"],["vehicleType","Vehicle type","select","Car|Van|Truck|Bike|Trailer|Other"],["capacity","Load capacity","text"],["driver","Assigned driver","text"],["status","Status","select","Available|On route|Under maintenance|Inactive"],["lastService","Last service date","date"],["notes","Notes","textarea"]]},
      drivers:{title:"Drivers",singular:"Driver",icon:"♙",desc:"Maintain driver records.",fields:[["name","Driver name","text","required"],["phone","Phone","tel"],["license","License reference","text"],["vehicle","Assigned vehicle","text"],["status","Status","select","Available|On duty|On leave|Inactive"],["notes","Notes","textarea"]]},
      routes:{title:"Routes",singular:"Route",icon:"↗",desc:"Record routes and trip details.",fields:[["name","Route name","text","required"],["origin","Origin","text"],["destination","Destination","text"],["distance","Distance","text"],["estimatedTime","Estimated time","text"],["status","Status","select","Active|Inactive"],["notes","Notes","textarea"]]},
      maintenance:{title:"Maintenance",singular:"Maintenance record",icon:"⚙",desc:"Track service and repairs.",fields:[["name","Vehicle / work","text","required"],["date","Service date","date","required"],["cost","Cost (PKR)","number"],["provider","Workshop / provider","text"],["nextService","Next service date","date"],["status","Status","select","Scheduled|In progress|Completed"],["notes","Notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Expense",icon:"↘",desc:"Track transport costs.",fields:[["name","Expense","text","required"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","select","Fuel|Repairs|Tolls|Salary|Other"],["notes","Notes","textarea"]]}
    }
  },
  agriculture:{
    name:"Agriculture",icon:"❋",description:"Track crops, fields, inputs, harvests and farm expenses.",
    nav:[["dashboard","Overview","▦"],["crops","Crops & Fields","❋"],["inventory","Farm Supplies","▣"],["activities","Farm Activities","✓"],["harvests","Harvests","↗"],["equipment","Equipment","⚙"],["expenses","Expenses","↘"],["reports","Reports","▥"]],
    modules:{
      crops:{title:"Crops & Fields",singular:"Crop / field",icon:"❋",desc:"Track crops, field details and growing cycles.",fields:[["name","Crop / field name","text","required"],["fieldId","Field reference","text"],["area","Field area","text"],["season","Season","text"],["plantingDate","Planting date","date"],["expectedHarvest","Expected harvest","date"],["status","Crop status","select","Planned|Growing|Ready to harvest|Harvested"],["notes","Notes","textarea"]]},
      inventory:{title:"Farm Supplies",singular:"Farm supply",icon:"▣",desc:"Track seed, fertilizer and supply inventory.",fields:[["name","Supply name","text","required"],["category","Category","select","Seeds|Fertilizer|Tools|Irrigation|Feed|Other"],["quantity","Quantity","number","required"],["unit","Unit","select","Bag|Kg|Liter|Pack|Piece|Other"],["minStock","Minimum stock","number"],["cost","Unit cost (PKR)","number"],["expiryDate","Expiry date","date"],["notes","Notes","textarea"]]},
      activities:{title:"Farm Activities",singular:"Farm activity",icon:"✓",desc:"Record irrigation, spraying and field work.",fields:[["name","Activity","text","required"],["field","Field / crop","text"],["date","Activity date","date","required"],["assignedTo","Assigned to","text"],["cost","Cost (PKR)","number"],["status","Status","select","Planned|In progress|Completed"],["notes","Notes","textarea"]]},
      harvests:{title:"Harvests",singular:"Harvest record",icon:"↗",desc:"Record harvested quantity and sales value.",fields:[["name","Crop / harvest","text","required"],["field","Field","text"],["date","Harvest date","date","required"],["quantity","Quantity harvested","number","required"],["unit","Unit","select","Kg|Ton|Bag|Crate|Other"],["price","Total sale value (PKR)","number"],["buyer","Buyer","text"],["notes","Notes","textarea"]]},
      equipment:{title:"Equipment",singular:"Equipment item",icon:"⚙",desc:"Track farm equipment and service dates.",fields:[["name","Equipment name","text","required"],["assetId","Asset / registration ID","text"],["condition","Condition","select","Good|Needs maintenance|Under repair"],["lastService","Last service date","date"],["nextService","Next service date","date"],["notes","Notes","textarea"]]},
      expenses:{title:"Expenses",singular:"Farm expense",icon:"↘",desc:"Record farm operating costs.",fields:[["name","Expense","text","required"],["amount","Amount (PKR)","number","required"],["date","Date","date","required"],["category","Category","select","Seeds|Fertilizer|Labor|Fuel|Equipment|Other"],["notes","Notes","textarea"]]}
    }
  }
};

const BASE_FIELDS = [
  ["name","Record name","text","required"],
  ["status","Status","select","Open|In progress|Completed|On hold"],
  ["date","Date","date"],
  ["notes","Notes","textarea"]
];

const MODULE_META = {
  dashboard:{title:"Overview",icon:"▦"},
  reports:{title:"Reports",icon:"▥"},
  settings:{title:"Settings",icon:"⚙"}
};

function category(){return CATEGORIES[state.category] || CATEGORIES.general;}
function moduleMeta(key){return category().modules[key] || {title:MODULE_META[key]?.title || key,icon:MODULE_META[key]?.icon || "◈",desc:"Manage your workspace records.",fields:BASE_FIELDS};}
function moduleKeys(){return category().nav.filter(n=>!["dashboard","reports"].includes(n[0])).map(n=>n[0]);}
function esc(v=""){return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(v){return new Intl.NumberFormat("en-PK",{style:"currency",currency:"PKR",maximumFractionDigits:0}).format(Number(v)||0);}
function dateText(v){if(!v)return "—";const d=new Date(v+"T00:00:00");return isNaN(d)?esc(v):d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}
function dateToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function toast(message,type="success"){const el=document.createElement("div");el.className=`toast ${type==="error"?"error":type==="success"?"success":""}`;el.textContent=message;$("toastRoot").append(el);setTimeout(()=>el.remove(),4200);}
function setBusy(value){state.busy=value;["authSubmit","googleSignIn","saveRecordBtn"].forEach(id=>{const el=$(id);if(el)el.disabled=value;});}
function initials(name="N"){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"N";}
function profileRef(){return doc(db,"users",state.user.uid);}
function recordsRef(){return collection(db,"users",state.user.uid,"records");}
function prefsRef(){return doc(db,"users",state.user.uid,"settings","preferences");}
function friendlyError(error){
  const map={
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/wrong-password":"Email or password is incorrect.",
    "auth/user-not-found":"No account found with this email.",
    "auth/email-already-in-use":"An account already exists for this email. Try signing in.",
    "auth/weak-password":"Choose a password with at least 6 characters.",
    "auth/invalid-email":"Enter a valid email address.",
    "auth/popup-closed-by-user":"Google sign-in was closed before completion.",
    "auth/popup-blocked":"Your browser blocked the Google sign-in popup. Allow popups and try again.",
    "auth/unauthorized-domain":"Add this website's domain in Firebase Authentication → Settings → Authorized domains.",
    "auth/network-request-failed":"Network error. Check your internet connection and try again.",
    "permission-denied":"Firestore denied this action. Check that the latest Firestore rules are published.",
    "unavailable":"Firebase is temporarily unavailable. Try again."
  };
  return map[error?.code] || error?.message || "Something went wrong. Please try again.";
}

let authMode="login";
function setAuthMode(mode){
  authMode=mode;
  const register=mode==="register";
  $("authTitle").textContent=register?"Create your account":"Welcome back";
  $("authSubtitle").textContent=register?"Start organizing your business with NEXORA.":"Sign in to continue to your workspace.";
  $("nameField").classList.toggle("hidden",!register);
  $("authName").required=register;
  $("authPassword").autocomplete=register?"new-password":"current-password";
  $("authSubmit").textContent=register?"Create account":"Sign in";
  $("authSwitchText").textContent=register?"Already have an account?":"New to NEXORA?";
  $("authSwitch").textContent=register?"Sign in":"Create account";
  $("forgotPassword").classList.toggle("hidden",register);
}
$("authSwitch").addEventListener("click",()=>setAuthMode(authMode==="login"?"register":"login"));
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();if(state.busy)return;
  const email=$("authEmail").value.trim(),password=$("authPassword").value;
  setBusy(true);
  try{
    if(authMode==="register"){
      const name=$("authName").value.trim();
      const credential=await createUserWithEmailAndPassword(auth,email,password);
      if(name)await updateProfile(credential.user,{displayName:name});
      await setDoc(doc(db,"users",credential.user.uid),{
        uid:credential.user.uid,name:name||"NEXORA User",email:credential.user.email,
        role:"user",plan:"free",createdAt:serverTimestamp(),updatedAt:serverTimestamp()
      });
      toast("Account created successfully.");
    }else{
      await signInWithEmailAndPassword(auth,email,password);
    }
  }catch(err){toast(friendlyError(err),"error");}
  finally{setBusy(false);}
});
$("googleSignIn").addEventListener("click",async()=>{
  if(state.busy)return;setBusy(true);
  try{await signInWithPopup(auth,googleProvider);toast("Google sign-in successful.");}
  catch(err){toast(friendlyError(err),"error");}
  finally{setBusy(false);}
});
$("forgotPassword").addEventListener("click",async()=>{
  const email=$("authEmail").value.trim();
  if(!email){toast("Enter your email address first.","error");$("authEmail").focus();return;}
  try{await sendPasswordResetEmail(auth,email);toast("Password reset email sent. Check your inbox.");}
  catch(err){toast(friendlyError(err),"error");}
});
$("signOutBtn").addEventListener("click",async()=>{try{await signOut(auth);}catch(err){toast(friendlyError(err),"error");}});
$("categorySelect").addEventListener("change",async e=>{
  state.category=e.target.value;state.page="dashboard";state.search="";state.filter="all";
  applyTheme();renderNavigation();await savePreferences();await loadRecords();renderPage();closeSidebar();
});
$("settingsNav").addEventListener("click",()=>{state.page="settings";setActiveNav("settings");renderPage();closeSidebar();});
$("refreshBtn").addEventListener("click",async()=>{await loadRecords();renderPage();toast("Workspace refreshed.");});
$("openSidebar").addEventListener("click",openSidebar);
$("closeSidebar").addEventListener("click",closeSidebar);
$("sidebarScrim").addEventListener("click",closeSidebar);
function openSidebar(){$("sidebar").classList.add("sidebar-open");$("sidebarScrim").classList.add("visible");}
function closeSidebar(){$("sidebar").classList.remove("sidebar-open");$("sidebarScrim").classList.remove("visible");}
function applyTheme(){
  document.body.dataset.category=state.category;
  const c=category();
  $("categorySelect").value=state.category;
  $("categoryBadgeIcon").textContent=c.icon;$("categoryBadgeName").textContent=c.name;
  $("topCategoryTag").textContent=c.name;
  document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.body).getPropertyValue("--accent").trim()||"#5b5ce2";
}
function renderNavigation(){
  const nav=category().nav.map(([key,label,icon])=>`<button class="nav-item ${state.page===key?"active":""}" data-nav="${esc(key)}"><span class="nav-icon">${esc(icon)}</span><span>${esc(label)}</span></button>`).join("");
  $("mainNav").innerHTML=nav;
  $("mainNav").querySelectorAll("[data-nav]").forEach(btn=>btn.addEventListener("click",()=>{
    state.page=btn.dataset.nav;state.search="";state.filter="all";setActiveNav(state.page);renderPage();closeSidebar();
  }));
}
function setActiveNav(key){
  $("mainNav").querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===key));
}
async function savePreferences(){
  if(!state.user)return;
  try{await setDoc(prefsRef(),{category:state.category,updatedAt:serverTimestamp()},{merge:true});}
  catch(err){toast(friendlyError(err),"error");}
}
async function loadUser(user){
  state.user=user;
  const ref=profileRef();
  const snap=await getDoc(ref);
  const data=snap.exists()?snap.data():{};
  state.profile={...data,name:data.name||user.displayName||"NEXORA User",email:user.email||data.email||""};
  if(!snap.exists()){
    await setDoc(ref,{uid:user.uid,name:state.profile.name,email:state.profile.email,role:"user",plan:"free",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  }else if(!data.name||!data.email){
    await setDoc(ref,{name:state.profile.name,email:state.profile.email,updatedAt:serverTimestamp()},{merge:true});
  }
  const prefs=await getDoc(prefsRef());
  const savedCategory=prefs.exists()?prefs.data().category:"general";
  state.category=CATEGORIES[savedCategory]?savedCategory:"general";
  $("sidebarUserName").textContent=state.profile.name;
  $("sidebarUserEmail").textContent=state.profile.email;
  $("topUserName").textContent=state.profile.name;
  $("userAvatar").textContent=initials(state.profile.name);
  $("topAvatar").textContent=initials(state.profile.name);
  $("authScreen").classList.add("hidden");$("appShell").classList.remove("hidden");
  applyTheme();renderNavigation();
  await loadRecords();renderPage();
}
onAuthStateChanged(auth,async user=>{
  if(!user){
    state.user=null;state.records=[];state.profile={};
    $("appShell").classList.add("hidden");$("authScreen").classList.remove("hidden");
    return;
  }
  try{await loadUser(user);}
  catch(err){toast(friendlyError(err),"error");}
});

async function loadRecords(){
  if(!state.user)return;
  try{
    const q=query(recordsRef(),orderBy("updatedAt","desc"));
    const snap=await getDocs(q);
    state.records=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch(err){
    // A fresh database may have no ordered index/data yet; try a plain collection read.
    try{
      const snap=await getDocs(recordsRef());
      state.records=snap.docs.map(d=>({id:d.id,...d.data()}));
    }catch(second){toast(friendlyError(second),"error");state.records=[];}
  }
}
function recordsFor(key){return state.records.filter(r=>r.category===state.category&&r.module===key);}
function allCategoryRecords(){return state.records.filter(r=>r.category===state.category);}
function getField(record,key){return record?.data?.[key]??"";}
function statusClass(value=""){
  const s=String(value).toLowerCase().replace(/\s+/g,"-");
  return ["pending","draft","cancelled","overdue","in-progress","active"].includes(s)?s:"";
}
function statusBadge(value){
  if(!value)return "";
  return `<span class="status-pill ${statusClass(value)}">${esc(value)}</span>`;
}
function moneyField(key){return /amount|price|cost|budget|commission|fee/i.test(key);}
function recordDisplay(record){
  const meta=moduleMeta(record.module),data=record.data||{};
  return data.name||data.title||meta.title;
}
function recordDate(record){
  const d=record.data||{};
  return d.date||d.dueDate||d.startDate||d.createdDate||"";
}
function renderPage(){
  if(!state.user)return;
  const p=state.page,c=category();
  const meta=moduleMeta(p);
  $("pageTitle").textContent=p==="dashboard"?"Overview":p==="settings"?"Settings":p==="reports"?"Reports":meta.title;
  $("breadcrumb").textContent=`${c.name} / ${$("pageTitle").textContent}`;
  if(p==="dashboard")renderDashboard();
  else if(p==="reports")renderReports();
  else if(p==="settings")renderSettings();
  else renderModule(p);
}
function pageHeading(title,desc,buttonText="",buttonAction="add"){
  return `<div class="page-heading"><div><h2>${esc(title)}</h2><p>${esc(desc)}</p></div><div class="heading-actions">${buttonText?`<button class="btn btn-primary" data-action="${esc(buttonAction)}">＋ ${esc(buttonText)}</button>`:""}</div></div>`;
}
function statCard(label,value,icon,foot="In your current category"){
  return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon">${esc(icon)}</span></div><div class="stat-value">${esc(value)}</div><div class="stat-foot">${esc(foot)}</div></article>`;
}
function renderDashboard(){
  const c=category(),items=allCategoryRecords();
  const completed=items.filter(r=>/completed|paid|delivered|closed|harvested|sold|served/i.test(String(r.data?.status||r.data?.paymentStatus||""))).length;
  const open=items.length-completed;
  const totalValue=items.reduce((sum,r)=>sum+Number(r.data?.amount||r.data?.price||r.data?.budget||r.data?.fee||0),0);
  const stockModule=["retail","restaurant","manufacturing","agriculture"].includes(state.category);
  const stock=items.filter(r=>/products|inventory|materials/i.test(r.module)).reduce((sum,r)=>sum+Number(r.data?.quantity||0),0);
  const cards=stockModule?[
    statCard("Total records",items.length,"▦"),
    statCard("Stock quantity",stock.toLocaleString("en-PK"),"▣"),
    statCard("Completed",completed,"✓"),
    statCard("Recorded value",money(totalValue),"↗","From amounts entered")
  ]:[
    statCard("Total records",items.length,"▦"),
    statCard("Open / active",open,"◷"),
    statCard("Completed",completed,"✓"),
    statCard("Recorded value",money(totalValue),"↗","From amounts entered")
  ];
  $("pageContent").innerHTML=`
    <section class="welcome-banner"><div><span class="eyebrow">${esc(c.name.toUpperCase())}</span><h2>Good to see you, ${esc((state.profile.name||"there").split(" ")[0])}.</h2><p>${esc(c.description)} Your workspace is ready. Add your first record or review your latest activity.</p></div><div class="welcome-decoration">${esc(c.icon)}</div></section>
    <div class="stats-grid">${cards.join("")}</div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h3>Workspace activity</h3><p>Records created over the last 7 days</p></div><button class="panel-action" data-page="reports">View reports ↗</button></div><div class="chart-wrap"><canvas id="activityChart" aria-label="Records created in the last seven days"></canvas></div></section>
      <section class="panel"><div class="panel-header"><div><h3>Quick actions</h3><p>Jump into your daily workflow</p></div></div><div class="shortcut-list">${c.nav.filter(n=>n[0]!=="dashboard"&&n[0]!=="reports").slice(0,4).map(([key,label,icon])=>`<button class="shortcut" data-shortcut="${esc(key)}"><span class="shortcut-icon">${esc(icon)}</span><strong>${esc(label)}</strong><small>Open ${esc(label.toLowerCase())}</small></button>`).join("")}</div></section>
      <section class="panel"><div class="panel-header"><div><h3>Recent records</h3><p>Your latest updates in this category</p></div></div><div class="activity-list">${items.slice(0,5).map(r=>`<div class="activity-item"><span class="activity-dot">${esc(moduleMeta(r.module).icon)}</span><div class="activity-copy"><strong>${esc(recordDisplay(r))}</strong><small>${esc(moduleMeta(r.module).title)}${r.data?.status?" · "+esc(r.data.status):""}</small></div><span class="activity-time">${dateText(recordDate(r))}</span></div>`).join("")||`<div class="empty-state"><div class="empty-icon">＋</div><h3>Your workspace starts here</h3><p>Add your first ${esc(c.name.toLowerCase())} record to see activity here.</p><button class="btn btn-primary" data-action="add-first">Add first record</button></div>`}</div></section>
      <section class="panel"><div class="panel-header"><div><h3>By module</h3><p>Records saved in each section</p></div></div><div class="activity-list">${c.nav.filter(n=>!["dashboard","reports"].includes(n[0])).map(([key,label,icon])=>`<div class="activity-item"><span class="activity-dot">${esc(icon)}</span><div class="activity-copy"><strong>${esc(label)}</strong><small>${recordsFor(key).length} record${recordsFor(key).length===1?"":"s"}</small></div><button class="panel-action" data-shortcut="${esc(key)}">Open →</button></div>`).join("")}</div></section>
    </div>`;
  $("pageContent").querySelectorAll("[data-shortcut]").forEach(b=>b.addEventListener("click",()=>{state.page=b.dataset.shortcut;setActiveNav(state.page);renderPage();}));
  $("pageContent").querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{state.page=b.dataset.page;setActiveNav(state.page);renderPage();}));
  $("pageContent").querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>openRecordDialog(moduleKeys()[0])));
  drawActivityChart();
}
function drawActivityChart(){
  const canvas=$("activityChart");if(!canvas)return;
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=window.devicePixelRatio||1;canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;
  const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
  const w=rect.width,h=rect.height,pad={l:27,r:10,t:14,b:28};
  const now=new Date(),days=[];
  for(let i=6;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);days.push(d);}
  const counts=days.map(d=>state.records.filter(r=>r.category===state.category&&r.createdAt?.toDate&&sameDate(r.createdAt.toDate(),d)).length);
  const max=Math.max(4,...counts),plotH=h-pad.t-pad.b,plotW=w-pad.l-pad.r;
  ctx.font="10px DM Sans, sans-serif";ctx.lineWidth=1;ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--line");
  for(let i=0;i<4;i++){const y=pad.t+plotH*i/3;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}
  const accent=getComputedStyle(document.body).getPropertyValue("--accent").trim();
  const step=plotW/7,bw=Math.min(25,step*.48);
  counts.forEach((v,i)=>{
    const bh=(v/max)*plotH*.88,x=pad.l+step*i+(step-bw)/2,y=pad.t+plotH-bh;
    ctx.fillStyle=accent;roundRect(ctx,x,y,bw,Math.max(3,bh),5);ctx.fill();
    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue("--muted");
    ctx.textAlign="center";ctx.fillText(days[i].toLocaleDateString("en",{weekday:"short"}),x+bw/2,h-8);
  });
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function sameDate(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
window.addEventListener("resize",()=>{if(state.page==="dashboard")drawActivityChart();});

function renderModule(key){
  const meta=moduleMeta(key),rows=recordsFor(key);
  const filtered=rows.filter(r=>{
    const data=r.data||"",haystack=JSON.stringify(data).toLowerCase();
    const searchMatch=!state.search||haystack.includes(state.search.toLowerCase());
    const status=String(data.status||data.paymentStatus||"").toLowerCase();
    const filterMatch=state.filter==="all"||status===state.filter.toLowerCase();
    return searchMatch&&filterMatch;
  });
  const statuses=[...new Set(rows.map(r=>r.data?.status||r.data?.paymentStatus).filter(Boolean))];
  $("pageContent").innerHTML=`
    ${pageHeading(meta.title,meta.desc,`Add ${meta.singular.toLowerCase()}`)}
    <div class="toolbar"><input id="recordSearch" class="filter-input" placeholder="Search ${esc(meta.title.toLowerCase())}…" value="${esc(state.search)}" aria-label="Search records"><select id="statusFilter" aria-label="Filter by status"><option value="all">All statuses</option>${statuses.map(s=>`<option value="${esc(s)}" ${state.filter===s?"selected":""}>${esc(s)}</option>`).join("")}</select><button id="exportCsvBtn" class="btn btn-soft">↓ Export CSV</button><span class="record-count">${filtered.length} record${filtered.length===1?"":"s"}</span></div>
    ${filtered.length?`<section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Name / reference</th>${meta.fields.filter(f=>f[0]!=="name"&&f[0]!=="notes").slice(0,4).map(f=>`<th>${esc(f[1])}</th>`).join("")}<th>Updated</th><th>Actions</th></tr></thead><tbody>${filtered.map(r=>renderTableRow(r,meta)).join("")}</tbody></table></div></section>`:`<div class="empty-state"><div class="empty-icon">${esc(meta.icon)}</div><h3>${state.search?"No matching records":"No records yet"}</h3><p>${state.search?"Try a different search term or filter.":`Add your first ${meta.singular.toLowerCase()} to start building your ${meta.title.toLowerCase()} records.`}</p><button class="btn btn-primary" data-action="add">＋ Add ${esc(meta.singular.toLowerCase())}</button></div>`}`;
  $("pageContent").querySelectorAll("[data-action='add']").forEach(b=>b.addEventListener("click",()=>openRecordDialog(key)));
  $("pageContent").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>openRecordDialog(key,b.dataset.edit)));
  $("pageContent").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>confirmDelete(b.dataset.delete,key)));
  $("pageContent").querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",()=>{state.filter=b.value;renderPage();}));
  $("pageContent").querySelector("#recordSearch")?.addEventListener("input",e=>{state.search=e.target.value;const pos=e.target.selectionStart;renderModule(key);const input=$("recordSearch");input.focus();input.setSelectionRange(pos,pos);});
  $("pageContent").querySelector("#statusFilter")?.addEventListener("change",e=>{state.filter=e.target.value;renderPage();});
  $("pageContent").querySelector("#exportCsvBtn")?.addEventListener("click",()=>exportCsv(key,filtered));
}
function renderTableRow(r,meta){
  const data=r.data||{};
  const fields=meta.fields.filter(f=>f[0]!=="name"&&f[0]!=="notes").slice(0,4);
  return `<tr><td><span class="table-primary">${esc(recordDisplay(r))}</span><span class="table-secondary">${esc(r.category===state.category?meta.title:"")}</span></td>${fields.map(f=>{
    let val=data[f[0]]??"";
    if(!val)return "<td>—</td>";
    if(f[0]==="status"||f[0]==="paymentStatus")return `<td>${statusBadge(val)}</td>`;
    if(moneyField(f[0]))val=money(val);
    else if(/date/i.test(f[0]))val=dateText(val);
    return `<td>${esc(val)}</td>`;
  }).join("")}<td>${r.updatedAt?.toDate?esc(r.updatedAt.toDate().toLocaleDateString()):"—"}</td><td><div class="table-actions"><button class="small-action" data-edit="${esc(r.id)}">Edit</button><button class="small-action delete" data-delete="${esc(r.id)}">Delete</button></div></td></tr>`;
}
function openRecordDialog(key,id=null){
  const meta=moduleMeta(key),existing=id?state.records.find(r=>r.id===id):null;
  state.activeModule=key;state.editingId=id;
  $("dialogEyebrow").textContent=category().name.toUpperCase();
  $("dialogTitle").textContent=existing?`Edit ${meta.singular.toLowerCase()}`:`Add ${meta.singular.toLowerCase()}`;
  $("saveRecordBtn").textContent=existing?"Save changes":"Save record";
  $("recordFields").innerHTML=meta.fields.map(f=>{
    const [name,label,type,extra]=f,value=existing?.data?.[name]??(type==="date"&&name==="date"?dateToday():"");
    const required=extra==="required"?"required":"";
    let input="";
    if(type==="select"){
      const options=(extra||"").split("|").filter(Boolean);
      input=`<select id="field_${esc(name)}" name="${esc(name)}" ${required}><option value="">Select…</option>${options.map(o=>`<option value="${esc(o)}" ${String(value)===o?"selected":""}>${esc(o)}</option>`).join("")}</select>`;
    }else if(type==="textarea"){
      input=`<textarea id="field_${esc(name)}" name="${esc(name)}" placeholder="Enter ${esc(label.toLowerCase())}…">${esc(value)}</textarea>`;
    }else{
      input=`<input id="field_${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${required} ${type==="number"?'min="0" step="any"':""} placeholder="${type==="date"||type==="time"?"":`Enter ${esc(label.toLowerCase())}…`}">`;
    }
    return `<div class="field ${type==="textarea"?"full-span":""}"><label for="field_${esc(name)}">${esc(label)}${required?" *":""}</label>${input}</div>`;
  }).join("");
  const dialog=$("recordDialog");
  if(!dialog.open)dialog.showModal();
}
$("closeDialog").addEventListener("click",()=>$("recordDialog").close());
$("cancelDialog").addEventListener("click",()=>$("recordDialog").close());
$("recordForm").addEventListener("submit",async e=>{
  e.preventDefault();if(state.busy)return;
  const key=state.activeModule,meta=moduleMeta(key),data={};
  for(const f of meta.fields){
    const el=$(`field_${f[0]}`);
    if(!el)continue;
    const raw=el.value.trim();
    if(f[2]==="number")data[f[0]]=raw===""?0:Number(raw);
    else data[f[0]]=raw;
  }
  if(!data.name){toast(`${meta.singular} name is required.`,"error");return;}
  setBusy(true);
  try{
    const payload={uid:state.user.uid,category:state.category,module:key,data,updatedAt:serverTimestamp()};
    if(state.editingId){
      await updateDoc(doc(db,"users",state.user.uid,"records",state.editingId),payload);
      toast(`${meta.singular} updated.`);
    }else{
      payload.createdAt=serverTimestamp();
      await addDoc(recordsRef(),payload);
      toast(`${meta.singular} added.`);
    }
    $("recordDialog").close();await loadRecords();renderPage();
  }catch(err){toast(friendlyError(err),"error");}
  finally{setBusy(false);}
});
async function confirmDelete(id,key){
  const meta=moduleMeta(key);
  $("confirmTitle").textContent=`Delete ${meta.singular.toLowerCase()}?`;
  $("confirmMessage").textContent="This record will be permanently deleted. This action cannot be undone.";
  const dlg=$("confirmDialog");
  dlg.showModal();
  const action=$("confirmAction");
  action.onclick=async e=>{
    e.preventDefault();if(state.busy)return;setBusy(true);
    try{
      await deleteDoc(doc(db,"users",state.user.uid,"records",id));
      dlg.close();toast(`${meta.singular} deleted.`);await loadRecords();renderPage();
    }catch(err){toast(friendlyError(err),"error");}
    finally{setBusy(false);}
  };
}
function exportCsv(key,rows){
  const meta=moduleMeta(key),fields=meta.fields;
  const values=[fields.map(f=>f[1]),...rows.map(r=>fields.map(f=>r.data?.[f[0]]??""))];
  const csv=values.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`nexora-${key}-${dateToday()}.csv`;a.click();URL.revokeObjectURL(url);
  toast("CSV export prepared.");
}
function renderReports(){
  const items=allCategoryRecords(),c=category();
  const byModule=c.nav.filter(n=>!["dashboard","reports"].includes(n[0])).map(([key,label,icon])=>({key,label,icon,count:recordsFor(key).length}));
  const totalAmount=items.reduce((s,r)=>s+Number(r.data?.amount||r.data?.price||r.data?.budget||r.data?.fee||0),0);
  const paid=items.filter(r=>/paid|completed|delivered|closed|sold|harvested/i.test(String(r.data?.status||r.data?.paymentStatus||""))).length;
  $("pageContent").innerHTML=`${pageHeading("Reports","A summary of records saved in your current category.")}<div class="stats-grid">${statCard("Total records",items.length,"▦")}${statCard("Modules used",byModule.filter(x=>x.count).length,"◫")}${statCard("Completed / paid",paid,"✓")}${statCard("Total recorded value",money(totalAmount),"↗","Sum of entered amounts")}</div><section class="panel"><div class="panel-header"><div><h3>Records by module</h3><p>Export individual modules as CSV from their own pages.</p></div></div><div class="activity-list">${byModule.map(m=>`<div class="activity-item"><span class="activity-dot">${esc(m.icon)}</span><div class="activity-copy"><strong>${esc(m.label)}</strong><small>${m.count} record${m.count===1?"":"s"}</small></div><button class="panel-action" data-report-module="${esc(m.key)}">Open →</button></div>`).join("")}</div><div class="notice">These reports summarize the records entered in NEXORA. They are not audited financial statements and do not automatically calculate taxes or reconcile external payments.</div></section>`;
  $("pageContent").querySelectorAll("[data-report-module]").forEach(b=>b.addEventListener("click",()=>{state.page=b.dataset.reportModule;setActiveNav(state.page);renderPage();}));
}
function renderSettings(){
  const c=category();
  $("pageContent").innerHTML=`${pageHeading("Settings","Manage your profile and workspace preferences.")}<div class="settings-grid"><section class="panel"><h3>Account profile</h3><p>Your account information from Firebase Authentication.</p><div class="settings-row"><div><strong>Full name</strong><small>${esc(state.profile.name||"Not set")}</small></div></div><div class="settings-row"><div><strong>Email address</strong><small>${esc(state.profile.email||"Not set")}</small></div></div><div class="settings-row"><div><strong>Sign-in provider</strong><small>${state.user?.providerData?.map(p=>p.providerId==="google.com"?"Google":p.providerId==="password"?"Email and password":p.providerId).join(", ")||"Firebase Authentication"}</small></div></div><div class="settings-row"><div><strong>App version</strong><small>NEXORA v${VERSION}</small></div></div></section><section class="panel"><h3>Workspace appearance</h3><p>Choose a business category to change the theme, navigation and forms.</p><div class="field"><label for="settingsCategory">Business category</label><select id="settingsCategory">${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${esc(k)}" ${k===state.category?"selected":""}>${esc(v.name)}</option>`).join("")}</select></div><div class="notice">Each category has its own accent colour and its own set of relevant modules. Your records remain separated by category.</div><button id="settingsSave" class="btn btn-primary">Save preferences</button></section><section class="panel"><h3>Your data</h3><p>Export records in a category for your own backup or spreadsheet workflow.</p><div class="settings-row"><div><strong>Export category data</strong><small>Download all category records as JSON.</small></div><button id="backupBtn" class="btn btn-soft">Export JSON</button></div><div class="settings-row"><div><strong>Refresh records</strong><small>Reload the latest saved data from Firestore.</small></div><button id="settingsRefresh" class="btn btn-soft">Refresh</button></div></section><section class="panel"><h3>Security & privacy</h3><p>Your data is stored under your Firebase user account.</p><div class="notice">Never share your password or private account credentials. Firebase security rules must be published before using this app with real business data.</div><button id="settingsSignOut" class="btn btn-soft">Sign out</button></section></div>`;
  $("pageContent").querySelector("#settingsSave").addEventListener("click",async()=>{
    const value=$("settingsCategory").value;
    state.category=CATEGORIES[value]?value:"general";state.page="dashboard";state.search="";state.filter="all";
    applyTheme();renderNavigation();await savePreferences();renderPage();toast("Workspace preferences saved.");
  });
  $("pageContent").querySelector("#backupBtn").addEventListener("click",()=>{
    const data={app:"NEXORA",version:VERSION,category:state.category,exportedAt:new Date().toISOString(),records:allCategoryRecords()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`nexora-${state.category}-backup-${dateToday()}.json`;a.click();URL.revokeObjectURL(url);toast("JSON backup prepared.");
  });
  $("pageContent").querySelector("#settingsRefresh").addEventListener("click",async()=>{await loadRecords();renderPage();toast("Records refreshed.");});
  $("pageContent").querySelector("#settingsSignOut").addEventListener("click",()=>signOut(auth));
}
