console.log("app.js loaded");

// =========================
// Owura-Ent POS - app.js
// =========================

// ===== Global State =====
let currentUser = null;
let cart = [];
let database = {
  products: [],
  sales: [],
  debtors: [],
  payments: [],
  admins: [
    { username: "admin", password: "admin123", role: "Super Admin", date: new Date().toLocaleString() }
  ]
};

// ⭐️ Helper function to generate SKU based on category
function generateSKU(category) {
  const prefix = category.slice(0, 3).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}

// ===== Bootstrapping / Initialization =====
document.addEventListener("DOMContentLoaded", () => {
  // Try load saved data
  loadDatabase();

  // If first time, ensure defaults exist
  if (!database || !database.admins || database.admins.length === 0) {
    database.admins = [
      { username: "admin", password: "admin123", role: "Super Admin", date: new Date().toLocaleString() }
    ];
    saveDatabase();
  }

  // Render static sections from DB
  renderInventory();
  renderSales();
  renderDebtors();
  renderReports();
  // renderAdmins(); // Removed since admin table body is not in HTML
  updateDatabaseStats();
  updateProductDropdown(); 
  
  // Initial setup for POS payment
  const paymentTypeEl = document.getElementById("paymentType");
  if(paymentTypeEl) paymentTypeEl.addEventListener("change", toggleCashAmountField);
  toggleCashAmountField(); // Initial call to set visibility
});


// ===== Login / Logout =====
function login() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  const admin = database.admins.find(a => a.username === username && a.password === password);
  if (!admin) {
    alert("Invalid credentials. Try admin / admin123");
    return;
  }

  currentUser = username;
  document.getElementById("currentUser").innerText = `👤 ${username}`;
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");

  renderInventory();
  renderSales();
  renderDebtors();
  renderReports();
  updateDatabaseStats();
}

function logout() {
  currentUser = null;
  document.getElementById("mainApp").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
}

// ===== Navigation =====
function showSection(id, ev) {
  document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  if (ev && ev.target) {
    ev.target.classList.add("active");
  }

  // Rerender reports/inventory/sales when entering the section
  if(id === 'inventory') renderInventory();
  if(id === 'sales') renderSales();
  if(id === 'debtors') renderDebtors();
  if(id === 'reports') renderReports();
}

// ===================================
// ===== Inventory Management (FIXED) =====
// ===================================

function showAddProductModal() {
  document.getElementById("productModalTitle").innerText = "Add New Product";
  
  // Clear all fields for new product
  document.getElementById("productName").value = "";
  document.getElementById("productCategory").value = "";
  document.getElementById("costPrice").value = "";
  document.getElementById("sellingPrice").value = "";
  document.getElementById("stockQuantity").value = ""; // Uses stockQuantity
  document.getElementById("stockLimit").value = ""; // Uses stockLimit
  
  // Set button for adding new product
  const saveBtn = document.querySelector("#productModal .btn-primary");
  saveBtn.innerText = "Add Product";
  saveBtn.onclick = saveProduct;
  
  openModal("productModal");
}

function saveProduct() {
  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("productCategory").value.trim(); // New field
  const cost = parseFloat(document.getElementById("costPrice").value);
  const sell = parseFloat(document.getElementById("sellingPrice").value);
  const stock = parseInt(document.getElementById("stockQuantity").value, 10); // Uses stockQuantity
  const limit = parseInt(document.getElementById("stockLimit").value, 10); // New field

  // Comprehensive Validation
  if (!name || !category || isNaN(sell) || isNaN(cost) || isNaN(stock) || isNaN(limit)) {
    alert("Please fill all product fields correctly.");
    return;
  }
  if (cost < 0 || sell < 0 || stock < 0 || limit < 0) { 
    alert("Values cannot be negative.");
    return;
  }

  const id = Date.now();
  const sku = generateSKU(category); // Generate SKU

  database.products.push({ id, sku, name, category, cost, sell, stock, limit });
  
  saveDatabase();
  renderInventory();
  closeModal("productModal");
  updateProductDropdown();
  updateDatabaseStats();
}

function editProduct(id) {
  const product = database.products.find(p => p.id == id);
  if (!product) return;

  document.getElementById("productModalTitle").innerText = "Edit Product: " + product.name;
  
  // Populate all 7 fields
  document.getElementById("productName").value = product.name;
  document.getElementById("productCategory").value = product.category || "";
  document.getElementById("costPrice").value = product.cost;
  document.getElementById("sellingPrice").value = product.sell;
  document.getElementById("stockQuantity").value = product.stock;
  document.getElementById("stockLimit").value = product.limit || 0;
  
  // Set button for saving changes
  const saveBtn = document.querySelector("#productModal .btn-primary");
  saveBtn.innerText = "Save Changes";
  openModal("productModal");

  // Override saveProduct for edit mode
  saveBtn.onclick = function () {
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value.trim();
    const cost = parseFloat(document.getElementById("costPrice").value);
    const sell = parseFloat(document.getElementById("sellingPrice").value);
    const stock = parseInt(document.getElementById("stockQuantity").value, 10);
    const limit = parseInt(document.getElementById("stockLimit").value, 10);

    if (!name || !category || isNaN(cost) || isNaN(sell) || isNaN(stock) || isNaN(limit)) {
      alert("Please fill all product fields correctly.");
      return;
    }
    
    // Update product properties
    product.name = name;
    product.category = category;
    product.cost = cost;
    product.sell = sell;
    product.stock = stock;
    product.limit = limit;
    // SKU is not re-generated on edit, but should be updated if category changes (simple implementation skips this)

    saveDatabase();
    renderInventory();
    closeModal("productModal");
    updateProductDropdown();
    updateDatabaseStats();
    
    // Restore original function for next time showAddProductModal is called
    saveBtn.onclick = saveProduct; 
  };
}

function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  database.products = database.products.filter(p => p.id !== id);
  saveDatabase();
  renderInventory();
  updateProductDropdown();
  updateDatabaseStats();
}

function renderInventory(data = database.products) {
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  data.forEach((p) => {
    let statusBadge;
    const stockLimit = p.limit || 0;

    // Stock Status Logic (Out of Stock, Low Stock, Available)
    if (p.stock === 0) {
      statusBadge = `<span class="badge badge-danger">Out of Stock</span>`;
    } else if (p.stock <= stockLimit) { 
      statusBadge = `<span class="badge badge-warning">Low Stock</span>`;
    } else {
      statusBadge = `<span class="badge badge-success">Available</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.sku || 'N/A'}</td>
      <td>${p.name}</td>
      <td>${p.category || 'N/A'}</td>
      <td>GH₵ ${p.sell.toFixed(2)}</td>
      <td>GH₵ ${p.cost.toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${stockLimit}</td> 
      <td class="action-btns">
        ${statusBadge}
        <button class="btn btn-warning btn-sm" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterInventory() {
  const query = document.getElementById("inventorySearch").value.toLowerCase();
  const filtered = database.products.filter(p => 
    (p.name && p.name.toLowerCase().includes(query)) ||
    (p.sku && p.sku.toLowerCase().includes(query)) ||
    (p.category && p.category.toLowerCase().includes(query))
  );
  renderInventory(filtered);
}

// =================================
// ===== POS / Product Selection =====
// =================================

let allProducts = [];

function updateProductDropdown() {
  const select = document.getElementById("productSelect");
  if (!select) return;

  allProducts = database.products.slice(); // store full list
  renderProductOptions(allProducts);
}

function renderProductOptions(list) {
  const select = document.getElementById("productSelect");
  select.innerHTML = `<option value="">-- Select Product --</option>`;
  list.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.category || "Uncategorized"}) - Stock: ${p.stock}`;
    select.appendChild(opt);
  });
}

function filterProductDropdown() {
  const query = document.getElementById("productSearch").value.toLowerCase();
  const filtered = allProducts.filter(p =>
    p.name.toLowerCase().includes(query) ||
    (p.category && p.category.toLowerCase().includes(query))
  );
  renderProductOptions(filtered);
}


function updateProductInfo() {
  const id = document.getElementById("productSelect").value;
  const product = database.products.find(p => p.id == id);
  if (product) {
    document.getElementById("unitPrice").value = product.sell;
  } else {
    document.getElementById("unitPrice").value = "";
  }
}

// =========================
// ===== POS / Cart Logic =====
// =========================

function addToCart() {
  const id = document.getElementById("productSelect").value;
  const qty = parseInt(document.getElementById("quantity").value);
  const product = database.products.find(p => p.id == id);

  if (!product) {
    alert("Select a product.");
    return;
  }
  if (isNaN(qty) || qty < 1) {
    alert("Enter a valid quantity (min 1).");
    return;
  }
  if (qty > product.stock) {
    alert("Not enough stock for this item.");
    return;
  }

  const existing = cart.find(i => i.id == product.id);
  if (existing) {
    if (existing.qty + qty > product.stock) {
      alert("Adding this exceeds available stock.");
      return;
    }
    existing.qty += qty;
  } else {
    cart.push({ id: product.id, name: product.name, cost: product.cost, sell: product.sell, qty });
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById("cartItems");
  if (!container) return;
  container.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    total += item.qty * item.sell;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>${item.name} x${item.qty}</span>
      <span>GH₵ ${(item.qty * item.sell).toFixed(2)}</span>
      <div class="action-btns">
        <button class="btn btn-warning btn-sm" onclick="changeCartQty(${index}, -1)">-</button>
        <button class="btn btn-success btn-sm" onclick="changeCartQty(${index}, 1)">+</button>
        <button class="btn btn-danger btn-sm" onclick="removeCartItem(${index})">X</button>
      </div>
    `;
    container.appendChild(div);
  });

  document.getElementById("cartTotal").innerText = total.toFixed(2);
}

function changeCartQty(index, delta) {
  const item = cart[index];
  if (!item) return;

  const product = database.products.find(p => p.id === item.id);
  const newQty = item.qty + delta;

  if (newQty < 1) {
    if (confirm(`Remove ${item.name} from cart?`)) {
        removeCartItem(index);
    }
    return;
  } 
  if (newQty > product.stock) {
    alert("Exceeds available stock.");
    return;
  }
  item.qty = newQty;
  renderCart();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

// ===== Checkout & Payment =====
function toggleCashAmountField() {
  const type = document.getElementById("paymentType")?.value;
  const cashGroup = document.getElementById("cashAmountGroup");
  if (cashGroup) cashGroup.style.display = type === "cash" ? "block" : "none";
}

function processCheckout() {
  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  const customer = document.getElementById("customerName").value.trim() || "Walk-in";
  const phone = document.getElementById("customerPhone").value.trim() || "";
  const paymentType = document.getElementById("paymentType").value;
  const total = parseFloat(document.getElementById("cartTotal").innerText);
  const receipt = Date.now();

  let amountPaid = total;
  if (paymentType === "cash") {
    amountPaid = parseFloat(document.getElementById("cashAmount").value);
    if (isNaN(amountPaid) || amountPaid < total) {
      alert("Amount paid is less than total. Please confirm.");
      return;
    }
  }

  // Create payment record
  const paymentRecord = {
    reference: "PAY" + receipt,
    customer,
    phone,
    amount: amountPaid,
    date: new Date().toLocaleString(),
    method: paymentType,
    status: paymentType === "credit" ? "Pending" : "Paid"
  };

  // Record sale with embedded payment
  const sale = {
    receipt,
    date: new Date().toLocaleString(),
    customer,
    items: cart.map(i => ({ ...i })),
    total,
    payment: paymentType,
    payments: [paymentRecord]
  };
  database.sales.push(sale);

  // Record payment globally
  database.payments.push(paymentRecord);

  // Record debtor if credit
  if (paymentType === "credit") {
    database.debtors.push({
      customer,
      phone,
      amount: total,
      date: new Date().toLocaleString(),
      status: "Pending"
    });
  }

  // Deduct stock
  cart.forEach(item => {
    const prod = database.products.find(p => p.id === item.id);
    if (prod) prod.stock -= item.qty;
  });

  saveDatabase();
  renderInventory();
  renderSales();
  renderDebtors();
  renderReports();
  // renderPayments(); // Only uncomment if you add a payments section
  updateDatabaseStats();

  if (paymentType === "cash") {
    const change = amountPaid - total;
    alert(`Checkout successful! Receipt #${receipt}\nChange due: GH₵ ${change.toFixed(2)}`);
  } else {
    alert(`Checkout successful! Receipt #${receipt}`);
  }

  clearCart();
}

// ======================
// ===== Sales Logic =====
// ======================
function renderSales() {
  const tbody = document.getElementById("salesTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  database.sales
    .slice()
    .sort((a, b) => b.receipt - a.receipt)
    .forEach(s => {
      // Logic for status badge
      const isCredit = s.payment === "credit";
      // Determine overall status by checking if any payment is still 'Pending'
      const currentStatus = isCredit ? (s.payments.some(p => p.status === "Pending" || p.status === "Partial") ? "Pending" : "Paid") : "Paid";
      const statusClass = currentStatus === "Paid" ? "badge-success" : "badge-warning";
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.receipt}</td>
        <td>${s.date}</td>
        <td>${s.customer}</td>
        <td>${s.items.map(i => `${i.name} x${i.qty}`).join(", ")}</td>
        <td>GH₵ ${s.total.toFixed(2)}</td>
        <td>${s.payment === "credit" ? "Credit" : "Cash"}</td>
        <td>
          <span class="badge ${statusClass}">${currentStatus}</span>
        </td>
        <td class="action-btns">
          <button class="btn btn-info btn-sm" onclick="viewSale(${s.receipt})">View</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSale(${s.receipt})">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

function viewSale(receipt) {
  const sale = database.sales.find(s => s.receipt == receipt);
  if (!sale) return alert("Sale not found.");
  const detail = `
Receipt: ${sale.receipt}
Date: ${sale.date}
Customer: ${sale.customer}
Payment: ${sale.payment}
Items:
${sale.items.map(i => `- ${i.name} x${i.qty} @ GH₵ ${i.sell.toFixed(2)} = GH₵ ${(i.qty * i.sell).toFixed(2)}`).join("\n")}
Total: GH₵ ${sale.total.toFixed(2)}
  `;
  alert(detail);
}

function deleteSale(receipt) {
  if (!confirm("Delete this sale record? (Stock will NOT be restored)")) return;
  database.sales = database.sales.filter(s => s.receipt != receipt);
  saveDatabase();
  renderSales();
  renderReports();
  updateDatabaseStats();
}


// =========================
// ===== Debtors Logic =====
// =========================

function renderDebtors() {
  const tbody = document.getElementById("debtorsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let totalDebt = 0;

  database.debtors.forEach((d, index) => {
    // Only count active pending/partial debt
    if (d.amount > 0) {
      totalDebt += d.amount;
    }
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.customer}</td>
      <td>${d.phone}</td>
      <td>GH₵ ${d.amount.toFixed(2)}</td>
      <td>${d.date}</td>
      <td>
        <span class="debtor-badge ${d.status === "Paid" ? "badge-paid" : d.status === "Pending" || d.status === "Partial" ? "badge-pending" : "badge-overdue"}">
          ${d.status}
        </span>
      </td>
     <td class="action-btns">
  ${d.amount > 0 ? `
    <button class="btn btn-success btn-sm" onclick="markPaid(${d.receipt})">Mark Full Paid</button>
    <button class="btn btn-info btn-sm" onclick="recordPartPayment(${d.receipt})">Part Payment</button>
  ` : ""}
  <button class="btn btn-danger btn-sm" onclick="deleteDebtor(${d.receipt})">Delete Record</button>
</td>

    `;
    tbody.appendChild(tr);
  });

  // Stats cards
  const totalDebtorsEl = document.getElementById("totalDebtors");
  const totalDebtEl = document.getElementById("totalDebt");
  if (totalDebtorsEl) totalDebtorsEl.innerText = database.debtors.filter(d => d.amount > 0).length;
  if (totalDebtEl) totalDebtEl.innerText = totalDebt.toFixed(2);
}

function markPaid(receipt) {
  const debtor = database.debtors.find(d => d.receipt === receipt);
  if (!debtor || debtor.amount === 0) return;

  // Find the original sale record to link payment
  const sale = database.sales.find(s => s.receipt === receipt);
  
  // Record full payment
  const fullPayment = {
    reference: "PAY" + Date.now(),
    customer: debtor.customer,
    phone: debtor.phone,
    amount: debtor.amount,
    date: new Date().toLocaleString(),
    method: "credit-settlement",
    status: "Paid"
  };
  database.payments.push(fullPayment);

  // Update sale record's payment log (if sale exists)
  if (sale) sale.payments.push(fullPayment);

  debtor.status = "Paid";
  debtor.amount = 0;

  saveDatabase();
  renderDebtors();
  renderSales(); // Update sales table status
  updateDatabaseStats();
}

function recordPartPayment(receipt) {
  const debtor = database.debtors.find(d => d.receipt === receipt);
  if (!debtor || debtor.amount === 0) return;

  const amount = parseFloat(prompt(`Enter part payment for ${debtor.customer} (GH₵ ${debtor.amount.toFixed(2)} remaining):`));
  if (isNaN(amount) || amount <= 0) {
    alert("Invalid amount.");
    return;
  }
  if (amount > debtor.amount) {
    alert("Payment exceeds remaining debt.");
    return;
  }

  // Find the original sale record to link payment
  const sale = database.sales.find(s => s.receipt === receipt);

  // Record partial payment
  const partPayment = {
    reference: "PAY" + Date.now(),
    customer: debtor.customer,
    phone: debtor.phone,
    amount,
    date: new Date().toLocaleString(),
    method: "credit-part",
    status: "Partial"
  };
  database.payments.push(partPayment);
  
  // Update sale record's payment log (if sale exists)
  if (sale) sale.payments.push(partPayment);

  debtor.amount -= amount;
  if (debtor.amount <= 0) {
    debtor.status = "Paid";
    debtor.amount = 0;
  } else {
    debtor.status = "Partial";
  }

  saveDatabase();
  renderDebtors();
  renderSales(); // Update sales table status
  updateDatabaseStats();
}

function deleteDebtor(receipt) {
  if (!confirm("Delete this debtor record? (This does NOT cancel the sale)")) return;
  database.debtors = database.debtors.filter(d => d.receipt !== receipt);
  saveDatabase();
  renderDebtors();
  updateDatabaseStats();
}

// ==========================
// ===== Reports Logic =====
// ==========================
// ... (Your renderReports logic is largely correct and remains the same)
function renderReports() {
  // Cards
  const todaySalesEl = document.getElementById("todaySales");
  const monthSalesEl = document.getElementById("monthSales");
  const totalRevenueEl = document.getElementById("totalRevenue");
  const totalProfitEl = document.getElementById("totalProfit");

  let todaySales = 0, monthSales = 0, totalRevenue = 0, totalProfit = 0;
  const todayKey = new Date().toLocaleDateString();
  const currentMonth = new Date().getMonth();

  const productStats = {}; 

  database.sales.forEach(s => {
    const saleDate = new Date(s.date);
    totalRevenue += s.total;

    if (saleDate.toLocaleDateString() === todayKey) todaySales += s.total;
    if (saleDate.getMonth() === currentMonth) monthSales += s.total;

    s.items.forEach(item => {
      const revenue = item.qty * item.sell;
      const cost = item.qty * item.cost;
      const profit = revenue - cost;
      totalProfit += profit;

      if (!productStats[item.name]) {
        productStats[item.name] = { units: 0, revenue: 0, cost: 0, profit: 0 };
      }
      productStats[item.name].units += item.qty;
      productStats[item.name].revenue += revenue;
      productStats[item.name].cost += cost;
      productStats[item.name].profit += profit;
    });
  });

  if (todaySalesEl) todaySalesEl.innerText = totalRevenue.toFixed(2); // Should sum all sales for today
  if (monthSalesEl) monthSalesEl.innerText = monthSales.toFixed(2);
  if (totalRevenueEl) totalRevenueEl.innerText = totalRevenue.toFixed(2);
  if (totalProfitEl) totalProfitEl.innerText = totalProfit.toFixed(2);

  // Profit table
  const profitTbody = document.getElementById("profitTableBody");
  if (profitTbody) {
    profitTbody.innerHTML = "";
    Object.keys(productStats).forEach(name => {
      const p = productStats[name];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>${p.units}</td>
        <td>GH₵ ${p.revenue.toFixed(2)}</td>
        <td>GH₵ ${p.cost.toFixed(2)}</td>
        <td>GH₵ ${p.profit.toFixed(2)}</td>
      `;
      profitTbody.appendChild(tr);
    });
  }
// Prepare daily sales and profit data
const dailyStats = {};
database.sales.forEach(s => {
  const parsedDate = new Date(Date.parse(s.date));
  if (isNaN(parsedDate)) return; // skip invalid dates
  const key = parsedDate.toISOString().split("T")[0];

  if (!dailyStats[key]) dailyStats[key] = { sales: 0, profit: 0 };
  dailyStats[key].sales += s.total;

  s.items.forEach(i => {
    const revenue = i.qty * i.sell;
    const cost = i.qty * i.cost;
    dailyStats[key].profit += revenue - cost;
  });
});

// Build last 7 days
const labels = [];
const salesData = [];
const profitData = [];
const todayD = new Date();

for (let i = 6; i >= 0; i--) {
  const d = new Date(todayD);
  d.setDate(todayD.getDate() - i);
  const key = d.toISOString().split("T")[0];
  // Format date for chart labels
  const formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  labels.push(formattedDate);
  salesData.push(dailyStats[key]?.sales || 0);
  profitData.push(dailyStats[key]?.profit || 0);
}

// Render chart
const canvas = document.getElementById("dailySalesChart");
if (canvas) {
  const ctx = canvas.getContext("2d");
  if (window.dailySalesChart instanceof Chart) window.dailySalesChart.destroy();

  window.dailySalesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Sales (GH₵)",
          data: salesData,
          borderColor: "#667eea",
          backgroundColor: "rgba(102,126,234,0.2)",
          fill: false,
          tension: 0.4
        },
        {
          label: "Profit (GH₵)",
          data: profitData,
          borderColor: "#48bb78",
          backgroundColor: "rgba(72,187,120,0.2)",
          fill: false,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      animation: {
        duration: 1500,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: ctx => `GH₵ ${ctx.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Amount (GH₵)" }
        },
        x: {
          title: { display: true, text: "Date" }
        }
      }
    }
  });
}
}


// ===============================
// ===== Database & Persistence =====
// ===============================
function updateDatabaseStats() {
  const p = document.getElementById("dbProductCount");
  const s = document.getElementById("dbSalesCount");
  const d = document.getElementById("dbDebtorCount");
  const a = document.getElementById("dbAdminCount");
  const pay = document.getElementById("dbPaymentCount");

  if (p) p.innerText = database.products.length;
  if (s) s.innerText = database.sales.length;
  if (d) d.innerText = database.debtors.filter(debtor => debtor.amount > 0).length; // Only count active debtors
  if (a) a.innerText = database.admins.length;
  if (pay) pay.innerText = database.payments.length;
}

function saveDatabase() {
  localStorage.setItem("owuraPOS", JSON.stringify(database));
}

function loadDatabase() {
  try {
    const raw = localStorage.getItem("owuraPOS");
    if (raw) {
      const data = JSON.parse(raw);
      // Basic schema guard to handle potential missing keys
      database = {
        products: Array.isArray(data.products) ? data.products : [],
        sales: Array.isArray(data.sales) ? data.sales : [],
        debtors: Array.isArray(data.debtors) ? data.debtors : [],
        payments: Array.isArray(data.payments) ? data.payments : [],
        admins: Array.isArray(data.admins) ? data.admins : [
          { username: "admin", password: "admin123", role: "Super Admin", date: new Date().toLocaleString() }
        ]
      };
    }
  } catch (e) {
    console.warn("Failed to load database, using defaults.", e);
  }
}

function exportDatabase() {
  const dataStr = JSON.stringify(database, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "owuraPOS_backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importDatabase() {
  const fileInput = document.getElementById("importFile");
  const file = fileInput?.files?.[0];
  if (!file) {
    alert("Please select a JSON file to import.");
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      // Basic validation
      if (!data || !data.products || !data.sales || !data.debtors || !data.admins) {
        throw new Error("Invalid data format");
      }
      database = data;
      saveDatabase();
      // Re-render everything
      renderInventory();
      renderSales();
      renderDebtors();
      renderReports();
      updateDatabaseStats();
      alert("Database imported successfully!");
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm("⚠️ This will delete ALL data permanently. Continue?")) return;
  database = { 
    products: [], 
    sales: [], 
    debtors: [], 
    payments: [],
    admins: database.admins // Preserve admins
  };
  saveDatabase();
  renderInventory();
  renderSales();
  renderDebtors();
  renderReports();
  updateDatabaseStats();
  alert("All data cleared (admins preserved).");
}

// =======================
// ===== Modal Helpers =====
// =======================

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
  if (el) el.style.display = "block"; // Use style for modal if CSS class doesn't handle it
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
  if (el) el.style.display = "none";
}

// ========================
// ===== Admin Functions (Simplified) =====
// ========================

// (Admin functions were not the focus of this fix, but kept for completeness)
function showAddAdminModal() {
  const username = prompt("New admin username:");
  if (!username) return;
  const password = prompt("New admin password:");
  if (!password) return;
  const role = prompt("Role (e.g., Manager, Cashier):") || "Staff";

  if (database.admins.some(a => a.username === username)) {
    alert("Username already exists.");
    return;
  }
  database.admins.push({ username, password, role, date: new Date().toLocaleString() });
  saveDatabase();
  // renderAdmins(); 
  updateDatabaseStats();
}

function deleteAdmin(username) {
  if (!confirm("Delete this admin?")) return;
  database.admins = database.admins.filter(a => a.username !== username);
  saveDatabase();
  // renderAdmins();
  updateDatabaseStats();
}